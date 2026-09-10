import { useMemo } from "react";
import {
  buildGroupedGraph,
  filterGroups,
  groupRecords,
  type DomainNode,
  type Orientation,
  type RecordFilter,
} from "../graph.js";
import type { RecordGroup } from "../graph.js";
import { useRequests } from "./useRequests.js";

export interface UseGraphResult {
  groups: RecordGroup[];
  domainNodes: DomainNode[];
  nodes: ReturnType<typeof buildGroupedGraph>["nodes"];
  edges: ReturnType<typeof buildGroupedGraph>["edges"];
}

export function useGraph(
  filter: RecordFilter,
  showEdges: boolean,
  orientation: Orientation,
  stackBursts = false,
): UseGraphResult {
  const requests = useRequests();
  const groups = useMemo(
    () => groupRecords(requests, undefined, stackBursts),
    [requests, stackBursts],
  );
  const filtered = useMemo(() => filterGroups(groups, filter), [groups, filter]);
  const graph = useMemo(
    () => buildGroupedGraph(filtered, showEdges, orientation),
    [filtered, showEdges, orientation],
  );
  return { groups, domainNodes: graph.domainNodes, nodes: graph.nodes, edges: graph.edges };
}
