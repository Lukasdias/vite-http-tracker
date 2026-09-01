import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import type { RequestRecord } from "@http-tracker/shared";
import { methodColor } from "../graph.js";

export interface RequestNodeData extends Record<string, unknown> {
  record: RequestRecord;
}

export type RequestFlowNode = Node<RequestNodeData, "request">;

export function RequestNode({ data }: NodeProps<RequestFlowNode>) {
  const { record } = data;
  const isError = record.status >= 400;
  return (
    <div className="min-w-36 rounded-box border border-base-300 bg-base-200 p-2 shadow">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold" style={{ color: methodColor(record.method) }}>
          {record.method}
        </span>
        <span className={`badge badge-sm ${isError ? "badge-error" : "badge-success"}`}>
          {record.status}
        </span>
      </div>
      <div className="mt-1 max-w-52 truncate text-xs mono">{record.url}</div>
      <div className="mt-0.5 text-xs text-base-content/60">{record.duration}ms</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
