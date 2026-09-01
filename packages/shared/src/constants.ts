export const DEFAULT_BODY_CAP = 500_000;
export const DEFAULT_STORE_BYTE_CAP = 128 * 1024 * 1024;
export const DEFAULT_RING_BUFFER_SIZE = 10_000;
export const DEFAULT_TOKEN = "dev";
export const DEFAULT_SERVER_PORT = 4000;
export const DEFAULT_SERVER_URL = "http://localhost:4000";
export const DEFAULT_WS_URL = "ws://localhost:4000/events";
export const REDACTED_VALUE = "[REDACTED]";
export const DEDUP_WINDOW_MS = 150;
export const SENSITIVE_FIELDS = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
  "token",
  "password",
  "secret",
] as const;
