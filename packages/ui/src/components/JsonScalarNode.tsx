import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import type { JsonGraphNode } from "../json-graph.js";

export interface JsonScalarNodeData extends Record<string, unknown> {
  node: JsonGraphNode;
}

export type JsonScalarFlowNode = Node<JsonScalarNodeData, "scalar">;

const valueClass: Record<string, string> = {
  string: "j-string",
  number: "j-number",
  boolean: "j-bool",
  null: "j-null",
};

export function JsonScalarNode({ data }: NodeProps<JsonScalarFlowNode>) {
  const { node } = data;
  return (
    <div className="json-graph flex items-center gap-2 rounded-box border border-base-300 bg-base-200 px-2 py-1 shadow">
      <Handle type="target" position={Position.Left} />
      <span className="j-key text-xs">{node.key}</span>
      <span className="j-punct">:</span>
      <span className={`text-xs ${valueClass[node.kind] ?? ""}`}>{node.value}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
