import { useQuery } from "@tanstack/react-query";
import type { RequestRecord } from "@vite-http-tracker/shared";

export const requestsQueryKey = ["requests"] as const;

export function useRequests(): RequestRecord[] {
  const query = useQuery<RequestRecord[]>({
    queryKey: requestsQueryKey,
    queryFn: () => [],
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return query.data ?? [];
}

export function useRequest(requestId: string | null): RequestRecord | null {
  const requests = useRequests();
  return requests.find((r) => r.requestId === requestId) ?? null;
}
