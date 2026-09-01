import { DEFAULT_RING_BUFFER_SIZE, DEFAULT_TOKEN, DEFAULT_WS_URL, type RequestRecord } from "@http-tracker/shared";

export interface TransportOptions {
  url?: string;
  token?: string;
  ringSize?: number;
}

export class WsTransport {
  private url: string;
  private token: string;
  private ringSize: number;
  private buffer: RequestRecord[] = [];
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onAck: (n: number) => void;

  constructor(opts: TransportOptions, onAck: (n: number) => void = () => {}) {
    this.url = opts.url ?? DEFAULT_WS_URL;
    this.token = opts.token ?? DEFAULT_TOKEN;
    this.ringSize = opts.ringSize ?? DEFAULT_RING_BUFFER_SIZE;
    this.onAck = onAck;
  }

  enqueue(record: RequestRecord): void {
    this.buffer.push(record);
    if (this.buffer.length > this.ringSize) {
      this.buffer.splice(0, this.buffer.length - this.ringSize);
    }
    this.flush();
  }

  connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) return;
    const sock = new WebSocket(this.url);
    this.socket = sock;
    sock.onopen = () => this.flush();
    sock.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { type: string; count?: number };
        if (msg.type === "acked" && typeof msg.count === "number") {
          this.buffer.splice(0, Math.min(msg.count, this.buffer.length));
          this.onAck(msg.count);
        }
      } catch {}
    };
    sock.onclose = () => this.scheduleReconnect();
    sock.onerror = () => sock.close();
  }

  close(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.socket = null;
  }

  private flush(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || this.buffer.length === 0) return;
    this.socket.send(JSON.stringify({ type: "records", token: this.token, records: this.buffer }));
  }

  private scheduleReconnect(): void {
    this.socket = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), 1000);
  }
}
