"use server";

import {
  prisma,
  type Transaction,
  type Waiver,
  type Penalty,
  type PaymentChannel,
  type ReconciliationStatus,
} from "@smart-school/db";
import {
  calculateAmountPaid,
  calculateWaivedAmount,
  calculateRemainingBalance,
  detectAnomaly,
  detectDuplicateRef,
  computeDefaulterScore,
  type DuplicateRefInput,
} from "@smart-school/rules";
import { notifySchoolAdmins } from "./push";

/**
 * The core payment recording function.
 * Must be implemented exactly per docs/financial_engine.md.
 */
export async function recordPayment(
  adminId: string,
  schoolId: string,
  data: {
    feeAssignmentId: string;
    channel: PaymentChannel;
    amount: number;
    refNumber?: string;
  }
) {
  if (data.amount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Acquire row-level lock on the FEE_ASSIGNMENT
    const feeAssignments = await tx.$queryRaw<
      { id: string; amount: number }[]
    >`SELECT id, amount FROM fee_assignments WHERE id = ${data.feeAssignmentId} FOR UPDATE`;

    if (feeAssignments.length === 0) {
      throw new Error(`Fee assignment not found for ID: ${data.feeAssignmentId}`);
    }
    const lockedAssignment = feeAssignments[0];
    if (!lockedAssignment) {
      throw new Error("Failed to lock fee assignment.");
    }

    // Fetch transactions and waivers for this assignment to compute current balance
    // Also fetch channel/refNumber so detectDuplicateRef can run as a pure function.
    const existingTransactions = await tx.transaction.findMany({
      where: { feeAssignmentId: data.feeAssignmentId },
      select: { amount: true, reconciliationStatus: true, channel: true, refNumber: true },
    });

    const waivers = await tx.waiver.findMany({
      where: { feeAssignmentId: data.feeAssignmentId },
      select: { amount: true },
    });

    const amountPaidBeforeThisTransaction = calculateAmountPaid(existingTransactions);
    const waivedAmount = calculateWaivedAmount(waivers);
    const remainingBalance = calculateRemainingBalance(
      lockedAssignment.amount,
      amountPaidBeforeThisTransaction,
      waivedAmount
    );

    // 2. Validate amount doesn't overpay
    if (data.amount > remainingBalance) {
      throw new Error(
        `Payment amount (${data.amount}) exceeds remaining balance (${remainingBalance}).`
      );
    }

    // 3a. Check idempotency for UPI — return existing if duplicate ref_number
    if (data.channel === "upi" && data.refNumber) {
      const existingUpi = await tx.transaction.findFirst({
        where: {
          channel: "upi",
          refNumber: data.refNumber,
        },
      });

      if (existingUpi) {
        // Return existing rather than inserting a duplicate
        return {
          transaction: existingUpi,
          isDuplicate: true,
        };
      }
    }

    // 3b. Check for duplicate ref across ALL channels (cheque numbers, etc.)
    // This runs AFTER UPI idempotency (which returns early) — only reaches here for
    // non-UPI channels or UPI channels where no existing row was found.
    let duplicateRefFlag: { isDuplicate: boolean; reason?: string } = { isDuplicate: false };
    if (data.refNumber) {
      duplicateRefFlag = detectDuplicateRef({
        channel: data.channel,
        refNumber: data.refNumber,
        existingTransactions,
      });
    }

    // Fetch the assignment completely to get studentId
    const fullAssignment = await tx.feeAssignment.findUniqueOrThrow({
      where: { id: data.feeAssignmentId },
    });

    // 4. Create the TRANSACTION
    // CRITICAL: cheque starts as cheque_pending, not posted.
    // financial_engine.md §3: (new cheque payment) → cheque_pending
    // A pending cheque is NOT counted in amount_paid until cleared.
    const initialStatus: ReconciliationStatus =
      data.channel === "cheque" ? "cheque_pending" : "posted";

    const transaction = await tx.transaction.create({
      data: {
        feeAssignmentId: data.feeAssignmentId,
        studentId: fullAssignment.studentId,
        schoolId,
        channel: data.channel,
        amount: data.amount,
        refNumber: data.refNumber || null,
        reconciliationStatus: initialStatus,
      },
    });

    // 5. Detect anomaly (synchronously inside the same DB transaction)
    // Two checks run in order — duplicate_channel_ref takes priority over amount_mismatch
    // since a duplicate ref means we shouldn't be posting at all.
    const anomalyResult = detectAnomaly(
      lockedAssignment.amount,
      amountPaidBeforeThisTransaction,
      waivedAmount,
      data.amount
    );

    // Merge duplicate-ref finding into the anomaly result
    const effectiveAnomalyResult = duplicateRefFlag.isDuplicate
      ? {
          isAnomalous: true,
          reason: "duplicate_channel_ref",
          expectedAmount: anomalyResult.expectedAmount,
        }
      : anomalyResult;

    if (effectiveAnomalyResult.isAnomalous) {
      // Create ANOMALY_FLAG row
      await tx.anomalyFlag.create({
        data: {
          transactionId: transaction.id,
          schoolId,
          expectedAmount: effectiveAnomalyResult.expectedAmount,
          receivedAmount: data.amount,
          flagReason: effectiveAnomalyResult.reason || "unknown",
        },
      });

      // Update transaction status to flagged
      await tx.transaction.update({
        where: { id: transaction.id },
        data: { reconciliationStatus: "flagged" },
      });
      transaction.reconciliationStatus = "flagged";
    }

    // (Push notification fired asynchronously by the UI/event layer — not inside the DB transaction)

    return {
      transaction,
      isDuplicate: false,
      anomalyResult: effectiveAnomalyResult,
    };

  });

  if (result.transaction.reconciliationStatus === "posted") {
    notifySchoolAdmins(schoolId, {
      title: "Payment Received",
      body: `A payment of ₹${result.transaction.amount} was recorded.`,
      url: `/admin/students/${result.transaction.studentId}`,
    }).catch(console.error);
  } else if (result.anomalyResult?.isAnomalous) {
    notifySchoolAdmins(schoolId, {
      title: "Anomaly Flagged",
      body: `A payment was flagged for manual review: ${result.anomalyResult.reason}`,
      url: "/admin/dashboard",
    }).catch(console.error);
  }

  return result;
}

