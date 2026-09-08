import {
  DEFAULT_RING_BUFFER_SIZE,
  DEFAULT_TOKEN,
  DEFAULT_WS_URL,
  type RequestRecord,
} from "@vite-http-tracker/shared";

export type ConnectionState = "connecting" | "connected" | "disconnected";

export interface TransportOptions {
  url?: string;
  token?: string;
  ringSize?: number;
  onConnectionChange?: (state: ConnectionState) => void;
}

export class WsTransport {
  private url: string;
  private token: string;
  private ringSize: number;
  private buffer: RequestRecord[] = [];
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onAck: (n: number) => void;
  private readonly onConnectionChange: ((state: ConnectionState) => void) | undefined;
  private isClosed = false;
  private connectionState: ConnectionState | null = null;

  constructor(opts: TransportOptions, onAck: (n: number) => void = () => {}) {
    this.url = opts.url ?? DEFAULT_WS_URL;
    this.token = opts.token ?? DEFAULT_TOKEN;
    this.ringSize = opts.ringSize ?? DEFAULT_RING_BUFFER_SIZE;
    this.onAck = onAck;
    this.onConnectionChange = opts.onConnectionChange;
  }

  enqueue(record: RequestRecord): void {
    this.buffer.push(record);
    if (this.buffer.length > this.ringSize) {
      this.buffer.splice(0, this.buffer.length - this.ringSize);
    }
    this.flush();
  }

  connect(): void {
    if (this.isClosed) return;
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    )
      return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.setConnectionState("connecting");
    let sock: WebSocket;
    try {
      sock = new WebSocket(this.url);
    } catch {
      this.setConnectionState("disconnected");
      this.scheduleReconnect();
      return;
    }
    this.socket = sock;
    sock.onopen = () => {
      if (this.isClosed || this.socket !== sock) return;
      this.setConnectionState("connected");
      this.flush();
    };
    sock.onmessage = (ev) => {
      if (this.isClosed || this.socket !== sock) return;
      try {
        const msg = JSON.parse(String(ev.data)) as { type: string; count?: number };
        if (msg.type === "acked" && typeof msg.count === "number") {
          this.buffer.splice(0, Math.min(msg.count, this.buffer.length));
          this.onAck(msg.count);
        }
      } catch {}
    };
    sock.onclose = () => {
      if (this.isClosed || this.socket !== sock) return;
      this.setConnectionState("disconnected");
      this.scheduleReconnect();
    };
    sock.onerror = () => {
      if (this.isClosed || this.socket !== sock) return;
      this.setConnectionState("disconnected");
      sock.close();
    };
  }

  close(): void {
    this.isClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.close();
    this.socket = null;
    this.setConnectionState("disconnected");
  }

  private flush(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || this.buffer.length === 0)
      return;
    this.socket.send(JSON.stringify({ type: "records", token: this.token, records: this.buffer }));
  }

  private scheduleReconnect(): void {
    if (this.isClosed) return;
    this.socket = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), 1000);
  }

  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState === state) return;
    this.connectionState = state;
    this.onConnectionChange?.(state);
  }
}
