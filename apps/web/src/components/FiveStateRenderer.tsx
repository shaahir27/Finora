import { ReactNode } from "react";
import { DataState } from "@/lib/useDataState";

interface FiveStateRendererProps<T> {
  state: DataState<T>;
  children: (data: T) => ReactNode;
}

export function FiveStateRenderer<T>({ state, children }: FiveStateRendererProps<T>) {
  if (state.state === "idle" || state.state === "loading") {
    return (
      <div className="w-full h-32 flex items-center justify-center text-text-secondary animate-pulse">
        Loading...
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {/* If stale, show a subtle banner or indicator at the top, but still render the data */}
      {state.state === "stale" && (
        <div className="absolute top-0 right-0 m-2 px-2 py-1 bg-yellow-900/50 text-yellow-200 text-xs rounded shadow-md z-10 pointer-events-none border border-yellow-700/50">
          Stale / Reconnecting...
        </div>
      )}
      
      {/* If conflict, highlight strongly */}
      {state.state === "conflict" && (
        <div className="absolute top-0 left-0 right-0 bg-risk-high/90 text-white text-sm py-1 px-4 text-center z-10 border-b border-red-900/50">
          Sync Conflict Detected
        </div>
      )}

      {/* The actual data rendering */}
      <div className={`${state.state === "conflict" ? "opacity-75" : ""}`}>
        {children(state.data)}
      </div>
    </div>
  );
}
