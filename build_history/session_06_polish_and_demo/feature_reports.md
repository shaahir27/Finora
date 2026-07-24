---
feature: "Reconciliation Reports & Export"
session: "Session 6"
status: "Built"
---

# Feature: Reconciliation Reports & Export

## 1. Overview
* **Name:** Reconciliation Reports & Export
* **Session:** Session 6 — Polish & Demo
* **Purpose:** Gives admins a date-ranged export of all reconciliation data (collected by channel, outstanding, class-wise) matching the live dashboard's figures exactly, with an immutable AUDIT_LOG entry per export.
* **Traces to:** api_specification.md `generateReconciliationReport`, ui_ux_specification.md ADMIN — Reports & Export.

## 2. Technical Rationale
* **How we achieved it:** `generateReconciliationReport` calls `getLedgerSnapshot` with `startDate`/`endDate` params (same aggregation the dashboard uses), writes an `AUDIT_LOG` row with `action: report_exported`, then returns a stub PDF/CSV URL. PDF/CSV generation itself is stubbed with a dummy storage URL for the demo.
* **Alternatives considered:** Separate aggregation queries for the report — rejected because it would create a second code path that could drift from the dashboard's numbers.
* **Why we chose this path:** Reusing `getLedgerSnapshot` is the only way to guarantee figure parity between a generated report and the live dashboard for the same date range (`api_specification.md`: "no new computation logic is introduced by this action").

## 3. Database Schema Impact
* **Changes made:** None. Uses existing `AUDIT_LOG` table with `action: report_exported`.

## 4. Core Logic & Necessary Functions
* **List of functions & files:**
  * `generateReconciliationReport` (`apps/web/src/app/actions/reports.ts`): Rate-limited (10/min per admin session). Passes `startDate`/`endDate` directly to `getLedgerSnapshot` so all aggregate metrics are period-scoped. Writes `AUDIT_LOG` with actor, format, date range, and row count. Returns a stub URL + count.
  ```typescript
  export async function generateReconciliationReport(
    schoolId: string, startDate: string, endDate: string, format: "csv" | "pdf"
  ): Promise<{ url: string; count: number }>
  // Note: Code snippets represent the function signature at the time this feature was built.
  ```

## 5. Testing & Verification
* **Automated tests:** None specific to this action; covered indirectly by `reconciliation.test.ts` for the underlying `getLedgerSnapshot`.
* **Manually verified:**
  * Generate report for a 7-day window → `totalCollected` matches the dashboard for the same filter. **Correction applied 2026-07-24**: original implementation fetched the snapshot without date params (school-wide totals), then filtered the transaction list in memory. Fixed to pass dates into `getLedgerSnapshot` so aggregate metrics are correctly period-scoped.
  * Every successful call creates an `AUDIT_LOG` row with `action: report_exported`.
  * Rate limiter rejects the 11th call within 60 seconds.

## 6. Dependencies & Deferred Work
* **Depends on:** `getLedgerSnapshot`, `rateLimit`, `prisma.auditLog`.
* **Known issues/deferred:** PDF/CSV file generation is stubbed — returns a dummy storage URL. A production build would use `react-pdf` or Puppeteer and upload to Supabase Storage. The `limit: 10000` cap on `getLedgerSnapshot` means schools with >10,000 transactions in the date range will get a truncated report — acceptable for demo scale.
