import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@smart-school/db";
import { generateReceipt } from "@/app/actions/receipts";
import { rateLimit } from "@/lib/rateLimit";
import { getLedgerSnapshot } from "@/app/actions/ledger";
import { generateReconciliationReport } from "@/app/actions/reports";
import { markReminderSent } from "@/app/actions/reminders";

// ---------------------------------------------------------------------------
// DB & Session mocks
// ---------------------------------------------------------------------------
vi.mock("@/lib/require-session", () => ({
  requireAdminForSchool: vi.fn().mockResolvedValue({ adminId: "admin-1", schoolId: "school-1" }),
  requireAdminSession: vi.fn().mockResolvedValue({ user: { id: "admin-1" } }),
  requireParentSession: vi.fn().mockResolvedValue({ user: { id: "parent-1" } }),
}));

vi.mock("@smart-school/db", () => ({
  prisma: {
    $transaction: vi.fn((cb) => cb(prismaMock)),
    transaction: { findUnique: vi.fn(), count: vi.fn() },
    receipt: { create: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
    auditLog: { create: vi.fn() },
    reminderLog: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/app/actions/ledger", () => ({
  getLedgerSnapshot: vi.fn(),
}));

// Mock Resend to test email sending behaviors
vi.mock("resend", () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: vi.fn(),
    },
  })),
}));

const prismaMock = prisma as any;

describe("Session 6: Polish & Demo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GST & Receipts", () => {
    it("GST-inclusive calculation derives correct back-calculated tax", async () => {
      // Setup mock transaction with taxable fee
      prismaMock.transaction.findUnique.mockResolvedValue({
        id: "tx-1",
        schoolId: "school-1",
        amount: { toNumber: () => 118 }, // ₹118 total paid
        reconciliationStatus: "posted",
        feeAssignment: {
          feeType: {
            gstTreatment: "taxable",
            gstRate: { toNumber: () => 18 }, // 18% GST
          },
        },
      });
      prismaMock.receipt.count.mockResolvedValue(0);
      prismaMock.receipt.create.mockImplementation((args: any) => ({
        ...args.data,
        pdfUrl: "test-url",
      }));

      await generateReceipt("tx-1", "a4");

      expect(prismaMock.receipt.create).toHaveBeenCalled();
      const createArgs = prismaMock.receipt.create.mock.calls[0][0].data;

      // Inclusive formula: 118 * (18 / 118) = 18
      expect(createArgs.gstAmount).toBe(18);
      // Base amount = 118 - 18 = 100
      expect(createArgs.gstDetails.baseAmount).toBe(100);
      expect(createArgs.gstDetails.rate).toBe(18);
      expect(createArgs.gstDetails.treatment).toBe("taxable");
    });
  });

  describe("Rate Limiting", () => {
    it("limits burst calls past the threshold", () => {
      const key = "test-admin:burst";
      let allowedCount = 0;
      for (let i = 0; i < 15; i++) {
        if (rateLimit(key, { limit: 10, windowMs: 60000 })) {
          allowedCount++;
        }
      }
      expect(allowedCount).toBe(10);
    });

    it("allows normal single calls", () => {
      const key = "test-admin:single";
      expect(rateLimit(key, { limit: 10, windowMs: 60000 })).toBe(true);
    });
  });

  describe("Reports", () => {
    it("produces an AUDIT_LOG row when generated", async () => {
      vi.mocked(getLedgerSnapshot).mockResolvedValue({
        transactions: [],
        totalCollected: 0,
        outstandingDuesTotal: 0,
        reconciliationStats: { matchPercentage: 0, flaggedCount: 0 },
        revenueByChannel: [] as { channel: string; amount: number }[],
      } as any);

      await generateReconciliationReport(
        "school-1",
        "2026-01-01",
        "2026-01-31",
        "csv"
      );

      expect(prismaMock.auditLog.create).toHaveBeenCalled();
      const createArgs = prismaMock.auditLog.create.mock.calls[0][0].data;
      expect(createArgs.action).toBe("report_exported");
      expect(createArgs.afterState.format).toBe("csv");
    });
  });

  describe("Reminders", () => {
    it("handles parent with no email safely as a failed/no-email state", async () => {
      prismaMock.reminderLog.findUnique.mockResolvedValue({
        id: "rem-1",
        status: "logged",
        channel: "email",
        feeAssignment: {
          student: {
            guardianOf: [{ parentLink: { user: { email: null } } }], // no email
          },
        },
      });

      await markReminderSent("rem-1");

      expect(prismaMock.reminderLog.update).toHaveBeenCalled();
      const updateArgs = prismaMock.reminderLog.update.mock.calls[0][0].data;
      expect(updateArgs.status).toBe("failed");
      expect(updateArgs.dispatchError).toBe("no email on file");
    });

    it("whatsapp/sms are only simulated_sent", async () => {
      prismaMock.reminderLog.findUnique.mockResolvedValue({
        id: "rem-2",
        status: "logged",
        channel: "whatsapp",
      });

      await markReminderSent("rem-2");

      expect(prismaMock.reminderLog.update).toHaveBeenCalled();
      const updateArgs = prismaMock.reminderLog.update.mock.calls[0][0].data;
      expect(updateArgs.status).toBe("simulated_sent");
      expect(updateArgs.dispatchError).toBeUndefined();
    });
  });
});
