# LOG_TEMPLATE

## 1. Overview
* **Name:** Real Action Buttons
* **Session:** Session 6 — Polish and Demo
* **Purpose:** Replace dummy toast notifications with real functional backend logic (routing, CSV export, and actual server actions) across the admin portal buttons.
* **Traces to:** `product_requirements.md` (implicitly, replacing fake hackathon shortcuts with real schema adherence)

## 2. Technical Rationale
* **How we achieved it:** We removed the "fake it till you make it" toast logic from `QuickActionButton.tsx`. We explicitly wired `DashboardClient` buttons to `router.push` and a CSV blob download. We wired `DefaultersPage` buttons to two new server actions (`queueRemindersForStudent`, `escalateDefaulterScore`) that strictly write to `REMINDER_LOG` and `DEFAULTER_SCORE` tables.
* **Alternatives considered:** We originally added a generic fallback toast for the demo, but the user correctly rejected it as a hallucination.
* **Why we chose this path:** Preserving strict adherence to `database_design.md` and maintaining true system state, even for a demo.

## 3. Database Schema Impact
* **Changes made:** none (We utilized the existing schema for `REMINDER_LOG`, `DEFAULTER_SCORE`, and `AUDIT_LOG`).

## 4. Core Logic & Necessary Functions
* **List of functions & files:** Key functions added or modified, and their exact file paths.
  * `queueRemindersForStudent` (`apps/web/src/app/actions/defaulters.ts`): Queries overdue assignments and inserts tier 1 rows into `REMINDER_LOG`.
  ```typescript
  export async function queueRemindersForStudent(schoolId: string, studentId: string) { ... }
  ```
  * `escalateDefaulterScore` (`apps/web/src/app/actions/defaulters.ts`): Upserts `DEFAULTER_SCORE` to risk level 3 and writes an `AUDIT_LOG` entry.
  ```typescript
  export async function escalateDefaulterScore(schoolId: string, studentId: string) { ... }
  ```
  * `handleExport` (`apps/web/src/app/admin/dashboard/DashboardClient.tsx`): Generates and downloads a CSV based on the dashboard snapshot.
  ```typescript
  const handleExport = () => { ... }
  ```

## 5. Testing & Verification
* **Automated tests:** None written specifically for these UI bindings.
* **Manually verified:** Clicked Mark Paid to test routing. Clicked Export to test CSV download. Clicked Escalate to observe DB updates and React Query invalidation triggering badge color change. Clicked Send Reminder to observe toast confirming queued count.

## 6. Dependencies & Deferred Work
* **Depends on:** React Hot Toast, TanStack Query.
* **Known issues/deferred:** "Add Student" simply routes to `/admin/students?action=new` rather than a full modal. "Import CSV" on Students page routes to `/admin/settings` due to lack of a dedicated CSV upload UI component in the current tree.
