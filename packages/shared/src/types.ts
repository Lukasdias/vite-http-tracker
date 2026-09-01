export interface RequestRecord {
  requestId: string;
  seq: number;
  method: string;
  url: string;
  status: number;
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
}
