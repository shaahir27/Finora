"use server";

import { prisma } from "@smart-school/db";
import {
  calculateAmountPaid,
  calculateWaivedAmount,
  calculateRemainingBalance,
  computeDefaulterScore
} from "@smart-school/rules";

export async function getDefaulters(schoolId: string) {
  // 1. Fetch all active students and their fee assignments (with transactions and waivers)
  const students = await prisma.student.findMany({
    where: { schoolId, status: "active" },
    include: {
      feeAssignments: {
        include: {
          transactions: { select: { amount: true, reconciliationStatus: true } },
          waivers: { select: { amount: true } }
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
        if (days > maxDaysOverdue) maxDaysOverdue = days;
      }
    }

    // TODO: broken_promise_count requires REMINDER_LOG join. Hardcoded to 0 for this session.
    const score = computeDefaulterScore(
      maxDaysOverdue,
      0, 
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
      // Fix: previously create() was called on every getDefaulters() invocation, inserting
      // duplicate rows on every page load and growing the table unboundedly.
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const existingToday = await prisma.defaulterScore.findFirst({
        where: {
          studentId: student.id,
          computedAt: { gte: todayStart },
        },
        orderBy: { computedAt: "desc" },
      });

      if (existingToday) {
        await prisma.defaulterScore.update({
          where: { id: existingToday.id },
          data: {
            riskLevel: riskLevelInt,
            computedReason: score.reason,
          },
        });
      } else {
        await prisma.defaulterScore.create({
          data: {
            studentId: student.id,
            schoolId,
            riskLevel: riskLevelInt,
            computedReason: score.reason,
          },
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
  const assignments = await prisma.feeAssignment.findMany({
    where: { studentId, dueDate: { lt: new Date() } },
    include: {
      student: { select: { schoolId: true } },
      transactions: true,
      waivers: true,
    }
  });

  const studentAssignments = assignments.filter(a => a.student.schoolId === schoolId);
  let queuedCount = 0;

  for (const fa of studentAssignments) {
    const paid = calculateAmountPaid(fa.transactions);
    const waived = calculateWaivedAmount(fa.waivers);
    const remainingBalance = calculateRemainingBalance(fa.amount.toNumber(), paid, waived);

    if (remainingBalance > 0) {
      const existing = await prisma.reminderLog.findFirst({
        where: { feeAssignmentId: fa.id, tier: 1 }
      });
      
      if (!existing) {
        await prisma.reminderLog.create({
          data: {
            feeAssignmentId: fa.id,
            tier: 1,
            channel: "email",
            draftedText: `This is an automated reminder regarding your overdue payment of ₹${remainingBalance}.`,
            status: "logged",
          }
        });
        queuedCount++;
      }
    }
  }

  return { success: true, queuedCount };
}

export async function escalateDefaulterScore(schoolId: string, studentId: string) {
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

  if (existingToday) {
    await prisma.defaulterScore.update({
      where: { id: existingToday.id },
      data: {
        riskLevel: 3,
        computedReason: "Manual escalation by admin",
      },
    });
  } else {
    await prisma.defaulterScore.create({
      data: {
        studentId,
        schoolId,
        riskLevel: 3,
        computedReason: "Manual escalation by admin",
      },
    });
  }

  const admin = await prisma.user.findFirst({
    where: { schoolId, role: "admin" }
  });

  if (admin) {
    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: "manual_escalation",
        beforeState: existingToday ? { riskLevel: existingToday.riskLevel } : {},
        afterState: { riskLevel: 3 },
      }
    });
  }

  return { success: true };
}
