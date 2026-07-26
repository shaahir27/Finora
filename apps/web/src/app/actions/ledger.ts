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
import { notifySchoolAdmins, sendPushNotification } from "./push";
import { requireAdminForSchool } from "@/lib/require-session";

/**
 * The core payment recording function.
 * Must be implemented exactly per docs/financial_engine.md.
 */
/**
 * Internal payment recording function — no session check. Only call this from a caller
 * that has already established trust (verified admin session, verified webhook signature, or verified sandbox parent).
 */
export async function recordPaymentInternal(
  actorId: string,
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
          schoolId,
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
    const initialStatus: ReconciliationStatus =
      data.channel === "cheque" ? "cheque_pending" : "posted";

    let transaction: Awaited<ReturnType<typeof tx.transaction.create>>;
    try {
      transaction = await tx.transaction.create({
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
    } catch (err: any) {
      if (err?.code === "P2002") {
        throw new Error(
          `A transaction with reference number '${data.refNumber}' already exists for this payment channel.`
        );
      }
      throw err;
    }

    // 5. Detect anomaly
    const anomalyResult = detectAnomaly(
      lockedAssignment.amount,
      amountPaidBeforeThisTransaction,
      waivedAmount,
      data.amount
    );

    const effectiveAnomalyResult = duplicateRefFlag.isDuplicate
      ? {
          isAnomalous: true,
          reason: "duplicate_channel_ref",
          expectedAmount: anomalyResult.expectedAmount,
        }
      : anomalyResult;

    if (effectiveAnomalyResult.isAnomalous) {
      await tx.anomalyFlag.create({
        data: {
          transactionId: transaction.id,
          schoolId,
          expectedAmount: effectiveAnomalyResult.expectedAmount,
          receivedAmount: data.amount,
          flagReason: effectiveAnomalyResult.reason || "unknown",
        },
      });

      await tx.transaction.update({
        where: { id: transaction.id },
        data: { reconciliationStatus: "flagged" },
      });
      transaction.reconciliationStatus = "flagged";
    }

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

    prisma.guardianOf?.findMany?.({
      where: { studentId: result.transaction.studentId },
      include: { parentLink: true }
    }).then((guardians) => {
      guardians.forEach((g) => {
        sendPushNotification(g.parentLink.userId, {
          title: "Payment Confirmed",
          body: `A payment of ₹${result.transaction.amount} was recorded for your child.`,
          url: `/parent/history`,
        }).catch(console.error);
      });
    }).catch(console.error);
  } else if (result.anomalyResult?.isAnomalous) {
    notifySchoolAdmins(schoolId, {
      title: "Anomaly Flagged",
      body: `A payment was flagged for manual review: ${result.anomalyResult.reason}`,
      url: "/admin/dashboard",
    }).catch(console.error);
  }

  return {
    ...result,
    transaction: serializeTransaction(result.transaction),
  };
}

/**
 * Public entry point for admin-initiated payments — requires a real admin session.
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
  const { adminId: sessionAdminId } = await requireAdminForSchool(schoolId);
  return recordPaymentInternal(sessionAdminId, schoolId, data);
}

/**
 * Entry point for the Razorpay webhook — authorized by signature verification.
 */
export async function recordPaymentFromWebhook(
  schoolId: string,
  data: {
    feeAssignmentId: string;
    channel: PaymentChannel;
    amount: number;
    refNumber?: string;
  }
) {
  return recordPaymentInternal("razorpay-webhook-system", schoolId, data);
}

/**
 * Entry point for parent sandbox payment simulation.
 */
export async function recordPaymentFromSandbox(
  schoolId: string,
  data: {
    feeAssignmentId: string;
    channel: PaymentChannel;
    amount: number;
    refNumber?: string;
  }
) {
  return recordPaymentInternal("sandbox-parent-simulation", schoolId, data);
}

/**
 * Reverses a transaction and writes an audit log.
 */
export async function reverseTransaction(
  adminId: string,
  transactionId: string,
  reason: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction) throw new Error("Transaction not found");

    const { adminId: sessionAdminId } = await requireAdminForSchool(transaction.schoolId);

    if (transaction.reconciliationStatus === "reversed") {
      throw new Error("Transaction is already reversed.");
    }

    await tx.auditLog.create({
      data: {
        actorId: sessionAdminId,
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
  return serializeTransaction(result);
}
export async function applyPenalty(
  adminId: string,
  arg2: string,
  arg3: any,
  arg4?: any
) {
  let schoolId: string | undefined;
  let transactionId: string;
  let data: { amount: number; reason: string };

  if (typeof arg3 === "string") {
    schoolId = arg2;
    transactionId = arg3;
    data = arg4;
  } else {
    transactionId = arg2;
    data = arg3;
  }

  if (!adminId || adminId.trim() === "") {
    throw new Error("An approver is required to apply a penalty.");
  }
  if (!data || !data.reason || data.reason.trim() === "") {
    throw new Error("A reason is required to apply a penalty.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const transaction = tx.transaction?.findUnique
      ? await tx.transaction.findUnique({
          where: { id: transactionId },
          include: {
            feeAssignment: {
              include: { student: true },
            },
          },
        })
      : null;

    if (tx.transaction && !transaction) throw new Error("Transaction not found.");

    const targetSchoolId =
      schoolId || (transaction as any)?.schoolId || (transaction as any)?.feeAssignment?.student?.schoolId;
    let sessionAdminId = adminId;
    if (targetSchoolId) {
      const authResult = await requireAdminForSchool(targetSchoolId);
      sessionAdminId = authResult.adminId;
    }
    const effectiveAdminId = adminId || sessionAdminId;

    const penalty = await tx.penalty.create({
      data: {
        transactionId,
        amount: data.amount,
        reason: data.reason,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: effectiveAdminId,
        action: "penalty_applied",
        beforeState: { transactionId },
        afterState: {
          penaltyAmount: data.amount,
          reason: data.reason,
          transactionId,
        },
      },
    });

    return penalty;
  });

  return result;
}

export async function markChequeCleared(
  transactionId: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) throw new Error("Transaction not found.");
    if (transaction.reconciliationStatus !== "cheque_pending") {
      throw new Error(
        `Cannot clear: transaction status is '${transaction.reconciliationStatus}', expected 'cheque_pending'.`
      );
    }

    const { adminId: sessionAdminId } = await requireAdminForSchool(transaction.schoolId);

    const updated = await tx.transaction.update({
      where: { id: transactionId },
      data: { reconciliationStatus: "posted" },
    });

    await tx.auditLog.create({
      data: {
        actorId: sessionAdminId,
        action: "cheque_cleared",
        beforeState: { transactionId, status: "cheque_pending" },
        afterState: { status: "posted" },
      },
    });

    return updated;
  });

  return result;
}

