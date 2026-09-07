export interface CliArgs {
  port: number;
  token: string;
  open: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  let port = 4000;
  let token = "dev";
  let open = true;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--port") port = Number(argv[++i]);
    else if (a === "--token") token = argv[++i] ?? token;
    else if (a === "--no-open") open = false;
    else if (a === "--help") {
      console.log("vite-http-tracker [--port 4000] [--token dev] [--no-open]");
      process.exit(0);
    }
  }
  return { port, token, open };
}

async function main(): Promise<void> {
  const { port, token, open } = parseArgs(process.argv.slice(2));
  const { startServer } = await import("./server.js");
  const { port: bound } = await startServer({ port, token });
  const url = `http://127.0.0.1:${bound}/?token=${token}`;
  console.log(`vite-http-tracker listening at ${url}`);
  if (open) {
    const cmd =
      process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    Bun.spawn([cmd, url]);
  }
}

if (import.meta.main) main();
