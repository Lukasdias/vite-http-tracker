import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import type { RequestRecord } from "@http-tracker/shared";
import { methodColor, statusClass } from "../graph.js";

export interface RequestNodeData extends Record<string, unknown> {
  record: RequestRecord;
  dupCount: number;
  strictMode: boolean;
  memberIds: string[];
  batchSize?: number;
}

export type RequestFlowNode = Node<RequestNodeData, "request">;

const statusBadge = {
  success: "badge-success",
  warning: "badge-warning",
  error: "badge-error",
} as const;

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function RequestNode({ data }: NodeProps<RequestFlowNode>) {
  const { record, dupCount, strictMode, batchSize } = data;
  const isBatch = (batchSize ?? 0) > 1;

  return (
    <div
      className={`min-w-48 rounded-box border bg-base-200 p-2 shadow ${isBatch ? "border-dashed border-warning/60" : "border-base-300"}`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <span
          className="rounded px-1.5 py-0.5 text-xs font-semibold"
          style={{
            background: `${methodColor(record.method)}22`,
            color: methodColor(record.method),
          }}
        >
          {record.method}
        </span>
        <span className={`badge badge-sm ${statusBadge[statusClass(record.status)]}`}>
          {record.status}
        </span>
        {dupCount > 1 && (
          <span className="badge badge-outline badge-sm text-base-content/70">×{dupCount}</span>
        )}
        {isBatch && (
          <span className="badge badge-outline badge-sm text-warning">⚡×{batchSize}</span>
        )}
      </div>
      <div className="mt-1 max-w-56 truncate text-xs mono">{record.url}</div>
      <div className="mt-1 flex items-center gap-2 text-xs text-base-content/60">
        <span className="mono">{record.duration}ms</span>
        <span className="mono">·</span>
        <span className="mono">{formatBytes(record.bodySizeBytes ?? 0)}</span>
      </div>
      {strictMode && dupCount > 1 && (
        <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-warning">
          likely strict mode
        </div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
