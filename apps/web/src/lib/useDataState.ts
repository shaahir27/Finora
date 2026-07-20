import { useQuery, UseQueryOptions } from "@tanstack/react-query";

export type DataState<T> =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "synced"; data: T }
  | { state: "stale"; data: T }
  | { state: "conflict"; data: T };

export type ExtendedQueryOptions<T> = UseQueryOptions<T, Error> & {
  isRealtimeLive?: boolean;
  hasConflict?: boolean;
};

export function useDataState<T>(options: ExtendedQueryOptions<T>): DataState<T> {
  const query = useQuery(options);

  if (query.status === "pending") {
    if (query.fetchStatus === "idle") {
      return { state: "idle" };
    }
    return { state: "loading" };
  }

  if (query.status === "error") {
    // If we have previous data during an error, treat it as stale
    if (query.data !== undefined) {
      return { state: "stale", data: query.data as T };
    }
    return { state: "loading" };
  }

  const { data } = query;

  if (options.hasConflict) {
    return { state: "conflict", data: data as T };
  }

  if (options.isRealtimeLive === false || query.isStale) {
    return { state: "stale", data: data as T };
  }

  return { state: "synced", data: data as T };
}
