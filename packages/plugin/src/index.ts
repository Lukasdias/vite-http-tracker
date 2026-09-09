import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";

export interface ViteHttpTrackerOptions {
  serverUrl?: string;
  token?: string;
  autoInject?: boolean;
  showIndicator?: boolean;
  captureStreamMessages?: boolean;
  maxStreamEventsPerConnection?: number;
}

const VIRTUAL_ID = "virtual:vite-http-tracker/agent";
const RESOLVED_ID = "\0" + VIRTUAL_ID;
const SOURCE_EXT = /\.(tsx|jsx|ts|js)$/;
const LOGO_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M7 6.5a3 3 0 0 1 3 3v5h8.5l-2.9-2.9a2 2 0 0 1 2.8-2.8l6.3 6.3a2 2 0 0 1 0 2.8l-6.3 6.3a2 2 0 0 1-2.8-2.8l2.9-2.9H10v5a3 3 0 1 1-6 0v-14a3 3 0 0 1 3-3Z' fill='%2354a7ff'/%3E%3Cpath d='M25 25.5a3 3 0 0 1-3-3v-5h-8.5l2.9 2.9a2 2 0 0 1-2.8 2.8l-6.3-6.3a2 2 0 0 1 0-2.8l6.3-6.3a2 2 0 0 1 2.8 2.8l-2.9 2.9H22v-5a3 3 0 1 1 6 0v14a3 3 0 0 1-3 3Z' fill='%2354a7ff'/%3E%3C/svg%3E";

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
  const showIndicator = opts.showIndicator ?? true;
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
        if (opts.captureStreamMessages !== undefined)
          args.push(`captureStreamMessages: ${JSON.stringify(opts.captureStreamMessages)}`);
        if (opts.maxStreamEventsPerConnection !== undefined)
          args.push(
            `maxStreamEventsPerConnection: ${JSON.stringify(opts.maxStreamEventsPerConnection)}`,
          );
        const imports = ['import { initAgent } from "@vite-http-tracker/agent";'];
        if (showIndicator) {
          args.push(`indicator: { logoUrl: ${JSON.stringify(LOGO_DATA_URI)} }`);
        }
        return `${imports.join("\n")}
const cleanups = initAgent({ ${args.join(", ")} });
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    for (const cleanup of cleanups) cleanup();
  });
}`;
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
