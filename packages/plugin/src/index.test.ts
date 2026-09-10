import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import type { Plugin } from "vite";
import { viteHttpTracker, type ViteHttpTrackerOptions } from "./index.js";

async function injectedTags(plugin: Plugin): Promise<unknown> {
  const hook = plugin.transformIndexHtml;
  if (!hook) throw new Error("Missing HTML hook");
  return Reflect.apply(typeof hook === "function" ? hook : hook.handler, {}, []);
}

async function runAgentModule(pluginOptions: ViteHttpTrackerOptions = {}): Promise<{
  options: unknown;
  dispose: () => void;
  cleanupCount: () => number;
}> {
  const hook = viteHttpTracker(pluginOptions).load;
  if (!hook) throw new Error("Missing virtual module hook");
  const code: unknown = await Reflect.apply(typeof hook === "function" ? hook : hook.handler, {}, [
    "\0virtual:vite-http-tracker/agent",
  ]);
  if (typeof code !== "string") throw new Error("Agent module was not loaded");
  let options: unknown;
  let dispose = (): void => {};
  let cleanupCount = 0;
  // Execute the emitted module with browser-agent and Vite HMR boundaries supplied.
  const executable = code
    .replace(/^import\s+.*?from\s+["'][^"']+["'];?\s*$/gm, "")
    .replaceAll("import.meta.hot", "hot");
  new Function("initAgent", "logoUrl", "hot", executable)(
    (value: unknown) => {
      options = value;
      return [() => cleanupCount++, () => cleanupCount++];
    },
    "data:image/png;base64,fixture",
    {
      dispose: (callback: () => void) => {
        dispose = callback;
      },
    },
  );
  return { options, dispose, cleanupCount: () => cleanupCount };
}

test("development injection starts the agent with its visible indicator by default", async () => {
  const module = await runAgentModule({
    serverUrl: "ws://localhost:4567/events",
    token: "local-token",
  });
  expect(await injectedTags(viteHttpTracker())).toEqual([
    {
      tag: "script",
      attrs: { type: "module", src: "/@id/virtual:vite-http-tracker/agent" },
      injectTo: "head-prepend",
    },
  ]);
  expect(module.options).toMatchObject({
    serverUrl: "ws://localhost:4567/events",
    token: "local-token",
    strictMode: false,
    indicator: { logoUrl: expect.stringContaining("data:image/svg+xml,") },
  });
});

test("hot disposal invokes every agent cleanup callback", async () => {
  const module = await runAgentModule();
  expect(module.cleanupCount()).toBe(0);
  module.dispose();
  expect(module.cleanupCount()).toBe(2);
});

test("showIndicator false keeps capture enabled without the indicator", async () => {
  const module = await runAgentModule({ showIndicator: false });
  expect(module.options).toEqual({ token: "dev", strictMode: false });
});

test("passes stream capture options to the browser agent", async () => {
  const module = await runAgentModule({
    captureStreamMessages: true,
    maxStreamEventsPerConnection: 25,
  });
  expect(module.options).toMatchObject({
    captureStreamMessages: true,
    maxStreamEventsPerConnection: 25,
  });
});

test("autoInject false leaves the application HTML without an agent entry", async () => {
  expect(await injectedTags(viteHttpTracker({ autoInject: false }))).toEqual([]);
});

test("starts the dashboard and reports its route through Vite", async () => {
  const messages: string[] = [];
  const httpServer = new EventEmitter();
  const configureServer = viteHttpTracker({ port: 0 }).configureServer;
  if (typeof configureServer !== "function") throw new Error("Missing configureServer hook");
  await Reflect.apply(configureServer, {}, [
    {
      config: { logger: { info: (message: string) => messages.push(message) } },
      httpServer,
    },
  ]);
  expect(messages[0]).toMatch(
    /^vite-http-tracker: dashboard disponível em http:\/\/127\.0\.0\.1:\d+\/\?token=dev$/,
  );
  httpServer.emit("close");
});
