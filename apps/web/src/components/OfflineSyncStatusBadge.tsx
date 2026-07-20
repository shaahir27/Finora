export type OfflineSyncStatus = "queued" | "syncing" | "synced" | "conflict";

export function OfflineSyncStatusBadge({ status }: { status: OfflineSyncStatus }) {
  let colorClass = "";
  let label = status;

  switch (status) {
    case "queued":
    case "syncing":
      colorClass = "bg-status-cheque-pending text-text-primary";
      break;
    case "synced":
      colorClass = "bg-risk-low text-text-primary";
      break;
    case "conflict":
      colorClass = "bg-risk-high text-text-primary";
      break;
  }

  return (
    <span className={`px-2 py-1 text-xs font-semibold uppercase rounded-full ${colorClass}`}>
      {label}
    </span>
  );
}
