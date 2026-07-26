"use server";

import { prisma } from "@smart-school/db";
import {
  calculateAmountPaid,
  calculateWaivedAmount,
  calculateRemainingBalance,
  computeDefaulterScore,
  evaluateReminderTrigger
} from "@smart-school/rules";
import { requireAdminForSchool } from "@/lib/require-session";
import { draftReminderTextAction } from "./ai";

export async function getDefaulters(schoolId: string) {
  await requireAdminForSchool(schoolId);

  // 1. Fetch all active students and their fee assignments (with transactions and waivers)
  const students = await prisma.student.findMany({
    where: { schoolId, status: "active" },
    include: {
      feeAssignments: {
        include: {
          transactions: { select: { amount: true, reconciliationStatus: true } },
          waivers: { select: { amount: true } },
          reminderLogs: { where: { status: { in: ["sent", "simulated_sent"] } } }
        }
      }
    }
  });

  const scoresToUpsert = [];

  for (const student of students) {
    let totalAmount = 0;
    let totalPaid = 0;
    let totalWaived = 0;
    let maxDaysOverdue = 0;
    let brokenPromiseCount = 0;

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
          Math.floor((Date.now() - a.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        );
        if (days > 0 && a.reminderLogs) {
          brokenPromiseCount += a.reminderLogs.length;
        }
        if (days > maxDaysOverdue) maxDaysOverdue = days;
      }
    }

    const score = computeDefaulterScore(
      maxDaysOverdue,
      brokenPromiseCount, 
      totalAmount,
      totalPaid,
      totalWaived
    );

    const riskLevelInt = score.riskLevel === "high" ? 3 : score.riskLevel === "medium" ? 2 : 1;
    const remainingBalance = totalAmount - totalPaid - totalWaived;

    // Only consider defaulters those who have a balance > 0
    if (remainingBalance > 0) {
      scoresToUpsert.push({
        studentId: student.id,
        schoolId,
        riskLevel: riskLevelInt,
        computedReason: score.reason,
        remainingBalance,
        maxDaysOverdue,
        studentName: student.name,
        admissionNumber: student.admissionNumber
      });

      // Upsert: update today's score if it already exists, otherwise create.
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const existingToday = await prisma.defaulterScore.findFirst({
        where: {
          studentId: student.id,
          schoolId,
          computedAt: { gte: todayStart }
        },
        orderBy: { computedAt: "desc" }
      });

      if (existingToday) {
        await prisma.defaulterScore.update({
          where: { id: existingToday.id },
          data: {
            riskLevel: riskLevelInt,
            computedReason: score.reason
          }
        });
      } else {
        await prisma.defaulterScore.create({
          data: {
            studentId: student.id,
            schoolId,
            riskLevel: riskLevelInt,
            computedReason: score.reason
          }
        });
      }
    }
  }

  // Sort by risk level (high first) and then by maxDaysOverdue
  scoresToUpsert.sort((a, b) => {
    if (a.riskLevel !== b.riskLevel) return b.riskLevel - a.riskLevel;
    return b.maxDaysOverdue - a.maxDaysOverdue;
  });

  return scoresToUpsert;
}

export async function queueRemindersForStudent(schoolId: string, studentId: string) {
  await requireAdminForSchool(schoolId);

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    include: {
      feeAssignments: {
        include: {
          transactions: { select: { amount: true, reconciliationStatus: true } },
          waivers: { select: { amount: true } },
          reminderLogs: { select: { tier: true } },
        }
      }
    }
  });

  if (!student) throw new Error("Student not found");

  let queuedCount = 0;

  for (const fa of student.feeAssignments) {
    const paid = calculateAmountPaid(fa.transactions);
    const waived = calculateWaivedAmount(fa.waivers);
    const remainingBalance = calculateRemainingBalance(fa.amount.toNumber(), paid, waived);

    if (remainingBalance > 0) {
      const daysOverdue = Math.max(
        0,
        Math.floor((Date.now() - fa.dueDate.getTime()) / (1000 * 60 * 60 * 24))
      );
      const highestTier = fa.reminderLogs.reduce((max, log) => Math.max(max, log.tier), 0);
      const trigger = evaluateReminderTrigger(daysOverdue, highestTier);

      if (trigger.shouldTrigger) {
        try {
          const tierDays = (trigger.newTier === 1 ? 1 : trigger.newTier === 2 ? 7 : 14) as 1 | 7 | 14;
          await draftReminderTextAction(schoolId, fa.id, tierDays, "email");
          queuedCount++;
        } catch {
          await prisma.reminderLog.create({
            data: {
              feeAssignmentId: fa.id,
              tier: trigger.newTier,
              channel: "email",
              draftedText: `This is an automated reminder regarding your overdue payment of ₹${remainingBalance}.`,
              status: "logged",
            }
          });
          queuedCount++;
        }
      }
    }
  }

  return { success: true, queuedCount };
}

export async function escalateDefaulterScore(schoolId: string, studentId: string) {
  const { adminId } = await requireAdminForSchool(schoolId);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const existingToday = await prisma.defaulterScore.findFirst({
    where: {
      studentId,
      schoolId,
      computedAt: { gte: todayStart },
    },
    orderBy: { computedAt: "desc" },
  });

  const previousReason = existingToday?.computedReason ?? "No prior score today";
  const escalationNote = `Manually escalated by admin (was: "${previousReason}")`;

  if (existingToday) {
    await prisma.defaulterScore.update({
      where: { id: existingToday.id },
      data: {
        riskLevel: 3,
        computedReason: escalationNote,
      },
    });
  } else {
    await prisma.defaulterScore.create({
      data: {
        studentId,
        schoolId,
        riskLevel: 3,
        computedReason: escalationNote,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "defaulter_score_manually_escalated",
      beforeState: existingToday ? { riskLevel: existingToday.riskLevel, reason: existingToday.computedReason } : {},
      afterState: { riskLevel: 3, reason: escalationNote, studentId },
    },
  });

  return { success: true };
}

/**
 * Triggers batch reminder generation for multiple defaulter students at once.
 */
export async function batchQueueRemindersAction(schoolId: string, studentIds: string[]) {
  await requireAdminForSchool(schoolId);

  let totalQueued = 0;
  for (const studentId of studentIds) {
    try {
      const res = await queueRemindersForStudent(schoolId, studentId);
      totalQueued += res.queuedCount;
    } catch (e) {
      console.error(`Batch reminder failed for student ${studentId}:`, e);
    }
  }

  return { success: true, count: totalQueued };
}
