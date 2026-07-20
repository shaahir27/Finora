import { RISK_CONFIG, type RiskLevel, scoreToRiskLevel } from "./config.js";

/**
 * Computes the defaulter risk score for a student based on their active fee assignments.
 *
 * Source: docs/business_rules.md
 *
 * @param daysOverdue Maximum days overdue among unpaid/partially paid fee assignments. 0 if none.
 * @param brokenPromiseCount Number of reminders sent for assignments that are STILL unpaid past their due date.
 * @param totalAmount Total amount of all fee assignments.
 * @param totalAmountPaid Total amount paid across all fee assignments.
 * @param totalWaivedAmount Total waived amount across all fee assignments.
 * @returns { riskLevel: "high" | "medium" | "low", riskScore: number, reason: string }
 */
export function computeDefaulterScore(
  daysOverdue: number,
  brokenPromiseCount: number,
  totalAmount: number | string,
  totalAmountPaid: number | string,
  totalWaivedAmount: number | string
): { riskLevel: RiskLevel; riskScore: number; reason: string } {
  const amount = Number(totalAmount);
  const paid = Number(totalAmountPaid);
  const waived = Number(totalWaivedAmount);

  // remaining_balance_ratio = (amount - amount_paid) / amount
  // We use effective amount paid (paid + waived) so waivers reduce the risk ratio properly.
  // Wait, formula in implementation plan:
  // remaining_balance_ratio = (amount - amount_paid) / amount
  // What about waivers? If a student has a waiver, they owe less. 
  // remaining_balance = amount - paid - waived.
  // ratio = remaining_balance / amount.
  const remainingBalance = Math.max(0, amount - paid - waived);
  const remainingBalanceRatio = amount > 0 ? remainingBalance / amount : 0;

  const riskScore =
    daysOverdue * RISK_CONFIG.WEIGHT_DAYS_OVERDUE +
    brokenPromiseCount * RISK_CONFIG.WEIGHT_BROKEN_PROMISES +
    remainingBalanceRatio * RISK_CONFIG.WEIGHT_BALANCE_RATIO;

  const riskLevel = scoreToRiskLevel(riskScore);

  // Computed reason string (rule-based fallback for AI narration)
  const reason = `Score: ${riskScore.toFixed(1)} (${daysOverdue} days overdue, ${brokenPromiseCount} broken promises, ${(
    remainingBalanceRatio * 100
  ).toFixed(0)}% balance remaining)`;

  return { riskLevel, riskScore, reason };
}
