"use server";

/**
 * Bank Statement Auto-Reconciliation Server Actions
 *
 * Runs bank statement parsing and Gemini AI matching against school context,
 * then posts confirmed batch matches directly into the master ledger.
 */

import { prisma } from "@smart-school/db";
import { requireAdminForSchool } from "@/lib/require-session";
import {
  reconcileBankStatement,
  type StudentFeeContext,
  type BankReconciliationResult,
} from "@smart-school/ai";
import {
  calculateAmountPaid,
  calculateWaivedAmount,
  calculateRemainingBalance,
} from "@smart-school/rules";
import { recordPaymentInternal } from "./ledger";

/**
 * Processes a raw bank statement text/CSV and returns 3-column match results.
 */
export async function processBankStatementAction(
  schoolId: string,
  statementText: string
): Promise<BankReconciliationResult> {
  await requireAdminForSchool(schoolId);

  // Fetch all open fee assignments for this school with remaining balances > 0
  const feeAssignments = await prisma.feeAssignment.findMany({
    where: {
      schoolId,
      student: { status: "active" },
    },
    include: {
      student: { select: { id: true, name: true, admissionNumber: true, class: true } },
      feeType: { select: { name: true } },
      transactions: { select: { amount: true, reconciliationStatus: true } },
      waivers: { select: { amount: true } },
    },
  });

  const openAssignments: StudentFeeContext[] = [];

  for (const fa of feeAssignments) {
    const paid = calculateAmountPaid(fa.transactions);
    const waived = calculateWaivedAmount(fa.waivers);
    const remainingBalance = calculateRemainingBalance(
      fa.amount.toNumber(),
      paid,
      waived
    );

    if (remainingBalance > 0) {
      openAssignments.push({
        id: fa.id,
        studentId: fa.student.id,
        studentName: fa.student.name,
        admissionNumber: fa.student.admissionNumber,
        className: fa.student.class,
        feeTypeName: fa.feeType.name,
        amount: fa.amount.toNumber(),
        remainingBalance,
        dueDate: fa.dueDate.toISOString().split("T")[0]!,
      });
    }
  }

  return reconcileBankStatement(statementText, openAssignments);
}

/**
 * Posts confirmed bank statement matches to the ledger in a batch loop.
 */
export async function confirmBatchBankReconciliationAction(
  schoolId: string,
  matchedItems: Array<{
    feeAssignmentId: string;
    amount: number;
    channel: "upi" | "cash" | "cheque";
    refNumber?: string;
  }>
): Promise<{ postedCount: number; totalPostedAmount: number }> {
  const { adminId } = await requireAdminForSchool(schoolId);

  let postedCount = 0;
  let totalPostedAmount = 0;

  for (const item of matchedItems) {
    if (item.amount <= 0 || !item.feeAssignmentId) continue;

    try {
      await recordPaymentInternal(adminId, schoolId, {
        feeAssignmentId: item.feeAssignmentId,
        channel: item.channel,
        amount: item.amount,
        ...(item.refNumber ? { refNumber: item.refNumber } : {}),
      });

      postedCount++;
      totalPostedAmount += item.amount;
    } catch (err: any) {
      console.error(`Failed to post batch item for assignment ${item.feeAssignmentId}:`, err.message);
    }
  }

  return { postedCount, totalPostedAmount };
}