/**
 * Reverses a transaction and writes an audit log.
 */
export async function reverseTransaction(
  adminId: string,
  transactionId: string,
  reason: string
): Promise<Transaction> {
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction) throw new Error("Transaction not found");

    if (transaction.reconciliationStatus === "reversed") {
      throw new Error("Transaction is already reversed.");
    }

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "transaction_reversed",
        beforeState: { status: transaction.reconciliationStatus },
        afterState: { status: "reversed", reason },
      },
    });

    return tx.transaction.update({
      where: { id: transactionId },
      data: { reconciliationStatus: "reversed" },
    });
  });
}

/**
 * Flips a cheque_pending transaction to posted (cheque cleared).
 * Does not produce an AUDIT_LOG — clearing is the normal/expected outcome,
 * not an exception event. Only reversals, bounces, waivers, penalties are logged.
 * financial_engine.md §3: cheque_pending → (markChequeCleared) → posted
 */
export async function markChequeCleared(
  transactionId: string
): Promise<Transaction> {
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction) throw new Error("Transaction not found.");
    if (transaction.reconciliationStatus !== "cheque_pending") {
      throw new Error(
        `Cannot clear: transaction status is '${transaction.reconciliationStatus}', expected 'cheque_pending'.`
      );
    }

    return tx.transaction.update({
      where: { id: transactionId },
      data: { reconciliationStatus: "posted" },
    });
  });
}

/**
 * Bounces a cheque: reverses the transaction, writes AUDIT_LOG, and triggers
 * computeDefaulterScore for the affected student.
 *
 * CRITICAL per financial_engine.md §3 and business_rules.md §Reconciliation:
 * - "reversed" is terminal — never transition again, create a new TRANSACTION to correct.
 * - Must trigger computeDefaulterScore recompute — a bounce is a new default event.
 * - The balance is "reopened" automatically: reversed status excludes it from amount_paid sum.
 */
