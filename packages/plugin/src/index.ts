import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";

export interface ViteHttpTrackerOptions {
  serverUrl?: string;
  token?: string;
  autoInject?: boolean;
}

const VIRTUAL_ID = "virtual:vite-http-tracker/agent";
const RESOLVED_ID = "\0" + VIRTUAL_ID;
const SOURCE_EXT = /\.(tsx|jsx|ts|js)$/;

async function detectStrictMode(root: string): Promise<boolean> {
  const files: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", "dist", ".vite"].includes(entry.name)) continue;
        await walk(path);
      } else if (SOURCE_EXT.test(entry.name)) {
        files.push(path);
      }
    }
  }
  await walk(join(root, "src"));
  for (const file of files) {
    const code = await readFile(file, "utf8").catch(() => "");
    if (/\bStrictMode\b/.test(code)) return true;
  }
  return false;
}

export function viteHttpTracker(opts: ViteHttpTrackerOptions = {}): Plugin {
  const serverUrl = opts.serverUrl;
  const token = opts.token ?? "dev";
  const autoInject = opts.autoInject ?? true;
  let strictMode = false;

  return {
    name: "vite-http-tracker",
    apply: "serve",
    async configResolved(config: ResolvedConfig) {
      if (autoInject) strictMode = await detectStrictMode(config.root);
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },
    load(id) {
      if (id === RESOLVED_ID) {
        const args: string[] = [];
        if (serverUrl) args.push(`serverUrl: ${JSON.stringify(serverUrl)}`);
        args.push(`token: ${JSON.stringify(token)}`, `strictMode: ${strictMode}`);
        return `import { initAgent } from "@vite-http-tracker/agent";\ninitAgent({ ${args.join(", ")} });`;
      }
    },
    transformIndexHtml: {
      order: "pre",
      handler() {
        if (!autoInject) return [];
        return [
          {
            tag: "script",
            attrs: { type: "module", src: "/@id/" + VIRTUAL_ID },
            injectTo: "head-prepend",
          },
        ];
      },
    },
  };
}
