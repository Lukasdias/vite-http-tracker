import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RequestRecord } from "@http-tracker/shared";

export interface ConnPayload {
  type: string;
  token?: string;
  records?: RequestRecord[];
}

export interface TrackerConnection {
  connected: boolean;
  send: (payload: ConnPayload) => void;
}

export function useTrackerConnection(url: string): TrackerConnection {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data)) as { type: string; records?: RequestRecord[] };
      if (msg.type === "snapshot") qc.setQueryData(["requests"], msg.records ?? []);
      else if (msg.type === "records") {
        qc.setQueryData(["requests"], (prev: RequestRecord[] | undefined) => [
          ...(prev ?? []),
          ...(msg.records ?? []),
        ]);
      } else if (msg.type === "clear") {
        qc.setQueryData(["requests"], []);
      }
    };
    ws.onclose = () => setConnected(false);
    return () => ws.close();
  }, [url, qc]);

  const send = useCallback((payload: ConnPayload) => {
    wsRef.current?.send(JSON.stringify(payload));
  }, []);

  return { connected, send };
}
