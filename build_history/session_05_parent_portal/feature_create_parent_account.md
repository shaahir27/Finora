# Feature: Create Parent Account (Admin Provisioning)

## 1. Overview
* **Name:** Create Parent Account
* **Session:** Session 5 — Parent Portal
* **Purpose:** Allow school admins to provision parent accounts and link them to students. Creates a USER row (role=parent), a PARENT_LINK row, and one or more GUARDIAN_OF rows — all in a single atomic transaction.
* **Traces to:** `docs/api_specification.md` — createParentAccount contract; `docs/database_design.md` Phase 11 USER schema additions.

## 2. Technical Rationale
* **How we achieved it:** Single `prisma.$transaction` wrapping USER + PARENT_LINK + GUARDIAN_OF creation. Phone is validated against E.164 regex before any DB call. Duplicate phone detected with a `findFirst` pre-check, returning `ALREADY_REGISTERED` error for the UI to surface.
* **Alternatives considered:** Could have used Supabase `admin.createUser` to create the auth row simultaneously, but that would couple the provisioning step to Supabase's auth admin API key, adding a surface to leak. Instead, admin creates the DB user; Supabase auth row is auto-created when the parent first OTPs in.
* **Why we chose this path:** Keeps provisioning purely DB-side, decoupled from auth provider — matches the pattern established for admin users.

## 3. Database Schema Impact
* **Changes made:** None — relies on existing USER, PARENT_LINK, and GUARDIAN_OF tables from `database_design.md`. USER.phone field (Phase 11) was already in the schema; no new migration needed.

## 4. Core Logic & Necessary Functions
* **List of functions & files:**
  * `createParentAccount` (`apps/web/src/app/actions/parents.ts`): Admin creates parent + links students atomically.
  * `addStudentToParent` (`apps/web/src/app/actions/parents.ts`): Adds an additional student to an existing parent.
  * `removeStudentFromParent` (`apps/web/src/app/actions/parents.ts`): Unlinks a student from a parent.
  ```typescript
  export async function createParentAccount(
    schoolId: string,
    data: { name: string; phone: string; email?: string; studentIds: string[] }
  )
  ```

## 5. Testing & Verification
* **Automated tests:** `apps/web/tests/session5.test.ts` — Tests 1–3 (studentIds guard, E.164 validation, ALREADY_REGISTERED duplicate detection).
* **Manually verified:** Admin "Add Parent" page at `/admin/parents` renders correctly with student multi-select.

## 6. Dependencies & Deferred Work
* **Depends on:** `@smart-school/db` Prisma client; existing STUDENT rows must exist before provisioning.
* **Known issues/deferred:** The admin "Add Parent" page currently shows all students in a school — future improvement would add class/section filtering to the dropdown. `name` field is not stored on USER (database_design.md USER has no name column) — the admin form collects it for display only, not persisted. Future schema extension may add this.
