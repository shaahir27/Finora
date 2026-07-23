/**
 * packages/rules/src/__tests__/duplicateRef.test.ts
 *
 * Pure unit tests for detectDuplicateRef — no mocking needed,
 * no DB access, no external calls (consistent with packages/rules isolation guarantee).
 */

import { describe, it, expect } from "vitest";
import { detectDuplicateRef } from "../duplicateRef";

describe("detectDuplicateRef", () => {
  it("returns isDuplicate=false when there are no existing transactions", () => {
    const result = detectDuplicateRef({
      channel: "upi",
      refNumber: "pay_abc123",
      existingTransactions: [],
    });
    expect(result.isDuplicate).toBe(false);
  });

  it("returns isDuplicate=false when refNumber is empty string", () => {
    const result = detectDuplicateRef({
      channel: "upi",
      refNumber: "",
      existingTransactions: [
        { channel: "upi", refNumber: "pay_abc123", reconciliationStatus: "posted" },
      ],
    });
    expect(result.isDuplicate).toBe(false);
  });

  it("detects a duplicate UPI ref_number", () => {
    const result = detectDuplicateRef({
      channel: "upi",
      refNumber: "pay_abc123",
      existingTransactions: [
        { channel: "upi", refNumber: "pay_abc123", reconciliationStatus: "posted" },
      ],
    });
    expect(result.isDuplicate).toBe(true);
    expect(result.reason).toContain("duplicate_channel_ref");
  });

  it("detects a duplicate cheque ref_number", () => {
    const result = detectDuplicateRef({
      channel: "cheque",
      refNumber: "CHQ-0042",
      existingTransactions: [
        { channel: "cheque", refNumber: "CHQ-0042", reconciliationStatus: "cheque_pending" },
      ],
    });
    expect(result.isDuplicate).toBe(true);
  });

  it("does NOT flag same ref_number on a different channel (channel mismatch)", () => {
    // ref_number 'CHQ-0042' on cheque channel ≠ same ref on cash channel
    const result = detectDuplicateRef({
      channel: "cash",
      refNumber: "CHQ-0042",
      existingTransactions: [
        { channel: "cheque", refNumber: "CHQ-0042", reconciliationStatus: "cheque_pending" },
      ],
    });
    expect(result.isDuplicate).toBe(false);
  });

  it("still flags a duplicate on a reversed transaction", () => {
    // A reversed cheque means the cheque was seen — re-presenting it is still a duplicate ref.
    const result = detectDuplicateRef({
      channel: "cheque",
      refNumber: "CHQ-0099",
      existingTransactions: [
        { channel: "cheque", refNumber: "CHQ-0099", reconciliationStatus: "reversed" },
      ],
    });
    expect(result.isDuplicate).toBe(true);
  });

  it("returns isDuplicate=false when existing transaction has null refNumber", () => {
    const result = detectDuplicateRef({
      channel: "cheque",
      refNumber: "CHQ-0042",
      existingTransactions: [
        { channel: "cheque", refNumber: null, reconciliationStatus: "posted" },
      ],
    });
    expect(result.isDuplicate).toBe(false);
  });
});
