import { cp, readFile, readdir, rm, writeFile } from "node:fs/promises";

const packages = ["shared", "agent", "server", "plugin"] as const;
const distRoot = new URL("../dist/", import.meta.url);

async function run(command: string[]): Promise<void> {
  const proc = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  const code = await proc.exited;
  if (code !== 0) throw new Error(`${command.join(" ")} exited with code ${code}`);
}

await rm(distRoot, { recursive: true, force: true });
await run(["bun", "run", "--cwd", "packages/ui", "build"]);

for (const packageName of packages) {
  await run(["bunx", "tsc", "-p", `packages/${packageName}/tsconfig.publish.json`]);
}

await cp(new URL("../packages/ui/dist/", import.meta.url), new URL("ui/dist/", distRoot), {
  recursive: true,
});
await cp(
  new URL("../packages/server/public/", import.meta.url),
  new URL("packages/server/public/", distRoot),
  {
    recursive: true,
  },
);
await cp(
  new URL("../packages/shared/src/logo.svg", import.meta.url),
  new URL("packages/shared/src/logo.svg", distRoot),
);

if ((await readdir(distRoot)).some((entry) => entry === "apps")) {
  throw new Error("Publish output must not contain test applications");
}

async function rewriteInternalImports(directory: URL): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      await rewriteInternalImports(new URL(`${entry.name}/`, directory));
      continue;
    }
    if (!entry.name.endsWith(".js") && !entry.name.endsWith(".d.ts")) continue;
    const path = new URL(entry.name, directory);
    const source = await readFile(path, "utf8");
    await writeFile(
      path,
      source
        .replaceAll("@vite-http-tracker/shared", "vite-http-tracker/shared")
        .replaceAll("@vite-http-tracker/agent", "vite-http-tracker/agent")
        .replaceAll("@vite-http-tracker/server", "vite-http-tracker/server"),
    );
  }
}

await rewriteInternalImports(new URL("packages/", distRoot));
console.log("Built publishable package in dist/");
