import type { Edge, EdgeProps } from "@xyflow/react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@xyflow/react";

export interface LinkedEdgeData extends Record<string, unknown> {
  gap?: number;
}

export type LinkedFlowEdge = Edge<LinkedEdgeData, "linked">;

export function LinkedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
}: EdgeProps<LinkedFlowEdge>) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        className="linked-edge"
        style={{ stroke: "#54a7ff", strokeWidth: 2 }}
      />
      {data?.gap != null && (
        <EdgeLabelRenderer>
          <div
            className="edge-label"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {data.gap}ms
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
