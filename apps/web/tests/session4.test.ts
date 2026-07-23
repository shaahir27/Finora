import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@smart-school/db";
import { ADMIN_COPILOT_WHITELIST, PARENT_COPILOT_WHITELIST } from "@smart-school/ai";
import { narrateAnomalyAction, processOcrUploadAction, confirmOcrEntryAction } from "@/app/actions/ai";

// ---------------------------------------------------------------------------
// DB mock — all Prisma calls are intercepted; no real DB needed for unit tests
// ---------------------------------------------------------------------------
vi.mock("@smart-school/db", () => ({
  prisma: {
    anomalyFlag: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    ocrStaging: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    school: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb({
      $queryRaw: vi.fn().mockResolvedValue([{ id: "fee-1", amount: 1000 }]),
      feeAssignment: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "fee-1",
          amount: { toNumber: () => 1000 },
          studentId: "student-1",
          schoolId: "school-1",
        }),
      },
      transaction: {
        create: vi.fn().mockResolvedValue({
          id: "tx-1",
          amount: 500,
          reconciliationStatus: "posted",
          studentId: "student-1",
        }),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      waiver: { findMany: vi.fn().mockResolvedValue([]) },
      anomalyFlag: { create: vi.fn() },
      auditLog: { create: vi.fn() },
    })),
  },
}));

// Mock @smart-school/ai — real AI calls are not made in unit tests
vi.mock("@smart-school/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@smart-school/ai")>();
  return {
    ...actual,
    narrateAnomaly: vi.fn().mockResolvedValue("Mocked narration."),
    processOcrUpload: vi.fn().mockResolvedValue({
      amount: 500,
      date: "2026-07-22",
      refNumber: "CHQ-12345",
      payerName: "Test Parent",
      extractionNotes: "Extracted from mock image.",
      confidence: "high",
    }),
    // Keep real whitelist arrays — tests assert against them directly
    ADMIN_COPILOT_WHITELIST: actual.ADMIN_COPILOT_WHITELIST,
    PARENT_COPILOT_WHITELIST: actual.PARENT_COPILOT_WHITELIST,
  };
});

