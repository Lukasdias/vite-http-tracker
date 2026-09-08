import type { RequestRecord } from "@vite-http-tracker/shared";
import { CopyIcon } from "@radix-ui/react-icons";
import { toast } from "sonner";
import { toCurl } from "../curl.js";
import { methodColor, statusClass, type RecordGroup } from "../graph.js";
import { domainOf, pathOf } from "../grouping.js";
import { queryParams } from "../json.js";
import { BodyViewer, KeyValueRows } from "./BodyViewer.js";

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

function mimeOf(headers?: Record<string, string>): string | undefined {
  const ct = headers?.["content-type"];
  return ct ? ct.split(";")[0] : undefined;
}

function SectionHeader({ title, mime }: { title: string; mime?: string }) {
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
        {title}
      </h3>
      {mime && (
        <span className="truncate font-mono text-[10px] text-base-content/40">· {mime}</span>
      )}
    </div>
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
  const query = queryParams(record.url);

  const copyCurl = async () => {
    const cmd = toCurl(record);
    try {
      await navigator.clipboard.writeText(cmd);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = cmd;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    toast.success("cURL copied!");
  };

  return (
    <aside className="h-full overflow-y-auto">
      <header className="flex items-start justify-between gap-2 border-b border-base-300 p-3">
        <div>
          <div className="text-xs text-base-content/50">{domainOf(record.url)}</div>
          <div className="font-semibold" style={{ color: methodColor(record.method) }}>
            {record.method} <span className="font-normal break-all">{pathOf(record.url)}</span>
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
          <SectionHeader title="Duplicate requests" />
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

      {query && (
        <section className="border-b border-base-300 p-3">
          <SectionHeader title="Query params" />
          <KeyValueRows rows={query} />
        </section>
      )}

      <section className="border-b border-base-300 p-3">
        <SectionHeader title="Request headers" />
        {headersTable(record.requestHeaders ?? {})}
      </section>
      <section className="border-b border-base-300 p-3">
        <SectionHeader title="Response headers" />
        {headersTable(record.responseHeaders ?? {})}
      </section>
      <section className="border-b border-base-300 p-3">
        <SectionHeader title="Request body" mime={mimeOf(record.requestHeaders)} />
        <BodyViewer raw={record.requestBody} />
      </section>
      <section className="p-3">
        <SectionHeader title="Response body" mime={mimeOf(record.responseHeaders)} />
        <BodyViewer
          raw={record.responseBody}
          truncated={record.bodyTruncated}
          opaque={record.opaque}
          streaming={record.streaming}
        />
      </section>
      <div className="sticky bottom-0 border-t border-base-300 bg-base-100 p-3">
        <button type="button" className="btn btn-primary btn-sm w-full" onClick={copyCurl}>
          <CopyIcon className="size-3.5" />
          Copy as cURL
        </button>
      </div>
    </aside>
  );
}
