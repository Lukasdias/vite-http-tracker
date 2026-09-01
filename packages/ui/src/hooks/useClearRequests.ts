import { useMutation } from "@tanstack/react-query";
import type { ConnPayload } from "./useTrackerConnection.js";

export function useClearRequests(send: (payload: ConnPayload) => void) {
  return useMutation({
    mutationFn: async (token: string) => {
      send({ type: "clear", token });
    },
  });
}
