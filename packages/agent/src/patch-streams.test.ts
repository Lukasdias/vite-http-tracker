/// <reference lib="dom" />
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { patchWebSocket } from "./patch-streams.js";

interface FakeEvent {
  data?: string;
}

type FakeListener = (event: FakeEvent) => void;

class FakeWebSocket {
  static readonly OPEN = 1;
  static readonly CONNECTING = 0;
  static readonly CLOSED = 3;
  private listeners = new Map<string, Set<FakeListener>>();

  constructor(readonly url: string) {}

  addEventListener(type: string, listener: FakeListener): void {
    const listeners = this.listeners.get(type) ?? new Set<FakeListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type: string, event: FakeEvent = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

const originalWebSocket = globalThis.WebSocket;

beforeAll(() => {
  GlobalRegistrator.register();
  Object.defineProperty(globalThis, "WebSocket", {
    configurable: true,
    value: FakeWebSocket,
  });
});

afterAll(() => {
  Object.defineProperty(globalThis, "WebSocket", {
    configurable: true,
    value: originalWebSocket,
  });
  GlobalRegistrator.unregister();
});

function emit(socket: FakeWebSocket, type: string, data?: string): void {
  socket.dispatch(type, { data });
}

describe("patchWebSocket", () => {
  test("captures lifecycle events without messages by default", () => {
    const captured: Array<{ eventType?: string }> = [];
    const restore = patchWebSocket({ enqueue: (record) => captured.push(record) });
    const socket = new window.WebSocket("wss://example.test") as unknown as FakeWebSocket;
    emit(socket, "open");
    emit(socket, "message", "one");
    emit(socket, "message", "two");
    emit(socket, "close");
    restore();

    expect(captured.map((record) => record.eventType)).toEqual(["open", "close"]);
  });

  test("captures messages only when enabled and respects the connection cap", () => {
    const captured: Array<{ eventType?: string }> = [];
    const restore = patchWebSocket({ enqueue: (record) => captured.push(record) }, false, {
      captureMessages: true,
      maxMessages: 2,
    });
    const socket = new window.WebSocket("wss://example.test") as unknown as FakeWebSocket;
    emit(socket, "message", "one");
    emit(socket, "message", "two");
    emit(socket, "message", "three");
    restore();

    expect(captured).toHaveLength(2);
    expect(captured.every((record) => record.eventType === "message")).toBe(true);
  });

  test("ignores the tracker's internal transport connection", () => {
    const captured: Array<{ eventType?: string }> = [];
    const restore = patchWebSocket({ enqueue: (record) => captured.push(record) }, false, {
      ignoredUrl: "ws://tracker.local/events?token=dev",
    });
    const socket = new window.WebSocket("ws://tracker.local/events?token=dev") as unknown as FakeWebSocket;
    emit(socket, "open");
    emit(socket, "close");
    restore();

    expect(captured).toHaveLength(0);
  });
});
