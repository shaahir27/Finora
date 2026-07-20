# User Flows — Smart School FinTech Platform

## Purpose

Step-by-step system-level workflows, tying together the engines, API contracts, and security policy specified elsewhere into concrete sequences. An AI coding agent should use this document to understand *ordering and cross-module dependency* — which action calls which, in what sequence, and what must happen synchronously versus asynchronously.

## Scope

Six core workflows (A–F) covering reconciliation, waivers, defaulter scoring, reminders, OCR, and the parent payment journey. Screen-level UI detail is in `ui_ux_specification.md`; the underlying business rules are in `business_rules.md` and `financial_engine.md`.

---

## Workflow A — Live Omnichannel Reconciliation

The system's central claim (§13.1 of the research) — must work exactly as specified, since this is the primary differentiator.

1. Admin or parent triggers a payment via one of three channels.
2. **UPI**: Razorpay sandbox webhook fires → `handleRazorpayWebhook` verifies signature → checks `ref_number` for idempotency → calls `recordPayment`.
   **Cash/cheque**: admin manually calls `recordPayment` at point of entry.
3. `recordPayment` writes `TRANSACTION` (`posted` for UPI/cash, `cheque_pending` for cheque), updates `FEE_ASSIGNMENT.amount_paid`/`payment_status` in the same DB transaction.
4. `detectAnomaly` runs synchronously, before the write completes its response — this is a blocking step by design.
5. Supabase Realtime pushes the change; the dashboard's `getLedgerSnapshot` subscriber re-renders with no polling and no manual refresh — this is the literal "zero manual step" requirement.
6. **Asynchronously, after step 5**: if a flag was created in step 4, `narrateAnomaly` runs and populates the admin-facing explanation. This step must never block steps 1–5.

## Workflow B — Waiver With Audit Trail

1. Admin selects a transaction (or a fee assignment ahead of any transaction), calls `applyWaiver` with `reason`, `amount`, and their own session-derived identity as `approvedBy`.
2. `WAIVER` row is written — `reason` and `approvedBy` are non-nullable at the schema level, so this cannot be bypassed by a malformed request.
3. `AUDIT_LOG` entry is generated automatically (recommend via database trigger, not solely application code) with before/after state.
4. `computeDefaulterScore` is triggered immediately for the affected student — this is not deferred to the next scheduled job, since a waiver can materially change a student's risk profile in the same moment it's applied.

## Workflow C — Defaulter Risk Segmentation