export async function markChequeBounced(
  adminId: string,
  transactionId: string,
  reason: string
): Promise<Transaction> {
  if (!reason || reason.trim() === "") {
    throw new Error("A reason is required to mark a cheque as bounced.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: transactionId },
      include: {
        feeAssignment: {
          include: {
            student: true,
            transactions: { select: { amount: true, reconciliationStatus: true } },
            waivers: { select: { amount: true } },
          },
        },
      },
    });

    if (!transaction) throw new Error("Transaction not found.");
    if (transaction.reconciliationStatus !== "cheque_pending") {
      throw new Error(
        `Cannot bounce: transaction status is '${transaction.reconciliationStatus}', expected 'cheque_pending'.`
      );
    }

    // 1. Write AUDIT_LOG before the status flip (captures before_state)
    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "cheque_bounced",
        beforeState: {
          transactionId,
          status: "cheque_pending",
          amount: transaction.amount.toString(),
        },
        afterState: {
          status: "reversed",
          reason,
        },
      },
    });

    // 2. Flip to reversed (terminal — financial_engine.md §3)
    const reversed = await tx.transaction.update({
      where: { id: transactionId },
      data: { reconciliationStatus: "reversed" },
    });

    // 3. CROSS-ENGINE DEPENDENCY — trigger computeDefaulterScore recompute.
    // financial_engine.md §3: "markChequeBounced must trigger computeDefaulterScore recompute"
    // The balance reopens automatically (reversed excluded from amount_paid sum).
    // We still recompute the score immediately so the admin sees updated risk, not stale badge.
    const studentId = transaction.feeAssignment.student.id;
    const schoolId = transaction.feeAssignment.student.schoolId;

    const studentAssignments = await tx.feeAssignment.findMany({
      where: { studentId },
      include: {
        transactions: { select: { amount: true, reconciliationStatus: true } },
        waivers: { select: { amount: true } },
      },
    });

    let totalAmount = 0;
    let totalPaid = 0;
    let totalWaived = 0;
    let maxDaysOverdue = 0;

    for (const a of studentAssignments) {
      totalAmount += a.amount.toNumber();
      const pd = calculateAmountPaid(a.transactions);
      totalPaid += pd;
      const wv = calculateWaivedAmount(a.waivers);
      totalWaived += wv;
      const bal = calculateRemainingBalance(a.amount.toNumber(), pd, wv);
      if (bal > 0) {
        const days = Math.max(
          0,
          Math.floor((Date.now() - a.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        );
        if (days > maxDaysOverdue) maxDaysOverdue = days;
      }
    }

    const newScore = computeDefaulterScore(
      maxDaysOverdue,
      0, // broken_promise_count — requires REMINDER_LOG join, deferred to full recompute job
      totalAmount,
      totalPaid,
      totalWaived
    );

    await tx.defaulterScore.create({
      data: {
        studentId,
        schoolId,
        riskLevel: newScore.riskLevel === "high" ? 3 : newScore.riskLevel === "medium" ? 2 : 1,
        computedReason: newScore.reason,
      },
    });

    return reversed;
  });

  notifySchoolAdmins(result.schoolId, {
    title: "Cheque Bounced",
    body: `A cheque payment of ₹${result.amount} has bounced.`,
    url: `/admin/students/${result.studentId}`,
  }).catch(console.error);

  return result;
}

/**
 * Applies a waiver and immediately recomputes defaulter score.
 */
