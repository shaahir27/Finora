# API Specification — Smart School FinTech Platform

## Purpose

Defines every Server Action / API contract in the system: inputs, outputs, and the business rules each action must enforce. These are Next.js Server Actions, not a separate REST layer, consistent with the single-funnel architecture in `system_architecture.md`.

## Scope

Action-level contracts grouped by module. Does not restate business logic detail already covered in `business_rules.md` — references it instead.

---

## Student Directory (`packages/db` + `apps/web` server actions) *(added Phase 14, revised Phase 15 — see `decision_log.md`)*

**`createStudent(schoolId, { name, class, admissionNumber? })`**
- Creates a single `STUDENT` row, `status: 'active'`. `admissionNumber`, if provided, must be unique within `schoolId` — a duplicate fails outright rather than silently creating a second row for the same student.
- This is a genuine prerequisite for `assignFee` and every downstream fee/payment action — see `implementation_plan.md` Session 1, where it's built alongside the rest of the ledger core rather than deferred, since nothing else in the Fee Engine is reachable without it.

**`bulkImportStudents(schoolId, csvFile)`**
- Parses a CSV (`name`, `class`, `admissionNumber` columns; `admissionNumber` optional per row) and calls `createStudent` per row inside a single batch operation.
- **Per-row, not all-or-nothing**: one malformed or duplicate row must not abort the batch — the action returns a per-row success/failure report so the admin can fix and re-submit only the failed rows, not re-upload the whole file.
- A row whose `admissionNumber` already exists for that school is treated as "already imported" and skipped (not duplicated, not an error) — this makes the action safe to re-run against the same file, e.g. if a browser tab crashed mid-import.

**`updateStudent(studentId, changes)`**
- Edits `name`/`class`/`admissionNumber` only — plain field edits, no status/lifecycle change. See `updateStudentStatus` immediately below for withdrawal/graduation/transfer.

**`updateStudentStatus(studentId, { status, balanceDisposition? })`** *(added Phase 15 — see `decision_log.md` Phase 15)*
- `status`: `active` \| `withdrawn` \| `graduated` \| `transferred`.
- **`balanceDisposition` (`write_off` \| `carry_forward`) is required whenever the student has a nonzero remaining balance at the time of this call and `status` is not `active`** — the action rejects the call outright if it's omitted in that case, rather than silently defaulting to either behavior. No `balanceDisposition` is needed (or accepted) if the remaining balance is already zero, or if the new `status` is `active`.
- `write_off` internally calls the existing `applyWaiver` for the full remaining balance, with `reason` auto-populated as `"Write-off on {status}, {date}"` and `approved_by` set to the acting admin — same non-nullable-reason, same `AUDIT_LOG` row as every other waiver, no new financial mechanism introduced.
- `carry_forward` changes no financial row at all — the balance remains fully collectible and visible, exactly as before this call.
- **Either disposition removes the student from `computeDefaulterScore`'s active pool and the daily reminder-trigger job**, immediately — both now filter on `STUDENT.status = 'active'` (see `business_rules.md` Defaulter Risk Segmentation). This is unconditional on the disposition choice: a `carry_forward` student's balance is still owed and still visible on their Student Profile, but they no longer appear on the active Defaulter Tracking view, since that view exists to prioritize actionable, current risk — not to accumulate every fee ever owed by every student who has ever left.
- Sets `status_changed_at` to the current timestamp. Never deletes or alters any `FEE_ASSIGNMENT`/`TRANSACTION`/`WAIVER`/`PENALTY`/`REMINDER_LOG`/`DEFAULTER_SCORE` row — all remain fully visible on the Student Profile screen regardless of status.

**`getStudentProfile(studentId)`**
- Admin-only, `school_id`-scoped like every other admin action (see Access Control Note). Returns one consolidated payload: the student's current `status`/`balance_disposition`, `FEE_ASSIGNMENT[]`, full `TRANSACTION[]` history across all channels, linked `WAIVER`/`PENALTY` rows with reasons, `REMINDER_LOG[]`, and `DEFAULTER_SCORE` history (not just the current value) — this is a read aggregation over existing tables, it introduces no new financial computation and cannot itself write anything.
- Exists specifically so an admin isn't required to cross-reference the Ledger (filtered by student) and the Defaulter Tracking view (which only shows currently at-risk students) separately to answer "what has happened with this one student."

