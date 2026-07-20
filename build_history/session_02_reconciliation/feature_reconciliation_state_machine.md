---
feature: "Reconciliation State Machine"
session: "Session 2"
status: "Built"
---

# Feature: Reconciliation State Machine

## 1. Overview
* **Name:** Reconciliation State Machine
* **Session:** Session 2 — Reconciliation
* **Purpose:** Completes the core `TRANSACTION` reconciliation state machine. Integrates initial cheque states, cheque clearing, cheque bouncing, and anomaly detection rules.
* **Traces to:** financial_engine.md

## 2. Technical Rationale
* **How we achieved it:** Fixed `recordPayment` so that `channel: cheque` defaults to `cheque_pending`. Implemented `markChequeBounced` with a cross-engine dependency constraint: bouncing a cheque correctly triggers an immediate `computeDefaulterScore` recompute.
* **Alternatives considered:** none
* **Why we chose this path:** Bouncing is a critical default event and must trigger the score recalculation synchronously.

## 3. Database Schema Impact
* **Changes made:** none

## 4. Core Logic & Necessary Functions
* **List of functions & files:** Key functions added or modified, and their exact file paths.
  * `markChequeBounced` (`apps/web/src/app/actions/ledger.ts`): Bounces a cheque, reverses the transaction, writes an AUDIT_LOG, and triggers computeDefaulterScore for the affected student.
  ```typescript
  export async function markChequeBounced(
    adminId: string, transactionId: string, reason: string
  ): Promise<Transaction>
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```

## 5. Testing & Verification
* **Automated tests:** none (Tests pending for Session 2 Checkpoint)
* **Manually verified:** Verified that bouncing a cheque properly transitions the state to terminal `reversed` and recalculates the defaulter score.

## 6. Dependencies & Deferred Work
* **Depends on:** `computeDefaulterScore` from `packages/rules`.
* **Known issues/deferred:** Present the anomaly and state transition controls in the Admin UI (deferred to Session 3).
