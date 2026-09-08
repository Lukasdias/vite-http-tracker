export interface RequestRecord {
  requestId: string;
  seq: number;
  method: string;
  url: string;
  status: number;
  transport?: "fetch" | "xhr" | "sse" | "websocket";
  error?: string;
  timedOut?: boolean;
  eventType?: "open" | "message" | "error" | "close";
  poolId?: string;
  initiator?: string;
  startTime: number;
  endTime: number;
  duration: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  bodyTruncated?: boolean;
  opaque?: boolean;
  streaming?: boolean;
  bodySizeBytes?: number;
  requestHash?: string;
  strictMode?: boolean;
  batchId?: string;
}
