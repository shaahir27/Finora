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
  * `handleRazorpayWebhook` (`apps/web/src/app/actions/payments.ts`): Server Action wrapper — verifies HMAC-SHA256 and calls `recordPayment`. Used internally by the API route below.
  ```typescript
  export async function handleRazorpayWebhook(
    rawBody: string, signature: string, adminId: string, schoolId: string, feeAssignmentId: string
  ): Promise<{ success: boolean; isDuplicate?: boolean }>
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```
  * `POST /api/webhooks/razorpay` (`apps/web/src/app/api/webhooks/razorpay/route.ts`): **Added 2026-07-24 (audit session).** The actual HTTP entry point for Razorpay's async callbacks. Reads raw body before JSON.parse (required for signature verification), calls `verifyRazorpayWebhookSignature`, extracts `fee_assignment_id` from order notes, and calls `recordPayment`. Returns 400 on signature failure, 200 (no-op) for non-captured events, 500 on DB failure so Razorpay retries. This route was always required by the spec but was missing from the codebase until the audit pass.

## 5. Testing & Verification
* **Automated tests:**
  * `apps/web/src/__tests__/reconciliation.test.ts` — tests UPI webhook idempotency: fires the same `ref_number` twice and asserts exactly one `TRANSACTION` row exists (second call returns the existing record without a new insert). Also tests that `channel: cheque` initialises to `cheque_pending` status, not `posted`.
* **Manually verified:** `handleRazorpayWebhook` securely verifies HMAC signatures and correctly handles idempotency via `ref_number`.

## 6. Dependencies & Deferred Work
* **Depends on:** `verifyRazorpayWebhookSignature` from `@smart-school/payments`. Requires `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` env vars.
* **Known issues/deferred:** None outstanding. The missing webhook API route (originally deferred) was added in the audit pass on 2026-07-24. The `feeAssignmentId` is sourced from Razorpay order `notes.fee_assignment_id`, set at order creation — if notes are absent (e.g. order created outside this system), the webhook handler returns 200 with an error log rather than 500, to avoid Razorpay retrying a fundamentally unresolvable request.
