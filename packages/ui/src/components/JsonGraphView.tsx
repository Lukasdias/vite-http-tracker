import { useEffect, useMemo, useState } from "react";
import {
  Background,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import type { Edge } from "@xyflow/react";
import type { RequestRecord } from "@vite-http-tracker/shared";
import { buildJsonGraph, toggleCollapse } from "../json-graph.js";
import type { JsonGraphNode } from "../json-graph.js";
import { parseJson } from "../json.js";
import { JsonContainerNode, type JsonContainerFlowNode } from "./JsonContainerNode.js";
import { JsonScalarNode, type JsonScalarFlowNode } from "./JsonScalarNode.js";

const EDGE_COLOR = "#54a7ff";
const nodeTypes = { container: JsonContainerNode, scalar: JsonScalarNode };

type JsonFlowNode = JsonScalarFlowNode | JsonContainerFlowNode;

function toFlowNodes(
  nodes: JsonGraphNode[],
  collapsed: ReadonlySet<string>,
  onCollapse: (id: string) => void,
): JsonFlowNode[] {
  return nodes.map((n) => {
    const container = n.kind === "object" || n.kind === "array";
    const data = container ? { node: n, collapsed: collapsed.has(n.id), onCollapse } : { node: n };
    return {
      id: n.id,
      type: container ? "container" : "scalar",
      position: { x: n.x, y: n.y },
      data,
    } as JsonFlowNode;
  });
}

function GraphCanvas({ nodes, edges }: { nodes: JsonFlowNode[]; edges: Edge[] }) {
  const { fitView } = useReactFlow();
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(nodes);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(edges);

  useEffect(() => {
    setRfNodes(nodes);
    setRfEdges(edges);
  }, [nodes, edges, setRfNodes, setRfEdges]);

  useEffect(() => {
    requestAnimationFrame(() => fitView({ padding: 0.2 }));
  }, [nodes, fitView]);

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      colorMode="dark"
    >
      <Background gap={24} size={1} />
    </ReactFlow>
  );
}

export function JsonGraphView({ record, onBack }: { record: RequestRecord; onBack: () => void }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const raw = record.responseBody ?? record.requestBody;

  const parsed = useMemo(() => (raw && raw.trim() ? parseJson(raw) : null), [raw]);

  const graph = useMemo(() => {
    if (!parsed?.ok) return null;
    return buildJsonGraph(parsed.value, collapsed);
  }, [parsed, collapsed]);

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      toggleCollapse(id, next);
      return next;
    });
  };

  const collapseAll = () => {
    if (!graph?.ok) return;
    setCollapsed(new Set(graph.graph.nodes.map((n) => n.id)));
  };

  const bodyIsJson = parsed?.ok ?? false;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-base-300 px-3 py-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          ← back
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setCollapsed(new Set())}
        >
          expand all
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={collapseAll}>
          collapse
        </button>
        <span className="text-[10px] text-base-content/50">
          {record.responseBody ? "response" : "request"} body
        </span>
        {record.bodyTruncated && <span className="text-[10px] text-warning">truncated</span>}
        {record.opaque && <span className="text-[10px] text-base-content/50">opaque</span>}
        {record.streaming && <span className="text-[10px] text-base-content/50">streaming</span>}
      </div>
      <div className="min-h-0 flex-1">
        {!bodyIsJson ? (
          <div className="flex h-full items-center justify-center text-sm text-base-content/50">
            response is not JSON
          </div>
        ) : !graph || !graph.ok ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-base-content/50">
            <span>large object — body too large for graph view</span>
          </div>
        ) : (
          <ReactFlowProvider>
            <GraphCanvas
              nodes={toFlowNodes(graph.graph.nodes, collapsed, toggle)}
              edges={graph.graph.edges.map((e) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                label: e.label,
                animated: true,
                style: { stroke: EDGE_COLOR, strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLOR },
              }))}
            />
          </ReactFlowProvider>
        )}
      </div>
    </div>
  );
}
