---
feature: "Email Reminders via Resend"
session: "Session 6"
status: "Built"
---

# Feature: Email Reminders via Resend

## 1. Overview
* **Name:** Email Reminders via Resend
* **Session:** Session 6 — Polish & Demo
* **Purpose:** Completes the `markReminderSent` action so that `email`-channel reminders dispatch a real email via Resend, while WhatsApp/SMS remain `simulated_sent` with no external calls (Governing Principle 3).
* **Traces to:** api_specification.md `markReminderSent`, business_rules.md Email Reminder Escalation, ui_ux_specification.md ADMIN — Reminders Queue.

## 2. Technical Rationale
* **How we achieved it:** Added `resend` npm dependency. In `markReminderSent`, branched on `log.channel === 'email'`. Found the parent email via the `guardianOf → parentLink → user` join. Dispatched via `resend.emails.send()`; updated `status` to `sent` on success or `failed` + `dispatchError` on Resend error.
* **Alternatives considered:** Nodemailer / SendGrid — Resend was chosen for its simpler API and Next.js-first design.
* **Why we chose this path:** Resend is minimal to wire and has a free-tier suitable for demo volume.

## 3. Database Schema Impact
* **Changes made:** `REMINDER_LOG.dispatchError` field (already in schema) is now populated on both failure cases: real Resend dispatch error, and missing-email no-op.

## 4. Core Logic & Necessary Functions
* **List of functions & files:**
  * `markReminderSent` (`apps/web/src/app/actions/reminders.ts`): Only function that changes `REMINDER_LOG.status` from `logged`. Email channel: dispatches via Resend (using `RESEND_FROM_EMAIL` or fallback `Finora <onboarding@resend.dev>`), sets `sent` on success or `failed` + `dispatchError` on error. WhatsApp/SMS: sets `simulated_sent` with no external call.
  ```typescript
  export async function markReminderSent(reminderLogId: string): Promise<void>
  // Note: Code snippets represent the function signature at the time this feature was built.
  ```

## 5. Testing & Verification
* **Automated tests:** None yet (Resend calls require mocking — deferred).
* **Manually verified:**
  * Mark email reminder sent for parent with email → status becomes `sent`.
  * Mark email reminder sent for parent with **no email** → status stays `logged`, `dispatchError` set to `no_email_on_file` (spec: "action still succeeds as a no-op dispatch"). **Correction applied 2026-07-24**: original implementation incorrectly set `status: 'failed'` for the no-email path; corrected to keep `status: 'logged'` per `api_specification.md`.
  * Invalid Resend address → status becomes `failed`, `dispatchError` populated with Resend error message.
  * WhatsApp/SMS channel → status becomes `simulated_sent`, no outbound HTTP call made.

## 6. Dependencies & Deferred Work
* **Depends on:** `resend` npm package, `RESEND_API_KEY` env var.
* **Known issues/deferred:** No automated test covering the Resend dispatch path — would require mocking the Resend SDK. The `RESEND_API_KEY` env var must be set to a real key for email dispatch to work; the code falls back to a dummy key that will always fail silently in the Resend SDK.
