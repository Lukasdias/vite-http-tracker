import type { RequestRecord } from "@http-tracker/shared";
import { methodColor, statusClass, type RecordGroup } from "../graph.js";

export interface InspectPanelProps {
  group: RecordGroup | null;
  record: RequestRecord | null;
  onClose: () => void;
}

const statusBadge = {
  success: "badge-success",
  warning: "badge-warning",
  error: "badge-error",
} as const;

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

export function InspectPanel({ group, record, onClose }: InspectPanelProps) {
  if (!record) {
    return (
      <aside className="flex h-full items-center justify-center text-sm text-base-content/50">
        Select a request to inspect
      </aside>
    );
  }

  const members = group?.members ?? [record];
  const isGroup = members.length > 1;

  return (
    <aside className="h-full overflow-y-auto">
      <header className="flex items-start justify-between gap-2 border-b border-base-300 p-3">
        <div>
          <div className="font-semibold" style={{ color: methodColor(record.method) }}>
            {record.method} <span className="font-normal">{record.url}</span>
          </div>
          <div className="mt-1 text-xs text-base-content/70">
            Status {record.status} · {record.duration}ms · {record.bodySizeBytes ?? 0} B
          </div>
          {isGroup && (
            <div className="badge badge-outline badge-sm mt-2 text-warning">
              ×{members.length} duplicate{members.length > 1 ? "s" : ""}
              {group?.strictMode ? " · Strict Mode" : ""}
            </div>
          )}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      {isGroup && (
        <section className="border-b border-base-300 p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/60">
            Duplicate requests
          </h3>
          <ul className="space-y-1">
            {members.map((m, i) => (
              <li
                key={m.requestId}
                className="rounded-box border border-base-300 bg-base-200 px-2 py-1.5 text-xs"
              >
                <span className="font-mono text-base-content/60">#{i + 1}</span>{" "}
                <span className={`badge badge-xs ${statusBadge[statusClass(m.status)]}`}>
                  {m.status}
                </span>{" "}
                <span className="mono text-base-content/70">{m.duration}ms</span>
                <span className="float-right text-[10px] text-base-content/50">
                  {new Date(m.startTime).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
