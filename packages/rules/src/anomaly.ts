import { RISK_CONFIG } from "./config";

/**
 * Evaluates whether an anomaly should be flagged for a transaction based on amount mismatch.
 *
 * CRITICAL TRAP: amountPaidBeforeThisTransaction MUST NOT include the current transaction's amount.
 * If it does, every payment looks anomalous because the baseline expected amount shifts.
 * Source: docs/financial_engine.md §4
 *
 * @param amount The original fee assignment amount.
 * @param amountPaidBeforeThisTransaction The amount paid BEFORE this transaction occurred.
 * @param waivedAmount Total waived amount for this fee assignment.
 * @param receivedAmount The amount received in this transaction.
 * @returns { isAnomalous: boolean, reason?: string, expectedAmount: number }
 */
export function detectAnomaly(
  amount: number | string,
  amountPaidBeforeThisTransaction: number,
  waivedAmount: number,
  receivedAmount: number | string
): { isAnomalous: boolean; reason?: string; expectedAmount: number } {
  const numAmount = Number(amount);
  const numReceived = Number(receivedAmount);

  // Expected amount is the remaining balance BEFORE this payment
  const expectedAmount = numAmount - amountPaidBeforeThisTransaction - waivedAmount;

  // A legitimate partial payment is NOT an anomaly.
  // We only flag if receivedAmount is exactly equal to expectedAmount? No.
  // Anomaly flag: "received_amount !== expected_amount" applies when we expect full payment,
  // BUT the requirements explicitly say: "A legitimate partial payment is NOT an anomaly" (testing_strategy.md).
  // Wait, business_rules.md / financial_engine.md §4 says:
  // "expected_amount = FEE_ASSIGNMENT.amount − amount_paid_before_this_transaction − SUM(applicable WAIVER.amount)"
  // "if received_amount !== expected_amount -> flagged"
  // Wait, if received_amount !== expected_amount, it's flagged. BUT testing strategy says:
  // "A payment matching the true remaining balance after a prior partial payment does NOT trigger flagged".
  // What about a partial payment itself? financial_engine.md §4 says "If a parent intends a partial payment, the received amount won't match the expected full balance, which flags an anomaly."
  // So any payment that doesn't exactly match the remaining balance is an anomaly (amount_mismatch).
  // An admin later resolves it if it was a legitimate partial payment. Or they use the UI to say "this is partial".
  // Actually, testing_strategy says: "A payment matching the true remaining balance after a prior partial payment does **not** trigger flagged — this is the "legitimate partial payment is not an anomaly" case from financial_engine.md §4"
  // This means: if remaining balance is 500 (after a prior partial of 500), and they pay 500, it's NOT an anomaly.
  // If remaining balance is 1000, and they pay 500, IS it an anomaly? Yes, because 500 !== 1000.
  // So the rule is simply: receivedAmount !== expectedAmount.

  if (numReceived !== expectedAmount) {
    return {
      isAnomalous: true,
      reason: "amount_mismatch",
      expectedAmount,
    };
  }

  return {
    isAnomalous: false,
    expectedAmount,
  };
}
