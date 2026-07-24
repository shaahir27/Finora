import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@smart-school/db";
import { PARENT_COPILOT_WHITELIST } from "@smart-school/ai";
import {
  createParentAccount,
  addStudentToParent,
  getMyChildrenDues,
  payDueViaUpi,
  getMyPaymentHistory,
  getParentLinkId,
  getParentSchoolId,
} from "@/app/actions/parents";

// ---------------------------------------------------------------------------
// DB mock — no real DB for unit tests
// ---------------------------------------------------------------------------
vi.mock("@smart-school/db", () => ({
  prisma: {
    user: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    parentLink: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    guardianOf: {
      create: vi.fn(),
      delete: vi.fn(),
    },
    feeAssignment: {
      findUnique: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb({
      user: { create: vi.fn() },
      parentLink: { create: vi.fn() },
      guardianOf: { create: vi.fn() },
    })),
  },
}));

// ---------------------------------------------------------------------------
// Session 5 — Test Suite
// ---------------------------------------------------------------------------

describe("Session 5 — Parent Portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Test 1: createParentAccount requires at least one student
  // -------------------------------------------------------------------------
  it("createParentAccount: rejects if no students provided", async () => {
    await expect(
      createParentAccount("school-1", {
        name: "Test Parent",
        phone: "+919876543210",
        studentIds: [],
      })
    ).rejects.toThrow("at least one linked student");
  });

  // -------------------------------------------------------------------------
  // Test 2: createParentAccount enforces E.164 format
  // -------------------------------------------------------------------------
  it("createParentAccount: rejects non-E.164 phone number", async () => {
    await expect(
      createParentAccount("school-1", {
        name: "Test Parent",
        phone: "9876543210", // missing +country code
        studentIds: ["student-1"],
      })
    ).rejects.toThrow("E.164 format");
  });

  // -------------------------------------------------------------------------
  // Test 3: createParentAccount rejects duplicate phone
  // -------------------------------------------------------------------------
  it("createParentAccount: rejects duplicate phone with ALREADY_REGISTERED", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
      id: "user-existing",
      role: "parent",
      schoolId: "school-1",
      email: null,
      phone: "+919876543210",
    } as any);

    await expect(
      createParentAccount("school-1", {
        name: "Another Parent",
        phone: "+919876543210",
        studentIds: ["student-1"],
      })
    ).rejects.toThrow("ALREADY_REGISTERED");
  });

  // -------------------------------------------------------------------------
  // Test 4: getMyChildrenDues returns empty array for unknown userId
  // -------------------------------------------------------------------------
  it("getMyChildrenDues: returns [] for userId with no parentLink", async () => {
    vi.mocked(prisma.parentLink.findUnique).mockResolvedValueOnce(null);
    const result = await getMyChildrenDues("unknown-user");
    expect(result).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Test 5: payDueViaUpi rejects zero amount
  // -------------------------------------------------------------------------
  it("payDueViaUpi: rejects amount <= 0", async () => {
    await expect(payDueViaUpi("fee-1", 0)).rejects.toThrow("greater than 0");
    await expect(payDueViaUpi("fee-1", -5)).rejects.toThrow("greater than 0");
  });

  // -------------------------------------------------------------------------
  // Test 6: payDueViaUpi rejects overpayment
  // -------------------------------------------------------------------------
  it("payDueViaUpi: rejects amount exceeding remaining balance", async () => {
    vi.mocked(prisma.feeAssignment.findUnique).mockResolvedValueOnce({
      id: "fee-1",
      amount: { toNumber: () => 1000 },
      transactions: [], // no transactions
      waivers: [],
    } as any);

    await expect(payDueViaUpi("fee-1", 1500)).rejects.toThrow("remaining balance");
  });

  // -------------------------------------------------------------------------
  // Test 7: PARENT_COPILOT_WHITELIST never contains any write action
  // -------------------------------------------------------------------------
  it("PARENT_COPILOT_WHITELIST: never includes write actions", () => {
    const PERMANENTLY_BANNED = [
      "recordPayment",
      "applyWaiver",
      "applyPenalty",
      "markChequeBounced",
      "reconcileMissedUpiPayment",
      "reverseTransaction",
      "markChequeCleared",
      "createParentAccount",
      "addStudentToParent",
      "removeStudentFromParent",
    ];

    for (const banned of PERMANENTLY_BANNED) {
      expect(PARENT_COPILOT_WHITELIST).not.toContain(banned),
        `Write action "${banned}" must never appear in PARENT_COPILOT_WHITELIST`;
    }
  });
});
