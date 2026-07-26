"use server";

/**
 * AI Server Actions — Session 4
 *
 * These are the Next.js Server Action wrappers for all 7 AI features.
 * They fetch data from the DB (maintaining RLS/school scoping), then call into packages/ai.
 *
 * Non-blocking ordering for narration features (system_architecture.md §Gemini contract):
 * narrateAnomalyAction and narrateDefaulterInsightAction may be called from the UI layer
 * AFTER a write has returned. They never run inside a DB transaction.
 *
 * OCR constraint: processOcrUploadAction writes OCR_STAGING with confirmed: false.
 * confirmOcrEntryAction is the ONLY function that may post a transaction from OCR data.
 */

import { prisma, type ReminderChannel } from "@smart-school/db";
import { rateLimit } from "@/lib/rateLimit";
import {
  narrateDefaulterInsight,
  answerDashboardQuery,
  narrateAnomaly,
  draftReminderText,
  processOcrUpload,
  generateWeeklyDigest,
  copilotQuery,
  answerHowDoI,
  translateTextWithGemini,
  type CopilotMessage,
  type CopilotToolContext,
} from "@smart-school/ai";
import { getLedgerSnapshot } from "./ledger";
import { recordPayment } from "./ledger";
import {
  calculateAmountPaid,
  calculateWaivedAmount,
  calculateRemainingBalance,
} from "@smart-school/rules";

