import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";

export interface HttpTrackerOptions {
  serverUrl?: string;
  token?: string;
  autoInject?: boolean;
}

const VIRTUAL_ID = "virtual:http-tracker/agent";
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

export function httpTracker(opts: HttpTrackerOptions = {}): Plugin {
  const serverUrl = opts.serverUrl ?? "http://localhost:4000";
  const token = opts.token ?? "dev";
  const autoInject = opts.autoInject ?? true;
  let strictMode = false;

  return {
    name: "http-tracker",
    apply: "serve",
    async configResolved(config: ResolvedConfig) {
      if (autoInject) strictMode = await detectStrictMode(config.root);
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },
    load(id) {
      if (id === RESOLVED_ID) {
        return [
          `import { initAgent } from "@http-tracker/agent";`,
          `initAgent({ serverUrl: ${JSON.stringify(serverUrl)}, token: ${JSON.stringify(token)}, strictMode: ${strictMode} });`,
        ].join("\n");
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
