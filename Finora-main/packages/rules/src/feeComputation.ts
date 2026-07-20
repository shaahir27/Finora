import type { Transaction, Waiver, FeeAssignment } from "@smart-school/db";

/**
 * Calculates the amount paid for a fee assignment.
 * ONLY includes posted transactions (not reversed, flagged, or cheque_pending).
 *
 * Source: docs/financial_engine.md §1
 */
export function calculateAmountPaid(
  transactions: Pick<Transaction, "amount" | "reconciliationStatus">[]
): number {
  return transactions
    .filter((t) => t.reconciliationStatus === "posted")
    .reduce((sum, t) => sum + Number(t.amount), 0);
}

/**
 * Calculates the total waived amount for a fee assignment.
 */
export function calculateWaivedAmount(
  waivers: Pick<Waiver, "amount">[]
): number {
  return waivers.reduce((sum, w) => sum + Number(w.amount), 0);
}

/**
 * Calculates the remaining balance for a fee assignment.
 * remaining_balance = amount - amount_paid - waived_amount
 *
 * This is the ONLY function that should determine how much is still owed.
 */
export function calculateRemainingBalance(
  amount: number | string,
  amountPaid: number,
  waivedAmount: number
): number {
  const bal = Number(amount) - amountPaid - waivedAmount;
  return Math.max(0, bal); // Prevent negative balances from overpayments (handled in Ledger)
}

export type PaymentStatus = "paid" | "partially_paid" | "unpaid" | "overdue";

/**
 * Derives the payment_status based on amount, amount_paid, waived_amount, and due_date.
 *
 * Source: docs/financial_engine.md §2 State Machine
 */
export function derivePaymentStatus(
  amount: number | string,
  amountPaid: number,
  waivedAmount: number,
  dueDate: Date,
  currentDate = new Date()
): PaymentStatus {
  const remaining = calculateRemainingBalance(amount, amountPaid, waivedAmount);
  const isPastDue = currentDate > dueDate;
  const isFullyPaid = remaining <= 0;

  if (isFullyPaid) {
    return "paid";
  }

  if (amountPaid > 0) {
    return isPastDue ? "overdue" : "partially_paid";
  }

  return isPastDue ? "overdue" : "unpaid";
}
