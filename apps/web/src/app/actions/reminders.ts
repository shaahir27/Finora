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

export interface ReminderQueueItem {
  id: string;
  feeAssignmentId: string;
  studentName: string;
  studentId: string;
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
          student: { select: { id: true, name: true } },
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

    return {
      id: log.id,
      feeAssignmentId: fa.id,
      studentName: fa.student.name,
      studentId: fa.student.id,
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
export async function markReminderSent(reminderLogId: string): Promise<void> {
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
      // Keep status as 'logged' (action succeeded, nothing was sent), but write dispatchError so
      // the UI can surface the "no email on file" message rather than treating it as a failure.
      await prisma.reminderLog.update({
        where: { id: reminderLogId },
        data: {
          dispatchError: "no_email_on_file",
        },
      });
      return;
    }

    try {
      await resend.emails.send({
        from: "Finora <noreply@finora.school>",
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
    } catch (err: any) {
      await prisma.reminderLog.update({
        where: { id: reminderLogId },
        data: {
          status: "failed",
          dispatchError: err.message || "Unknown email dispatch error",
          sentAt: new Date(),
        },
      });
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
  }
}