export async function applyWaiver(
  adminId: string,
  schoolId: string,
  feeAssignmentId: string,
  data: {
    transactionId?: string;
    amount: number;
    reason: string;
  }
): Promise<Waiver> {
  if (!data.reason || data.reason.trim() === "") {
    throw new Error("A reason is required to apply a waiver.");
  }
  if (!adminId) {
    throw new Error("An approver is required to apply a waiver.");
  }

  return prisma.$transaction(async (tx) => {
    const assignment = await tx.feeAssignment.findUnique({
      where: { id: feeAssignmentId },
      include: {
        transactions: { select: { amount: true, reconciliationStatus: true } },
        waivers: { select: { amount: true } },
      },
    });
    if (!assignment) throw new Error("Fee assignment not found.");

    const amountPaidBefore = calculateAmountPaid(assignment.transactions);
    const waivedBefore = calculateWaivedAmount(assignment.waivers);
    const balanceBefore = calculateRemainingBalance(
      assignment.amount.toNumber(),
      amountPaidBefore,
      waivedBefore
    );

    const waiver = await tx.waiver.create({
      data: {
        feeAssignmentId,
        transactionId: data.transactionId || null,
        amount: data.amount,
        approvedById: adminId,
        reason: data.reason,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "waiver_applied",
        beforeState: { effectiveBalance: balanceBefore },
        afterState: { effectiveBalance: balanceBefore - data.amount, waiverAmount: data.amount, reason: data.reason },
      },
    });

    // Immediately recompute defaulter score for this student
    // Need to fetch ALL assignments for the student to recompute total score
    const studentAssignments = await tx.feeAssignment.findMany({
      where: { studentId: assignment.studentId },
      include: {
        transactions: { select: { amount: true, reconciliationStatus: true } },
        waivers: { select: { amount: true } },
      },
    });

    let totalAmount = 0;
    let totalPaid = 0;
    let totalWaived = 0;
    let maxDaysOverdue = 0;

    for (const a of studentAssignments) {
      totalAmount += a.amount.toNumber();
      const pd = calculateAmountPaid(a.transactions);
      totalPaid += pd;
      totalWaived += calculateWaivedAmount(a.waivers);
      
      const bal = calculateRemainingBalance(a.amount.toNumber(), pd, totalWaived);
      if (bal > 0) {
        const days = Math.floor((new Date().getTime() - a.dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (days > maxDaysOverdue) maxDaysOverdue = days;
      }
    }

    const newScore = computeDefaulterScore(
      maxDaysOverdue,
      0, // broken promises not simulated in this snippet, would need to count from REMINDER_LOG
      totalAmount,
      totalPaid,
      totalWaived
    );

    await tx.defaulterScore.create({
      data: {
        studentId: assignment.studentId,
        schoolId,
        riskLevel: newScore.riskLevel === "high" ? 3 : newScore.riskLevel === "medium" ? 2 : 1, // mapping enum to int
        computedReason: newScore.reason,
      },
    });

    return waiver;
  });
}

/**
 * Applies a penalty.
 */
export async function applyPenalty(
  adminId: string,
  transactionId: string,
  data: { amount: number; reason: string }
): Promise<Penalty> {
  if (!data.reason || data.reason.trim() === "") {
    throw new Error("A reason is required to apply a penalty.");
  }

  return prisma.$transaction(async (tx) => {
    const penalty = await tx.penalty.create({
      data: {
        transactionId,
        amount: data.amount,
        reason: data.reason,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "penalty_applied",
        beforeState: {},
        afterState: { penaltyAmount: data.amount, reason: data.reason, transactionId },
      },
    });

    return penalty;
  });
}

/**
 * Ledger snapshot aggregator.
 */
export async function getLedgerSnapshot(
  schoolId: string,
  options?: {
    channel?: PaymentChannel;
    startDate?: Date;
    endDate?: Date;
    cursor?: string;
    limit?: number;
  }
) {
  const limit = options?.limit || 50;

  const where: any = { schoolId };
  if (options?.channel) where.channel = options.channel;
  if (options?.startDate || options?.endDate) {
    where.postedAt = {};
    if (options.startDate) where.postedAt.gte = options.startDate;
    if (options.endDate) where.postedAt.lte = options.endDate;
  }

  // Only include posted/flagged for total collected, not reversed or pending cheques
  const collectedWhere = { ...where, reconciliationStatus: { in: ["posted", "flagged"] } };
  const { _sum } = await prisma.transaction.aggregate({
    where: collectedWhere,
    _sum: { amount: true },
  });

  const transactions = await prisma.transaction.findMany({
    where,
    take: limit + 1,
    ...(options?.cursor ? { cursor: { id: options.cursor } } : {}),
    orderBy: { postedAt: "desc" },
    include: {
      student: { select: { id: true, name: true, admissionNumber: true } },
      feeAssignment: { include: { feeType: true } },
    },
  });

  let nextCursor: string | undefined = undefined;
  if (transactions.length > limit) {
    const nextItem = transactions.pop();
    nextCursor = nextItem?.id;
  }

  // Metrics calculations for dashboard
  // 1. Outstanding Dues
  const assignments = await prisma.feeAssignment.findMany({
    where: { schoolId },
    include: {
      transactions: { select: { amount: true, reconciliationStatus: true } },
      waivers: { select: { amount: true } }
    }
  });

  let outstandingDuesTotal = 0;
  for (const a of assignments) {
    const paid = calculateAmountPaid(a.transactions);
    const waived = calculateWaivedAmount(a.waivers);
    const bal = calculateRemainingBalance(a.amount.toNumber(), paid, waived);
    if (bal > 0) {
      outstandingDuesTotal += bal;
    }
  }

  // 2. Reconciliation Stats
  const allTx = await prisma.transaction.findMany({
    where: { schoolId },
    select: { reconciliationStatus: true }
  });

  const totalTx = allTx.length;
  const postedTx = allTx.filter(t => t.reconciliationStatus === "posted").length;
  const flaggedCount = allTx.filter(t => t.reconciliationStatus === "flagged").length;
  const matchPercentage = totalTx > 0 ? Math.round((postedTx / totalTx) * 100) : 100;

  // 3. Revenue by channel (posted only)
  const channelData = await prisma.transaction.groupBy({
    by: ['channel'],
    where: { schoolId, reconciliationStatus: "posted" },
    _sum: { amount: true }
  });

  const revenueByChannel = [
    { channel: 'upi', amount: channelData.find(c => c.channel === 'upi')?._sum.amount?.toNumber() || 0 },
    { channel: 'cash', amount: channelData.find(c => c.channel === 'cash')?._sum.amount?.toNumber() || 0 },
    { channel: 'cheque', amount: channelData.find(c => c.channel === 'cheque')?._sum.amount?.toNumber() || 0 },
  ];

  return {
    transactions,
    nextCursor,
    totalCollected: _sum.amount?.toNumber() || 0,
    outstandingDuesTotal,
    reconciliationStats: {
      matchPercentage,
      flaggedCount
    },
    revenueByChannel
  };
}
