import type { RequestRecord } from "@vite-http-tracker/shared";
import { useState } from "react";
import { ChatBubbleIcon, CopyIcon } from "@radix-ui/react-icons";
import { toast } from "sonner";
import { toCurl } from "../curl.js";
import { methodColor, statusClass, type RecordGroup } from "../graph.js";
import { domainOf, pathOf } from "../grouping.js";
import { queryParams } from "../json.js";
import { BodyViewer, KeyValueRows } from "./BodyViewer.js";
import { useI18n } from "../i18n.js";
import { buildAiContext, copyText } from "../context.js";

export interface InspectPanelProps {
  group: RecordGroup | null;
  record: RequestRecord | null;
  contextRecords: RequestRecord[];
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

export function InspectPanel({ group, record, contextRecords, onClose }: InspectPanelProps) {
  const { t } = useI18n();
  const [redactSensitive, setRedactSensitive] = useState(true);
  if (!record) {
    return (
      <aside className="flex h-full items-center justify-center text-sm text-base-content/50">
        {t("selectRequest")}
      </aside>
    );
  }

  const members = group?.members ?? [record];
  const isGroup = members.length > 1;
  const query = queryParams(record.url);

  const copyCurl = async () => {
    const cmd = toCurl(record);
    await copyText(cmd);
    toast.success(t("curlCopied"));
  };

  const copyAiContext = async () => {
    await copyText(buildAiContext(record, group, contextRecords, redactSensitive));
    toast.success(t("aiContextCopied"));
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
            {t("statusSummary", {
              status: record.status || record.eventType || "error",
              duration: record.duration,
              bytes: record.bodySizeBytes ?? 0,
            })}
          </div>
          {(record.transport || record.poolId || record.error) && (
            <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
              {record.transport && (
                <span className="badge badge-ghost badge-xs">{record.transport}</span>
              )}
              {record.poolId && (
                <span className="badge badge-info badge-outline badge-xs">
                  pool:{record.poolId}
                </span>
              )}
              {record.timedOut && <span className="badge badge-warning badge-xs">timeout</span>}
              {record.error && <span className="text-error">{record.error}</span>}
            </div>
          )}
          {isGroup && (
            <div className="badge badge-outline badge-sm mt-2 text-warning">
              {t("duplicateCount", {
                count: members.length,
                suffix: members.length > 1 ? "s" : "",
              })}
              {group?.strictMode ? ` · ${t("strictMode")}` : ""}
            </div>
          )}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label={t("close")}>
          ×
        </button>
      </header>

      {isGroup && (
        <section className="border-b border-base-300 p-3">
          <SectionHeader title={t("duplicateRequests")} />
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
          <SectionHeader title={t("queryParams")} />
          <KeyValueRows rows={query} />
        </section>
      )}

      <section className="border-b border-base-300 p-3">
        <SectionHeader title={t("requestHeaders")} />
        {headersTable(record.requestHeaders ?? {})}
      </section>
      <section className="border-b border-base-300 p-3">
        <SectionHeader title={t("responseHeaders")} />
        {headersTable(record.responseHeaders ?? {})}
      </section>
      <section className="border-b border-base-300 p-3">
        <SectionHeader title={t("requestBody")} mime={mimeOf(record.requestHeaders)} />
        <BodyViewer raw={record.requestBody} />
      </section>
      <section className="p-3">
        <SectionHeader title={t("responseBody")} mime={mimeOf(record.responseHeaders)} />
        <BodyViewer
          raw={record.responseBody}
          truncated={record.bodyTruncated}
          opaque={record.opaque}
          streaming={record.streaming}
        />
      </section>
      <div className="sticky bottom-0 border-t border-base-300 bg-base-100 p-3">
        <div className="grid gap-2">
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-box border border-base-300 bg-base-200/50 px-3 py-2 text-xs">
            <span className="min-w-0">
              <span className="block font-medium">{t("hideSensitiveData")}</span>
              {!redactSensitive && (
                <span className="block text-warning">{t("sensitiveDataWarning")}</span>
              )}
            </span>
            <input
              type="checkbox"
              className="toggle toggle-sm toggle-primary"
              checked={redactSensitive}
              onChange={(event) => setRedactSensitive(event.target.checked)}
              aria-label={t("hideSensitiveData")}
            />
          </label>
          <button type="button" className="btn btn-primary btn-sm w-full" onClick={copyAiContext}>
            <ChatBubbleIcon className="size-3.5" aria-hidden="true" />
            {t("copyAiContext")}
          </button>
          <button type="button" className="btn btn-ghost btn-sm w-full" onClick={copyCurl}>
            <CopyIcon className="size-3.5" aria-hidden="true" />
            {t("copyCurl")}
          </button>
        </div>
      </div>
    </aside>
  );
}
