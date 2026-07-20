import { describe, it, expect, vi, beforeEach } from "vitest";
import { applyWaiver, applyPenalty } from "../app/actions/ledger";
import { prisma } from "@smart-school/db";

// Mock prisma for testing application layer validation
// (DB constraint tests require a real DB, which is handled in integration tests)
vi.mock("@smart-school/db", () => ({
  prisma: {
    $transaction: vi.fn(async (cb) => cb(prisma)),
    feeAssignment: {
      findUnique: vi.fn().mockResolvedValue({
        id: "fa-1",
        studentId: "stu-1",
        amount: { toNumber: () => 1000 },
        transactions: [],
        waivers: [],
        dueDate: new Date(),
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    waiver: {
      create: vi.fn().mockResolvedValue({ id: "waiver-1" }),
    },
    penalty: {
      create: vi.fn().mockResolvedValue({ id: "penalty-1" }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
    defaulterScore: {
      create: vi.fn().mockResolvedValue({ id: "score-1" }),
    },
  },
}));

describe("applyWaiver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("produces a matching AUDIT_LOG row", async () => {
    await applyWaiver("admin-1", "school-1", "fa-1", {
      amount: 100,
      reason: "Discount",
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: "admin-1",
          action: "waiver_applied",
        }),
      })
    );
  });

  it("rejects null or empty reason at application layer", async () => {
    await expect(
      applyWaiver("admin-1", "school-1", "fa-1", { amount: 100, reason: "" })
    ).rejects.toThrow("A reason is required to apply a waiver.");
  });

  it("rejects null or empty approver at application layer", async () => {
    await expect(
      applyWaiver("", "school-1", "fa-1", { amount: 100, reason: "Discount" })
    ).rejects.toThrow("An approver is required to apply a waiver.");
  });
});

describe("applyPenalty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("produces a matching AUDIT_LOG row", async () => {
    await applyPenalty("admin-1", "tx-1", {
      amount: 50,
      reason: "Late fee",
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: "admin-1",
          action: "penalty_applied",
        }),
      })
    );
  });

  it("rejects null or empty reason at application layer", async () => {
    await expect(
      applyPenalty("admin-1", "tx-1", { amount: 50, reason: "" })
    ).rejects.toThrow("A reason is required to apply a penalty.");
  });
});
