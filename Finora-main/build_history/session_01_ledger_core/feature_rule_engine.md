---
feature: "Rule Engine"
session: "Session 1"
status: "Built"
---

# Feature: Rule Engine

## 1. Overview
* **Name:** Rule Engine
* **Session:** Session 1 — Ledger Core
* **Purpose:** Provide pure, isolated business logic for defaulter scoring, anomaly detection, and reminder triggering without DB dependencies.
* **Traces to:** business_rules.md

## 2. Technical Rationale
* **How we achieved it:** Built `packages/rules` as an independent package with zero external calls. All configuration weights and thresholds are centralized in `config.ts`.
* **Alternatives considered:** Embedding logic directly into `apps/web` actions.
* **Why we chose this path:** Centralizes financial calculations so they can be securely reused by the UI, API routes, and eventual AI copilot without duplicating side effects.

## 3. Database Schema Impact
* **Changes made:** none (Purely functional package, no DB access).

## 4. Core Logic & Necessary Functions
* **List of functions & files:** Key functions added or modified, and their exact file paths.
  * `computeDefaulterScore` (`packages/rules/src/defaulterScore.ts`): Calculates a student's risk profile based on overdue days and active anomalies.
  ```typescript
  export function computeDefaulterScore(daysOverdue: number, hasAnomalies: boolean, balance: number): number
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```
  * `detectAnomaly` (`packages/rules/src/anomaly.ts`): Flags payments that do not match the expected remaining balance exactly.
  ```typescript
  export function detectAnomaly(
    amount: number | string, amountPaidBeforeThisTransaction: number,
    waivedAmount: number, receivedAmount: number | string
  ): { isAnomalous: boolean; reason?: string; expectedAmount: number }
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```
  * `evaluateReminderTrigger` (`packages/rules/src/reminderTrigger.ts`): Determines if a student crosses a new escalation tier boundary.
  ```typescript
  export function evaluateReminderTrigger(daysOverdue: number, currentTier: ReminderTier): boolean
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```
  * `calculateAmountPaid` (`packages/rules/src/feeComputation.ts`): Safely sums up only 'posted' transactions.
  ```typescript
  export function calculateAmountPaid(transactions: Pick<Transaction, "amount" | "reconciliationStatus">[]): number
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```
  * `calculateRemainingBalance` (`packages/rules/src/feeComputation.ts`): Computes absolute remaining balance and prevents negative balances.
  ```typescript
  export function calculateRemainingBalance(amount: number | string, amountPaid: number, waivedAmount: number): number
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```
  * `detectDuplicateRef` (`packages/rules/src/duplicateRef.ts`): Evaluates whether an external channel reference number was already used.
  ```typescript
  export function detectDuplicateRef(input: DuplicateRefInput): { isDuplicate: boolean; reason?: string }
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```

## 5. Testing & Verification
* **Automated tests:** none (Tests pending for Session 1 Checkpoint)
* **Manually verified:** Evaluated edge cases in anomaly detection (e.g., partial payments).

## 6. Dependencies & Deferred Work
* **Depends on:** none (Zero dependencies by design)
* **Known issues/deferred:** none
