import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from "bun:test";
import { WsTransport } from "./transport.js";

class FakeSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static instances: FakeSocket[] = [];
  static shouldThrow = false;
  sent: string[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    if (FakeSocket.shouldThrow) throw new Error("WebSocket unavailable");
    FakeSocket.instances.push(this);
  }
  close(): void {
    this.readyState = 3;
    this.onclose?.();
  }
  send(data: string): void {
    this.sent.push(data);
  }
  open(): void {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }
}

const RealWebSocket = globalThis.WebSocket;
const transports: WsTransport[] = [];
beforeAll(() => {
  Object.defineProperty(globalThis, "WebSocket", {
    configurable: true,
    writable: true,
    value: FakeSocket,
  });
});
beforeEach(() => {
  FakeSocket.instances = [];
  FakeSocket.shouldThrow = false;
});
afterEach(() => {
  for (const transport of transports.splice(0)) transport.close();
});
afterAll(() => {
  globalThis.WebSocket = RealWebSocket;
});

function createTransport(states: string[]): WsTransport {
  const transport = new WsTransport({ onConnectionChange: (state) => states.push(state) });
  transports.push(transport);
  return transport;
}
function latestSocket(): FakeSocket {
  const socket = FakeSocket.instances.at(-1);
  if (!socket) throw new Error("Expected a connection attempt");
  return socket;
}

test("reports connection progress and retries a lost connection", async () => {
  const states: string[] = [];
  const transport = createTransport(states);
  transport.connect();
  latestSocket().open();
  latestSocket().close();
  expect(states).toEqual(["connecting", "connected", "disconnected"]);
  await Bun.sleep(1100);
  expect(states).toEqual(["connecting", "connected", "disconnected", "connecting"]);
  latestSocket().open();
  expect(states.at(-1)).toBe("connected");
});

test("reports socket errors as disconnected", () => {
  const states: string[] = [];
  const transport = createTransport(states);
  transport.connect();
  latestSocket().onerror?.();
  expect(states.at(-1)).toBe("disconnected");
});

test("intentional close ignores stale events and permanently prevents reconnection", async () => {
  const states: string[] = [];
  const transport = createTransport(states);
  transport.enqueue({
    requestId: "1",
    seq: 1,
    method: "GET",
    url: "/test",
    status: 200,
    startTime: 0,
    endTime: 1,
    duration: 1,
  });
  transport.connect();
  const socket = latestSocket();
  transport.close();
  socket.open();
  socket.onclose?.();
  transport.connect();
  await Bun.sleep(1100);
  expect(socket.sent).toEqual([]);
  expect(FakeSocket.instances).toHaveLength(1);
  expect(states).toEqual(["connecting", "disconnected"]);
});

test("constructor failures report disconnection and retry without throwing", async () => {
  const states: string[] = [];
  FakeSocket.shouldThrow = true;
  const transport = createTransport(states);
  expect(() => transport.connect()).not.toThrow();
  expect(states).toEqual(["connecting", "disconnected"]);
  FakeSocket.shouldThrow = false;
  await Bun.sleep(1100);
  latestSocket().open();
  expect(states).toEqual(["connecting", "disconnected", "connecting", "connected"]);
});
