import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { WsTransport } from "./transport.js";

class FakeSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;
  sent: string[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  closeCalls = 0;
  close() {
    this.closeCalls++;
  }
  send(data: string) {
    this.sent.push(data);
  }
}

const RealWebSocket = globalThis.WebSocket;
beforeAll(() => {
  globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket;
});
afterAll(() => {
  globalThis.WebSocket = RealWebSocket;
});

const makeOpts = () => ({ url: "ws://localhost:4000", token: "dev" });

describe("WsTransport", () => {
  test("queues records and flushes when socket is open", () => {
    const t = new WsTransport(makeOpts());
    t.enqueue({ requestId: "1", seq: 1 } as never);
    const sock = new FakeSocket();
    sock.readyState = FakeSocket.OPEN;
    (t as any).socket = sock;
    (t as any).flush();
    expect(sock.sent[0]).toContain('"requestId":"1"');
  });
  test("drops oldest when over ring buffer size", () => {
    const t = new WsTransport({ ...makeOpts(), ringSize: 2 });
    t.enqueue({ requestId: "1" } as never);
    t.enqueue({ requestId: "2" } as never);
    t.enqueue({ requestId: "3" } as never);
    expect((t as any).buffer.length).toBe(2);
  });
  test("connect attaches handler and ack trims the buffer", () => {
    const t = new WsTransport(makeOpts());
    t.enqueue({ requestId: "1" } as never);
    t.enqueue({ requestId: "2" } as never);
    t.connect();
    const sock = (t as any).socket as FakeSocket;
    sock.readyState = FakeSocket.OPEN;
    sock.onopen?.();
    expect(sock.sent[0]).toContain('"requestId":"1"');
    sock.onmessage?.({ data: JSON.stringify({ type: "acked", count: 2 }) });
    expect((t as any).buffer.length).toBe(0);
    t.close();
  });
  test("does not resend an in-flight batch for every new record", () => {
    const t = new WsTransport(makeOpts());
    t.connect();
    const sock = (t as any).socket as FakeSocket;
    sock.readyState = FakeSocket.OPEN;
    sock.onopen?.();

    t.enqueue({ requestId: "1" } as never);
    t.enqueue({ requestId: "2" } as never);
    expect(sock.sent).toHaveLength(1);
    expect(JSON.parse(sock.sent[0] ?? "{}").records).toHaveLength(1);

    sock.onmessage?.({ data: JSON.stringify({ type: "acked", count: 1 }) });
    expect(sock.sent).toHaveLength(2);
    expect(JSON.parse(sock.sent[1] ?? "{}").records).toHaveLength(1);
    expect(JSON.parse(sock.sent[1] ?? "{}").records[0].requestId).toBe("2");
    t.close();
  });
});