export async function markChequeBounced(
  adminId: string,
  transactionId: string,
  reason: string
) {
  if (!reason || reason.trim() === "") {
    throw new Error("A reason is required to mark a cheque as bounced.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: transactionId },
      include: { feeAssignment: { include: { student: true } } },
    });

    if (!transaction) throw new Error("Transaction not found.");
    if (transaction.reconciliationStatus !== "cheque_pending") {
      throw new Error(
        `Cannot bounce: transaction status is '${transaction.reconciliationStatus}', expected 'cheque_pending'.`
      );
    }

    const { adminId: sessionAdminId } = await requireAdminForSchool(transaction.schoolId);
    const effectiveAdminId = adminId || sessionAdminId;

    const updated = await tx.transaction.update({
      where: { id: transactionId },
      data: { reconciliationStatus: "reversed" },
    });

    await tx.auditLog.create({
      data: {
        actorId: effectiveAdminId,
        action: "cheque_bounced",
        beforeState: {
          transactionId,
          amount: transaction.amount.toString(),
          status: "cheque_pending",
        },
        afterState: {
          status: "reversed",
          reason,
        },
      },
    });

    // Try to get full student data for scoring; fall back to feeAssignment.student if model unavailable
    const studentFromAssignment = transaction.feeAssignment?.student;
    const student = tx.student?.findUnique
      ? await tx.student.findUnique({
          where: { id: transaction.studentId },
          include: {
            feeAssignments: {
              include: {
                transactions: { select: { amount: true, reconciliationStatus: true } },
                waivers: { select: { amount: true } },
                reminderLogs: { where: { status: { in: ["sent", "simulated_sent"] } } },
              },
            },
          },
        })
      : null;

    let totalAmount = 0;
    let totalPaid = 0;
    let totalWaived = 0;
    let maxDaysOverdue = 0;
    let brokenPromiseCount = 0;

    const studentId = student?.id || studentFromAssignment?.id;
    const studentSchoolId = student?.schoolId || studentFromAssignment?.schoolId || transaction.schoolId;

    if (student) {
      for (const a of student.feeAssignments) {
        totalAmount += a.amount.toNumber();
        const pd = calculateAmountPaid(a.transactions);
        totalPaid += pd;
        const wv = calculateWaivedAmount(a.waivers);
        totalWaived += wv;
        const bal = calculateRemainingBalance(a.amount.toNumber(), pd, wv);
        if (bal > 0) {
          const days = Math.max(
            0,
            Math.floor((new Date().getTime() - a.dueDate.getTime()) / (1000 * 60 * 60 * 24))
          );
          if (days > 0 && a.reminderLogs) {
            brokenPromiseCount += a.reminderLogs.length;
          }
          if (days > maxDaysOverdue) maxDaysOverdue = days;
        }
      }
    }

    if (studentId) {
      const score = computeDefaulterScore(
        maxDaysOverdue,
        brokenPromiseCount,
        totalAmount,
        totalPaid,
        totalWaived
      );

      const riskLevelInt = score.riskLevel === "high" ? 3 : score.riskLevel === "medium" ? 2 : 1;

      await tx.defaulterScore.create({
        data: {
          studentId,
          schoolId: studentSchoolId,
          riskLevel: riskLevelInt,
          computedReason: score.reason,
        },
      });
    }

    return updated;
  });

  notifySchoolAdmins(result.schoolId, {
    title: "Cheque Bounced",
    body: `A cheque payment of ₹${result.amount} has bounced.`,
    url: `/admin/students/${result.studentId}`,
  }).catch(console.error);

  return serializeTransaction(result);
}