---

## Fee Engine (`packages/db` + `apps/web` server actions)

**`createFeeType(schoolId, { name, category, isActive, gstTreatment, gstRate? })`**
- Creates a `FEE_TYPE`. `gstRate` required if `gstTreatment = 'taxable'`.

**`assignFee(studentId, feeTypeId, { amount, dueDate })`**
- Single-student assignment. Supports bulk via an array of `studentId`s in one call (per-class assignment).

**`updateFeeSchema(feeTypeId, changes)`**
- Edits an existing fee type. Deactivating (`isActive: false`) must not delete or invalidate historical `FEE_ASSIGNMENT` rows already using it — only prevents new assignments.

---

## Ledger Engine (`packages/payments` + `packages/db`)

**`recordPayment({ feeAssignmentId, channel, amount, refNumber? })`**
- `channel ∈ { upi, cash, cheque }`.
- Acquires a row-level lock (`SELECT ... FOR UPDATE`) on the target `FEE_ASSIGNMENT` as the first step inside its database transaction — added Phase 8, see `financial_engine.md` §1 Concurrency for the race this prevents. Every other step below happens after the lock is held.
- Validates `amount > 0` and `amount ≤ remaining balance` (rejects overpayment, does not cap silently) — this check reads the balance *after* the lock above, not a pre-lock cached value.
- For `channel: upi`: checks for an existing `TRANSACTION` with the same `ref_number` before insert (idempotency — see `system_architecture.md`); returns the existing record if found.
- Writes `TRANSACTION`, updates `FEE_ASSIGNMENT.amount_paid`/`payment_status` in the same DB transaction, runs `detectAnomaly` synchronously. See full algorithm in `business_rules.md` §2.
- Returns the created (or matched) `TRANSACTION` plus updated `FEE_ASSIGNMENT` state.

**`getLedgerSnapshot(schoolId, filters?, pagination?)`**
- Powers the real-time dashboard. Reads Postgres directly — no cache layer, since staleness is the exact problem this product solves.
- Filters: channel, `reconciliation_status`, date range, student.
- `pagination`: cursor-based (`{ cursor?, limit }`, default `limit: 50`) — added Phase 8, previously unspecified. Applies to the ledger's transaction list only; the top-row aggregate metrics (collected/outstanding/etc.) are always computed over the full filtered range regardless of pagination, never just the current page.

**`reverseTransaction(transactionId, reason)`**
- Writes `AUDIT_LOG`. Never hard-deletes the original `TRANSACTION`.

**`markChequeCleared(transactionId)`**
- Flips `reconciliation_status: cheque_pending → posted`.

**`markChequeBounced(transactionId, reason)`**
- Calls `reverseTransaction` internally, writes `AUDIT_LOG`, reopens the fee balance, **and triggers `computeDefaulterScore`** for the affected student (business rule, not optional — see `business_rules.md` §2).

**`initiateUpiSandboxPayment(feeAssignmentId)`**
- Creates a Razorpay sandbox order.

**`handleRazorpayWebhook(payload)`**
- Verifies signature; on success, calls `recordPayment` internally with `channel: upi`. Rejects and logs on signature failure without posting a transaction.

**`reconcileMissedUpiPayment(razorpayOrderId)`** *(added Phase 8 — closes the previously-named-but-unaddressed "webhook never arrives" gap, see `system_architecture.md`)*
- Manual, explicitly-triggered admin action — **not** automatic polling, which remains a Future Extension. Looks up the order directly against the Razorpay sandbox API; if a successful payment exists there but no matching `TRANSACTION` row exists locally (checked by `ref_number`), posts it through the same `recordPayment` path used by the webhook, preserving idempotency.
- Exists specifically so an admin who notices "Razorpay shows paid, the ledger doesn't" — the one failure mode most likely to visibly surface during a live demo — has a documented recovery step rather than no path forward at all.

---

## Rule Engine (`packages/rules` — pure functions, zero external calls)

**`computeDefaulterScore(studentId)` → `{ riskLevel, reason }`**
- Formula in `business_rules.md` §5. Called by: daily scheduled job, `applyWaiver`, `markChequeBounced`.

**`detectAnomaly(transactionId)` → `{ isAnomalous, reason }`**
- Amount-mismatch and duplicate-ref checks per `business_rules.md` §7. Called synchronously inside `recordPayment`.

