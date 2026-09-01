import { useMemo } from "react";

export function useTrackerToken(): string {
  return useMemo(() => new URLSearchParams(window.location.search).get("token") ?? "dev", []);
}
