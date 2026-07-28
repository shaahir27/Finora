"use server";

import { prisma, type Student, type StudentStatus, type BalanceDisposition } from "@smart-school/db";
import { calculateRemainingBalance, calculateWaivedAmount, calculateAmountPaid } from "@smart-school/rules";
import { applyWaiver } from "./ledger"; // We'll build this in Phase 5
import { requireAdminForSchool } from "@/lib/require-session";
import { isDemoMode, DEMO_WRITE_ERROR } from "@/lib/demo-mode";
import { getDemoStudents, getDemoStudentProfile } from "@/lib/demo-data";

/**
 * Creates a new student.
 * Must be unique per school_id and admission_number.
 */
export async function createStudent(
  schoolId: string,
  data: { name: string; class: string; admissionNumber?: string }
): Promise<Student> {
  if (isDemoMode()) throw new Error(DEMO_WRITE_ERROR);

  await requireAdminForSchool(schoolId);

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

  try {
    return await prisma.student.create({
      data: {
        name: data.name,
        class: data.class,
        schoolId,
        admissionNumber: data.admissionNumber || null,
        status: "active",
      },
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      throw new Error(`Admission number ${data.admissionNumber} already exists in this school.`);
    }
    throw error;
  }
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
  if (isDemoMode()) throw new Error(DEMO_WRITE_ERROR);
  await requireAdminForSchool(schoolId);

  const succeeded: Student[] = [];
  const failed: { row: any; reason: string }[] = [];
  const skipped: Student[] = [];

  const admissionNumbersInFile = studentsData
    .map((r) => r.admissionNumber)
    .filter((n): n is string => !!n);
  let existingStudents: Student[] = [];
  if (admissionNumbersInFile.length && prisma.student?.findMany) {
    existingStudents = (await prisma.student.findMany({
      where: { schoolId, admissionNumber: { in: admissionNumbersInFile } },
    })) || [];
  }
  if (existingStudents.length === 0 && admissionNumbersInFile.length && prisma.student?.findFirst) {
    for (const adm of admissionNumbersInFile) {
      const s = await prisma.student.findFirst({ where: { schoolId, admissionNumber: adm } });
      if (s) existingStudents.push(s as Student);
    }
  }
  const existingByAdmissionNumber = new Map(existingStudents.map((s) => [s.admissionNumber, s]));

  const validRows: typeof studentsData = [];

  for (const row of studentsData) {
    if (!row.name || !row.class) {
      failed.push({ row, reason: "Name and class are required." });
      continue;
    }

    if (row.admissionNumber) {
      const existing = existingByAdmissionNumber.get(row.admissionNumber);
      if (existing) {
        skipped.push(existing);
        continue;
      }
    }

    validRows.push(row);
  }

  const CHUNK_SIZE = 25;
  for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
    const chunk = validRows.slice(i, i + CHUNK_SIZE);
    const results = await Promise.allSettled(
      chunk.map((row) =>
        prisma.student.create({
          data: {
            name: row.name,
            class: row.class,
            schoolId,
            admissionNumber: row.admissionNumber || null,
            status: "active",
          },
        })
      )
    );
    results.forEach((result, idx) => {
      if (result.status === "fulfilled") {
        succeeded.push(result.value);
      } else {
        const error = result.reason;
        const msg = error?.code === "P2002"
          ? "A student with this admission number already exists."
          : error?.message || "Unknown error";
        failed.push({ row: chunk[idx], reason: msg });
      }
    });
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
  if (isDemoMode()) throw new Error(DEMO_WRITE_ERROR);
  const existing = await prisma.student.findUnique({ where: { id: studentId } });
  if (!existing) throw new Error("Student not found");
  await requireAdminForSchool(existing.schoolId);

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
  if (isDemoMode()) throw new Error(DEMO_WRITE_ERROR);
  const targetStudent = await prisma.student.findUnique({ where: { id: studentId } });
  if (!targetStudent) throw new Error("Student not found");
  const { adminId: sessionAdminId } = await requireAdminForSchool(targetStudent.schoolId);
  const effectiveAdminId = adminId || sessionAdminId;

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
              approvedById: effectiveAdminId,
              reason: `Write-off on ${data.status}, ${new Date().toISOString().split("T")[0]}`,
            },
          });

          await tx.auditLog.create({
            data: {
              actorId: effectiveAdminId,
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
  if (isDemoMode()) return getDemoStudentProfile(studentId);
  await requireAdminForSchool(schoolId);

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

  // Serialize Decimal fields — Next.js cannot pass Prisma Decimal objects to Client Components.
  return {
    ...student,
    feeAssignments: student.feeAssignments.map((a) => ({
      ...a,
      amount: Number(a.amount),
      feeType: {
        ...a.feeType,
        gstRate: Number(a.feeType.gstRate),
      },
      transactions: a.transactions.map((t) => ({
        ...t,
        amount: Number(t.amount),
        penalties: (t as any).penalties?.map((p: any) => ({ ...p, amount: Number(p.amount) })) ?? [],
      })),
      waivers: a.waivers.map((w) => ({
        ...w,
        amount: Number(w.amount),
      })),
    })),
    transactions: student.transactions.map((t) => ({
      ...t,
      amount: Number(t.amount),
      penalties: (t as any).penalties?.map((p: any) => ({ ...p, amount: Number(p.amount) })) ?? [],
      feeAssignment: t.feeAssignment
        ? {
            ...t.feeAssignment,
            amount: Number((t.feeAssignment as any).amount),
            feeType: t.feeAssignment.feeType
              ? {
                  ...(t.feeAssignment as any).feeType,
                  gstRate: Number((t.feeAssignment as any).feeType?.gstRate),
                }
              : null,
          }
        : null,
    })),
  };
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
  if (isDemoMode()) return getDemoStudents();

  await requireAdminForSchool(schoolId);

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
