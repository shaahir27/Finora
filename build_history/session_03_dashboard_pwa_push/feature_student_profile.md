# LOG_TEMPLATE
Use this exact structure for every feature log in `build_history/`. Copy it, replace every `{{PLACEHOLDER}}`, delete nothing else.

## 1. Overview
* **Name:** Student Profile & Lifecycle Management
* **Session:** Session 3 — Dashboard / Defaulter Scoring, PWA + Admin Push
* **Purpose:** Provide a centralized view for an individual student, aggregating fee assignments and transaction histories, and allowing status lifecycle management (e.g., active -> withdrawn + write-off).
* **Traces to:** `product_requirements.md` (M-6) and `business_rules.md` (Status Lifecycle).

## 2. Technical Rationale
* **How we achieved it:** Implemented `getStudentProfile` to aggregate all relevant student records. Added status toggles in the UI that dispatch `updateStudentStatus` with `balanceDisposition` arguments (carry_forward vs write_off) when transitioning an active student to `withdrawn`.
* **Alternatives considered:** Handling write-offs silently without generating a `WAIVER` row.
* **Why we chose this path:** Generating a `WAIVER` row guarantees double-entry parity for accounting. A write-off is just an administrative waiver per the governing principles.

## 3. Database Schema Impact
* **Changes made:** none

## 4. Core Logic & Necessary Functions
* **List of functions & files:** Key functions added or modified, and their exact file paths.
  * `getStudentProfile` (`apps/web/src/app/actions/students.ts`): Aggregates the student, their fee assignments, transactions, waivers, and penalties for the profile view.
  ```typescript
  // export async function getStudentProfile(schoolId: string, studentId: string)
  ```
  * `updateStudentStatus` (`apps/web/src/app/actions/students.ts`): Safely updates the student status and executes balance disposition if withdrawing.
  ```typescript
  // export async function updateStudentStatus(adminId: string, schoolId: string, studentId: string, status: StudentStatus, balanceDisposition?: "carry_forward" | "write_off")
  ```
  * `StudentProfilePage` (`apps/web/src/app/admin/students/[id]/page.tsx`): Profile UI rendering all records.

## 5. Testing & Verification
* **Automated tests:** `apps/web/tests/session3.test.ts` — verified school-scoping on `getStudentProfile` so an admin cannot fetch a student from a different school.
* **Manually verified:** UI renders all fee assignments and aggregates correctly.

## 6. Dependencies & Deferred Work
* **Depends on:** Ledger engine (transaction generation).
* **Known issues/deferred:** none
