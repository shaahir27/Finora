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
* **How we achieved it:** `generateReconciliationReport` calls `getLedgerSnapshot` with `startDate`/`endDate` params, writes an `AUDIT_LOG` row with `action: report_exported`, then generates a real CSV string or PDF document using `@react-pdf/renderer` (`ReconciliationReportPdf.tsx`). It uploads the file to the Supabase Storage `reports` bucket (with a base64 data URL fallback if storage is offline) and returns the public download URL.
* **Alternatives considered:** Client-side CSV string generation only.
* **Why we chose this path:** Server-side PDF and CSV generation with Supabase Storage upload ensures immutable, downloadable reports while retaining complete data parity with live dashboard figures.

## 3. Database Schema Impact
* **Changes made:** None. Uses existing `AUDIT_LOG` table with `action: report_exported`.

## 4. Core Logic & Necessary Functions
* **List of functions & files:**
  * `generateReconciliationReport` (`apps/web/src/app/actions/reports.ts`): Protected by `requireAdminForSchool` and rate-limited. Passes `startDate`/`endDate` to `getLedgerSnapshot` so metrics are period-scoped. Renders `ReconciliationReportPdf.tsx` for PDF or generates CSV string, uploads to Supabase Storage `reports` bucket, writes `AUDIT_LOG`, and returns download URL + transaction count.
  ```typescript
  export async function generateReconciliationReport(
    schoolId: string, startDate: string, endDate: string, format: "csv" | "pdf"
  ): Promise<{ url: string; count: number }>
  ```

## 5. Testing & Verification
* **Automated tests:** Covered by ledger unit tests and bucket verification scripts (`create-bucket.js`).
* **Manually verified:**
  * Report generation creates real downloadable CSV and PDF files.
  * Every successful call creates an `AUDIT_LOG` row with `action: report_exported`.
  * Session guard (`requireAdminForSchool`) and rate limiter enforce strict authorization.

## 6. Dependencies & Deferred Work
* **Depends on:** `getLedgerSnapshot`, `requireAdminForSchool`, `@react-pdf/renderer`, Supabase Storage (`reports` bucket).
* **Updates applied in Audit Pass**: Replaced stub URL response with real PDF and CSV generation, Supabase Storage bucket upload, and base64 data URL fallback.
