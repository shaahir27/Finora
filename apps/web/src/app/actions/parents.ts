"use server";

import { prisma } from "@smart-school/db";
import { initiateUpiSandboxPayment as _initiateUpiSandboxPayment } from "@smart-school/payments";
import { calculateAmountPaid, calculateRemainingBalance, calculateWaivedAmount } from "@smart-school/rules";

// ---------------------------------------------------------------------------
// ADMIN PROVISIONING ACTIONS
// ---------------------------------------------------------------------------

/**
 * Creates a parent account and links initial students.
 * Admin-only.
 */
export async function createParentAccount(
  schoolId: string,
  data: { name: string; phone: string; email?: string; studentIds: string[] }
) {
  if (!data.studentIds || data.studentIds.length === 0) {
    throw new Error("A parent account must have at least one linked student.");
  }

  // Basic E.164 validation
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  if (!phoneRegex.test(data.phone)) {
    throw new Error("Phone number must be in E.164 format (e.g., +919876543210)");
  }

  // Check if phone already exists
  const existingUser = await prisma.user.findFirst({
    where: { phone: data.phone },
  });

  if (existingUser) {
    throw new Error("ALREADY_REGISTERED: This phone number is already registered. Please add the student to the existing account instead.");
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        role: "parent",
        schoolId,
        phone: data.phone,
        email: data.email || null,
      },
    });

    const parentLink = await tx.parentLink.create({
      data: {
        userId: user.id,
      },
    });

    for (const studentId of data.studentIds) {
      await tx.guardianOf.create({
        data: {
          parentLinkId: parentLink.id,
          studentId,
        },
      });
    }

    return user;
  });
}

/**
 * Adds a student to an existing parent.
 */
export async function addStudentToParent(parentUserId: string, studentId: string) {
  const parentLink = await prisma.parentLink.findUnique({
    where: { userId: parentUserId },
  });

  if (!parentLink) {
    throw new Error("Parent link not found for this user.");
  }

  return prisma.guardianOf.create({
    data: {
      parentLinkId: parentLink.id,
      studentId,
    },
  });
}

/**
 * Removes a student from a parent.
 */
export async function removeStudentFromParent(parentUserId: string, studentId: string) {
  const parentLink = await prisma.parentLink.findUnique({
    where: { userId: parentUserId },
  });

  if (!parentLink) {
    throw new Error("Parent link not found for this user.");
  }

  return prisma.guardianOf.delete({
    where: {
      parentLinkId_studentId: {
        parentLinkId: parentLink.id,
        studentId,
      },
    },
  });
}

// ---------------------------------------------------------------------------
// PARENT-FACING ACTIONS
// ---------------------------------------------------------------------------

/**
 * Gets dues for all children linked to this parent.
 */
export async function getMyChildrenDues(parentUserId: string) {
  const parentLink = await prisma.parentLink.findUnique({
    where: { userId: parentUserId },
    include: {
      guardianOf: {
        include: {
          student: {
            include: {
              feeAssignments: {
                include: {
                  feeType: true,
                  transactions: { where: { reconciliationStatus: "posted" } },
                  waivers: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!parentLink) return [];

  const dues = [];

  for (const relation of parentLink.guardianOf) {
    const student = relation.student;
    
    // Skip non-active students
    if (student.status !== "active") continue;

    for (const assignment of student.feeAssignments) {
      const amountPaid = calculateAmountPaid(assignment.transactions);
      const waived = calculateWaivedAmount(assignment.waivers);
      const remainingBalance = calculateRemainingBalance(assignment.amount.toNumber(), amountPaid, waived);

      let paymentStatus = "unpaid";
      if (remainingBalance <= 0) {
        paymentStatus = "paid";
      } else if (amountPaid > 0 || waived > 0) {
        paymentStatus = "partially_paid";
      }
      
      const dueDate = new Date(assignment.dueDate);
      if (remainingBalance > 0 && new Date() > dueDate) {
        paymentStatus = "overdue";
      }

      dues.push({
        id: assignment.id,
        studentId: student.id,
        studentName: student.name,
        feeType: assignment.feeType.name,
        amount: assignment.amount.toNumber(),
        amountPaid,
        remainingBalance,
        paymentStatus,
        dueDate: assignment.dueDate.toISOString().split("T")[0],
      });
    }
  }

  return dues;
}

/**
 * Initiates a UPI payment from the parent portal.
 */
export async function payDueViaUpi(feeAssignmentId: string, amount: number) {
  if (amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  const assignment = await prisma.feeAssignment.findUnique({
    where: { id: feeAssignmentId },
    include: {
      transactions: { where: { reconciliationStatus: "posted" } },
      waivers: true,
    },
  });

  if (!assignment) {
    throw new Error("Fee assignment not found");
  }

  const amountPaid = calculateAmountPaid(assignment.transactions);
  const waived = calculateWaivedAmount(assignment.waivers);
  const remaining = calculateRemainingBalance(assignment.amount.toNumber(), amountPaid, waived);

  if (amount > remaining) {
    throw new Error(`Amount cannot exceed remaining balance of ₹${remaining}`);
  }

  const amountPaise = Math.round(amount * 100);
  return _initiateUpiSandboxPayment(feeAssignmentId, amountPaise);
}

/**
 * Gets payment history for a parent's children.
 */
export async function getMyPaymentHistory(parentUserId: string, options?: { limit?: number; cursor?: string }) {
  const limit = options?.limit ?? 20;

  const parentLink = await prisma.parentLink.findUnique({
    where: { userId: parentUserId },
    include: { guardianOf: true },
  });

  if (!parentLink) return { transactions: [], nextCursor: undefined };

  const studentIds = parentLink.guardianOf.map((g) => g.studentId);
  if (studentIds.length === 0) return { transactions: [], nextCursor: undefined };

  const transactions = await prisma.transaction.findMany({
    where: { studentId: { in: studentIds } },
    take: limit + 1,
    ...(options?.cursor ? { cursor: { id: options.cursor } } : {}),
    orderBy: { postedAt: "desc" },
    include: {
      feeAssignment: { include: { feeType: true } },
      student: { select: { name: true } },
    },
  });

  let nextCursor: string | undefined;
  if (transactions.length > limit) {
    const next = transactions.pop();
    nextCursor = next?.id;
  }

  const mapped = transactions.map((t) => ({
    id: t.id,
    studentName: t.student.name,
    feeType: t.feeAssignment.feeType.name,
    amount: t.amount.toNumber(),
    channel: t.channel,
    status: t.reconciliationStatus,
    postedAt: t.postedAt.toISOString(),
  }));

  return { transactions: mapped, nextCursor };
}
/**
 * Gets the PARENT_LINK id for a given user id.
 * Used by the client to store the parentLinkId in sessionStorage
 * so the Copilot can scope its tool context correctly.
 */
export async function getParentLinkId(userId: string): Promise<string | null> {
  const link = await prisma.parentLink.findUnique({
    where: { userId },
    select: { id: true },
  });
  return link?.id ?? null;
}

/**
 * Gets the schoolId for a given parent userId (via their linked user row).
 * Used by the client to scope copilot queries.
 */
export async function getParentSchoolId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { schoolId: true },
  });
  return user?.schoolId ?? null;
}