1. Scheduled job (daily) runs `computeDefaulterScore` for every student with an overdue `FEE_ASSIGNMENT` **and `status = 'active'` (added Phase 15)** — a withdrawn/graduated/transferred student is skipped by this job entirely, regardless of any remaining balance, so the active view doesn't slowly accumulate stale entries for students no longer enrolled over the course of a school year.
2. Writes/updates `DEFAULTER_SCORE` rows.
3. Admin dashboard's defaulter view reads `DEFAULTER_SCORE` joined to `STUDENT`, sorted/grouped by `risk_level` — not merely by days-overdue, satisfying the "beyond a sorted table" requirement.
4. `narrateDefaulterInsight` is called **lazily**, only when an admin opens a specific student's card — not precomputed for every student on every job run, to keep Gemini calls proportional to actual admin attention rather than to total student count.
5. Off-cycle recompute triggers (do not wait for the next daily job): `applyWaiver` (Workflow B, step 4) and `markChequeBounced` (Workflow A's cheque variant, see below), **and `updateStudentStatus` (added Phase 15, see Workflow M) — a status change away from `active` removes the student from this view on the very next read, not just the next scheduled run.**

## Workflow D — Reminder Drafting (Logged, Never Sent to WhatsApp/SMS; Email Is a Narrow, Real Exception — Phase 15)

1. `evaluateReminderTrigger` runs as part of the same daily job as Workflow C, per student/assignment **with `status = 'active'` (added Phase 15) — same exclusion as Workflow C, since a reminder about a student no longer enrolled serves no one.**
2. Where the tier logic (see `business_rules.md` §6) indicates a new tier has been crossed, `draftReminderText` calls Gemini and writes to `REMINDER_LOG` with `status: logged`, on whichever channel(s) the tier/parent-contact-info combination calls for.
3. Admin dashboard shows a "reminders ready to send" queue. Clicking "mark sent" (`markReminderSent`) behaves per-channel: for `whatsapp`/`sms` it flips `status: simulated_sent` and records a timestamp — **no WhatsApp/SMS API is ever called, under any configuration; this remains a hard constraint, not a temporary MVP limitation.** **For `email` (added Phase 15)**, the same click also dispatches one real, non-blocking email via Resend using the already-reviewed `drafted_text`, resolving to `sent` or `failed`. The human-in-the-loop guarantee (nothing is sent without this explicit action) is identical across every channel.
4. If a payment clears the underlying due *after* a reminder is drafted but *before* it's marked sent, the queue view must visually flag that row (e.g. "dues cleared since drafted") so the admin doesn't send a stale reminder — applies identically regardless of channel.
5. **Why email exists at all (added Phase 15)**: Web Push (Workflow G) only reaches a parent who has already installed the PWA and opted in — exactly the least likely profile among parents already behind on fees. Email requires neither, and carries none of the WhatsApp Business API/DLT registration overhead that keeps WhatsApp/SMS simulated-only. See `business_rules.md` Email Reminder Escalation for the full reasoning.

## Workflow E — OCR Confirm-Gate

1. Admin uploads a photo of a cheque/receipt.
2. `processOcrUpload` sends the image to Gemini, receives extracted fields, writes to `OCR_STAGING` with `confirmed: false`. **Nothing is posted to `TRANSACTION` at this step.**
3. UI presents the extracted fields as an editable form — never auto-filled into a live transaction, never auto-submitted.
4. Admin reviews/corrects the fields, then calls `confirmOcrEntry`. This is the **only** function permitted to call `recordPayment` on behalf of an OCR-originated entry; it also sets `OCR_STAGING.confirmed = true` and links `confirmed_transaction_id`.
5. From this point, the transaction proceeds through Workflow A exactly as any other cash/cheque entry would — OCR is purely an intake assist, not a parallel posting path.

## Workflow F — Parent Views and Pays (Journey D)

The demo/production moment that proves Workflow A's reconciliation claim from the parent side, not just the admin side.

1. Parent logs in via OTP — phone SMS primary, email fallback (redesigned Phase 11, was magic link; see Workflow J for the full login sequence) → session carries `role: parent`.
2. If the parent has more than one `PARENT_LINK`, the UI presents a child selector; if exactly one, no selector renders at all.
3. UI calls `getMyChildrenDues` → RLS restricts the underlying query to the parent's own `PARENT_LINK` rows **before** the application layer ever sees the data — a malicious or buggy client cannot widen this by manipulating the request.
4. Parent selects a due, optionally edits the amount down for a partial payment (must remain `> 0` and `≤` remaining balance), calls `payDueViaUpi`.
5. Same Razorpay sandbox order flow as an admin-initiated UPI payment — no separate payment code path.
6. Webhook fires → `handleRazorpayWebhook` → `recordPayment` — **this is the identical code path as Workflow A**, channel locked to `upi`.
7. Supabase Realtime pushes to *both* the parent's payment-history view and the admin's live ledger simultaneously — this simultaneity is the actual demo/proof moment: same transaction, two screens, same instant.
8. Parent downloads a receipt via `getMyPaymentHistory` → same `RECEIPT` row and `pdf_url` that the admin-side receipt generation already produced — no separate parent-side PDF generation logic exists.
9. If the payment was partial, the UI must reflect the updated remaining balance immediately, and — per the no-extension rule — make clear that the original `due_date` still governs the remainder.

---

## Workflow G — Push Notification Dispatch *(added Phase 9)*

Cross-cutting, not a standalone user journey — this workflow fires as a side effect of steps already happening inside Workflows A and F, not as something a user initiates directly.

1. A trigger event occurs: `recordPayment` posts (Workflow A step, or Workflow F step 6), `markChequeBounced` runs (Workflow A cheque variant), or `ANOMALY_FLAG` is created (`detectAnomaly`, inside Workflow A).
2. The triggering write completes and returns first — per `business_rules.md` Push Notification Strategy's non-blocking rule, this is not optional ordering, it's the same discipline already applied to AI narration in Workflow A/C.
3. The Server Action orchestration layer (not the rule/payment engine itself — see `system_architecture.md` AI Copilot Architecture note on why) looks up `PUSH_SUBSCRIPTION` rows for the relevant user(s) and calls `sendPushNotification`.
4. Best-effort per subscription: a failed endpoint is deleted (404/410) or simply logged (other failures), never retried in a way that could delay or affect the underlying data the notification is reporting on.
5. For a payment involving a linked student, both the admin (operational alert) and the parent (confirmation) may receive a notification from the same single underlying event — these are two separate `PUSH_SUBSCRIPTION` lookups against the same trigger, not two different trigger paths.

## Workflow H — AI Copilot Query *(added Phase 9)*

1. User (admin or parent) opens the Copilot tab; for admin, `generateWeeklyDigest` auto-loads as the first message (Session 4 scope) — for parent, the tab opens empty with suggestion chips only (no parent-side digest exists).
2. User sends a message (or taps a suggestion chip) → `copilotQuery(role, message, conversationHistory)`.
3. Gemini, constrained to the role-specific whitelist (`system_architecture.md` AI Copilot Architecture), selects zero or more whitelisted actions to call and generates a response grounded in their results.
4. Every whitelisted action re-runs its own normal RLS-scoped query — **this is not a special Copilot code path**, it's the identical function the rest of the app already calls, which is precisely why a parent's Copilot session structurally cannot surface another family's data (see `security.md` AI Copilot section) — there is no separate authorization check to get right or wrong here, because there's no separate access path in the first place.
5. If the response includes a proposed action, the UI renders a deep-link button; the user must navigate and act manually — the Copilot's role ends at step 4, it never proceeds to perform the action itself.
6. Conversation state persists only in client-side React state for the session — closing the tab or reloading the page discards it, per the deliberate no-persistent-history scope decision.

---

## Workflow I — Offline Payment Entry & Sync *(added Phase 10)*

1. Admin, offline (no connectivity), opens the cash/cheque entry form on the Ledger screen — same form as the online case, no separate "offline mode" UI to learn.
2. Submits an entry → written to local IndexedDB with a client-generated `local_id`, state `queued`. UI confirms with a visually distinct "queued, not yet posted" state — never the same success indicator as a normal post (Workflow A).
3. Connectivity returns. Background Sync (where supported) or the admin's manual "Sync Now" action triggers `syncOfflinePayment` for each queued entry, oldest first.
4. `syncOfflinePayment` calls `recordPayment` — the identical function Workflow A already uses. Two outcomes:
   - **Success**: transaction posts normally, re-enters Workflow A's anomaly-detection and push-notification steps exactly as any other payment would. Local queue entry is removed.
   - **Conflict**: the balance changed while offline in a way that makes the entry invalid as queued. `reportSyncConflict` writes a school-visible `OFFLINE_SYNC_CONFLICT` row and triggers an admin push notification (Workflow G). The entry is **not** retried automatically and **not** silently dropped from view — it moves to the Sync Conflict section of the Offline Sync Queue screen.
5. Any admin at the school (not necessarily the one who queued the entry) can review a conflict: discard it, or re-enter a corrected amount through the normal entry form (re-entering Workflow A), then mark the conflict resolved with a required reason — same audit-trail-native discipline as a waiver or penalty.
6. At no point between steps 2 and 4's successful resolution does the entry appear in any dashboard aggregate (`getLedgerSnapshot` totals, defaulter balance calculations, etc.) — it isn't a `TRANSACTION` row yet, so it's excluded by construction, not by a special-case filter that could be forgotten.

---

## Workflow J — Parent Account Creation & Login *(added Phase 11 — replaces the magic-link version of this flow referenced in earlier phases)*

1. Admin opens Add Parent (from a student's Student Profile screen — added Phase 14, see Workflow K — or the standalone Parents section) and submits name, phone (required), email (optional), and at least one linked student → `createParentAccount`.
2. `createParentAccount` creates the `USER` row and every requested `PARENT_LINK` row in one transaction — no intermediate state where the account exists but has no linked student, and no intermediate state where a student is linked but the underlying `USER` row doesn't exist yet.
3. No notification fires at this point. The parent's first login attempt, whenever it happens, is what triggers their first OTP — account creation is a pure data-provisioning step with no external side effect.
4. Parent opens the login screen, enters their phone number (default) and requests an OTP — client calls `signInWithOtp({ phone, options: { shouldCreateUser: false } })`.
5. Two outcomes:
   - **Registered number**: Supabase sends the OTP (real Twilio delivery, or a skip-SMS Test OTP match for demo-configured numbers — see `system_architecture.md` Parent Authentication). Parent enters the code, `verifyOtp` succeeds, session created with `role: parent`.
   - **Unregistered number**: `shouldCreateUser: false` causes the call to fail rather than silently provisioning a new account. UI shows the "not registered — contact your school" message from `ui_ux_specification.md` PARENT — Login, never a signup prompt.
6. If the parent instead selects "log in with email," steps 4–5 repeat identically over the email channel — same `shouldCreateUser: false` requirement, same registered/unregistered branching, same session outcome on success.
7. Once authenticated, the parent's session behaves identically regardless of which channel (phone or email) or which specific number/address was used to log in — RLS scoping (`security.md`) is keyed to the `USER`/`PARENT_LINK` relationship, not to the login channel, so Workflow F proceeds exactly the same way from here regardless of how the parent got in.

---

## Workflow K — Student Onboarding & Profile Lookup *(added Phase 14 — see `decision_log.md` Phase 14)*

1. Admin opens Student Directory and either fills the single-student form (name, class, admission number optional) → `createStudent`, or uploads a CSV → `bulkImportStudents`.
2. For the bulk path: each row is validated and processed independently — a row whose `admission_number` already exists for the school is matched and skipped (not duplicated), a row missing a required field is reported as failed with its specific reason, and every other valid row still creates a `STUDENT`. The admin sees a per-row result, not a single pass/fail message.
3. Newly created students are immediately eligible for Workflow A (fee assignment, payment) — no separate activation step.
4. Admin clicks into a student (from the Directory, a Ledger row, or a Defaulter card) → `getStudentProfile` assembles fee assignments, transaction history, waivers/penalties, reminders, and risk-score history from tables Workflows A–D already populate. This is a read-only aggregation; it triggers no write and computes no new figure.
5. If the student has no linked parent, the profile shows a prompt into Workflow J (Add Parent), pre-filled with this student.
6. If an admin later changes a student's status away from `active` (`updateStudentStatus`, added Phase 15 — see Workflow M), their existing `FEE_ASSIGNMENT`/`TRANSACTION`/`WAIVER`/`PENALTY` rows remain fully intact and visible on their Student Profile — the status change removes them from active assignment/defaulter-tracking flows only, never from historical view.

## Workflow L — Reconciliation Report Export *(added Phase 14 — see `decision_log.md` Phase 14)*

1. Admin opens Reports & Export (directly, or via the Dashboard's export quick-action button) and selects a date range and format (CSV/PDF).
2. The preview and the final export both call the same aggregation `getLedgerSnapshot` and `generateWeeklyDigest` already use (`business_rules.md` Reporting Logic) — `generateReconciliationReport` introduces no second calculation path, so the export can never show a different number than the live dashboard would for the same range.
3. On successful generation, an `AUDIT_LOG` row is written (`report_exported`, actor, date range) — the same audit-trail-native pattern already applied to every other money-adjacent action in this system, even though an export itself changes no balance.
4. No AI narration is involved anywhere in this workflow — deliberately, see `decision_log.md` Phase 14 and `product_requirements.md` F-8.

## Workflow M — Student Exit (Withdrawal, Graduation, Transfer) *(added Phase 15 — see `decision_log.md` Phase 15)*

1. Admin opens a student's Student Profile (or the row-level action on Student Directory) and selects "Change Status" → a status other than `active`.
2. If the student's remaining balance across all `FEE_ASSIGNMENT` rows is zero, the status change submits immediately — no further prompt.
3. If a nonzero balance exists, the form requires an explicit `balanceDisposition` choice before it will submit: `write_off` (creates a full-remaining-balance `WAIVER` via the existing `applyWaiver` mechanism — same non-nullable reason, same `AUDIT_LOG` row as every other waiver) or `carry_forward` (no financial row changes; the balance remains fully collectible and visible).
4. `updateStudentStatus` commits the status change and, if applicable, the waiver — both in the effect described, never partially.
5. On the next read, the student is absent from the active Defaulter Tracking view and excluded from the daily reminder-trigger job (Workflow C, Workflow D), regardless of which `balanceDisposition` was chosen.
6. All historical `FEE_ASSIGNMENT`/`TRANSACTION`/`WAIVER`/`PENALTY`/`REMINDER_LOG`/`DEFAULTER_SCORE` data remains fully intact and visible on the Student Profile — a status change is a change in active-tracking membership, never a deletion of history.
7. A status change is reversible: an admin can set a student's status back to `active` (e.g. a transfer that fell through), which re-includes them in Workflow C/D's active pool starting from the next job run. A prior `write_off` is not automatically undone by this reversal — the waiver already recorded stands; the balance was already forgiven and does not silently reappear.

## Cross-Workflow Dependency Summary (for agent implementation ordering)

| Trigger | Must also do |
|---|---|
| Any `recordPayment` | Run `detectAnomaly` synchronously (Workflow A) |
| `applyWaiver` | Trigger `computeDefaulterScore` immediately (Workflow B → C) |
| `markChequeBounced` | Trigger `reverseTransaction` + `computeDefaulterScore` immediately (Workflow A/C) |
| `confirmOcrEntry` | Re-enter Workflow A at `recordPayment`, not a separate posting path (Workflow E → A) |
| Any AI narration call (`narrateAnomaly`, `narrateDefaulterInsight`) | Must be async/non-blocking relative to the triggering write (Workflow A, C) |
| **`recordPayment`, `markChequeBounced`, `detectAnomaly` (added Phase 9)** | **After the write returns, dispatch push notifications per Workflow G — same async/non-blocking discipline as the narration row above, applied to a different side effect** |
| **Any `copilotQuery` call (added Phase 9)** | **Must resolve exclusively through the existing whitelisted, RLS-scoped action set (Workflow H) — never a new data-access path written specifically for the Copilot** |
| **`syncOfflinePayment` success (added Phase 10)** | **Re-enters Workflow A at the point immediately after `recordPayment` — anomaly detection and push dispatch both still apply, exactly as if the payment had been entered online. This is not a parallel, lighter-weight posting path.** |
| **`syncOfflinePayment` conflict (added Phase 10)** | **Must call `reportSyncConflict` (Workflow I) before returning — a conflict that's detected but not escalated is functionally identical to one silently dropped, from the perspective of every other admin at the school** |
| **Any `signInWithOtp` call (added Phase 11)** | **Must pass `shouldCreateUser: false` — omitting this is the single easiest way to silently reopen the no-self-registration principle this system otherwise enforces consistently (Workflow J)** |
| **`bulkImportStudents` (added Phase 14)** | **Each row processed and reported independently (Workflow K) — a single bad row must never abort or roll back the rows around it** |
| **`generateReconciliationReport` (added Phase 14)** | **Must write an `AUDIT_LOG` row on every successful call (Workflow L) — same discipline as every other money-adjacent action, even though this one changes no balance** |
| **`updateStudentStatus` with a nonzero balance (added Phase 15)** | **Must reject the call outright if `balanceDisposition` is omitted (Workflow M) — never silently default to either write-off or carry-forward on the admin's behalf** |
| **`computeDefaulterScore` / the daily reminder-trigger job (added Phase 15)** | **Must filter on `STUDENT.status = 'active'` (Workflows C, D) — a status change takes effect on the very next read, not just the next scheduled job run** |
| **`markReminderSent` on the `email` channel (added Phase 15)** | **Must resolve to a distinct `sent` / `failed` / "no email on file" outcome (Workflow D) — never conflate a real dispatch failure with the WhatsApp/SMS channels' `simulated_sent`, and never silently no-op without surfacing the missing-email case** |

This table exists because these cross-workflow effects are the most likely place for an agent to implement each workflow correctly in isolation while missing the interaction between them.

## Assumptions

- The daily scheduled job (Workflows C and D) runs via Vercel Cron or a Supabase Edge Function — exact scheduling mechanism is an implementation detail left to the agent, not specified as a hard constraint.

## Future Extensions

A bulk-reminder review-and-send screen, a polling fallback for Workflow A if a UPI webhook never arrives, a refund-adjacent workflow for post-full-payment waivers (currently out of scope).

## References

Workflows A–E trace to Phase 3 of this project's design process; Workflow F and its cross-workflow dependency on Workflow A trace to the Phase 2 parent-scope negotiation and Phase 3's subsequent RLS/API design. The cross-workflow dependency table was compiled during Phase 6 design review to close gaps found there (waiver-triggers-recompute, cheque-bounce-triggers-recompute, async narration). Workflows G and H, and their two added rows in the dependency table, trace to Phase 9 (`decision_log.md`) — added alongside the PWA, push notification, weekly digest, and AI Copilot features they document. Workflow I and its two added rows trace to Phase 10 — added directly in response to the official challenge brief's "offline workflows" requirement, not design judgment like most of Phase 9. Workflow J and its dependency-table row trace to Phase 11 — the parent login redesign from magic-link email to dual-channel (phone primary, email fallback) OTP, sourced from a direct product decision to improve reach among this parent demographic and avoid the WhatsApp Business API approval barrier; see `decision_log.md` Phase 11 for the full comparison of alternatives considered.
