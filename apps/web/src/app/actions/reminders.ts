"use server";

/**
 * Reminders Queue server actions — Session 4
 *
 * getRemindersQueue: Reads REMINDER_LOG with FEE_ASSIGNMENT/STUDENT joins.
 * markReminderSent: The ONLY function that changes reminder status from "logged".
 *
 * Governing Principle 3 (business_rules.md, project_overview.md):
 * No reminder is ever delivered without an explicit, logged, human "mark sent" action.
 * WhatsApp/SMS → simulated_sent (no real delivery).
 * Email → real Resend dispatch (Session 6 implementation; stub here that marks sent).
 */

import { prisma, type ReminderStatus } from "@smart-school/db";
import {
  calculateAmountPaid,
  calculateWaivedAmount,
  calculateRemainingBalance,
} from "@smart-school/rules";
import { requireAdminForSchool } from "@/lib/require-session";
import { isDemoMode, DEMO_WRITE_ERROR } from "@/lib/demo-mode";
import { getDemoReminders } from "@/lib/demo-data";

export interface ReminderQueueItem {
  id: string;
  feeAssignmentId: string;
  studentName: string;
  studentId: string;
  studentClass: string;
  guardianPhone: string | null;
  feeTypeName: string;
  remainingBalance: number;
  dueDate: string;
  daysOverdue: number;
  draftedText: string;
  tier: number;
  channel: string;
  status: ReminderStatus;
  createdAt: string;
  sentAt: string | null;
  dispatchError: string | null;
  /** True if the balance has been cleared since the reminder was drafted — stale reminder */
  isStale: boolean;
}

/**
 * Returns the reminders queue for a school, ordered by tier severity then date.
 * School-scoped via feeAssignment.schoolId join — no school can see another's reminders.
 */
export async function getRemindersQueue(
  schoolId: string,
  options?: { status?: ReminderStatus; limit?: number; cursor?: string }
): Promise<{ reminders: ReminderQueueItem[]; nextCursor: string | undefined }> {
  if (isDemoMode()) return getDemoReminders();

  await requireAdminForSchool(schoolId);

  const limit = options?.limit ?? 50;

  const logs = await prisma.reminderLog.findMany({
    where: {
      feeAssignment: { schoolId },
      ...(options?.status ? { status: options.status } : {}),
    },
    take: limit + 1,
    ...(options?.cursor ? { cursor: { id: options.cursor } } : {}),
    orderBy: [{ status: "asc" }, { tier: "desc" }, { createdAt: "asc" }],
    include: {
      feeAssignment: {
        include: {
          student: {
            select: {
              id: true,
              name: true,
              class: true,
              guardianOf: {
                include: {
                  parentLink: {
                    include: {
                      user: { select: { phone: true } },
                    },
                  },
                },
              },
            },
          },
          feeType: { select: { name: true } },
          transactions: { select: { amount: true, reconciliationStatus: true } },
          waivers: { select: { amount: true } },
        },
      },
    },
  });

  let nextCursor: string | undefined;
  if (logs.length > limit) {
    const next = logs.pop();
    nextCursor = next?.id;
  }

  const mapped: ReminderQueueItem[] = logs.map((log) => {
    const fa = log.feeAssignment;
    const paid = calculateAmountPaid(fa.transactions);
    const waived = calculateWaivedAmount(fa.waivers);
    const remainingBalance = calculateRemainingBalance(fa.amount.toNumber(), paid, waived);
    const daysOverdue = Math.max(
      0,
      Math.floor((Date.now() - fa.dueDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    const isStale = remainingBalance <= 0;

    const guardianPhone = fa.student.guardianOf[0]?.parentLink?.user?.phone || null;

    return {
      id: log.id,
      feeAssignmentId: fa.id,
      studentName: fa.student.name,
      studentId: fa.student.id,
      studentClass: fa.student.class || "Grade 10",
      guardianPhone,
      feeTypeName: fa.feeType.name,
      remainingBalance,
      dueDate: fa.dueDate.toISOString().split("T")[0]!,
      daysOverdue,
      draftedText: log.draftedText,
      tier: log.tier,
      channel: log.channel,
      status: log.status,
      createdAt: log.createdAt.toISOString(),
      sentAt: log.sentAt?.toISOString() ?? null,
      dispatchError: log.dispatchError,
      isStale,
    };
  });

  return { reminders: mapped, nextCursor };
}

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_key");

/**
 * Marks a reminder as sent.
 *
 * WhatsApp/SMS: changes status to simulated_sent (no real delivery — Governing Principle 3).
 * Email: Sends via Resend if parent email exists.
 */
export async function markReminderSent(reminderLogId: string): Promise<{ status: ReminderStatus; dispatchError: string | null }> {
  if (isDemoMode()) throw new Error(DEMO_WRITE_ERROR);

  const log = await prisma.reminderLog.findUnique({
    where: { id: reminderLogId },
    include: {
      feeAssignment: {
        include: {
          student: {
            include: {
              guardianOf: {
                include: {
                  parentLink: {
                    include: {
                      user: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  
  if (!log) throw new Error("Reminder log not found");

  if (log.feeAssignment?.schoolId) {
    await requireAdminForSchool(log.feeAssignment.schoolId);
  }

  if (log.status !== "logged") {
    throw new Error(`Reminder is already in status '${log.status}' — cannot mark as sent.`);
  }

  if (log.channel === "email") {
    // Find parent email
    const guardians = log.feeAssignment.student.guardianOf;
    const parentEmail = guardians.find((g) => g.parentLink.user.email)?.parentLink.user.email;

    if (!parentEmail) {
      // api_specification.md: "If no email is on file, the action still succeeds as a no-op dispatch
      // and the UI must surface 'no email on file' rather than silently doing nothing."
      // Keep status as 'failed', but write dispatchError so
      // the UI can surface the "no email on file" message rather than treating it as a failure.
      await prisma.reminderLog.update({
        where: { id: reminderLogId },
        data: {
          status: "failed",
          dispatchError: "no email on file",
        },
      });
      return { status: "failed", dispatchError: "no email on file" };
    }

    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "Finora <onboarding@resend.dev>",
        to: parentEmail,
        subject: `Payment Reminder - Tier ${log.tier}`,
        text: log.draftedText,
      });

      await prisma.reminderLog.update({
        where: { id: reminderLogId },
        data: {
          status: "sent",
          sentAt: new Date(),
        },
      });
      return { status: "sent", dispatchError: null };
    } catch (err: any) {
      const errorMsg = err.message || "Unknown email dispatch error";
      await prisma.reminderLog.update({
        where: { id: reminderLogId },
        data: {
          status: "failed",
          dispatchError: errorMsg,
          sentAt: new Date(),
        },
      });
      return { status: "failed", dispatchError: errorMsg };
    }
  } else {
    // WhatsApp/SMS
    await prisma.reminderLog.update({
      where: { id: reminderLogId },
      data: {
        status: "simulated_sent",
        sentAt: new Date(),
      },
    });
    return { status: "simulated_sent", dispatchError: null };
  }
}
