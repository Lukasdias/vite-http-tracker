import { useMemo } from "react";
import {
  buildGraph,
  filterGroups,
  groupRecords,
  type Orientation,
  type RecordFilter,
} from "../graph.js";
import type { RecordGroup } from "../graph.js";
import { useRequests } from "./useRequests.js";

export interface UseGraphResult {
  groups: RecordGroup[];
  nodes: ReturnType<typeof buildGraph>["nodes"];
  edges: ReturnType<typeof buildGraph>["edges"];
}

export function useGraph(
  filter: RecordFilter,
  showEdges: boolean,
  orientation: Orientation,
): UseGraphResult {
  const requests = useRequests();
  const groups = useMemo(() => groupRecords(requests), [requests]);
  const filtered = useMemo(() => filterGroups(groups, filter), [groups, filter]);
  const graph = useMemo(
    () => buildGraph(filtered, showEdges, orientation),
    [filtered, showEdges, orientation],
  );
  return { groups, nodes: graph.nodes, edges: graph.edges };
}
