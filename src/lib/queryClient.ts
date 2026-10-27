import { QueryClient } from "@tanstack/react-query";
import { ApiError, onMutationSuccess } from "./apiClient";

/**
 * Shared cache for API reads. Data counts as fresh for 30 s (no refetch when you move
 * between pages), stays in memory for 10 minutes, and refetches quietly in the background
 * after that or when the window regains focus.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: true,
      // Retry once for network blips, never for "not allowed" or "not found".
      retry: (failures, error) =>
        failures < 1 && !(error instanceof ApiError && [400, 401, 403, 404, 409, 422].includes(error.status)),
    },
  },
});

// Any successful write may change what lists and pages show: mark everything stale so what
// is on screen refetches in the background, and other pages refetch when next opened.
onMutationSuccess(() => {
  void queryClient.invalidateQueries();
});

/** Drops every cached response (logout, switching business). */
export function clearQueryCache() {
  queryClient.clear();
}
