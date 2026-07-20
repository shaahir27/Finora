---
feature: "Student Directory"
session: "Session 1"
status: "Built"
---

# Feature: Student Directory

## 1. Overview
* **Name:** Student Directory
* **Session:** Session 1 — Ledger Core
* **Purpose:** Provide server actions to manage student lifecycles (`createStudent`, `bulkImportStudents`, `updateStudent`, `updateStudentStatus`, `getStudentProfile`).
* **Traces to:** product_requirements.md M-1

## 2. Technical Rationale
* **How we achieved it:** Built `apps/web/src/app/actions/students.ts`. Implemented Phase 14 deduping for `bulkImportStudents` using `admissionNumber`. Implemented Phase 15 `status` updates with the critical `balanceDisposition` guard to either apply a write-off waiver or carry forward the balance.
* **Alternatives considered:** None
* **Why we chose this path:** Using server actions ensures all logic stays safely on the server and easily integrates with Next.js forms.

## 3. Database Schema Impact
* **Changes made:** none (Schema was pre-scaffolded in `feature_project_scaffolding.md`)

## 4. Core Logic & Necessary Functions
* **List of functions & files:** Key functions added or modified, and their exact file paths.
  * `createStudent` (`apps/web/src/app/actions/students.ts`): Creates a new student while enforcing admission number uniqueness per school.
  ```typescript
  export async function createStudent(
    schoolId: string,
    data: { name: string; class: string; admissionNumber?: string }
  ): Promise<Student>
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```
  * `bulkImportStudents` (`apps/web/src/app/actions/students.ts`): Bulk imports students from an array. It safely skips existing admission numbers without aborting the batch.
  ```typescript
  export async function bulkImportStudents(
    schoolId: string,
    studentsData: Array<{ name: string; class: string; admissionNumber?: string }>
  )
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```
  * `updateStudent` (`apps/web/src/app/actions/students.ts`): Updates a student's basic details.
  ```typescript
  export async function updateStudent(
    studentId: string,
    data: { name?: string; class?: string; admissionNumber?: string | null }
  ): Promise<Student>
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```
  * `updateStudentStatus` (`apps/web/src/app/actions/students.ts`): Updates student lifecycle status (Phase 15). Rejects outright if status is non-active, balance > 0, and balanceDisposition is missing.
  ```typescript
  export async function updateStudentStatus(
    studentId: string, adminId: string,
    data: { status: StudentStatus; balanceDisposition?: BalanceDisposition }
  ): Promise<Student>
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```
  * `getStudentProfile` (`apps/web/src/app/actions/students.ts`): Fetches a single student with their active fee assignments, transactions, and waivers.
  ```typescript
  export async function getStudentProfile(studentId: string, schoolId: string)
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```

## 5. Testing & Verification
* **Automated tests:** `apps/web/src/__tests__/studentDirectory.test.ts`
* **Manually verified:** Evaluated edge cases in anomaly detection.

## 6. Dependencies & Deferred Work
* **Depends on:** Core Ledger DB schema.
* **Known issues/deferred:** none

---
## [Session 3 Update] UI and Actions
* **What changed:** Built the frontend view for the directory (`/admin/students/page.tsx`) utilizing `GlassCard` design tokens. Created `getStudents` server action (`apps/web/src/app/actions/students.ts`) to fetch students with basic active fee and balance aggregations.
* **Why:** To satisfy the M-4 Student Directory UI requirements in Session 3.
