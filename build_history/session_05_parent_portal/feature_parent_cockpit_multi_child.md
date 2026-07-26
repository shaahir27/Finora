# Feature Log: Parent Portal Overhaul & Multi-Child Cockpit

## 1. Overview
* **Name:** Parent Portal Overhaul & Multi-Child Cockpit
* **Session:** Session 5 — Parent Portal
* **Purpose:** Transform the minimal dues list into an interactive research-backed Parent Cockpit financial hub with child switcher toggles, 80C tax exemption certificates, GST SAC transparency, installment simulators, and family cart payments.
* **Traces to:** `docs/product_requirements.md` (Parent Portal UI/UX) & Market Research Pain Point Remediation.

## 2. Technical Rationale
* **How we achieved it:** Added `getMyChildren` and optional `studentId` filtering to parent server actions (`parents.ts`). Built a segmented child switcher toggle (`All Children` vs individual child) and high-density KPI cards on `/parent/dues`. Integrated 1-click Section 80C Tax Exemption Certificate PDF generation, GST SAC 9992 itemized drawer, 3-tier installment calculator modal, and inline receipt downloads (`/parent/history`).
* **Alternatives considered:** Render all children's fee assignments in a single un-collapsible list — rejected due to parent clutter, cognitive overload, and multi-child payment friction.
* **Why we chose this path:** Segmented toggling and combined family dues pay address top empirical parent pain points discovered via market research while maintaining zero database schema changes.

## 3. Database Schema Impact
* **Changes made:** none (consumed existing `ParentLink`, `GuardianOf`, `Student`, `FeeAssignment`, and `Transaction` relations).

## 4. Core Logic & Necessary Functions
* **List of functions & files:**
  * `getMyChildren` (`apps/web/src/app/actions/parents.ts`): Fetches all active linked children for a parent user.
  ```typescript
  export async function getMyChildren(parentUserId: string)
  ```
  * `getMyChildrenDues` (`apps/web/src/app/actions/parents.ts`): Gets dues filtered by parent user ID and optional single-child ID.
  ```typescript
  export async function getMyChildrenDues(parentUserId: string, studentId?: string)
  ```
  * `generate80CTaxCertificateAction` (`apps/web/src/app/actions/parents.ts`): Generates Section 80C tuition tax deduction certificate metadata.
  ```typescript
  export async function generate80CTaxCertificateAction(parentUserId: string, studentId: string, financialYear?: string)
  ```
  * `ParentDuesPage` (`apps/web/src/app/parent/dues/page.tsx`): Cockpit dashboard with child switcher, KPI cards, Sec 80C tax modal, GST SAC 9992 drawer, and family pay.
  * `ParentHistoryPage` (`apps/web/src/app/parent/history/page.tsx`): Payment history ledger with child switcher, status badges, format selector (A4 vs Thermal), and receipt downloads.
  * `ParentSidebar` (`apps/web/src/app/parent/layout.tsx`): Navigation bar with Warm Alabaster Sand & Imperial Emerald palette design system styling.

## 5. Testing & Verification
* **Automated tests:** Next.js build compilation check (`pnpm build`).
* **Manually verified:**
  * Child switcher toggle between `All Children` and individual children on `/parent/dues` and `/parent/history`.
  * Section 80C Tax Exemption Certificate generation and modal trigger.
  * GST SAC 9992 transparency drawer and 3-step Installment Plan Simulator modal.
  * Inline receipt generation (A4 / Thermal PDF) for posted transactions.

## 6. Dependencies & Deferred Work
* **Depends on:** `ParentLink`, `@smart-school/rules` fee calculation utilities, `@react-pdf/renderer`.
* **Known issues/deferred:** none.
