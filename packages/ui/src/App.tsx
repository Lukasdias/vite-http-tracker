import { useMemo, useState } from "react";
import { Background, Controls, ReactFlow } from "@xyflow/react";
import type { Edge } from "@xyflow/react";
import type { RequestRecord } from "@http-tracker/shared";
import { useRequestFilters } from "./hooks/useRequestFilters.js";
import { useRequestSelection } from "./hooks/useRequestSelection.js";
import { useGraph } from "./hooks/useGraph.js";
import { useTrackerConnection } from "./hooks/useTrackerConnection.js";
import { useClearRequests } from "./hooks/useClearRequests.js";
import { useRequest } from "./hooks/useRequests.js";
import { RequestNode, type RequestFlowNode } from "./components/RequestNode.js";
import { FilterBar } from "./components/FilterBar.js";
import { InspectPanel } from "./components/InspectPanel.js";
import { useTrackerToken } from "./hooks/useTrackerToken.js";

const nodeTypes = { request: RequestNode };

export function App() {
  const token = useTrackerToken();
  const wsUrl = useMemo(() => {
    const env = import.meta.env.VITE_HTTP_TRACKER_URL as string | undefined;
    return env ?? `ws://${window.location.hostname}:4000/ws?token=${token}`;
  }, [token]);

  const { connected, send } = useTrackerConnection(wsUrl);
  const [filter, setFilter] = useRequestFilters();
  const [showEdges, setShowEdges] = useState(false);
  const [selectedId, setSelectedId] = useRequestSelection();
  const { filtered, nodes, edges } = useGraph(filter, showEdges);
  const selected = useRequest(selectedId);
  const clear = useClearRequests(send);

  const graphNodes = useMemo<RequestFlowNode[]>(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: "request",
        position: { x: n.x, y: n.y },
        data: { record: filtered.find((r) => r.requestId === n.id) as RequestRecord },
      })),
    [nodes, filtered],
  );
  const graphEdges = useMemo<Edge[]>(() => edges.map((e) => ({ ...e, animated: true })), [edges]);

  return (
    <div className="flex h-screen flex-col bg-base-100 text-base-content">
      <header className="navbar border-b border-base-300">
        <div className="navbar-start">
          <span className="text-lg font-semibold">http-tracker</span>
        </div>
        <div className="navbar-end">
          <span className={`badge badge-sm ${connected ? "badge-success" : "badge-warning"} gap-1`}>
            <span
              className={`status status-sm ${connected ? "status-success" : "status-warning"}`}
            />
            {connected ? "connected" : "disconnected"}
          </span>
        </div>
      </header>
      <FilterBar
        filter={filter}
        onChange={setFilter}
        showEdges={showEdges}
        onShowEdges={setShowEdges}
        onClear={() => clear.mutate(token)}
      />
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <ReactFlow
            nodes={graphNodes}
            edges={graphEdges}
            nodeTypes={nodeTypes}
            fitView
            onNodeClick={(_, node) => setSelectedId(node.id)}
          >
            <Background gap={24} size={1} />
            <Controls className="!bottom-4 !left-4" />
          </ReactFlow>
        </div>
        <div className="hidden w-80 shrink-0 border-l border-base-300 md:block">
          <InspectPanel record={selected} onClose={() => setSelectedId(null)} />
        </div>
      </div>
    </div>
  );
}
