import { DEFAULT_STORE_BYTE_CAP, type RequestRecord } from "@vite-http-tracker/shared";

export interface StoreOptions {
  byteCap?: number;
}

export class RequestStore {
  private records = new Map<string, RequestRecord>();
  private byteCap: number;
  private bytes = 0;

  constructor(opts: StoreOptions = {}) {
    this.byteCap = opts.byteCap ?? DEFAULT_STORE_BYTE_CAP;
  }

  add(r: RequestRecord): boolean {
    if (this.records.has(r.requestId)) return false;
    const size = this.sizeOf(r);
    this.records.set(r.requestId, r);
    this.bytes += size;
    while (this.bytes > this.byteCap && this.records.size > 1) {
      const sorted = this.snapshot();
      const oldest = sorted[0];
      if (!oldest) break;
      this.records.delete(oldest.requestId);
      this.bytes -= this.sizeOf(oldest);
    }
    return true;
  }

  snapshot(): RequestRecord[] {
    return [...this.records.values()].sort((a, b) => a.seq - b.seq);
  }

  clear(): void {
    this.records.clear();
    this.bytes = 0;
  }

  count(): number {
    return this.records.size;
  }
  get sizeInBytes(): number {
    return this.bytes;
  }

  private sizeOf(r: RequestRecord): number {
    return (r.bodySizeBytes ?? 0) + (r.responseBody?.length ?? 0);
  }
}
