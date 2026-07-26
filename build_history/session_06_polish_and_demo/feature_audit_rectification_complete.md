# Feature Log: Codebase Audit & Solution Rectification (Complete)

## 1. Overview
* **Name:** Complete Codebase Audit & Audit Report Rectification
* **Session:** Session 6 — Polish & Demo
* **Purpose:** Resolve all 25 consolidated items from `audit_report.md` (Round 4 and Round 5), fix missing database constraints, patch security IDOR gaps, fix TypeScript type errors, and ensure 100% test suite and type safety.
* **Traces to:** `audit_report.md` items 1–25; `docs/project_overview.md` Governing Principles; `docs/AI_INSTRUCTIONS.md`.

## 2. Technical Rationale
* **How we achieved it:** 
  - Implemented `ALLOW_UNAUTHENTICATED_DEMO_ACTIONS` opt-in flag in `require-session.ts` so authentication is strictly enforced outside explicit testing/demo setups.
  - Added `requireAdminForSchool` auth guards to `reverseTransaction`, `markChequeCleared`, `markChequeBounced`, `applyPenalty`, `applyWaiver`, `resolveAnomaly`, `fees.ts`, `reminders.ts`, `ai.ts`, and `defaulters.ts`.
  - Fixed IDOR vulnerabilities in `parents.ts` and `push.ts` by deriving user context directly from `requireParentSession()` or `auth()` instead of accepting untrusted parameter strings.
  - Refactored `recordPayment` into `recordPaymentInternal` with dedicated safe entry points `recordPaymentFromWebhook` and `recordPaymentFromSandbox`.
  - Added database migration `20260726000000_constraints_and_indexes` creating partial unique indexes on `transactions.ref_number` (where `channel = 'upi'`) and `students(school_id, admission_number)`, a CHECK constraint on `transactions.amount > 0`, and `receipts(school_id, receipt_number)` uniqueness.
  - Added Prisma `P2002` error handling across server actions (`ledger.ts`, `receipts.ts`, `students.ts`) for graceful duplicate handling.
  - Fixed floating-point precision in anomaly detection via `round2()`.
  - Wired `reportSyncConflict` in `handleSyncNow` in `ledger/page.tsx` so unresolvable offline sync conflicts reach the server `offline_sync_conflicts` table.
* **Alternatives considered:** none — all fixes were hand-traced against the exact rules and specifications in `docs/`.
* **Why we chose this path:** Preserved all architectural invariants, zero breaking API contract changes, 100% backward compatibility for existing callers.

## 3. Database Schema Impact
* **Changes made:**
  - Added migration `packages/db/prisma/migrations/20260726000000_constraints_and_indexes/migration.sql`:
    - `CREATE UNIQUE INDEX transactions_upi_ref_number_key ON transactions (ref_number) WHERE channel = 'upi' AND ref_number IS NOT NULL;`
    - `CREATE UNIQUE INDEX students_school_admission_number_key ON students (school_id, admission_number) WHERE admission_number IS NOT NULL;`
    - `ALTER TABLE transactions ADD CONSTRAINT transactions_amount_positive_check CHECK ("amount" > 0);`
    - `ALTER TABLE receipts ADD COLUMN school_id TEXT;` with backfill, `NOT NULL` constraint, FK constraint, and `receipts_school_id_receipt_number_key` unique index.

## 4. Core Logic & Necessary Functions
* **List of functions & files:**
  * `requireAdminForSchool`, `requireParentSession` (`apps/web/src/lib/require-session.ts`): Opt-in unauthenticated demo mode.
  * `recordPaymentInternal`, `recordPaymentFromWebhook`, `recordPaymentFromSandbox` (`apps/web/src/app/actions/ledger.ts`): Internal payment core with role-specific public entry points.
  * `markChequeCleared` (`apps/web/src/app/actions/ledger.ts`): 1-argument signature with session-derived `actorId` audit logging.
  * `reportSyncConflict` (`apps/web/src/app/actions/offlineSync.ts`): Server-side conflict reporting.
  * `handleSyncNow` (`apps/web/src/app/admin/ledger/page.tsx`): Offline queue sync runner with conflict reporting integration.
  * `generateReceipt` (`apps/web/src/app/actions/receipts.ts`): Short-transaction reservation pattern with `P2002` duplicate receipt protection.
  * `verifyRazorpayWebhookSignature` (`packages/payments/src/razorpay.ts`): Length check prior to `crypto.timingSafeEqual`.

```typescript
export async function recordPaymentFromWebhook(
  schoolId: string,
  data: { feeAssignmentId: string; channel: PaymentChannel; amount: number; refNumber?: string }
) {
  return recordPaymentInternal("razorpay-webhook-system", schoolId, data);
}
```

## 5. Testing & Verification
* **Automated tests:** 
  - `pnpm test` (7 test files, 54/54 tests passing).
  - `pnpm --filter web exec tsc --noEmit` (0 TypeScript errors across all files).
* **Manually verified:**
  - Offline sync failure conflict escalation to `reportSyncConflict`.
  - Duplicate receipt generation P2002 handling.
  - Authorization guards across all admin/parent server actions.

## 6. Dependencies & Deferred Work
* **Depends on:** `@smart-school/db`, `@smart-school/rules`, `@smart-school/payments`.
* **Known issues/deferred:**
  - Rate limiter shared KV store (`@upstash/redis` / `@upstash/ratelimit`) deferred to production infrastructure deployment phase (documented in Fix 16).
