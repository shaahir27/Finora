"use server";

import { prisma, type Student, type StudentStatus, type BalanceDisposition } from "@smart-school/db";
import { calculateRemainingBalance, calculateWaivedAmount, calculateAmountPaid } from "@smart-school/rules";
import { applyWaiver } from "./ledger"; // We'll build this in Phase 5

/**
 * Creates a new student.
 * Must be unique per school_id and admission_number.
 */
export async function createStudent(
  schoolId: string,
  data: { name: string; class: string; admissionNumber?: string }
): Promise<Student> {
  // Enforce admission number uniqueness per school if provided
  if (data.admissionNumber) {
    const existing = await prisma.student.findFirst({
      where: {
        schoolId,
        admissionNumber: data.admissionNumber,
      },
    });

    if (existing) {
      throw new Error(`Admission number ${data.admissionNumber} already exists in this school.`);
    }
  }

  return prisma.student.create({
    data: {
      name: data.name,
      class: data.class,
      schoolId,
      admissionNumber: data.admissionNumber || null,
      status: "active",
    },
  });
}

/**
 * Bulk imports students from a parsed CSV or array.
 * Safe to re-run: skips existing admission numbers.
 * One bad row does NOT abort the batch.
 */
export async function bulkImportStudents(
  schoolId: string,
  studentsData: Array<{ name: string; class: string; admissionNumber?: string }>
) {
  const succeeded: Student[] = [];
  const failed: { row: any; reason: string }[] = [];
  const skipped: Student[] = [];

  for (const row of studentsData) {
    try {
      if (!row.name || !row.class) {
        failed.push({ row, reason: "Name and class are required." });
        continue;
      }

      if (row.admissionNumber) {
        const existing = await prisma.student.findFirst({
          where: { schoolId, admissionNumber: row.admissionNumber },
        });

        if (existing) {
          skipped.push(existing);
          continue;
        }
      }

      const created = await prisma.student.create({
        data: {
          name: row.name,
          class: row.class,
          schoolId,
          admissionNumber: row.admissionNumber || null,
          status: "active",
        },
      });
      succeeded.push(created);
    } catch (error: any) {
      failed.push({ row, reason: error.message || "Unknown error" });
    }
  }

  return { succeeded, failed, skipped };
}

/**
 * Updates basic student info.
 */
export async function updateStudent(
  studentId: string,
  changes: { name?: string; class?: string; admissionNumber?: string }
): Promise<Student> {
  return prisma.student.update({
    where: { id: studentId },
    data: changes,
  });
}

/**
 * Updates student lifecycle status (Phase 15).
 * Rejects outright if status is non-active, balance > 0, and balanceDisposition is missing.
 */
export async function updateStudentStatus(
  studentId: string,
  adminId: string,
  data: { status: StudentStatus; balanceDisposition?: BalanceDisposition }
): Promise<Student> {
  return prisma.$transaction(async (tx) => {
    const student = await tx.student.findUnique({
      where: { id: studentId },
      include: {
        feeAssignments: {
          include: {
            transactions: {
              where: { reconciliationStatus: "posted" },
            },
            waivers: true,
          },
        },
      },
    });

    if (!student) throw new Error("Student not found");

    // If status isn't changing, nothing to do
    if (student.status === data.status) {
      return student;
    }

    // Calculate total remaining balance
    let totalRemainingBalance = 0;
    for (const assignment of student.feeAssignments) {
      const amountPaid = calculateAmountPaid(assignment.transactions);
      const waivedAmount = calculateWaivedAmount(assignment.waivers);
      const remaining = calculateRemainingBalance(assignment.amount.toNumber(), amountPaid, waivedAmount);
      totalRemainingBalance += remaining;
    }

    if (data.status !== "active" && totalRemainingBalance > 0 && !data.balanceDisposition) {
      throw new Error("A balance disposition is required when deactivating a student with a nonzero balance.");
    }

    if (data.status !== "active" && totalRemainingBalance > 0 && data.balanceDisposition === "write_off") {
      // Apply waiver to each assignment that has a remaining balance
      for (const assignment of student.feeAssignments) {
        const amountPaid = calculateAmountPaid(assignment.transactions);
        const waivedAmount = calculateWaivedAmount(assignment.waivers);
        const remaining = calculateRemainingBalance(assignment.amount.toNumber(), amountPaid, waivedAmount);

        if (remaining > 0) {
          // This requires applying a waiver directly on the fee assignment
          await tx.waiver.create({
            data: {
              feeAssignmentId: assignment.id,
              amount: remaining,
              approvedById: adminId,
              reason: `Write-off on ${data.status}, ${new Date().toISOString().split("T")[0]}`,
            },
          });

          await tx.auditLog.create({
            data: {
              actorId: adminId,
              action: "waiver_applied_on_exit",
              beforeState: { balance: remaining },
              afterState: { balance: 0 },
            },
          });
        }
      }
    }

    // Update status
    return tx.student.update({
      where: { id: studentId },
      data: {
        status: data.status,
        statusChangedAt: new Date(),
        balanceDisposition: data.balanceDisposition || null,
      },
    });
  });
}

/**
 * Gets the consolidated profile for a student (Phase 14).
 * School-scoped read-only aggregation.
 */
export async function getStudentProfile(schoolId: string, studentId: string) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    include: {
      feeAssignments: {
        include: {
          feeType: true,
          transactions: true,
          waivers: { include: { approvedBy: true } },
        },
      },
      transactions: {
        orderBy: { postedAt: "desc" },
        include: {
          feeAssignment: { include: { feeType: true } },
          penalties: true,
        },
      },
      defaulterScores: {
        orderBy: { computedAt: "desc" },
      },
    },
  });

  if (!student) throw new Error("Student not found");

  return student;
}

/**
 * Gets a paginated list of students for the directory.
 */
export async function getStudents(
  schoolId: string,
  options?: {
    search?: string;
    status?: StudentStatus;
    cursor?: string;
    limit?: number;
  }
) {
  const limit = options?.limit || 50;
  
  const where: any = { schoolId };
  if (options?.status) where.status = options.status;
  if (options?.search) {
    where.OR = [
      { name: { contains: options.search, mode: "insensitive" } },
      { admissionNumber: { contains: options.search, mode: "insensitive" } }
    ];
  }

  const students = await prisma.student.findMany({
    where,
    take: limit + 1,
    ...(options?.cursor ? { cursor: { id: options.cursor } } : {}),
    orderBy: { name: "asc" },
    include: {
      feeAssignments: {
        include: {
          transactions: { select: { amount: true, reconciliationStatus: true } },
          waivers: { select: { amount: true } }
        }
      }
    }
  });

  let nextCursor: string | undefined = undefined;
  if (students.length > limit) {
    const nextItem = students.pop();
    nextCursor = nextItem?.id;
  }

  // Calculate balance for each student
  const mapped = students.map(student => {
    let totalBalance = 0;
    for (const a of student.feeAssignments) {
      const pd = calculateAmountPaid(a.transactions);
      const wv = calculateWaivedAmount(a.waivers);
      const bal = calculateRemainingBalance(a.amount.toNumber(), pd, wv);
      totalBalance += bal;
    }
    
    // Omit heavy relations for the list view
    const { feeAssignments, ...rest } = student;
    return { ...rest, totalBalance };
  });

  return {
    students: mapped,
    nextCursor
  };
}
