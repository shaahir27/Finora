---
feature: "Offline Queue Write Path"
session: "Session 2"
status: "Built"
---

# Feature: Offline Queue Write Path

## 1. Overview
* **Name:** Offline Queue Write Path
* **Session:** Session 2 — Reconciliation
* **Purpose:** Implements the local IndexedDB offline payment queue for cash and cheque entries, enabling reliable operation without a live server connection. Includes the server-side sync endpoints (resolving conflicts).
* **Traces to:** product_requirements.md (Offline Payment Sync, Phase 10)

## 2. Technical Rationale
* **How we achieved it:** The offline queue uses browser IndexedDB directly via the `idb` wrapper. Entries generate a `local_id` (UUID) client-side to guarantee idempotency across multiple sync retries.
* **Alternatives considered:** none
* **Why we chose this path:** Generating IDs locally prevents double-posting during unpredictable network reconnections.

## 3. Database Schema Impact
* **Changes made:** none (Schema already handles pending offline logic).

## 4. Core Logic & Necessary Functions
* **List of functions & files:** Key functions added or modified, and their exact file paths.
  * `syncOfflinePayment` (`apps/web/src/app/actions/offlineSync.ts`): Syncs a single offline-queued entry by calling the normal recordPayment path. Rejects UPI outright.
  ```typescript
  export async function syncOfflinePayment(
    localId: string, feeAssignmentId: string, channel: "cash" | "cheque",
    amount: number, queuedAt: string, adminId: string, schoolId: string, refNumber?: string
  ): Promise<{ success: true; transaction: object } | { success: false; conflictReason: string }>
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```

## 5. Testing & Verification
* **Automated tests:**
  * `apps/web/tests/session3.test.ts` — tests that `enqueueOfflinePayment` rejects `channel: upi` with an explicit error, and that `syncOfflinePayment` returns `{ success: false, conflictReason }` (rather than throwing or posting) when the synced amount would cause an overpayment.
  * `apps/web/src/__tests__/reconciliation.test.ts` — tests `resolveSyncConflict` rejects an empty `reason` string (enforcing the non-negotiable audit principle).
* **Manually verified:** Verified that UPI is strictly rejected by the server action.

## 6. Dependencies & Deferred Work
* **Depends on:** `recordPayment` from `apps/web/src/app/actions/ledger.ts`.
* **Known issues/deferred:** This feature implements enqueueing and server-side syncing logic. The actual sync *execution trigger* (Service Worker Background Sync) is deferred to Session 3.
