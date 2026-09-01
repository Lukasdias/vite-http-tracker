import { useState } from "react";
import type { RecordFilter } from "../graph.js";

export type RequestFilterState = [RecordFilter, (f: RecordFilter) => void];

export function useRequestFilters(): RequestFilterState {
  return useState<RecordFilter>({});
}