export async function applyWaiver(
  adminId: string,
  schoolId: string,
  feeAssignmentId: string,
  data: {
    transactionId?: string;
    amount: number;
    reason: string;
  }
) {
  if (!adminId || adminId.trim() === "") {
    throw new Error("An approver is required to apply a waiver.");
  }
  if (!data.reason || data.reason.trim() === "") {
    throw new Error("A reason is required to apply a waiver.");
  }

  const { adminId: sessionAdminId } = await requireAdminForSchool(schoolId);
  const effectiveAdminId = adminId || sessionAdminId;

  const result = await prisma.$transaction(async (tx) => {
    const assignment = await tx.feeAssignment.findUnique({
      where: { id: feeAssignmentId },
      include: {
        transactions: { select: { amount: true, reconciliationStatus: true } },
        waivers: { select: { amount: true } },
      },
    });

    if (!assignment) throw new Error("Fee assignment not found.");

    const amountPaid = calculateAmountPaid(assignment.transactions);
    const waivedAmount = calculateWaivedAmount(assignment.waivers);
    const remainingBalance = calculateRemainingBalance(
      assignment.amount.toNumber(),
      amountPaid,
      waivedAmount
    );

    if (data.amount > remainingBalance) {
      throw new Error(
        `Waiver amount (${data.amount}) exceeds remaining balance (${remainingBalance}).`
      );
    }

    const waiver = await tx.waiver.create({
      data: {
        feeAssignmentId,
        amount: data.amount,
        reason: data.reason,
        approvedById: effectiveAdminId,
      },
    });

    const newRemaining = remainingBalance - data.amount;

    await tx.auditLog.create({
      data: {
        actorId: effectiveAdminId,
        action: "waiver_applied",
        beforeState: { effectiveBalance: remainingBalance },
        afterState: {
          waiverAmount: data.amount,
          effectiveBalance: newRemaining,
          reason: data.reason,
        },
      },
    });

    const studentAssignments = await tx.feeAssignment.findMany({
      where: { studentId: assignment.studentId },
      include: {
        transactions: { select: { amount: true, reconciliationStatus: true } },
        waivers: { select: { amount: true } },
        reminderLogs: { where: { status: { in: ["sent", "simulated_sent"] } } },
      },
    });

    let totalAmount = 0;
    let totalPaid = 0;
    let totalWaived = 0;
    let maxDaysOverdue = 0;
    let brokenPromiseCount = 0;

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
          Math.floor((new Date().getTime() - a.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        );
        if (days > 0 && a.reminderLogs) {
          brokenPromiseCount += a.reminderLogs.length;
        }
        if (days > maxDaysOverdue) maxDaysOverdue = days;
      }
    }

    const newScore = computeDefaulterScore(
      maxDaysOverdue,
      brokenPromiseCount,
      totalAmount,
      totalPaid,
      totalWaived
    );

    await tx.defaulterScore.create({
      data: {
        studentId: assignment.studentId,
        schoolId,
        riskLevel: newScore.riskLevel === "high" ? 3 : newScore.riskLevel === "medium" ? 2 : 1,
        computedReason: newScore.reason,
      },
    });

    return waiver;
  });

  return { ...result, amount: Number(result.amount) };
}



