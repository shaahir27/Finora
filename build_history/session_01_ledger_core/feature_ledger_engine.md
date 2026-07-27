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
  * `recordPaymentInternal` (`apps/web/src/app/actions/ledger.ts`): Internal payment recording function with row-level locking (`SELECT ... FOR UPDATE`), anomaly detection (`round2`), and duplicate ref checks.
  * `recordPayment` (`apps/web/src/app/actions/ledger.ts`): Public admin entry point for payment recording; requires active admin session via `requireAdminForSchool(schoolId)`.
  ```typescript
  export async function recordPayment(
    adminId: string, schoolId: string,
    data: { feeAssignmentId: string; channel: PaymentChannel; amount: number; refNumber?: string; }
  )
  ```
  * `recordPaymentFromWebhook` (`apps/web/src/app/actions/ledger.ts`): Public Razorpay webhook entry point authenticated by signature verification.
  * `recordPaymentFromSandbox` (`apps/web/src/app/actions/ledger.ts`): Public parent sandbox simulation entry point.
  * `reverseTransaction` (`apps/web/src/app/actions/ledger.ts`): Reverses a transaction, preventing future state changes and writing an audit log. Guarded by `requireAdminForSchool`.
  ```typescript
  export async function reverseTransaction(
    adminId: string, transactionId: string, reason: string
  ): Promise<Transaction>
  ```
  * `applyWaiver` (`apps/web/src/app/actions/ledger.ts`): Applies a financial waiver to a specific fee assignment with mandatory audit logging and defaulter score recomputation. Guarded by `requireAdminForSchool`.
  ```typescript
  export async function applyWaiver(
    adminId: string, schoolId: string, feeAssignmentId: string,
    data: { amount: number; reason: string; }
  )
  ```
  * `applyPenalty` (`apps/web/src/app/actions/ledger.ts`): Applies a financial penalty with mandatory audit logging and defaulter score recomputation. Guarded by `requireAdminForSchool`.
  ```typescript
  export async function applyPenalty(
    adminId: string, transactionId: string,
    data: { amount: number; reason: string; }
  )
  ```
  * `getLedgerSnapshot` (`apps/web/src/app/actions/ledger.ts`): Aggregates total collected revenue, pending cheque totals, flagged anomaly totals, reversed totals, and supports real-time multi-field search (`student.name`, `student.admissionNumber`, `refNumber`) and status filtering (`posted`, `cheque_pending`, `flagged`, `reversed`).
  ```typescript
  export async function getLedgerSnapshot(
    schoolId: string, options?: { channel?: PaymentChannel; status?: ReconciliationStatus; search?: string; startDate?: Date; endDate?: Date; cursor?: string; limit?: number; }
  )
  ```
  * `batchClearChequesAction` (`apps/web/src/app/actions/ledger.ts`): Executes atomic batch clearing of selected pending cheques in a single Prisma transaction with audit logs and audio soundbox notifications.
  * `exportLedgerCsvAction` (`apps/web/src/app/actions/ledger.ts`): Generates a downloadable CSV spreadsheet formatted with fee categories, GST calculations, and payment details.
  * `getTransactionAuditHistory` (`apps/web/src/app/actions/ledger.ts`): Returns complete audit trail history and itemized GST tax breakdown for the Transaction Inspector drawer.
  * `reconcileBankStatement` (`packages/ai/src/reconcileBankStatement.ts`): Bank Statement Auto-Reconciliation Engine using UTR rule matching & Gemini AI semantic depositor matching.
  * `processBankStatementAction` (`apps/web/src/app/actions/bankReconciliation.ts`): Server action executing bank statement auto-reconciliation against school fee contexts.
  * `confirmBatchBankReconciliationAction` (`apps/web/src/app/actions/bankReconciliation.ts`): Batch posts confirmed bank statement matches to the master ledger.
  * `markChequeCleared` (`apps/web/src/app/actions/ledger.ts`): Safely advances a cheque's reconciliation status to posted with session-derived audit log. Guarded by `requireAdminForSchool`.
  ```typescript
  export async function markChequeCleared(transactionId: string): Promise<Transaction>
  ```
  * `resolveAnomaly` (`apps/web/src/app/actions/ledger.ts`): Resolves a flagged anomaly transaction as either `posted` or `reversed` with mandatory audit logging. Guarded by `requireAdminForSchool(transaction.schoolId)`.
  ```typescript
  export async function resolveAnomaly(
    adminId: string, transactionId: string, resolution: "posted" | "reversed", notes?: string
  )
  ```

## 5. Testing & Verification
* **Automated tests:**
  * `packages/ai/src/__tests__/reconcileBankStatement.test.ts` — tests bank statement text parsing, exact UTR rule matching, and fallback handling.
  * `apps/web/src/__tests__/waiverPenaltyAudit.test.ts` — tests `applyWaiver` and `applyPenalty` audit logging and validations.
  * `apps/web/src/__tests__/reconciliation.test.ts` — tests `recordPayment`, `markChequeBounced`, `markChequeCleared`, and `resolveSyncConflict`.
* **Manually verified:** DB-level lock testing for concurrency, 4-tab workspace navigation (`Master Ledger`, `Bank Auto-Match 🤖`, `OCR Scanner`, `Offline Sync`), multi-select batch cheque clearing, CSV export, and Transaction Inspector drawer.

## 6. Dependencies & Deferred Work
* **Depends on:** `detectAnomaly` and `computeDefaulterScore` from `packages/rules`, `generateContent` from `@smart-school/ai`.
* **Option C Upgrade Applied**: Real-time multi-field search engine, status filters, 1-click batch cheque clearance, formatted CSV export engine, live KPI banner, Transaction Inspector drawer, and the flagship Bank Statement Auto-Reconciliation Engine with 3-column match board.


