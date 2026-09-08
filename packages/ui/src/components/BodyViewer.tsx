import { useMemo, useState } from "react";
import { countNodes, parseJson, parseParams } from "../json.js";
import { JsonViewer } from "./JsonViewer.js";
import { useI18n } from "../i18n.js";

export interface BodyViewerProps {
  raw?: string;
  truncated?: boolean;
  opaque?: boolean;
  streaming?: boolean;
}

const MAX_RENDER_NODES = 5000;

type ContentKind = "json" | "params" | "text";

function detect(raw: string): { kind: ContentKind; value?: unknown; nodes?: number } {
  const parsed = parseJson(raw);
  if (parsed.ok) {
    return { kind: "json", value: parsed.value, nodes: countNodes(parsed.value, MAX_RENDER_NODES) };
  }
  if (parseParams(raw)) return { kind: "params" };
  return { kind: "text" };
}

export function KeyValueRows({ rows }: { rows: { key: string; value: string }[] }) {
  return (
    <div className="divide-y divide-base-300/60">
      {rows.map((r) => (
        <div key={r.key} className="flex gap-2 py-0.5">
          <span className="w-32 shrink-0 truncate font-mono text-[11px] text-base-content/60">
            {r.key}
          </span>
          <span className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-[11px] text-base-content/90">
            {r.value || "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

export function BodyViewer({ raw, truncated, opaque, streaming }: BodyViewerProps) {
  const { t } = useI18n();
  const [structured, setStructured] = useState(true);
  const [forceTree, setForceTree] = useState(false);

  const info = useMemo(() => (raw && raw.trim() ? detect(raw) : null), [raw]);

  const contentKind: ContentKind = info?.kind ?? "text";
  const canStructure = contentKind === "json" || contentKind === "params";
  const isBigJson = contentKind === "json" && (info?.nodes ?? 0) > MAX_RENDER_NODES;
  const showTree = canStructure && structured && !(isBigJson && !forceTree);

  return (
    <div className="space-y-2">
      {truncated && (
        <div className="rounded-box border border-warning/30 bg-warning/10 px-2 py-1 text-[10px] text-warning">
          {t("bodyTruncated")}
        </div>
      )}
      {streaming && (
        <div className="rounded-box border border-base-300 bg-base-200/50 px-2 py-1 text-[10px] text-base-content/60">
          {t("streamingResponse")}
        </div>
      )}
      {opaque && (
        <div className="rounded-box border border-base-300 bg-base-200/50 px-2 py-1 text-[10px] text-base-content/60">
          {t("opaqueBody")}
        </div>
      )}

      {!raw?.trim() ? (
        <div className="font-mono text-xs text-base-content/40">—</div>
      ) : !showTree ? (
        <div>
          {canStructure && isBigJson && !forceTree && (
            <div className="mb-1 flex items-center gap-2 rounded-box border border-base-300 bg-base-200/40 px-2 py-1 text-[10px] text-base-content/70">
              <span>{t("largeObjectRaw", { nodes: info?.nodes?.toLocaleString() ?? 0 })}</span>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setForceTree(true)}
              >
                {t("viewStructure")}
              </button>
            </div>
          )}
          <pre className="whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-base-content/90">
            {raw}
          </pre>
        </div>
      ) : contentKind === "json" ? (
        <JsonViewer value={info?.value} defaultDepth={3} />
      ) : contentKind === "params" ? (
        <KeyValueRows rows={parseParams(raw) ?? []} />
      ) : null}

      {canStructure && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={`btn btn-ghost btn-xs ${structured ? "btn-active" : ""}`}
            onClick={() => setStructured(true)}
          >
            {t("structure")}
          </button>
          <button
            type="button"
            className={`btn btn-ghost btn-xs ${structured ? "" : "btn-active"}`}
            onClick={() => setStructured(false)}
          >
            {t("raw")}
          </button>
        </div>
      )}
    </div>
  );
}
