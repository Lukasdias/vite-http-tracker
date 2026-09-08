import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { initAgent } from "./init-agent.js";

class TestSocket {
  static readonly OPEN = 1;
  static readonly CONNECTING = 0;
  static instances: TestSocket[] = [];
  readyState = TestSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(readonly url: string) {
    TestSocket.instances.push(this);
  }

  send(): void {}

  close(): void {
    this.readyState = 3;
    this.onclose?.();
  }

  open(): void {
    this.readyState = TestSocket.OPEN;
    this.onopen?.();
  }
}

let restore: (() => void)[] = [];

beforeAll(() => {
  GlobalRegistrator.register({ url: "http://app.local:5173" });
  Object.defineProperty(globalThis, "WebSocket", { configurable: true, value: TestSocket });
});

afterEach(() => {
  restore.forEach((cleanup) => cleanup());
  restore = [];
  TestSocket.instances = [];
  document.querySelectorAll("vite-http-tracker-indicator").forEach((host) => host.remove());
});

afterAll(() => GlobalRegistrator.unregister());

function currentSocket(): TestSocket {
  const socket = TestSocket.instances.at(-1);
  if (!socket) throw new Error("Agent did not connect");
  return socket;
}

function indicatorRoot(): ShadowRoot {
  const root = document.querySelector("vite-http-tracker-indicator")?.shadowRoot;
  if (!root) throw new Error("Agent did not mount its indicator");
  return root;
}

test("the optional indicator reports the real connection and links to the configured dashboard", () => {
  restore = initAgent({
    serverUrl: "https://tracker.local:4443/",
    token: "local & token",
    indicator: { logoUrl: "data:image/png;base64,test" },
  });
  const root = indicatorRoot();
  const link = root.querySelector("a");
  const status = root.querySelector('[role="status"]');
  expect(link?.href).toBe("https://tracker.local:4443/?token=local+%26+token");
  expect(link?.target).toBe("_blank");
  expect(link?.rel).toContain("noopener");
  expect(root.querySelector("img")?.src).toBe("data:image/png;base64,test");
  expect(status?.textContent).toBe("Connecting");
  expect(currentSocket().url).toBe("wss://tracker.local:4443/events?token=local%20%26%20token");
  currentSocket().open();
  expect(status?.textContent).toBe("Connected");
  expect(link?.getAttribute("aria-label")).toContain("Connected");
  currentSocket().close();
  expect(status?.textContent).toBe("Disconnected");
  expect(link?.title).toContain("Disconnected");
});

test("cleanup restores the app APIs, closes the socket, and removes the indicator", () => {
  const originalFetch = window.fetch;
  const originalOpen = XMLHttpRequest.prototype.open;
  restore = initAgent({ indicator: { logoUrl: "/logo.png" } });
  expect(document.querySelectorAll("vite-http-tracker-indicator")).toHaveLength(1);
  const socket = currentSocket();
  expect(socket.url).toBe("ws://app.local:4000/events?token=dev");
  restore.forEach((cleanup) => cleanup());
  restore = [];
  expect(document.querySelector("vite-http-tracker-indicator")).toBeNull();
  expect(window.fetch).toBe(originalFetch);
  expect(XMLHttpRequest.prototype.open).toBe(originalOpen);
  expect(socket.readyState).toBe(3);
});

test("manual initialization captures without adding an indicator by default", () => {
  restore = initAgent();
  expect(document.querySelector("vite-http-tracker-indicator")).toBeNull();
  expect(currentSocket().url).toBe("ws://app.local:4000/events?token=dev");
});

test("websocket server URLs become HTTP dashboard links without losing the base path", () => {
  restore = initAgent({
    serverUrl: "wss://tracker.local/debug/",
    indicator: { logoUrl: "/logo.png" },
  });
  expect(indicatorRoot().querySelector("a")?.href).toBe("https://tracker.local/debug/?token=dev");
  expect(currentSocket().url).toBe("wss://tracker.local/debug/events?token=dev");
});
