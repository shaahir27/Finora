import { describe, it, expect, vi, beforeEach } from "vitest";
import { bulkImportStudents, updateStudentStatus } from "../app/actions/students";
import { prisma } from "@smart-school/db";

vi.mock("@smart-school/db", () => ({
  prisma: {
    $transaction: vi.fn(async (cb) => cb(prisma)),
    student: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    waiver: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

describe("bulkImportStudents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("partial-batch failure: valid row creates STUDENT, invalid row reported individually, batch not aborted", async () => {
    (prisma.student.create as any)
      .mockResolvedValueOnce({ id: "stu-1", name: "Valid" });

    const result = await bulkImportStudents("school-1", [
      { name: "Valid", class: "10A" },
      { name: "", class: "" }, // Invalid
    ]);

    expect(result.succeeded).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.reason).toBe("Name and class are required.");
    expect(prisma.student.create).toHaveBeenCalledTimes(1);
  });

  it("idempotent re-run: second run creates zero new rows for existing admission numbers", async () => {
    (prisma.student.findFirst as any)
      .mockResolvedValueOnce({ id: "stu-1", admissionNumber: "ADM-1" });

    const result = await bulkImportStudents("school-1", [
      { name: "Valid", class: "10A", admissionNumber: "ADM-1" },
    ]);

    expect(result.succeeded).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(prisma.student.create).not.toHaveBeenCalled();
  });
});

describe("updateStudentStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing disposition when balance is > 0", async () => {
    (prisma.student.findUnique as any).mockResolvedValue({
      id: "stu-1",
      status: "active",
      feeAssignments: [
        {
          id: "fa-1",
          amount: { toNumber: () => 1000 },
          transactions: [],
          waivers: [],
        },
      ],
    });

    await expect(
      updateStudentStatus("stu-1", "admin-1", { status: "withdrawn" })
    ).rejects.toThrow("A balance disposition is required");
  });

  it("write_off creates a real waiver and audit log", async () => {
    (prisma.student.findUnique as any).mockResolvedValue({
      id: "stu-1",
      status: "active",
      feeAssignments: [
        {
          id: "fa-1",
          amount: { toNumber: () => 1000 },
          transactions: [],
          waivers: [],
        },
      ],
    });

    await updateStudentStatus("stu-1", "admin-1", {
      status: "withdrawn",
      balanceDisposition: "write_off",
    });

    expect(prisma.waiver.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 1000,
          approvedById: "admin-1",
        }),
      })
    );

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "waiver_applied_on_exit",
        }),
      })
    );
  });

  it("zero-balance student does not require balance disposition", async () => {
    (prisma.student.findUnique as any).mockResolvedValue({
      id: "stu-1",
      status: "active",
      feeAssignments: [
        {
          id: "fa-1",
          amount: { toNumber: () => 1000 },
          transactions: [{ amount: 1000, reconciliationStatus: "posted" }],
          waivers: [],
        },
      ],
    });

    (prisma.student.update as any).mockResolvedValue({ status: "withdrawn" });

    const result = await updateStudentStatus("stu-1", "admin-1", {
      status: "withdrawn",
    });

    expect(result.status).toBe("withdrawn");
  });
});
