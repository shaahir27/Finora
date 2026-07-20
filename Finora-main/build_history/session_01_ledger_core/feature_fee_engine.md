---
feature: "Fee Engine"
session: "Session 1"
status: "Built"
---

# Feature: Fee Engine

## 1. Overview
* **Name:** Fee Engine
* **Session:** Session 1 — Ledger Core
* **Purpose:** Allows administrators to securely define and assign fees to students, enforcing GST compliance natively.
* **Traces to:** product_requirements.md M-1

## 2. Technical Rationale
* **How we achieved it:** Built `apps/web/src/app/actions/fees.ts`. Ensures taxable fee types mandate a GST rate > 0. Bulk assignment works via an array of student IDs and never aborts the whole batch if one fails.
* **Alternatives considered:** none
* **Why we chose this path:** Resilient batch operations are critical for school admins who assign fees to thousands of students at once.

## 3. Database Schema Impact
* **Changes made:** none (Schema was pre-scaffolded in `feature_project_scaffolding.md`)

## 4. Core Logic & Necessary Functions
* **List of functions & files:** Key functions added or modified, and their exact file paths.
  * `createFeeType` (`apps/web/src/app/actions/fees.ts`): Creates a new FeeType for a school, ensuring GST constraints are enforced natively.
  ```typescript
  export async function createFeeType(
    schoolId: string,
    data: { name: string; category: string; isActive?: boolean; gstTreatment: GstTreatment; gstRate?: number; }
  ): Promise<FeeType>
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```
  * `updateFeeSchema` (`apps/web/src/app/actions/fees.ts`): Updates an existing FeeType while maintaining assignment integrity.
  ```typescript
  export async function updateFeeSchema(
    feeTypeId: string,
    changes: { name?: string; category?: string; isActive?: boolean; gstTreatment?: GstTreatment; gstRate?: number | null; }
  ): Promise<FeeType>
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```
  * `assignFee` (`apps/web/src/app/actions/fees.ts`): Assigns a fee to one or more students, supporting bulk assignments securely.
  ```typescript
  export async function assignFee(
    schoolId: string,
    studentIds: string | string[],
    feeTypeId: string,
    data: { amount: number; dueDate: Date }
  )
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```

## 5. Testing & Verification
* **Automated tests:** none (Tests pending for Session 1 Checkpoint)
* **Manually verified:** Bulk assignment resilience, GST rate enforcement on taxable fees.

## 6. Dependencies & Deferred Work
* **Depends on:** `Student` rows existing.
* **Known issues/deferred:** none
