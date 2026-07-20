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

      // Update or create in DB
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

  // Sort by risk level (high first) and then by maxDaysOverdue
  scoresToUpsert.sort((a, b) => {
    if (a.riskLevel !== b.riskLevel) return b.riskLevel - a.riskLevel;
    return b.maxDaysOverdue - a.maxDaysOverdue;
  });

  return scoresToUpsert;
}