// ---------------------------------------------------------------------------
// AI Feature 1 — narrateDefaulterInsightAction
// Called lazily when admin opens a student's defaulter card.
// Returns null on failure — UI falls back to computed_reason.
// ---------------------------------------------------------------------------
export async function narrateDefaulterInsightAction(
  schoolId: string,
  studentId: string
): Promise<string | null> {
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    include: {
      feeAssignments: {
        include: {
          transactions: { select: { amount: true, reconciliationStatus: true } },
          waivers: { select: { amount: true } },
        },
      },
      defaulterScores: {
        orderBy: { computedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!student) return null;

  const latestScore = student.defaulterScores[0];
  if (!latestScore) return null;

  let totalFees = 0;
  let totalPaid = 0;
  let totalWaived = 0;
  let maxDaysOverdue = 0;

  for (const a of student.feeAssignments) {
    const assignmentAmount = a.amount.toNumber();
    const paid = calculateAmountPaid(a.transactions);
    const waived = calculateWaivedAmount(a.waivers);
    const balance = calculateRemainingBalance(assignmentAmount, paid, waived);
    totalFees += assignmentAmount;
    totalPaid += paid;
    totalWaived += waived;
    if (balance > 0) {
      const days = Math.max(
        0,
        Math.floor((Date.now() - a.dueDate.getTime()) / (1000 * 60 * 60 * 24))
      );
      if (days > maxDaysOverdue) maxDaysOverdue = days;
    }
  }

  const riskLevelMap: Record<number, "high" | "medium" | "low"> = {
    3: "high",
    2: "medium",
    1: "low",
  };

  return narrateDefaulterInsight({
    studentName: student.name,
    riskLevel: riskLevelMap[latestScore.riskLevel] ?? "low",
    computedReason: latestScore.computedReason,
    totalFees,
    totalPaid,
    remainingBalance: totalFees - totalPaid - totalWaived,
    maxDaysOverdue,
    brokenPromiseCount: 0, // TODO Session 5: join REMINDER_LOG for broken_promise_count
  });
}

// ---------------------------------------------------------------------------
// AI Feature 2 — answerDashboardQueryAction
// Fetches ledger snapshot, calls answerDashboardQuery.
// ---------------------------------------------------------------------------
export async function answerDashboardQueryAction(
  schoolId: string,
  question: string
): Promise<string> {
  const MOCK_ADMIN_ID = "admin-123"; // In a real app, this would come from the auth session
  if (!rateLimit(`${MOCK_ADMIN_ID}:answerDashboardQuery`, { limit: 10, windowMs: 60 * 1000 })) {
    throw new Error("Rate limit exceeded. Please try again later.");
  }

  const snapshot = await getLedgerSnapshot(schoolId, { limit: 20 });

  const context = {
    totalCollected: snapshot.totalCollected,
    outstandingDuesTotal: snapshot.outstandingDuesTotal,
    reconciliationStats: snapshot.reconciliationStats,
    revenueByChannel: snapshot.revenueByChannel,
    recentTransactions: snapshot.transactions.map((t) => ({
      id: t.id,
      channel: t.channel,
      amount: Number(t.amount),
      reconciliationStatus: t.reconciliationStatus,
      studentName: t.student?.name,
      postedAt: t.postedAt.toISOString(),
    })),
  };

  return answerDashboardQuery(question, context);
}

// ---------------------------------------------------------------------------
// AI Feature 3 — narrateAnomalyAction
// Called ASYNCHRONOUSLY after recordPayment response has returned.
// Writes the narration back to ANOMALY_FLAG.narration if successful.
// If it fails, the flag_reason is always available as fallback.
// ---------------------------------------------------------------------------
export async function narrateAnomalyAction(anomalyFlagId: string): Promise<void> {
  const flag = await prisma.anomalyFlag.findUnique({
    where: { id: anomalyFlagId },
    include: {
      transaction: {
        include: {
          student: { select: { name: true } },
        },
      },
    },
  });

  if (!flag) return;

  const narration = await narrateAnomaly({
    flagReason: flag.flagReason,
    expectedAmount: flag.expectedAmount.toNumber(),
    receivedAmount: flag.receivedAmount.toNumber(),
    studentName: flag.transaction.student.name,
    channel: flag.transaction.channel,
    refNumber: flag.transaction.refNumber ?? undefined,
  });

  if (narration) {
    await prisma.anomalyFlag.update({
      where: { id: anomalyFlagId },
      data: { narration },
    });
  }
}

// ---------------------------------------------------------------------------
// AI Feature 4 — draftReminderTextAction
// Calls Gemini to draft reminder text, then writes to REMINDER_LOG with status: logged.
// The draft is logged. Admin must explicitly call markReminderSent to "send" it.
// ---------------------------------------------------------------------------
export async function draftReminderTextAction(
  schoolId: string,
  feeAssignmentId: string,
  tier: 1 | 7 | 14,
  channel: ReminderChannel
): Promise<{ logId: string; draftedText: string }> {
  const assignment = await prisma.feeAssignment.findFirst({
    where: { id: feeAssignmentId, schoolId },
    include: {
      student: {
        include: {
          guardianOf: {
            include: {
              parentLink: { include: { user: true } },
            },
          },
        },
      },
      feeType: true,
      transactions: { select: { amount: true, reconciliationStatus: true } },
      waivers: { select: { amount: true } },
    },
  });

  if (!assignment) throw new Error("Fee assignment not found");

  const amountPaid = calculateAmountPaid(assignment.transactions);
  const waivedAmount = calculateWaivedAmount(assignment.waivers);
  const remainingBalance = calculateRemainingBalance(
    assignment.amount.toNumber(),
    amountPaid,
    waivedAmount
  );
  const daysOverdue = Math.max(
    0,
    Math.floor((Date.now() - assignment.dueDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  const guardian = assignment.student.guardianOf[0]?.parentLink.user;

  const draftedText = await draftReminderText({
    studentName: assignment.student.name,
    guardianName: guardian?.email ?? undefined,
    feeTypeName: assignment.feeType.name,
    amountDue: remainingBalance,
    dueDate: assignment.dueDate.toISOString().split("T")[0]!,
    daysOverdue,
    tier,
    channel,
    schoolName: "Your School", // TODO Session 6: fetch from SCHOOL table
  });

  const log = await prisma.reminderLog.create({
    data: {
      feeAssignmentId,
      draftedText,
      tier,
      channel,
      status: "logged",
    },
  });

  return { logId: log.id, draftedText };
}

// ---------------------------------------------------------------------------
// AI Feature 5a — processOcrUploadAction
// Calls Gemini Vision on image URL, writes OCR_STAGING with confirmed: false.
// NEVER creates a TRANSACTION. That is exclusively confirmOcrEntryAction's job.
// ---------------------------------------------------------------------------
export async function processOcrUploadAction(
  schoolId: string,
  imageUrl: string
): Promise<{ stagingId: string; extraction: Awaited<ReturnType<typeof processOcrUpload>> }> {
  const MOCK_ADMIN_ID = "admin-123"; // In a real app, this would come from the auth session
  if (!rateLimit(`${MOCK_ADMIN_ID}:processOcrUpload`, { limit: 10, windowMs: 60 * 1000 })) {
    throw new Error("Rate limit exceeded. Please try again later.");
  }

  const extraction = await processOcrUpload(imageUrl);

  const staging = await prisma.ocrStaging.create({
    data: {
      schoolId,
      imageUrl,
      extractedAmount: extraction.amount ?? null,
      extractedDate: extraction.date ? new Date(extraction.date) : null,
      extractedRefNumber: extraction.refNumber ?? null,
      rawExtraction: extraction as any,
      confirmed: false, // HARD CONSTRAINT: always false here
    },
  });

  return { stagingId: staging.id, extraction };
}

// ---------------------------------------------------------------------------
// AI Feature 5b — confirmOcrEntryAction
// The ONLY function that may post an OCR-originated payment.
// Validates the staging row, calls recordPayment, then flips confirmed = true.
// ---------------------------------------------------------------------------
export async function confirmOcrEntryAction(
  adminId: string,
  schoolId: string,
  stagingId: string,
  correctedFields: {
    feeAssignmentId: string;
    amount: number;
    channel: "cash" | "cheque";
    refNumber?: string;
  }
) {
  const staging = await prisma.ocrStaging.findFirst({
    where: { id: stagingId, schoolId },
  });

  if (!staging) throw new Error("OCR staging record not found");
  if (staging.confirmed) throw new Error("This OCR entry has already been confirmed");

  // recordPayment is the canonical write path — no shortcutting it
  const result = await recordPayment(adminId, schoolId, {
    feeAssignmentId: correctedFields.feeAssignmentId,
    channel: correctedFields.channel,
    amount: correctedFields.amount,
    ...(correctedFields.refNumber !== undefined ? { refNumber: correctedFields.refNumber } : {}),
  });

  // Flip confirmed = true and link to the transaction that was created
  await prisma.ocrStaging.update({
    where: { id: stagingId },
    data: {
      confirmed: true,
      confirmedAt: new Date(),
      confirmedTransactionId: result.transaction.id,
    },
  });

  return result;
}

// ---------------------------------------------------------------------------
// AI Feature 6 — generateWeeklyDigestAction
// Computes trend data from DB (rule-layer logic), then calls generateWeeklyDigest.
// Gemini narrates; it never computes financial figures itself.
// ---------------------------------------------------------------------------
export async function generateWeeklyDigestAction(schoolId: string): Promise<string> {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [thisWeekTx, lastWeekTx, pendingCheques, school, riskScores, assignments] =
    await Promise.all([
      prisma.transaction.findMany({
        where: {
          schoolId,
          postedAt: { gte: oneWeekAgo },
          reconciliationStatus: { in: ["posted", "flagged"] },
        },
        select: { amount: true, channel: true },
      }),
      prisma.transaction.findMany({
        where: {
          schoolId,
          postedAt: { gte: twoWeeksAgo, lt: oneWeekAgo },
          reconciliationStatus: { in: ["posted", "flagged"] },
        },
        select: { amount: true },
      }),
      prisma.transaction.findMany({
        where: { schoolId, reconciliationStatus: "cheque_pending" },
        select: { postedAt: true },
      }),
      prisma.school.findUnique({ where: { id: schoolId } }),
      // Risk tier movement: compare latest scores with those from 7 days ago
      prisma.defaulterScore.findMany({
        where: { schoolId, computedAt: { gte: oneWeekAgo } },
        select: { riskLevel: true, studentId: true, computedAt: true },
        orderBy: { computedAt: "desc" },
        distinct: ["studentId"],
      }),
      prisma.feeAssignment.findMany({
        where: { schoolId },
        include: {
          transactions: { select: { amount: true, reconciliationStatus: true } },
          waivers: { select: { amount: true } },
        },
      }),
    ]);

  const thisWeekTotal = thisWeekTx.reduce((sum, t) => sum + Number(t.amount), 0);
  const lastWeekTotal = lastWeekTx.reduce((sum, t) => sum + Number(t.amount), 0);

  const byChannel = ["upi", "cash", "cheque"].map((ch) => ({
    channel: ch,
    amount: thisWeekTx
      .filter((t) => t.channel === ch)
      .reduce((sum, t) => sum + Number(t.amount), 0),
  }));

  const chequePendingTotalDays = pendingCheques.reduce(
    (sum, c) => sum + Math.floor((Date.now() - c.postedAt.getTime()) / (1000 * 60 * 60 * 24)),
    0
  );

  // Outstanding dues total
  let outstandingTotal = 0;
  for (const a of assignments) {
    const paid = calculateAmountPaid(a.transactions);
    const waived = calculateWaivedAmount(a.waivers);
    const bal = calculateRemainingBalance(a.amount.toNumber(), paid, waived);
    if (bal > 0) outstandingTotal += bal;
  }

  // Simple risk tier movement approximation: count high/medium from this week's new scores
  const movedToHigh = riskScores.filter((s) => s.riskLevel === 3).length;
  const movedToMedium = riskScores.filter((s) => s.riskLevel === 2).length;
  const movedToLow = riskScores.filter((s) => s.riskLevel === 1).length;
  const resolvedRisk = 0; // requires historical comparison — deferred to Session 6

  return generateWeeklyDigest({
    schoolName: school?.name ?? "Your School",
    currentWeek: {
      collected: thisWeekTotal,
      transactionCount: thisWeekTx.length,
      byChannel,
      chequePendingCount: pendingCheques.length,
      chequePendingTotalDays,
    },
    previousWeek: {
      collected: lastWeekTotal,
      transactionCount: lastWeekTx.length,
    },
    riskTierMovement: { movedToHigh, movedToMedium, movedToLow, resolvedRisk },
    outstandingTotal,
  });
}

// ---------------------------------------------------------------------------
// AI Feature 7 — copilotQueryAction
// Orchestrates copilotQuery. Fetches tool context from DB before calling AI.
// School scoping is enforced by the underlying actions — Gemini never receives raw DB access.
// ---------------------------------------------------------------------------
export async function copilotQueryAction(
  role: "admin" | "parent",
  schoolId: string,
  message: string,
  conversationHistory: CopilotMessage[],
  options?: {
    parentLinkId?: string; // for parent role — scopes getMyChildrenDues
  }
) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true },
  });

  const toolContext: CopilotToolContext = {
    role,
    ...(school?.name ? { schoolName: school.name } : {}),
  };

  if (role === "admin") {
    // Pre-fetch ledger snapshot for getLedgerSnapshot tool
    const snapshot = await getLedgerSnapshot(schoolId, { limit: 20 });
    toolContext.ledgerSnapshot = {
      totalCollected: snapshot.totalCollected,
      outstandingDuesTotal: snapshot.outstandingDuesTotal,
      reconciliationStats: snapshot.reconciliationStats,
      revenueByChannel: snapshot.revenueByChannel,
      recentTransactions: snapshot.transactions.map((t) => ({
        id: t.id,
        channel: t.channel,
        amount: Number(t.amount),
        reconciliationStatus: t.reconciliationStatus,
        studentName: t.student?.name,
        postedAt: t.postedAt.toISOString(),
      })),
    };

    // Pre-fetch weekly digest
    toolContext.weeklyDigestNarration = await generateWeeklyDigestAction(schoolId).catch(
      () => "Weekly digest not available."
    );
  }

  if (role === "parent" && options?.parentLinkId) {
    // Fetch child dues scoped to this parent
    const parentLink = await prisma.parentLink.findUnique({
      where: { id: options.parentLinkId },
      include: {
        guardianOf: {
          include: {
            student: {
              include: {
                feeAssignments: {
                  include: {
                    feeType: true,
                    transactions: { select: { amount: true, reconciliationStatus: true } },
                    waivers: { select: { amount: true } },
                  },
                },
                transactions: {
                  orderBy: { postedAt: "desc" },
                  take: 20,
                  include: { feeAssignment: { include: { feeType: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (parentLink) {
      toolContext.childrenDues = parentLink.guardianOf.flatMap((g) =>
        g.student.feeAssignments.map((a) => {
          const paid = calculateAmountPaid(a.transactions);
          const waived = calculateWaivedAmount(a.waivers);
          const remaining = calculateRemainingBalance(a.amount.toNumber(), paid, waived);
          return {
            studentName: g.student.name,
            feeType: a.feeType.name,
            amount: a.amount.toNumber(),
            amountPaid: paid,
            remainingBalance: remaining,
            dueDate: a.dueDate.toISOString().split("T")[0]!,
            paymentStatus:
              remaining <= 0 ? "paid" : Date.now() > a.dueDate.getTime() ? "overdue" : "pending",
          };
        })
      );

      toolContext.paymentHistory = parentLink.guardianOf.flatMap((g) =>
        g.student.transactions.map((t) => ({
          amount: Number(t.amount),
          channel: t.channel,
          status: t.reconciliationStatus,
          postedAt: t.postedAt.toISOString(),
          feeType: t.feeAssignment.feeType.name,
        }))
      );

      // Build GST rules context from fee types this parent's children have assignments for
      const feeTypeMap = new Map<string, { name: string; gstTreatment: string; gstRate: number | null }>();
      parentLink.guardianOf.forEach((g) => {
        g.student.feeAssignments.forEach((a) => {
          if (!feeTypeMap.has(a.feeType.id)) {
            feeTypeMap.set(a.feeType.id, {
              name: a.feeType.name,
              gstTreatment: a.feeType.gstTreatment,
              gstRate: a.feeType.gstRate ? Number(a.feeType.gstRate) : null,
            });
          }
        });
      });
      toolContext.gstRules = Array.from(feeTypeMap.values()).map((ft) => ({
        feeType: ft.name,
        gstTreatment: ft.gstTreatment,
        gstRate: ft.gstRate,
      }));
    }
  }

  return copilotQuery(role, message, conversationHistory, toolContext);
}

// ---------------------------------------------------------------------------
// answerHowDoIAction — standalone wrapper for the How-do-I tool
// ---------------------------------------------------------------------------
export async function answerHowDoIAction(
  role: "admin" | "parent",
  topic: string
): Promise<string> {
  return answerHowDoI(role, topic);
}

export async function askAdminCopilotAction(schoolId: string, message: string) {
  return copilotQueryAction("admin", message, [], { schoolId });
}

export async function getWeeklySummaryDigestAction(schoolId: string) {
  return generateWeeklyDigestAction(schoolId);
}

export async function translateMissingTextAction(
  text: string,
  targetLocale: string
): Promise<string> {
  return translateTextWithGemini(text, targetLocale);
}

export async function translateBatchMissingTextAction(
  phrases: string[],
  targetLocale: string
): Promise<Record<string, string>> {
  return translateBatchWithGemini(phrases, targetLocale);
}
