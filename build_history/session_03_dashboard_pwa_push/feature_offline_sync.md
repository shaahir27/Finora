---
feature: "Offline Sync & Conflict Resolution"
session: "Session 3"
status: "Built"
---

# Feature: Offline Sync & Conflict Resolution

## 1. Overview
* **Name:** Offline Sync & Conflict Resolution
* **Session:** Session 3 — Dashboard / Defaulter Scoring, PWA + Admin Push
* **Purpose:** Process locally queued offline payments on network reconnection, detect conflicts (e.g. overpayments), and provide an Admin UI to resolve those conflicts.
* **Traces to:** `product_requirements.md` (M-7) and `business_rules.md` (Offline Payment Entry Strategy).

## 2. Technical Rationale
* **How we achieved it:** Implemented `syncOfflinePayment` which intercepts queued items and routes them through `recordPayment`. If `recordPayment` throws an overpayment error, we catch it and generate an `OFFLINE_SYNC_CONFLICT` record instead. The UI lists pending local items (`getAllEntries` from IndexedDB) alongside global conflicts (`getSyncConflicts` from Postgres).
* **Alternatives considered:** Rejecting conflicts silently or overwriting the previous payment.
* **Why we chose this path:** Generating explicit `OFFLINE_SYNC_CONFLICT` records adheres to the explicit audit logging mandate. Admins must explicitly resolve conflicts.

## 3. Database Schema Impact
* **Changes made:** none (utilizing `OFFLINE_SYNC_CONFLICT` created in Session 1).

## 4. Core Logic & Necessary Functions
* **List of functions & files:** Key functions added or modified, and their exact file paths.
  * `syncOfflinePayment` (`apps/web/src/app/actions/offlineSync.ts`): Processes queued items and handles overpayment conflict generation.
  ```typescript
  export async function syncOfflinePayment(
    localId: string, feeAssignmentId: string, channel: "cash" | "cheque",
    amount: number, queuedAt: string, adminId: string, schoolId: string, refNumber?: string
  )
  ```
  * `reportSyncConflict` (`apps/web/src/app/actions/offlineSync.ts`): Escalates an unresolvable offline sync conflict to the server-side `offline_sync_conflicts` table (school-visible). Called on sync failure in `handleSyncNow` (`apps/web/src/app/admin/ledger/page.tsx`).
  ```typescript
  export async function reportSyncConflict(
    localId: string, schoolId: string, submittedById: string,
    feeAssignmentId: string, channel: "cash" | "cheque", amount: number,
    queuedAt: string, conflictReason: string
  ): Promise<{ id: string }>
  ```
  * `resolveSyncConflict` (`apps/web/src/app/actions/offlineSync.ts`): Marks a conflict as discarded or reentered_adjusted, with a session-verified audit log.
  ```typescript
  export async function resolveSyncConflict(
    conflictId: string, adminId: string, resolution: "discarded" | "reentered_adjusted", reason: string
  )
  ```
  * `getPendingEntries` / `getAllEntries` (`apps/web/src/lib/offlineQueue.ts`): Retrieves entries from IndexedDB for processing.

## 5. Testing & Verification
* **Automated tests:** `apps/web/tests/session3.test.ts` — verified that `syncOfflinePayment` intercepts an overpayment and returns a conflict error without posting the transaction. Also verified that `enqueueOfflinePayment` rejects `channel: upi`.
* **Manually verified:** Verified that `handleSyncNow` in `ledger/page.tsx` updates IndexedDB status to `conflict` and calls `reportSyncConflict`.

## 6. Dependencies & Deferred Work
* **Depends on:** `recordPayment` from Session 1, `offlineQueue.ts` created in Session 2.
* **Updates applied in Audit Pass:** `reportSyncConflict` integrated into `handleSyncNow`, `resolveSyncConflict` updated to use session-verified `sessionAdminId`.

