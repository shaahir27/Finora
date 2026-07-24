---
feature: "Codebase Audit & Bug Fixes"
session: "Session 6"
status: "Built"
---

# Feature: Codebase Audit & Bug Fixes

## 1. Overview
* **Name:** Codebase Audit & Bug Fixes
* **Session:** Session 6 — Polish & Demo
* **Purpose:** Full end-to-end audit of all logic, endpoints, and features through Session 6. Identified and fixed 5 bugs, created the missing Razorpay webhook API route, and corrected stale build history logs. No new user-facing features introduced — all changes are correctness fixes.
* **Traces to:** `docs/AI_INSTRUCTIONS.md` Rule 1 (never ship something that doesn't match spec); `api_specification.md` across all sessions.

## 2. Technical Rationale
* **How we achieved it:** Manually traced every Server Action file against `api_specification.md`, `business_rules.md`, and `financial_engine.md`. Identified deviations and bugs. Applied surgical fixes with no architectural changes.
* **Alternatives considered:** None — these are spec-compliance corrections, not design decisions.
* **Why we chose this path:** Surgical fixes over architectural changes, to match the spec without introducing regressions.

## 3. Database Schema Impact
* **Changes made:** None. All fixes are application-level logic corrections. No new tables, columns, or migrations required.

## 4. Core Logic & Necessary Functions

### Bug 1 — `applyWaiver` defaulter score recompute (CRITICAL)
* **File:** `apps/web/src/app/actions/ledger.ts`
* **Root cause:** The defaulter score recompute loop after a waiver accumulated `totalWaived` across all of a student's fee assignments and then passed that cumulative value to `calculateRemainingBalance` as if it were the per-assignment waived amount. This caused the remaining balance to be underestimated on the 2nd+ assignment (waived amount of ALL assignments subtracted from ONE assignment's base amount), producing an incorrectly low risk score after any waiver on a student with more than one fee type.
* **Fix:** Captured `wv = calculateWaivedAmount(a.waivers)` before accumulating into `totalWaived`. `calculateRemainingBalance` now receives `wv` (per-assignment) not `totalWaived` (cumulative).

### Bug 2 — Missing Razorpay Webhook API Route (CRITICAL)
* **File created:** `apps/web/src/app/api/webhooks/razorpay/route.ts`
* **Root cause:** `handleRazorpayWebhook` was implemented as a Next.js Server Action, but Razorpay sends a raw HTTP POST from its servers. Server Actions cannot receive arbitrary HTTP POSTs from external services. Without an actual `app/api/` route handler, every UPI sandbox payment captured by Razorpay would never auto-confirm in the ledger — admins would have to manually use `reconcileMissedUpiPayment` for every transaction.
* **Fix:** Created a proper Next.js API route handler at `/api/webhooks/razorpay`. It reads raw body (required for HMAC signature verification), calls `verifyRazorpayWebhookSignature`, extracts `fee_assignment_id` from order notes set at order creation time, and posts through `recordPayment`. Returns 400 on signature failure, 200 for non-captured events, 500 on DB failure (so Razorpay retries).

### Bug 3 — `markReminderSent` "no email on file" status (MEDIUM)
* **File:** `apps/web/src/app/actions/reminders.ts`
* **Root cause:** `api_specification.md` states: "If no email is on file, the action still succeeds as a no-op dispatch and the UI must surface 'no email on file'." The code was setting `status: 'failed'`, which collapsed a "not-configured" state with real dispatch failures, making them indistinguishable.
* **Fix:** The no-email path now keeps `status: 'logged'` (action succeeded, nothing dispatched) and writes `dispatchError: 'no_email_on_file'` so the UI can surface the correct user message without treating it as a failure.

### Bug 4 — `generateReconciliationReport` date filter (HIGH)
* **File:** `apps/web/src/app/actions/reports.ts`
* **Root cause:** `getLedgerSnapshot` was called with no date parameters, returning school-wide totals. The transaction list was filtered in memory after the fact. This meant the `totalCollected` / `outstandingDuesTotal` aggregate metrics in the report header always showed school-wide figures regardless of the requested date range.
* **Fix:** `startDate`/`endDate` are now passed into `getLedgerSnapshot` as query-level filters, so all aggregate metrics are period-scoped and match the live dashboard for the same date range.

### Bug 5 — `getDefaulters` unbounded DB growth (MEDIUM)
* **File:** `apps/web/src/app/actions/defaulters.ts`
* **Root cause:** `prisma.defaulterScore.create()` was called for every student with a balance on every invocation of `getDefaulters()`. With no uniqueness constraint on `(studentId, date)`, every page load of `/admin/defaulters` inserted a new duplicate score row per student. On `getStudentProfile`, this grew into a polluted score history list.
* **Fix:** Replaced with an upsert pattern: checks for an existing score row for the student created today (`computedAt >= todayStart`). If found, updates in place. Otherwise creates a new row. At most one score row per student per day.

### Bug 6 — `AdminLayout` Responsive Sidebar Breakage (HIGH)
* **File:** `apps/web/src/app/admin/layout.tsx`
* **Root cause:** The layout wrapper used `flex-col md:flex-row`, causing the sidebar to expand and take up the entire viewport on narrower screens or scaled resolutions, completely hiding the actual dashboard content beneath it.
* **Fix:** Implemented a Mobile Drawer pattern. The sidebar is now hidden by default on mobile/narrow screens. A slim top bar with a Hamburger Menu icon (`Menu` from `lucide-react`) is shown. Clicking it slides the sidebar in (`transform translate-x-0`). Selecting any navigation item correctly dismisses the drawer (`setIsMobileMenuOpen(false)`). On desktop (`>=768px`), the sidebar remains perfectly pinned to the left edge exactly as it was.

## 5. Testing & Verification
* **Automated tests:** Existing tests still pass (no test file changes required — these are logic bug fixes, not new API surface).
* **Manually verified:**
  * `applyWaiver` on a student with 2 fee assignments → defaulter score reflects correct per-assignment balance, not an underestimated one.
  * `/api/webhooks/razorpay` reachable via HTTP POST; signature mismatch returns 400.
  * `markReminderSent` for parent with no email → `status` stays `logged`, `dispatchError: 'no_email_on_file'` set.
  * `generateReconciliationReport` for a 7-day range → `totalCollected` matches ledger snapshot for the same range.
  * `getDefaulters` called twice → second call updates the existing score row, no new row created.
  * Simulated laptop zoom and mobile screen widths to verify that the sidebar collapses into a drawer on small screens and pins alongside content on large screens.

## 6. Dependencies & Deferred Work
* **Depends on:** All prior sessions' features (this is a cross-cutting audit).
* **Known issues/deferred:**
  * The in-memory rate limiter in `rateLimit.ts` resets on every serverless cold start — known limitation, Redis upgrade deferred post-demo.
  * PDF/CSV file generation remains stubbed (returns a dummy storage URL).
  * `RESEND_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` must be set with real values by the operator — placeholder values in `.env` mean those features degrade gracefully but do not function end-to-end.
  * `broken_promise_count` in `computeDefaulterScore` still hardcoded to 0 (requires REMINDER_LOG join to be meaningful — known, documented in Session 3 log).
