import { useMemo, useState } from "react";
import { Background, Controls, MarkerType, ReactFlow } from "@xyflow/react";
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
import type { Orientation } from "./graph.js";

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
  const [orientation, setOrientation] = useState<Orientation>("horizontal");
  const [selectedId, setSelectedId] = useRequestSelection();
  const { groups, nodes, edges } = useGraph(filter, showEdges, orientation);
  const selected = useRequest(selectedId);
  const clear = useClearRequests(send);

  const graphNodes = useMemo<RequestFlowNode[]>(
    () =>
      nodes.map((n) => {
        const group = groups.find((g) => g.canonical.requestId === n.id);
        return {
          id: n.id,
          type: "request",
          position: { x: n.x, y: n.y },
          data: {
            record: (group?.canonical ?? selected) as RequestRecord,
            dupCount: n.dupCount,
            strictMode: n.strictMode,
            memberIds: n.memberIds,
            batchSize: n.batchSize,
          },
        };
      }),
    [nodes, groups, selected],
  );
  const graphEdges = useMemo<Edge[]>(
    () =>
      edges.map((e) => ({
        ...e,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      })),
    [edges],
  );

  const selectedGroup = useMemo(
    () => groups.find((g) => g.canonical.requestId === selectedId) ?? null,
    [groups, selectedId],
  );

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
        orientation={orientation}
        onOrientation={setOrientation}
        onClear={() => clear.mutate(token)}
      />
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <ReactFlow
            key={orientation}
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
          <InspectPanel
            group={selectedGroup}
            record={selected}
            onClose={() => setSelectedId(null)}
          />
        </div>
      </div>
    </div>
  );
}
