import { useMemo } from "react";
import { buildGraph, filterRecords, type RecordFilter } from "../graph.js";
import type { RequestRecord } from "@http-tracker/shared";
import { useRequests } from "./useRequests.js";

export interface UseGraphResult {
  filtered: RequestRecord[];
  nodes: ReturnType<typeof buildGraph>["nodes"];
  edges: ReturnType<typeof buildGraph>["edges"];
}

export function useGraph(filter: RecordFilter, showEdges: boolean): UseGraphResult {
  const requests = useRequests();
  const filtered = useMemo(() => filterRecords(requests, filter), [requests, filter]);
  const graph = useMemo(() => buildGraph(filtered, showEdges), [filtered, showEdges]);
  return { filtered, nodes: graph.nodes, edges: graph.edges };
}
