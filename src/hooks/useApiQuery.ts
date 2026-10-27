import { keepPreviousData, useQuery, type QueryKey } from "@tanstack/react-query";
import { ApiError } from "../lib/apiClient";

/**
 * A cached API read with the shape pages already use: data, a first-load flag, a readable
 * error and a reload function.
 *
 * Returning to a page shows the cached data at once and refreshes it in the background.
 * With `keepPrevious`, changing a list's filter or page keeps the current rows on screen
 * until the new ones arrive instead of flashing back to skeletons.
 */
export function useApiQuery<T>(
  key: QueryKey,
  fetcher: () => Promise<T>,
  { fallbackError = "Something went wrong.", keepPrevious = false, enabled = true }: {
    fallbackError?: string;
    keepPrevious?: boolean;
    enabled?: boolean;
  } = {},
) {
  const query = useQuery({
    queryKey: key,
    queryFn: fetcher,
    enabled,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
  });
  const error = query.error ? (query.error instanceof ApiError ? query.error.message : fallbackError) : null;
  return {
    data: query.data,
    /** True only while there's nothing to show yet (not during background refreshes). */
    isLoading: query.isPending && enabled,
    isRefreshing: query.isFetching && !query.isPending,
    error,
    errorStatus: query.error instanceof ApiError ? query.error.status : null,
    reload: () => query.refetch(),
  };
}