**`evaluateReminderTrigger(feeAssignmentId)` → boolean**
- Tier logic per `business_rules.md` §6. Decides *whether* a reminder is due — never decides content or sends anything.

**`getRemindersQueue(schoolId, pagination?)`** *(added Phase 8 — the Reminders Queue screen in `ui_ux_specification.md` was previously specified without a backing action listed here)*
- Returns `REMINDER_LOG` rows with `status: logged`, joined to `FEE_ASSIGNMENT`/`STUDENT` for display, including the stale-reminder flag (dues cleared since drafted) per `user_flows.md` Workflow D.
- `pagination`: cursor-based (`{ cursor?, limit }`, default `limit: 50`).

**`markReminderSent(reminderLogId)`** *(added Phase 15 — the Reminders Queue's "mark sent" button in `ui_ux_specification.md` had no backing action listed here, same class of gap `getRemindersQueue` closed above)*
- The single explicit, human-triggered action for every channel — this is what makes "no reminder is ever delivered without an explicit, logged, human action" (Governing Principle 3) actually enforceable in code, not just in UI copy.
- **`whatsapp`/`sms` channel**: flips `REMINDER_LOG.status` to `simulated_sent`. No external call of any kind — unchanged from before Phase 15.
- **`email` channel (added Phase 15)**: if the linked parent has an email on file, this same action also dispatches one real, non-blocking email via Resend using the already-reviewed `drafted_text`, then sets `status` to `sent` on success or `failed` (with `dispatch_error` populated) on failure. If no email is on file, the action still succeeds as a no-op dispatch and the UI must surface "no email on file" rather than silently doing nothing — see `ui_ux_specification.md` ADMIN — Reminders Queue.
- The email dispatch is asynchronous relative to the `status` write already committing — same non-blocking discipline as every Gemini call and push notification in this system (NFR-2, Governing Principle 1's ordering guarantee applied to a third kind of side effect).

---

## AI Layer (`packages/ai` — all calls read-only against the ledger, all non-blocking on the payment-critical path — 7 features as of Phase 9, was 5)

**`narrateDefaulterInsight(studentId)`**
- Called lazily, on-demand when an admin opens a specific student's card — not precomputed for every student.
- On failure: UI falls back to `DEFAULTER_SCORE.computed_reason` (rule-based, always present).

**`answerDashboardQuery(schoolId, question)`**
- Gemini formats/interprets the natural-language question against aggregated ledger data; does not generate SQL independently without structured guardrails.

**`narrateAnomaly(anomalyFlagId)`**
- Called asynchronously after the triggering `recordPayment` response has returned. On failure: UI falls back to `ANOMALY_FLAG.flag_reason`.

**`draftReminderText(feeAssignmentId, tier)`**
- Writes to `REMINDER_LOG` with `status: logged`. Never sends anything.

**`processOcrUpload(imageUrl)`**
- Writes to `OCR_STAGING` only, `confirmed: false`.

**`confirmOcrEntry(stagingId, correctedFields)`**
- The only function that may post an OCR-originated payment. Calls `recordPayment` internally, sets `OCR_STAGING.confirmed = true` and `confirmed_transaction_id`. Must be a distinct, explicit action — never auto-invoked by `processOcrUpload`.

**`generateWeeklyDigest(schoolId)`** *(added Phase 9)*
- Read-only aggregation over the trailing 7 days vs. the prior 7 days: collections trend, cheque-aging summary (reusing the existing 5-day-pending filter from `business_rules.md`), and defaulter-risk-level movement (students who moved tiers up or down). Gemini's role is narration of these already-computed rule-based numbers into plain language — it does not compute the trend figures itself, same "rules decide, AI narrates" discipline as everywhere else in this system.
- Becomes the Admin Copilot's opening message when the tab is first opened each session (see below) — the two features share one code path rather than being built as separate, redundant summarization logic.

**`copilotQuery(role, message, conversationHistory)`** *(added Phase 9)*
- Function-calling over a role-specific whitelist of existing actions — see `system_architecture.md` AI Copilot Architecture for the full whitelist per role and the security reasoning. Never generates SQL, never receives a database credential, never calls a write action for either role.
- `conversationHistory` is passed in from client-side React state on each call — this action is stateless server-side; no `COPILOT_SESSION` table exists or is needed, by deliberate scope decision.
- Returns either a direct answer (drawn from a whitelisted read action's result) or a proposed-action suggestion with a deep-link (e.g., `{ suggestion: "open_reminders_queue", label: "3 reminders look stale" }`) — the client renders the deep-link as a button; the Copilot itself never triggers navigation or a write.

**`answerHowDoI(role, topic)`** *(added Phase 9)*
- Retrieval-grounded, not free-generation: answers are drawn from a small, curated excerpt set of `user_flows.md`/`ui_ux_specification.md` content relevant to the asking role, not from Gemini's general knowledge of "how fee management systems typically work." This keeps guidance accurate to *this* system's actual behavior rather than a plausible-sounding generic answer.
- One of the tools available to `copilotQuery` for both roles, not a separately user-facing action.

---

## Waivers/Penalties

**`applyWaiver(transactionId, { reason, amount, approvedBy })`**
- `reason` and `approvedBy` required, non-nullable — request must fail validation without both.
- Writes `WAIVER`, `AUDIT_LOG` (before/after state), and triggers `computeDefaulterScore` for the affected student.

**`applyPenalty(transactionId, { reason, amount })`**
- `reason` required.

---

## Push Notifications *(added Phase 9)*

**`subscribeToPush(userId, subscription, deviceLabel?)`**
- `subscription` is the browser's `PushSubscription` object (`endpoint`, `keys.p256dh`, `keys.auth`). Upserts a `PUSH_SUBSCRIPTION` row — if the same `endpoint` already exists for this user, updates rather than duplicates (see the unique constraint in `database_design.md`).

**`unsubscribeFromPush(userId, endpoint)`**
- Deletes the matching `PUSH_SUBSCRIPTION` row. Called both from an explicit user action (settings toggle off) and internally by the send logic when a push attempt returns 404/410 (expired/revoked subscription).

**`sendPushNotification(userId, payload)`** *(internal — not user-invoked, called by the Server Action orchestration layer per the trigger events in `business_rules.md` Push Notification Strategy)*
- Fetches all `PUSH_SUBSCRIPTION` rows for the user, sends to each via `web-push`, best-effort and non-blocking per the hard failure rule in `system_architecture.md`. A failure on one device's endpoint never affects delivery to the user's other subscribed devices, nor the underlying write that triggered the notification.

---

## Offline Payment Sync *(added Phase 10)*

**`syncOfflinePayment(localId, feeAssignmentId, channel, amount, queuedAt)`**
- `channel ∈ { cash, cheque }` only — rejects `upi` outright, per `business_rules.md` Offline Payment Entry Strategy scope.
- Internally calls `recordPayment` with the same arguments — **this is not a separate posting function**, it's the offline queue's entry point into the one posting path every channel already shares, so it inherits the row-lock/overpayment check automatically rather than needing its own copy of that logic.
- On success: returns the posted `TRANSACTION`, client removes the entry from its local queue.
- On failure (balance conflict): does **not** retry silently and does **not** partially post. Returns a conflict result; client calls `reportSyncConflict` immediately with the same `localId`.

**`reportSyncConflict(localId, feeAssignmentId, channel, amount, queuedAt, conflictReason)`**
- Writes an `OFFLINE_SYNC_CONFLICT` row (`database_design.md`) — school-visible, not just visible to the submitting admin. Idempotent on `local_id`: a retried escalation call for the same entry updates rather than duplicates.
- Triggers an admin push notification per `business_rules.md` Push Notification Strategy.

**`getSyncConflicts(schoolId)`**
- Returns unresolved `OFFLINE_SYNC_CONFLICT` rows for the school — any admin, not just the one who queued the original entry, per the RLS policy in `security.md`.

**`resolveSyncConflict(conflictId, resolutionAction, reason)`**
- `resolutionAction ∈ { discarded, reentered_adjusted }`. `discarded` closes the conflict with no further write. `reentered_adjusted` requires the admin to have already re-entered a corrected payment through the normal `recordPayment` flow first — this action only marks the conflict resolved and links the reasoning, it does not itself post anything. Requires a non-empty `reason`, same non-negotiable pattern as `applyWaiver`/`applyPenalty`.

---

## Parent Account Management *(added Phase 11)*

**`createParentAccount(schoolId, name, phone, email?, studentIds[])`**
- Admin-only. Creates the `USER` row (`role: parent`, `phone` required, `email` optional) and one `PARENT_LINK` row per student in `studentIds`, in a single transaction — a parent account with zero linked students is never a valid intermediate state, since it "has nothing to see" per `business_rules.md` Parent Account & Login Strategy.
- `phone` must be validated as E.164 format before the underlying Supabase Auth user is provisioned — a malformed number here fails account creation outright rather than creating an account that can never receive an OTP.
- Does **not** itself trigger any OTP or notification — the parent's first login attempt is what triggers their first OTP, not account creation. Keeps this action a pure provisioning step, no side effects on external services.

**`addStudentToParent(parentUserId, studentId)` / `removeStudentFromParent(parentUserId, studentId)`**
- Admin-only. Adds/removes a single `PARENT_LINK` without touching the `USER` row — for the common case of a parent gaining or losing a linked child (sibling enrolls, family leaves the school) without recreating the account.

---

## Parent-Facing Actions (thin wrappers over existing admin logic — no new payment or receipt generation code)

**`getMyChildrenDues(parentUserId)`**
- Resolves `PARENT_LINK` → `FEE_ASSIGNMENT[]` for linked students.
- Returns, per due: `{ amount, amountPaid, remainingBalance, paymentStatus, dueDate }` — must include the paid/remaining breakdown to support partial-payment display; RLS does the real access enforcement, this action is a UI-shape convenience only.

**`payDueViaUpi(feeAssignmentId, amount)`**
- Same underlying `initiateUpiSandboxPayment` → `handleRazorpayWebhook` → `recordPayment` path as the admin flow.
- `amount` may be less than the full remaining balance (partial payment) but must be `> 0` and `≤` remaining balance — same validation as `recordPayment`.
- No extension of `due_date` on partial payment — the original due date still governs overdue/defaulter status for whatever remains unpaid.

**`getMyPaymentHistory(parentUserId, pagination?)`**
- Filtered `TRANSACTION` + joined `RECEIPT` for the parent's linked student(s), for download links.
- `pagination`: cursor-based (`{ cursor?, limit }`, default `limit: 20`) — added Phase 8.

---

## Reports & Export *(added Phase 14 — see `decision_log.md` Phase 14)*

**`generateReconciliationReport(schoolId, { startDate, endDate, format })`**
- `format`: `csv` \| `pdf`. Admin-only, `school_id`-scoped.
- Computes collected-by-channel, outstanding, waived total, and class-wise breakdown for the given date range, using the exact same aggregation queries already defined in `business_rules.md` Reporting Logic (the same formulas `getLedgerSnapshot` and `generateWeeklyDigest` already use) — **no new computation logic is introduced by this action**; it is a formatting/export layer over existing derivations, so an exported figure can never drift from what the live dashboard shows for the same range.
- Every successful call writes an `AUDIT_LOG` row (`action: report_exported`, actor, date range) per NFR-7 — financial data leaving the platform is logged with the same discipline as a waiver or penalty, even though generating a report changes no balance and requires no approval reason.
- **Deliberately has no Gemini-narrated summary** — considered and explicitly deferred, see `decision_log.md` Phase 14 and `product_requirements.md` F-8. This keeps the "7 AI features" count (`system_architecture.md`) unchanged.

---

## Access Control Note (applies to every action above)

Every action listed here is additionally constrained by Row-Level Security at the database layer (see `security.md`) — the action-level code should not be the only thing preventing a parent from reading another family's data. If an action's application-layer logic and the RLS policy ever appear to disagree, the RLS policy is authoritative; fix the action, not the policy.

## Assumptions

- All actions run server-side only (Next.js Server Actions); no direct client-to-database calls exist anywhere in the app.
- Every action assumes an authenticated session; unauthenticated calls are rejected before reaching any business logic.

## Future Extensions

Automatic polling-based Razorpay status-check (the *automatic* fallback for missed webhooks — the *manual* fallback, `reconcileMissedUpiPayment`, is now built, see Ledger Engine above), a bulk-reminder-send review action, an admin-facing rate-limit override for AI-heavy actions during high-load periods.

## References

Action contracts trace to Phase 3 (initial definitions) and Phase 6 (idempotency and async-narration corrections) of this project's design process. Business rule detail referenced throughout is authoritative in `business_rules.md`; this document should not be treated as a second source of truth for rule logic, only for action shape and sequencing.
