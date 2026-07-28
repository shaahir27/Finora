/**
 * Session 2 — Reconciliation State Machine Tests
 *
 * Testing strategy (docs/testing_strategy.md Session 2 targets):
 * 1. cheque initial status: channel=cheque → cheque_pending (not posted).
 * 2. Off-by-one trap: second partial payment ANOMALY_FLAG.expected_amount uses
 *    pre-payment remaining balance, not the original fee amount.
 * 3. Legitimate partial payment: payment exactly matching remaining balance → NOT flagged.
 * 4. UPI idempotency: same ref_number twice → returns existing TRANSACTION, no insert.
 * 5. markChequeBounced: requires reason, writes AUDIT_LOG, triggers computeDefaulterScore.
 * 6. markChequeCleared: flips cheque_pending → posted.
 * 7. resolveSyncConflict: rejects empty reason.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted — runs BEFORE vi.mock factories, safe to reference in the factory
// ---------------------------------------------------------------------------

const {
  mockTx,
  mockPrisma,
  mockExistingTransactions,
  mockFindFirstSlot,
  mockFindUniqueSlot,
} = vi.hoisted(() => {
  // Use objects as mutable reference buckets so tests can mutate them
  const mockExistingTransactions: { value: any[] } = { value: [] };
  const mockFindFirstSlot: { value: any } = { value: null };
  const mockFindUniqueSlot: { value: any } = { value: null };

  const mockTx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "fa-1", amount: 1000 }]),
    transaction: {
      findMany: vi.fn(() => Promise.resolve(mockExistingTransactions.value)),
      findFirst: vi.fn(() => Promise.resolve(mockFindFirstSlot.value)),
      findUnique: vi.fn(() => Promise.resolve(mockFindUniqueSlot.value)),
      create: vi.fn((args: any) =>
        Promise.resolve({ id: "tx-new", ...args.data })
      ),
      update: vi.fn((args: any) =>
        Promise.resolve({ id: args.where?.id ?? "tx-updated", ...args.data })
      ),
    },
    feeAssignment: {
      findUniqueOrThrow: vi.fn(() =>
        Promise.resolve({
          id: "fa-1",
          studentId: "stu-1",
          amount: { toNumber: () => 1000 },
          dueDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
          student: { id: "stu-1", schoolId: "school-1" },
        })
      ),
      findMany: vi.fn(() =>
        Promise.resolve([
          {
            id: "fa-1",
            amount: { toNumber: () => 1000 },
            dueDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
            transactions: mockExistingTransactions.value,
            waivers: [],
          },
        ])
      ),
      findUnique: vi.fn(() => Promise.resolve(mockFindUniqueSlot.value)),
    },
    waiver: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    anomalyFlag: {
      create: vi.fn().mockResolvedValue({ id: "flag-1" }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
    defaulterScore: {
      create: vi.fn().mockResolvedValue({ id: "score-1" }),
    },
  };

  const mockPrisma = {
    $transaction: vi.fn(async (cb: any) => cb(mockTx)),
    offlineSyncConflict: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "conflict-1" }),
      update: vi.fn().mockResolvedValue({ id: "conflict-1" }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
  };

  return { mockTx, mockPrisma, mockExistingTransactions, mockFindFirstSlot, mockFindUniqueSlot };
});

// ---------------------------------------------------------------------------
// Top-level vi.mock — runs BEFORE any import, factory references hoisted vars
// ---------------------------------------------------------------------------

vi.mock("@smart-school/db", () => ({
  prisma: mockPrisma,
  PrismaClient: vi.fn(),
}));

// @smart-school/rules contains only pure functions — no external deps.
// Use the real implementation (importOriginal passthrough).
vi.mock("@smart-school/rules", async (importOriginal) => {
  return importOriginal<typeof import("@smart-school/rules")>();
});

// ---------------------------------------------------------------------------
// Import modules under test (AFTER vi.mock — mock is already registered)
// ---------------------------------------------------------------------------

import { recordPayment, markChequeBounced, markChequeCleared } from "../app/actions/ledger";
import { resolveSyncConflict } from "../app/actions/offlineSync";

// ---------------------------------------------------------------------------
// Reset helper
// ---------------------------------------------------------------------------

function resetMocks() {
  mockExistingTransactions.value = [];
  mockFindFirstSlot.value = null;
  mockFindUniqueSlot.value = null;
  vi.clearAllMocks();
  // Re-install implementations after clearAllMocks wipes them
  mockTx.$queryRaw.mockResolvedValue([{ id: "fa-1", amount: 1000 }]);
  mockTx.transaction.findMany.mockImplementation(() =>
    Promise.resolve(mockExistingTransactions.value)
  );
  mockTx.transaction.findFirst.mockImplementation(() =>
    Promise.resolve(mockFindFirstSlot.value)
  );
  mockTx.transaction.findUnique.mockImplementation(() =>
    Promise.resolve(mockFindUniqueSlot.value)
  );
  mockTx.transaction.create.mockImplementation((args: any) =>
    Promise.resolve({ id: "tx-new", ...args.data })
  );
  mockTx.transaction.update.mockImplementation((args: any) =>
    Promise.resolve({ id: args.where?.id ?? "tx-updated", ...args.data })
  );
  mockTx.feeAssignment.findUniqueOrThrow.mockImplementation(() =>
    Promise.resolve({
      id: "fa-1",
      studentId: "stu-1",
      amount: { toNumber: () => 1000 },
      dueDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      student: { id: "stu-1", schoolId: "school-1" },
    })
  );
  mockTx.feeAssignment.findMany.mockImplementation(() =>
    Promise.resolve([
      {
        id: "fa-1",
        amount: { toNumber: () => 1000 },
        dueDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        transactions: mockExistingTransactions.value,
        waivers: [],
      },
    ])
  );
  mockTx.feeAssignment.findUnique.mockImplementation(() =>
    Promise.resolve(mockFindUniqueSlot.value)
  );
  mockTx.waiver.findMany.mockResolvedValue([]);
  mockTx.anomalyFlag.create.mockResolvedValue({ id: "flag-1" });
  mockTx.auditLog.create.mockResolvedValue({ id: "audit-1" });
  mockTx.defaulterScore.create.mockResolvedValue({ id: "score-1" });
  mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));
  mockPrisma.offlineSyncConflict.findUnique.mockResolvedValue(null);
  mockPrisma.offlineSyncConflict.create.mockResolvedValue({ id: "conflict-1" });
  mockPrisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
}

// ---------------------------------------------------------------------------
// Test group 1: cheque initial status (the bug fix)
// ---------------------------------------------------------------------------

describe("recordPayment — cheque initial status", () => {
  beforeEach(resetMocks);

  it("sets reconciliationStatus to cheque_pending for channel=cheque", async () => {
    await recordPayment("admin-1", "school-1", {
      feeAssignmentId: "fa-1",
      channel: "cheque",
      amount: 1000,
      refNumber: "CHQ-001",
    });

    expect(mockTx.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reconciliationStatus: "cheque_pending",
        }),
      })
    );
  });

  it("sets reconciliationStatus to posted for channel=cash", async () => {
    await recordPayment("admin-1", "school-1", {
      feeAssignmentId: "fa-1",
      channel: "cash",
      amount: 1000,
    });

    expect(mockTx.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reconciliationStatus: "posted",
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Test group 2: Off-by-one anomaly trap
// ---------------------------------------------------------------------------

describe("detectAnomaly — off-by-one trap", () => {
  beforeEach(resetMocks);

  it("uses pre-payment remaining balance as expectedAmount for the SECOND payment", async () => {
    /**
     * fee = 1000, first payment = 500 (already posted).
     * Second payment = 400. Remaining before second = 500.
     * ANOMALY_FLAG.expected_amount MUST be 500, not 1000.
     * Verifies financial_engine.md §4 off-by-one trap.
     */
    mockExistingTransactions.value = [
      {
        amount: { toNumber: () => 500, toString: () => "500", valueOf: () => 500 },
        reconciliationStatus: "posted",
        channel: "cash",
        refNumber: null,
      },
    ];

    await recordPayment("admin-1", "school-1", {
      feeAssignmentId: "fa-1",
      channel: "cash",
      amount: 400, // 400 ≠ 500 remaining → anomaly
    });

    expect(mockTx.anomalyFlag.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          expectedAmount: 500, // pre-payment remaining balance, NOT original 1000
          receivedAmount: 400,
          flagReason: "amount_mismatch",
        }),
      })
    );
  });

  it("does NOT flag anomaly when payment exactly matches remaining balance after prior partial", async () => {
    /**
     * The 'legitimate partial payment' case from testing_strategy.md:
     * fee = 1000, first = 500 posted, second = 500 (exact remaining).
     * Expected: NO ANOMALY_FLAG created.
     */
    mockExistingTransactions.value = [
      {
        amount: { toNumber: () => 500, toString: () => "500", valueOf: () => 500 },
        reconciliationStatus: "posted",
        channel: "cash",
        refNumber: null,
      },
    ];

    await recordPayment("admin-1", "school-1", {
      feeAssignmentId: "fa-1",
      channel: "cash",
      amount: 500, // exactly matches remaining balance
    });

    expect(mockTx.anomalyFlag.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test group 3: UPI idempotency
// ---------------------------------------------------------------------------

describe("recordPayment — UPI idempotency", () => {
  beforeEach(resetMocks);

  it("returns existing TRANSACTION without inserting a duplicate for same ref_number", async () => {
    const existingUpiTx = {
      id: "tx-existing",
      channel: "upi",
      refNumber: "pay_abc123",
      reconciliationStatus: "posted",
    };
    mockFindFirstSlot.value = existingUpiTx;

    const result = await recordPayment("admin-1", "school-1", {
      feeAssignmentId: "fa-1",
      channel: "upi",
      amount: 1000,
      refNumber: "pay_abc123",
    });

    expect(result.isDuplicate).toBe(true);
    expect(mockTx.transaction.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test group 4: markChequeBounced
// ---------------------------------------------------------------------------

describe("markChequeBounced", () => {
  beforeEach(() => {
    resetMocks();
    mockFindUniqueSlot.value = {
      id: "tx-1",
      reconciliationStatus: "cheque_pending",
      amount: { toNumber: () => 500, toString: () => "500", valueOf: () => 500 },
      feeAssignment: {
        student: { id: "stu-1", schoolId: "school-1" },
        transactions: [],
        waivers: [],
      },
    };
  });

  it("requires a non-empty reason", async () => {
    await expect(
      markChequeBounced("admin-1", "tx-1", "")
    ).rejects.toThrow("A reason is required to mark a cheque as bounced.");
  });

  it("writes AUDIT_LOG with action cheque_bounced", async () => {
    await markChequeBounced("admin-1", "tx-1", "Cheque dishonoured by bank");

    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: expect.any(String),
          action: "cheque_bounced",
        }),
      })
    );
  });

  it("triggers computeDefaulterScore recompute — cross-engine dependency", async () => {
    await markChequeBounced("admin-1", "tx-1", "NSF");

    // DEFAULTER_SCORE row must be created — key Session 2 invariant
    expect(mockTx.defaulterScore.create).toHaveBeenCalled();
  });

  it("rejects if transaction is not in cheque_pending state", async () => {
    mockFindUniqueSlot.value = {
      id: "tx-1",
      reconciliationStatus: "posted",
      amount: { toNumber: () => 500, toString: () => "500", valueOf: () => 500 },
      feeAssignment: {
        student: { id: "stu-1", schoolId: "school-1" },
        transactions: [],
        waivers: [],
      },
    };

    await expect(
      markChequeBounced("admin-1", "tx-1", "Attempted bounce on cleared cheque")
    ).rejects.toThrow("expected 'cheque_pending'");
  });
});

// ---------------------------------------------------------------------------
// Test group 5: markChequeCleared
// ---------------------------------------------------------------------------

describe("markChequeCleared", () => {
  beforeEach(() => {
    resetMocks();
    mockFindUniqueSlot.value = {
      id: "tx-1",
      reconciliationStatus: "cheque_pending",
    };
  });

  it("flips reconciliationStatus from cheque_pending to posted", async () => {
    await markChequeCleared("tx-1");

    expect(mockTx.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { reconciliationStatus: "posted" },
      })
    );
  });

  it("rejects if transaction is not cheque_pending", async () => {
    mockFindUniqueSlot.value = { id: "tx-1", reconciliationStatus: "posted" };

    await expect(markChequeCleared("tx-1")).rejects.toThrow("expected 'cheque_pending'");
  });
});

// ---------------------------------------------------------------------------
// Test group 6: resolveSyncConflict — requires reason
// ---------------------------------------------------------------------------

describe("resolveSyncConflict", () => {
  it("rejects empty reason", async () => {
    await expect(
      resolveSyncConflict("conflict-1", "admin-1", "discarded", "")
    ).rejects.toThrow("A reason is required to resolve a sync conflict.");
  });
});