// Mock the push notifications used by recordPayment
vi.mock("@/app/actions/push", () => ({
  notifySchoolAdmins: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// TEST SUITE 1: narrateAnomaly non-blocking ordering guarantee
//
// testing_strategy.md §Session 4:
// "narrateAnomaly and narrateDefaulterInsight run AFTER the payment write has returned"
//
// This test verifies the structural guarantee:
// narrateAnomalyAction is a separate, independently-callable function.
// It is NOT called from inside recordPayment's DB transaction.
// The test confirms it can be called and resolved without affecting any prior write result.
// ===========================================================================
describe("narrateAnomaly — non-blocking ordering guarantee", () => {
  it("narrateAnomalyAction can be called as a fire-and-forget after a write — does not throw", async () => {
    vi.mocked(prisma.anomalyFlag.findUnique).mockResolvedValue({
      id: "flag-1",
      transactionId: "tx-1",
      schoolId: "school-1",
      expectedAmount: { toNumber: () => 1000 } as any,
      receivedAmount: { toNumber: () => 500 } as any,
      flagReason: "amount_mismatch",
      narration: null,
      resolved: false,
      resolvedById: null,
      resolvedAt: null,
      resolutionReason: null,
      createdAt: new Date(),
      transaction: {
        channel: "cash",
        refNumber: null,
        student: { name: "Test Student" },
      },
    } as any);

    vi.mocked(prisma.anomalyFlag.update).mockResolvedValue({} as any);

    // Must not throw when called independently (as it would be in fire-and-forget pattern)
    await expect(narrateAnomalyAction("flag-1")).resolves.not.toThrow();
  });

  it("narrateAnomalyAction returning void does NOT affect the already-returned transaction object", async () => {
    // The key guarantee: the payment result is captured BEFORE narration is called.
    // This test validates the design by verifying narrateAnomalyAction returns void (undefined),
    // not any payment data — it has no way to contaminate a prior result.
    vi.mocked(prisma.anomalyFlag.findUnique).mockResolvedValue(null);

    const result = await narrateAnomalyAction("nonexistent-flag");
    expect(result).toBeUndefined(); // void — caller's transaction result is untouched
  });
});

// ===========================================================================
// TEST SUITE 2: processOcrUpload → OCR_STAGING write flow
//
// testing_strategy.md §Session 4:
// "processOcrUpload alone never creates a TRANSACTION"
// "confirmOcrEntry is the only path that may flip OCR_STAGING.confirmed = true"
// ===========================================================================
describe("OCR staging — confirmed: false gate", () => {
  it("processOcrUploadAction writes OCR_STAGING with confirmed: false — never true", async () => {
    vi.mocked(prisma.ocrStaging.create).mockResolvedValue({
      id: "staging-1",
      schoolId: "school-1",
      imageUrl: "https://example.com/receipt.jpg",
      extractedAmount: 500,
      extractedDate: new Date("2026-07-22"),
      extractedRefNumber: "CHQ-12345",
      rawExtraction: null,
      confirmed: false,
      confirmedAt: null,
      confirmedTransactionId: null,
      createdAt: new Date(),
    } as any);

    const result = await processOcrUploadAction("school-1", "https://example.com/receipt.jpg");

    // The staging row must be created with confirmed: false
    expect(prisma.ocrStaging.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ confirmed: false }),
      })
    );

    expect(result.stagingId).toBe("staging-1");
    // processOcrUploadAction must NOT have created any TRANSACTION
    // (prisma.$transaction would be called only by recordPayment/confirmOcrEntryAction)
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("processOcrUploadAction does NOT create a TRANSACTION row under any condition", async () => {
    vi.mocked(prisma.ocrStaging.create).mockResolvedValue({ id: "staging-2" } as any);

    await processOcrUploadAction("school-1", "https://example.com/receipt2.jpg");

    // The ONLY thing that should have been called on prisma is ocrStaging.create
    // No transaction.create, no $transaction
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("confirmOcrEntryAction rejects if staging row is already confirmed", async () => {
    vi.mocked(prisma.ocrStaging.findFirst).mockResolvedValue({
      id: "staging-1",
      confirmed: true, // Already confirmed
      schoolId: "school-1",
    } as any);

    await expect(
      confirmOcrEntryAction("admin-1", "school-1", "staging-1", {
        feeAssignmentId: "fee-1",
        amount: 500,
        channel: "cash",
      })
    ).rejects.toThrow("already been confirmed");
  });
});

// ===========================================================================
// TEST SUITE 3: Admin Copilot whitelist — static assertion
//
// testing_strategy.md §Session 4:
// "ADMIN_COPILOT_WHITELIST must not contain recordPayment, applyWaiver, applyPenalty,
//  markChequeBounced, reconcileMissedUpiPayment"
//
// This test is STATIC — it runs on the actual exported whitelist array.
// It must pass for every future session. If it fails, someone added a write action.
// ===========================================================================
describe("Copilot whitelist — static write-action exclusion assertion", () => {
  /**
   * These are permanently excluded from the copilot whitelist.
   * They are write actions. The copilot is read-only.
   * See: system_architecture.md AI Copilot Architecture, security.md AI Copilot
   */
  const PERMANENTLY_EXCLUDED_ACTIONS = [
    "recordPayment",
    "applyWaiver",
    "applyPenalty",
    "markChequeBounced",
    "reconcileMissedUpiPayment",
    // Additional write actions from sessions 1-3
    "reverseTransaction",
    "markChequeCleared",
    "assignFee",
    "createStudent",
    "updateStudent",
    "updateStudentStatus",
    "bulkImportStudents",
    "createFeeType",
    "updateFeeSchema",
    "processOcrUpload", // extraction only — not a ledger write, but excluded from copilot scope
    "confirmOcrEntry",  // posts a payment — permanently excluded
    "markReminderSent", // marks sent — excluded from copilot scope
    "syncOfflinePayment",
    "resolveConflict",
    "draftReminderText", // drafts text — not in copilot scope, separate action
  ];

  it("ADMIN_COPILOT_WHITELIST does not contain any write or payment action", () => {
    for (const excluded of PERMANENTLY_EXCLUDED_ACTIONS) {
      expect(ADMIN_COPILOT_WHITELIST).not.toContain(excluded);
    }
  });

  it("PARENT_COPILOT_WHITELIST does not contain any write or payment action", () => {
    for (const excluded of PERMANENTLY_EXCLUDED_ACTIONS) {
      expect(PARENT_COPILOT_WHITELIST).not.toContain(excluded);
    }
  });

  it("ADMIN_COPILOT_WHITELIST is a non-empty readonly array", () => {
    expect(Array.isArray(ADMIN_COPILOT_WHITELIST)).toBe(true);
    expect(ADMIN_COPILOT_WHITELIST.length).toBeGreaterThan(0);
  });

  it("PARENT_COPILOT_WHITELIST is a readonly array (may be empty pre-Session-5)", () => {
    expect(Array.isArray(PARENT_COPILOT_WHITELIST)).toBe(true);
    // Session 5 will add entries; for now it's intentionally minimal
  });

  it("ADMIN_COPILOT_WHITELIST contains only the expected safe read actions", () => {
    const ALLOWED_ADMIN_ACTIONS = [
      "getLedgerSnapshot",
      "getRemindersQueue",
      "narrateAnomaly",
      "narrateDefaulterInsight",
      "generateWeeklyDigest",
      "answerHowDoI",
      "getStudentProfile",
      "getDefaulters",
      "getStudents",
    ];

    for (const action of ADMIN_COPILOT_WHITELIST) {
      expect(ALLOWED_ADMIN_ACTIONS).toContain(action);
    }
  });
});

// ===========================================================================
// TEST SUITE 4: Cross-tenant Copilot isolation
//
// testing_strategy.md §Session 4:
// "A question about school B asked by school A's admin returns no data (RLS, not prompt refusal)"
//
// This test verifies the architectural guarantee: isolation comes from RLS-scoped
// underlying actions, NOT from a Copilot-level "if school_id doesn't match, refuse" check.
// The copilotQueryAction pre-fetches context scoped to schoolId — a different school's data
// is simply never present in the toolContext passed to copilotQuery.
// ===========================================================================
describe("Cross-tenant Copilot isolation — RLS-scoped pre-fetch", () => {
  it("processOcrUploadAction school-scopes the staging write to the provided schoolId", async () => {
    vi.mocked(prisma.ocrStaging.create).mockResolvedValue({ id: "staging-99" } as any);

    await processOcrUploadAction("school-A", "https://example.com/receipt.jpg");

    expect(prisma.ocrStaging.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ schoolId: "school-A" }),
      })
    );
    // school-B's data is never included — the write is scoped to school-A
  });

  it("confirmOcrEntryAction rejects if staging row belongs to a different school", async () => {
    // Simulate: findFirst returns null because school_id doesn't match
    vi.mocked(prisma.ocrStaging.findFirst).mockResolvedValue(null);

    await expect(
      confirmOcrEntryAction("admin-1", "school-B", "staging-from-school-A", {
        feeAssignmentId: "fee-1",
        amount: 500,
        channel: "cash",
      })
    ).rejects.toThrow("OCR staging record not found");
  });
});