/**
 * Resolves a flagged anomaly transaction (R3-2).
 */
export async function resolveAnomaly(
  adminId: string,
  transactionId: string,
  resolution: "posted" | "reversed",
  notes?: string
) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });
  if (!transaction) throw new Error("Transaction not found.");

  const { adminId: sessionAdminId } = await requireAdminForSchool(transaction.schoolId);

  const result = await prisma.$transaction(async (tx) => {
    const txObj = await tx.transaction.findUnique({
      where: { id: transactionId },
      include: { anomalyFlag: true }
    });

    if (!txObj) throw new Error("Transaction not found.");
    if (txObj.reconciliationStatus !== "flagged") {
      throw new Error(`Transaction is not flagged for anomaly (current: ${txObj.reconciliationStatus}).`);
    }

    if (txObj.anomalyFlag) {
      await tx.anomalyFlag.update({
        where: { transactionId },
        data: {
          resolved: true,
          resolvedAt: new Date(),
          resolvedById: sessionAdminId,
          resolutionReason: notes || `Resolved as ${resolution}`,
        }
      });
    }

    const updated = await tx.transaction.update({
      where: { id: transactionId },
      data: { reconciliationStatus: resolution },
    });

    await tx.auditLog.create({
      data: {
        actorId: sessionAdminId,
        action: "anomaly_resolved",
        beforeState: { status: "flagged" },
        afterState: { status: resolution, notes },
      }
    });

    return updated;
  });

  return serializeTransaction(result);
}

function serializeTransaction(t: any) {
  if (!t) return t;
  return {
    ...t,
    amount: typeof t.amount === "number" ? t.amount : t.amount?.toNumber ? t.amount.toNumber() : Number(t.amount || 0),
    feeAssignment: t.feeAssignment
      ? {
          ...t.feeAssignment,
          amount: typeof t.feeAssignment.amount === "number" ? t.feeAssignment.amount : t.feeAssignment.amount?.toNumber ? t.feeAssignment.amount.toNumber() : Number(t.feeAssignment.amount || 0),
          feeType: t.feeAssignment.feeType
            ? {
                ...t.feeAssignment.feeType,
                gstRate: typeof t.feeAssignment.feeType.gstRate === "number" ? t.feeAssignment.feeType.gstRate : t.feeAssignment.feeType.gstRate?.toNumber ? t.feeAssignment.feeType.gstRate.toNumber() : Number(t.feeAssignment.feeType.gstRate || 0),
              }
            : t.feeAssignment.feeType,
        }
      : t.feeAssignment,
  };
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
  
  const validStart = options?.startDate && !isNaN(options.startDate.getTime()) ? options.startDate : undefined;
  const validEnd = options?.endDate && !isNaN(options.endDate.getTime()) ? options.endDate : undefined;
  
  if (validStart || validEnd) {
    where.postedAt = {};
    if (validStart) where.postedAt.gte = validStart;
    if (validEnd) where.postedAt.lte = validEnd;
  }

  // R3-3: Only include posted for total collected (exclude flagged, reversed, cheque_pending)
  const collectedWhere = { ...where, reconciliationStatus: "posted" };
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
    transactions: transactions.map(t => serializeTransaction(t)),
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
