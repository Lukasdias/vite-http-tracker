import type { Node, NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import type { JsonGraphNode } from "../json-graph.js";

export interface JsonContainerNodeData extends Record<string, unknown> {
  node: JsonGraphNode;
  collapsed: boolean;
  onCollapse: (id: string) => void;
}

export type JsonContainerFlowNode = Node<JsonContainerNodeData, "container">;

export function JsonContainerNode({ data }: NodeProps<JsonContainerFlowNode>) {
  const { node, collapsed, onCollapse } = data;
  const brace = node.kind === "array" ? "[]" : "{}";
  return (
    <div className="json-graph rounded-box border border-base-300 bg-base-200 px-2 py-1 shadow">
      <Handle type="target" position={Position.Left} />
      <button
        type="button"
        className="flex cursor-pointer items-center gap-2 text-left"
        onClick={() => onCollapse(node.id)}
      >
        <span className="inline-block w-3 text-center font-mono text-xs text-base-content/50">
          {collapsed ? "▸" : "▾"}
        </span>
        <span className="j-key text-xs">{node.key}</span>
        <span className="j-punct text-xs">{brace}</span>
        <span className="text-[10px] text-base-content/50">({node.childCount})</span>
      </button>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
