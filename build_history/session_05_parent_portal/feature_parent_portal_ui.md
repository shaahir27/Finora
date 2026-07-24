# Feature: Parent Portal UI (Dues / Pay / History)

## 1. Overview
* **Name:** Parent Portal UI
* **Session:** Session 5 — Parent Portal
* **Purpose:** Provides the core parent-facing screens: `/parent/dues` (outstanding fees with Pay Now CTA), `/parent/pay` (UPI payment initiation), and `/parent/history` (transaction history with receipt download stub). Includes a shared shell layout with sidebar navigation and auth guard.
* **Traces to:** `docs/api_specification.md` — getMyChildrenDues, payDueViaUpi, getMyPaymentHistory contracts; `docs/ui_ux_specification.md` — Parent Portal screens.

## 2. Technical Rationale
* **How we achieved it:** Next.js App Router with a shared `parent/layout.tsx` that: (1) intercepts all `/parent/*` routes except `/parent/login`, (2) checks `sessionStorage` for an auth flag set after OTP verification, (3) redirects to `/parent/login` if missing. This is a client-side soft guard — real security is at the server action layer (PARENT_LINK scoping). Multi-child support uses tab UI. Payment status color-coding matches the admin ledger (`status-posted`/`risk-high` design tokens).
* **Alternatives considered:** Server-side session via Supabase SSR auth middleware. Deferred to keep the parent portal isolated from the admin auth path.
* **Why we chose this path:** Fastest path to a complete demo; the DB-level PARENT_LINK scoping in server actions is the real security boundary regardless of client guard.

## 3. Database Schema Impact
* **Changes made:** None — all reads via existing PARENT_LINK → GUARDIAN_OF → STUDENT → FEE_ASSIGNMENT → TRANSACTION chain.

## 4. Core Logic & Necessary Functions
* **List of functions & files:**
  * `ParentLayout` (`apps/web/src/app/parent/layout.tsx`): Auth guard, sidebar nav, I18nProvider wrapper.
  * `ParentDuesPage` (`apps/web/src/app/parent/dues/page.tsx`): Fetches dues via `getMyChildrenDues`, renders per-student tabs, Pay Now deeplink.
  * `PayPage` (`apps/web/src/app/parent/pay/page.tsx`): Reads `assignmentId`/`amount` from query params, calls `payDueViaUpi`, shows Razorpay sandbox flow.
  * `ParentHistoryPage` (`apps/web/src/app/parent/history/page.tsx`): Fetches via `getMyPaymentHistory`, renders tabular history with receipt download stub.
  ```typescript
  export async function getMyChildrenDues(parentUserId: string): Promise<DueItem[]>
  export async function payDueViaUpi(feeAssignmentId: string, amount: number): Promise<UpiOrder>
  export async function getMyPaymentHistory(parentUserId: string): Promise<{ transactions: TxItem[], nextCursor?: string }>
  ```

## 5. Testing & Verification
* **Automated tests:** `apps/web/tests/session5.test.ts` — Tests 4–6 (dues returns empty for unknown user; payDueViaUpi rejects zero/negative/overpayment).
* **Manually verified:** Layout auth guard redirects without session; dues page renders skeleton; multi-student tab switching.

## 6. Dependencies & Deferred Work
* **Depends on:** `getMyChildrenDues`, `payDueViaUpi`, `getMyPaymentHistory` server actions; `@smart-school/payments` UPI sandbox package.
* **Known issues/deferred:** Receipt download button is a stub — actual PDF generation is Session 6. Razorpay webhook round-trip not yet wired (sandbox only simulates payment in UI).
