import type { Node, NodeProps } from "@xyflow/react";

export interface DomainNodeData extends Record<string, unknown> {
  domain: string;
  color: string;
}

export type DomainFlowNode = Node<DomainNodeData, "domain">;

export function DomainNode({ data }: NodeProps<DomainFlowNode>) {
  return (
    <div className="relative h-full w-full">
      <div
        className="absolute left-2 top-0 flex -translate-y-full items-center gap-1.5 rounded-t px-1 pb-0.5 font-mono text-xs font-semibold"
        style={{ color: data.color }}
      >
        <span className="size-2 rounded-full" style={{ backgroundColor: data.color }} />
        {data.domain}
      </div>
    </div>
  );
}
