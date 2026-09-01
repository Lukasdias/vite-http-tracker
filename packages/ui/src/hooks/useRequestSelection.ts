import { useState } from "react";

export type RequestSelectionState = [string | null, (id: string | null) => void];

export function useRequestSelection(): RequestSelectionState {
  return useState<string | null>(null);
}
