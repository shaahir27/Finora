---
feature: "Razorpay Sandbox Integration"
session: "Session 2"
status: "Built"
---

# Feature: Razorpay Sandbox Integration

## 1. Overview
* **Name:** Razorpay Sandbox Integration
* **Session:** Session 2 — Reconciliation
* **Purpose:** Enables creating sandbox UPI orders and handling webhooks to process payments. Includes idempotency handling and manual reconciliation for missed webhooks.
* **Traces to:** product_requirements.md

## 2. Technical Rationale
* **How we achieved it:** Used a lightweight custom REST fetcher for Razorpay instead of the full SDK to keep the sandbox mode simple, predictable, and fully edge-compatible.
* **Alternatives considered:** Using the official Razorpay SDK.
* **Why we chose this path:** Edge-compatibility and simplicity for sandbox mode.

## 3. Database Schema Impact
* **Changes made:** none

## 4. Core Logic & Necessary Functions
* **List of functions & files:** Key functions added or modified, and their exact file paths.
  * `initiateUpiSandboxPayment` (`apps/web/src/app/actions/payments.ts`): Creates a Razorpay sandbox order for a fee assignment's UPI payment.
  ```typescript
  export async function initiateUpiSandboxPayment(
    feeAssignmentId: string, amountRupees: number
  ): Promise<RazorpayOrder>
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```
  * `handleRazorpayWebhook` (`apps/web/src/app/actions/payments.ts`): Processes an incoming Razorpay webhook. Verifies HMAC-SHA256 signature and calls recordPayment.
  ```typescript
  export async function handleRazorpayWebhook(
    rawBody: string, signature: string, adminId: string, schoolId: string, feeAssignmentId: string
  ): Promise<{ success: boolean; isDuplicate?: boolean }>
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```

## 5. Testing & Verification
* **Automated tests:** none (Tests pending for Session 2 Checkpoint)
* **Manually verified:** `handleRazorpayWebhook` securely verifies HMAC signatures and correctly handles idempotency via `ref_number`.

## 6. Dependencies & Deferred Work
* **Depends on:** `verifyRazorpayWebhookSignature` from `@smart-school/payments`.
* **Known issues/deferred:** Wire UI components to consume these server actions (deferred to Session 3).
