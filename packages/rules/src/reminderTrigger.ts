import { RISK_CONFIG } from "./config";

/**
 * Evaluates whether a reminder should be triggered based on days overdue and last triggered tier.
 *
 * Source: docs/business_rules.md §Reminder Strategy
 *
 * @param daysOverdue Number of days past the due date. Negative if not yet due.
 * @param lastTriggeredTier The highest tier (0, 1, 2, 3) that has already been triggered.
 * @returns { shouldTrigger: boolean, newTier: number }
 */
export function evaluateReminderTrigger(
  daysOverdue: number,
  lastTriggeredTier: number,
  options?: { isPaymentInFlight?: boolean }
): { shouldTrigger: boolean; newTier: number; reason?: string } {
  // Smart Reminder Muting: suppress reminders if payment is currently in-flight
  if (options?.isPaymentInFlight) {
    return { shouldTrigger: false, newTier: lastTriggeredTier, reason: "payment_in_flight" };
  }

  if (daysOverdue < RISK_CONFIG.REMINDER_TIER_1_START) {
    return { shouldTrigger: false, newTier: lastTriggeredTier };
  }

  // Tier 3: >= 14 days
  if (daysOverdue >= RISK_CONFIG.REMINDER_TIER_3_START) {
    if (lastTriggeredTier < 3) {
      return { shouldTrigger: true, newTier: 3 };
    }
    return { shouldTrigger: false, newTier: lastTriggeredTier };
  }

  // Tier 2: 7 to 13 days
  if (
    daysOverdue >= RISK_CONFIG.REMINDER_TIER_2_START &&
    daysOverdue <= RISK_CONFIG.REMINDER_TIER_2_END
  ) {
    if (lastTriggeredTier < 2) {
      return { shouldTrigger: true, newTier: 2 };
    }
    return { shouldTrigger: false, newTier: lastTriggeredTier };
  }

  // Tier 1: 1 to 6 days
  if (
    daysOverdue >= RISK_CONFIG.REMINDER_TIER_1_START &&
    daysOverdue <= RISK_CONFIG.REMINDER_TIER_1_END
  ) {
    if (lastTriggeredTier < 1) {
      return { shouldTrigger: true, newTier: 1 };
    }
    return { shouldTrigger: false, newTier: lastTriggeredTier };
  }

  return { shouldTrigger: false, newTier: lastTriggeredTier };
}
