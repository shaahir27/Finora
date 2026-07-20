---
feature: "Defaulter Scoring & Tracking"
session: "Session 3"
status: "Built"
---

# Feature: Defaulter Scoring & Tracking

## 1. Overview
* **Name:** Defaulter Scoring & Tracking
* **Session:** Session 3 — Dashboard / Defaulter Scoring, PWA + Admin Push
* **Purpose:** Implement dynamic risk scoring for active students with unpaid balances, and display them in a ranked Defaulter Tracking dashboard.
* **Traces to:** `business_rules.md` (Defaulter Score section) and `product_requirements.md` (M-8).

## 2. Technical Rationale
* **How we achieved it:** Implemented `computeDefaulterScore` as a pure function per business rules (factoring days overdue, broken promises, and remaining balance ratio). Built the `getDefaulters` server action to fetch all active students, apply this formula to their fee assignments, and return a sorted list of defaulters. Developed the frontend screen (`/admin/defaulters`) using `RiskBadge` and `StatusBadge` components.
* **Alternatives considered:** Materializing the risk score directly on the `STUDENT` row on every payment.
* **Why we chose this path:** Risk is fluid (days overdue changes daily without writes). Computing it dynamically in `getDefaulters` ensures freshness. For historical snapshots, it is snapshotted via AI workflows when explicitly generated.

## 3. Database Schema Impact
* **Changes made:** none

## 4. Core Logic & Necessary Functions
* **List of functions & files:** Key functions added or modified, and their exact file paths.
  * `computeDefaulterScore` (`packages/rules/src/defaulterScore.ts`): Pure function that computes the exact numeric score and risk level (high, medium, low).
  ```typescript
  // export function computeDefaulterScore(daysOverdue: number, brokenPromiseCount: number, totalAmount: number | string, totalAmountPaid: number | string, totalWaivedAmount: number | string): { riskLevel: RiskLevel; riskScore: number; reason: string }
  ```
  * `getDefaulters` (`apps/web/src/app/actions/defaulters.ts`): Queries active students and maps them to their highest overdue assignment score.
  ```typescript
  // export async function getDefaulters(schoolId: string)
  ```
  * `DefaulterTrackingPage` (`apps/web/src/app/admin/defaulters/page.tsx`): The UI displaying the ranked list.

## 5. Testing & Verification
* **Automated tests:** `apps/web/tests/session3.test.ts` — verified that `computeDefaulterScore` ranks partially-paid students strictly lower than identically-overdue students who have paid nothing. Also verified that `getDefaulters` accurately excludes `withdrawn` status students.
* **Manually verified:** UI renders the risk badges dynamically based on the score threshold.

## 6. Dependencies & Deferred Work
* **Depends on:** Fee Engine, Ledger Engine
* **Known issues/deferred:** Broken promises metric currently always receives 0 until the Reminder Notification system is fully wired.
