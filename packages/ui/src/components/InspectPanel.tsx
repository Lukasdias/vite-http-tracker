import type { RequestRecord } from "@http-tracker/shared";
import { methodColor } from "../graph.js";

export interface InspectPanelProps {
  record: RequestRecord | null;
  onClose: () => void;
}

function headersTable(headers: Record<string, string>) {
  const entries = Object.entries(headers);
  return (
    <table className="table table-sm">
      <tbody>
        {entries.length ? (
          entries.map(([k, v]) => (
            <tr key={k}>
              <td className="font-mono text-xs text-base-content/70">{k}</td>
              <td className="font-mono text-xs break-all">{v}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td className="text-xs text-base-content/50">—</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export function InspectPanel({ record, onClose }: InspectPanelProps) {
  if (!record) {
    return (
      <aside className="flex h-full items-center justify-center text-sm text-base-content/50">
        Select a request to inspect
      </aside>
    );
  }
  return (
    <aside className="h-full overflow-y-auto">
      <header className="flex items-start justify-between gap-2 border-b border-base-300 p-3">
        <div>
          <div className="font-semibold" style={{ color: methodColor(record.method) }}>
            {record.method} <span className="font-normal">{record.url}</span>
          </div>
          <div className="mt-1 text-xs text-base-content/70">
            Status {record.status} · {record.duration}ms
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <section className="border-b border-base-300 p-3">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-base-content/60">
          Timing
        </h3>
        <p className="text-xs mono">Started {new Date(record.startTime).toLocaleTimeString()}</p>
      </section>
      <section className="border-b border-base-300 p-3">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-base-content/60">
          Request headers
        </h3>
        {headersTable(record.requestHeaders ?? {})}
      </section>
      <section className="border-b border-base-300 p-3">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-base-content/60">
          Response headers
        </h3>
        {headersTable(record.responseHeaders ?? {})}
      </section>
      <section className="border-b border-base-300 p-3">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-base-content/60">
          Request body
        </h3>
        <pre className="whitespace-pre-wrap break-all text-xs mono">
          {record.requestBody ?? "—"}
        </pre>
      </section>
      <section className="p-3">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-base-content/60">
          Response body
        </h3>
        <pre className="whitespace-pre-wrap break-all text-xs mono">
          {record.bodyTruncated
            ? `[truncated]\n${record.responseBody ?? ""}`
            : (record.responseBody ?? "—")}
        </pre>
      </section>
    </aside>
  );
}
