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
  * `applyWaiver` (`apps/web/src/app/actions/ledger.ts`): Applies a financial waiver to a specific fee assignment.
  ```typescript
  export async function applyWaiver(
    adminId: string, schoolId: string,
    data: { feeAssignmentId: string; amount: number; reason: string; }
  )
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```
  * `applyPenalty` (`apps/web/src/app/actions/ledger.ts`): Applies a financial penalty (e.g. late fee).
  ```typescript
  export async function applyPenalty(
    adminId: string, schoolId: string,
    data: { feeAssignmentId: string; amount: number; reason: string; }
  )
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```
  * `getLedgerSnapshot` (`apps/web/src/app/actions/ledger.ts`): Aggregates total collected revenue and pending fees across the school.
  ```typescript
  export async function getLedgerSnapshot(
    schoolId: string, options?: { channel?: PaymentChannel; startDate?: Date; endDate?: Date; }
  )
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```
  * `markChequeCleared` (`apps/web/src/app/actions/ledger.ts`): Safely advances a cheque's reconciliation status to posted.
  ```typescript
  export async function markChequeCleared(transactionId: string): Promise<Transaction>
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```

## 5. Testing & Verification
* **Automated tests:** none (Tests pending for Session 1 Checkpoint)
* **Manually verified:** DB-level lock testing for concurrency, security check that waivers and penalties enforce `adminId` and emit `AUDIT_LOG`.

## 6. Dependencies & Deferred Work
* **Depends on:** `detectAnomaly` and `computeDefaulterScore` from `packages/rules`.
* **Known issues/deferred:** Razorpay webhook routing and AI narration of anomalies are deferred to Sessions 2 and 4.
