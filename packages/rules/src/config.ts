/**
 * Configuration constants for the rule engine.
 *
 * SOURCE OF TRUTH: docs/business_rules.md §Configuration Constants
 * All weights and thresholds live here — never inline in formula logic.
 * This is what makes them tunable without touching the formula itself.
 *
 * DO NOT scatter these across modules. If you need a value from here,
 * import RISK_CONFIG — do not re-declare a local constant.
 */
export const RISK_CONFIG = {
  // Defaulter risk score formula weights
  // (days_overdue × WEIGHT_DAYS_OVERDUE) + (broken_promise_count × WEIGHT_BROKEN_PROMISES)
  //   + (remaining_balance_ratio × WEIGHT_BALANCE_RATIO)
  WEIGHT_DAYS_OVERDUE: 2,
  WEIGHT_BROKEN_PROMISES: 15,
  WEIGHT_BALANCE_RATIO: 30,

  // Risk level thresholds
  // high   if risk_score > THRESHOLD_HIGH
  // medium if risk_score > THRESHOLD_MEDIUM
  // low    otherwise
  THRESHOLD_HIGH: 60,
  THRESHOLD_MEDIUM: 30,

  // Reminder tier windows (days overdue)
  REMINDER_TIER_1_START: 1,
  REMINDER_TIER_1_END: 6,
  REMINDER_TIER_2_START: 7,
  REMINDER_TIER_2_END: 13,
  REMINDER_TIER_3_START: 14, // >= 14 days

  // Anomaly detection: duplicate-ref window in minutes
  DUPLICATE_REF_WINDOW_MINUTES: 5,

  // Cheque aging alert threshold in days
  CHEQUE_AGING_ALERT_DAYS: 5,
} as const;

export type RiskLevel = "high" | "medium" | "low";

/**
 * Maps a numeric risk_score to a risk level string.
 * Used by computeDefaulterScore and in defaulter view sorting.
 */
export function scoreToRiskLevel(score: number): RiskLevel {
  if (score > RISK_CONFIG.THRESHOLD_HIGH) return "high";
  if (score > RISK_CONFIG.THRESHOLD_MEDIUM) return "medium";
  return "low";
}
