import { ReconciliationStatus } from "@smart-school/db";

export function ReconciliationStatusBadge({ status }: { status: ReconciliationStatus }) {
  let colorClass = "";
  let label = status.replace("_", " ");

  switch (status) {
    case "posted":
      colorClass = "bg-status-posted text-text-primary";
      break;
    case "cheque_pending":
      colorClass = "bg-status-cheque-pending text-text-primary";
      break;
    case "flagged":
      colorClass = "bg-status-flagged text-text-primary";
      break;
    case "reversed":
      colorClass = "bg-status-reversed text-text-primary";
      break;
  }

  return (
    <span className={`px-2 py-1 text-xs font-semibold uppercase rounded-full ${colorClass}`}>
      {label}
    </span>
  );
}

// Payment Status could be paid, partial, unpaid depending on the context
export function PaymentStatusBadge({ status }: { status: "paid" | "partial" | "unpaid" }) {
  let colorClass = "";

  switch (status) {
    case "paid":
      colorClass = "bg-status-posted text-text-primary";
      break;
    case "partial":
      colorClass = "bg-status-cheque-pending text-text-primary";
      break;
    case "unpaid":
      colorClass = "bg-status-flagged text-text-primary";
      break;
  }

  return (
    <span className={`px-2 py-1 text-xs font-semibold uppercase rounded-full ${colorClass}`}>
      {status}
    </span>
  );
}
