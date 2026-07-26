---
feature: "Ledger Engine"
session: "Session 1"
status: "Built"
---

# Feature: Ledger Engine

## 1. Overview
* **Name:** Ledger Engine
* **Session:** Session 1 — Ledger Core
* **Purpose:** Acts as the absolute source of truth for the school's financial state, processing payments and enforcing mathematical correctness.
* **Traces to:** product_requirements.md M-2, M-3

## 2. Technical Rationale
* **How we achieved it:** Built `apps/web/src/app/actions/ledger.ts`. `recordPayment` acquires a `SELECT ... FOR UPDATE` lock on the FEE_ASSIGNMENT before reading balances to prevent concurrent overpayments. Implemented UPI webhook idempotency. Anomalies are detected synchronously inside the payment write.
* **Alternatives considered:** Optimistic locking via Prisma versions.
* **Why we chose this path:** Pessimistic locking (SELECT FOR UPDATE) guarantees no race conditions across simultaneous web and webhook payment events.

## 3. Database Schema Impact
* **Changes made:** none (Schema was pre-scaffolded in `feature_project_scaffolding.md`)

## 4. Core Logic & Necessary Functions
* **List of functions & files:** Key functions added or modified, and their exact file paths.
  * `recordPayment` (`apps/web/src/app/actions/ledger.ts`): The core payment recording function that implements mathematical locks and detects anomalies synchronously.
  ```typescript
  export async function recordPayment(
    adminId: string, schoolId: string,
    data: { feeAssignmentId: string; channel: PaymentChannel; amount: number; refNumber?: string; }
  )
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```
  * `reverseTransaction` (`apps/web/src/app/actions/ledger.ts`): Reverses a transaction, preventing any future state changes and writes an audit log.
  ```typescript
  export async function reverseTransaction(
    adminId: string, transactionId: string, reason: string
  ): Promise<Transaction>
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```
  * `applyWaiver` (`apps/web/src/app/actions/ledger.ts`): Applies a financial waiver to a specific fee assignment with mandatory audit logging. Also triggers a defaulter score recompute for the affected student. **Correction applied 2026-07-24**: the defaulter score recompute loop used `totalWaived` (a cumulative sum across all assignments) as the per-assignment waived amount in `calculateRemainingBalance`, causing the remaining balance to be underestimated on the 2nd+ assignment and producing a wrong defaulter score after any waiver. Fixed to capture per-assignment `wv` before accumulating into `totalWaived`.
  ```typescript
  export async function applyWaiver(
    adminId: string, schoolId: string, feeAssignmentId: string,
    data: { amount: number; reason: string; }
  )
  // Note: feeAssignmentId is a positional argument, NOT nested inside data.
  // Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```
  * `applyPenalty` (`apps/web/src/app/actions/ledger.ts`): Applies a financial penalty (e.g. late fee) with mandatory audit logging.
  ```typescript
  export async function applyPenalty(
    adminId: string, transactionId: string,
    data: { amount: number; reason: string; }
  )
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```
  * `getLedgerSnapshot` (`apps/web/src/app/actions/ledger.ts`): Aggregates total collected revenue (excluding `flagged` transactions) and pending fees across the school.
  ```typescript
  export async function getLedgerSnapshot(
    schoolId: string, options?: { channel?: PaymentChannel; startDate?: Date; endDate?: Date; cursor?: string; limit?: number; }
  )
  ```
  * `markChequeCleared` (`apps/web/src/app/actions/ledger.ts`): Safely advances a cheque's reconciliation status to posted.
  ```typescript
  export async function markChequeCleared(transactionId: string): Promise<Transaction>
  ```
  * `resolveAnomaly` (`apps/web/src/app/actions/ledger.ts`): Resolves a flagged anomaly transaction as either `posted` or `reversed` with mandatory audit logging and note tracking.
  ```typescript
  export async function resolveAnomaly(
    adminId: string, transactionId: string, resolution: "posted" | "reversed", notes?: string
  )
  ```

## 5. Testing & Verification
* **Automated tests:**
  * `apps/web/src/__tests__/waiverPenaltyAudit.test.ts` — directly tests `applyWaiver` and `applyPenalty`: verifies `AUDIT_LOG` rows are produced on every call, empty/null reasons are rejected at the application layer, and empty `adminId` is rejected.
  * `apps/web/src/__tests__/reconciliation.test.ts` — tests `recordPayment`, `markChequeBounced`, `markChequeCleared`, and `resolveSyncConflict`.
* **Manually verified:** DB-level lock testing for concurrency, security check that waivers and penalties enforce `adminId` and emit `AUDIT_LOG`.

## 6. Dependencies & Deferred Work
* **Depends on:** `detectAnomaly` and `computeDefaulterScore` from `packages/rules`.
* **Updates applied in Audit Pass**: `resolveAnomaly` action added, `totalCollected` updated to exclude `flagged` status, `applyWaiver` validated against balance, and `applyPenalty` updated to recompute defaulter score.
