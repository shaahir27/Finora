/**
 * Detects duplicate-channel-ref anomalies for a transaction.
 *
 * Business rule (business_rules.md §Anomaly Detection):
 * A UPI ref_number appearing more than once for the same channel is a duplicate-ref
 * anomaly — most commonly caused by double submission or a webhook retransmission that
 * bypassed the ref_number idempotency check. Cheque ref_numbers (cheque numbers) must
 * also be unique per student to prevent the same cheque being entered twice.
 *
 * This function is a pure predicate over the provided existing transactions — it does NOT
 * query the database. The caller (recordPayment server action) supplies the relevant rows.
 * Zero external calls, consistent with packages/rules isolation guarantee (Principle #1).
 */

export interface DuplicateRefInput {
  channel: string;
  refNumber: string;
  existingTransactions: Array<{
    channel: string;
    refNumber: string | null;
    reconciliationStatus: string;
  }>;
}

/**
 * @returns { isDuplicate: boolean, reason?: string }
 *
 * A transaction is a duplicate if:
 *   - It has a non-null refNumber, AND
 *   - Another transaction in existingTransactions matches on both channel and refNumber.
 *
 * "reversed" transactions are still counted as duplicates — a reversed cheque with
 * a given cheque number still means that cheque has been seen; re-presenting it would
 * be a new cheque, not a retry of the same one.
 */
export function detectDuplicateRef(input: DuplicateRefInput): {
  isDuplicate: boolean;
  reason?: string;
} {
  if (!input.refNumber || input.refNumber.trim() === "") {
    return { isDuplicate: false };
  }

  const match = input.existingTransactions.find(
    (t) =>
      t.channel === input.channel &&
      t.refNumber !== null &&
      t.refNumber === input.refNumber
  );

  if (match) {
    return {
      isDuplicate: true,
      reason: `duplicate_channel_ref: ${input.channel} ref '${input.refNumber}' already exists`,
    };
  }

  return { isDuplicate: false };
}
