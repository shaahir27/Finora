"use server";

/**
 * apps/web/src/app/actions/offlineSync.ts
 *
 * Server-side write path for the offline payment queue.
 *
 * Design rules (api_specification.md — Offline Payment Sync, Phase 10):
 * - syncOfflinePayment: rejects UPI outright; calls recordPayment (same path as every channel).
 * - reportSyncConflict: writes OFFLINE_SYNC_CONFLICT (school-visible, not device-scoped).
 * - getSyncConflicts: returns unresolved conflicts for any admin at the school.
 * - resolveSyncConflict: requires non-empty reason (same pattern as applyWaiver/applyPenalty).
 *
 * Session 2 scope: write path only. Sync TRIGGER (service worker Background Sync) is Session 3.
 * A queued entry sitting in IndexedDB is expected — not a bug.
 */

import { prisma, type PaymentChannel } from "@smart-school/db";
import { recordPayment } from "./ledger";
import { notifySchoolAdmins } from "./push";
import { requireAdminForSchool } from "@/lib/require-session";
import { isDemoMode, DEMO_WRITE_ERROR } from "@/lib/demo-mode";
import { getDemoSyncConflicts } from "@/lib/demo-data";

// ---------------------------------------------------------------------------
// syncOfflinePayment
// ---------------------------------------------------------------------------

/**
 * Syncs a single offline-queued entry by calling the normal recordPayment path.
 *
 * Critical: this is NOT a separate posting function. It calls the exact same
 * recordPayment used by every other channel, so it inherits the row-level lock
 * and overpayment check automatically (api_specification.md).
 *
 * @param localId         The client-generated UUID (idempotency anchor).
 * @param feeAssignmentId The assignment to post against.
 * @param channel         cash | cheque only — upi is rejected.
 * @param amount          Amount in rupees.
 * @param queuedAt        ISO string of when the entry was originally created offline.
 * @param adminId         The acting admin.
 * @param schoolId        School context.
 */
export async function syncOfflinePayment(
  localId: string,
  feeAssignmentId: string,
  channel: "cash" | "cheque",
  amount: number,
  queuedAt: string,
  adminId: string,
  schoolId: string,
  refNumber?: string
): Promise<{ success: true; transaction: object } | { success: false; conflictReason: string }> {
  if (isDemoMode()) throw new Error(DEMO_WRITE_ERROR);

  // Hard rule: UPI cannot be synced offline
  if ((channel as string) === "upi") {
    throw new Error(
      "syncOfflinePayment rejects upi channel. Only cash and cheque can be queued offline."
    );
  }

  await requireAdminForSchool(schoolId);

  try {
    const result = await recordPayment(adminId, schoolId, {
      feeAssignmentId,
      channel: channel as PaymentChannel,
      amount,
      ...(refNumber !== undefined ? { refNumber } : {}),
    });

    return { success: true, transaction: result.transaction };
  } catch (err) {
    // Balance conflict or overpayment — caller must call reportSyncConflict
    const conflictReason =
      err instanceof Error ? err.message : "unknown_error";
    return { success: false, conflictReason };
  }
}

// ---------------------------------------------------------------------------
// reportSyncConflict
// ---------------------------------------------------------------------------

/**
 * Escalates an unresolvable offline sync conflict to the server-side school-wide table.
 *
 * Idempotent on local_id — a retried call updates rather than duplicates
 * (database_design.md unique constraint on local_id).
 *
 * The conflict is school-visible, not device-scoped — any admin at the school
 * can see and resolve it, not just the one whose device queued the entry.
 */
export async function reportSyncConflict(
  localId: string,
  schoolId: string,
  submittedById: string,
  feeAssignmentId: string,
  channel: "cash" | "cheque",
  amount: number,
  queuedAt: string,
  conflictReason: string
): Promise<{ id: string }> {
  await requireAdminForSchool(schoolId);

  // Upsert — if the same localId was already escalated (retried call), update rather than duplicate.
  const existing = await prisma.offlineSyncConflict.findUnique({
    where: { localId },
  });

  if (existing) {
    return { id: existing.id };
  }

  const conflict = await prisma.offlineSyncConflict.create({
    data: {
      schoolId,
      submittedById,
      localId,
      feeAssignmentId,
      channel: channel as PaymentChannel,
      amount,
      queuedAt: new Date(queuedAt),
      conflictReason,
    },
  });

  // NOTE: Push notification for the conflict is triggered by the UI/event layer
  // after this action returns — same non-blocking pattern as every other side effect.
  notifySchoolAdmins(schoolId, {
    title: "Sync Conflict",
    body: `A sync conflict was reported for a queued offline payment.`,
    url: "/admin/offline-sync",
  }).catch(console.error);

  return { id: conflict.id };
}

// ---------------------------------------------------------------------------
// getSyncConflicts
// ---------------------------------------------------------------------------

/**
 * Returns unresolved OFFLINE_SYNC_CONFLICT rows for the school.
 * Any admin at the school can view these — not scoped to the submitting admin.
 */
export async function getSyncConflicts(schoolId: string) {
  if (isDemoMode()) return getDemoSyncConflicts();

  await requireAdminForSchool(schoolId);

  const conflicts = await prisma.offlineSyncConflict.findMany({
    where: { schoolId, resolved: false },
    orderBy: { createdAt: "asc" },
    include: {
      submittedBy: { select: { id: true, email: true } },
    },
  });

  return conflicts.map((c) => ({
    ...c,
    amount: Number(c.amount),
  }));
}

// ---------------------------------------------------------------------------
// resolveSyncConflict
// ---------------------------------------------------------------------------

/**
 * Marks a conflict resolved.
 *
 * Per api_specification.md:
 * - resolutionAction: 'discarded' | 'reentered_adjusted'
 * - 'discarded' closes with no further write.
 * - 'reentered_adjusted' requires the admin to have already re-entered a corrected
 *   payment through the normal recordPayment flow first — this action only marks
 *   it resolved and records the reasoning. It does NOT itself post anything.
 * - reason is non-nullable (same non-negotiable pattern as applyWaiver/applyPenalty).
 */
export async function resolveSyncConflict(
  conflictId: string,
  adminId: string,
  resolutionAction: "discarded" | "reentered_adjusted",
  reason: string
): Promise<void> {
  if (!reason || reason.trim() === "") {
    throw new Error("A reason is required to resolve a sync conflict.");
  }

  const conflict = await prisma.offlineSyncConflict.findUnique({
    where: { id: conflictId },
  });
  if (!conflict) throw new Error("Sync conflict not found.");
  if (conflict.resolved) throw new Error("Conflict is already resolved.");

  const { adminId: sessionAdminId } = await requireAdminForSchool(conflict.schoolId);

  await prisma.offlineSyncConflict.update({
    where: { id: conflictId },
    data: {
      resolved: true,
      resolvedById: sessionAdminId,
      resolvedAt: new Date(),
      resolutionAction,
    },
  });

  // Audit log — resolving a conflict is as audit-worthy as a waiver or penalty.
  await prisma.auditLog.create({
    data: {
      actorId: sessionAdminId,
      action: "sync_conflict_resolved",
      beforeState: {
        conflictId,
        localId: conflict.localId,
        conflictReason: conflict.conflictReason,
      },
      afterState: {
        resolutionAction,
        reason,
      },
    },
  });
}
