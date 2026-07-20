# Business Rules

## Purpose

This is the authoritative specification of every calculation, threshold, and decision rule in the system. Where a rule is rule-based rather than AI-driven, that is a deliberate, research-grounded choice (§10.1 confirms a heuristic is sufficient) — no rule described here should be replaced with a machine-learning model without a corresponding product decision.

## Scope

Covers fee engine logic, reconciliation logic, waiver/penalty handling, defaulter risk segmentation, reminder strategy, anomaly detection, GST logic, and reporting aggregation. Does not cover UI presentation (see `ui_ux_specification.md`) or schema field definitions (see `database_design.md`), though rules reference field names for precision.

---

## Fee Engine Logic

- A fee is never a hardcoded type. Every fee a student owes is an instance of an admin-defined `FEE_TYPE` applied via `FEE_ASSIGNMENT`.
- Discounts (e.g., sibling slabs) are expressed as a reduced `amount` at assignment time, or as a `WAIVER` applied after the fact if the discount decision happens post-assignment. There is no separate discount-calculation engine — this keeps the fee engine itself simple and pushes audit responsibility onto the waiver mechanism, which already satisfies that requirement.
- Late fees are a manually assigned, flat-amount `FEE_TYPE` like any other. Automatic day-based accrual is explicitly not built (no research citation demands it; see `product_requirements.md` F-6).
- Deactivating a `FEE_TYPE` prevents new assignments but must never affect or delete existing `FEE_ASSIGNMENT` rows already referencing it.

## Reconciliation Logic

The core algorithm, executed synchronously on every payment event regardless of channel:

1. Write a `TRANSACTION` row with `channel`, `amount`, and initial `reconciliation_status`:
   - `upi` or `cash` → `posted`
   - `cheque` → `cheque_pending`
2. Within the same database transaction, update the linked `FEE_ASSIGNMENT`'s derived `amount_paid`.
3. Recompute `FEE_ASSIGNMENT.payment_status` (`unpaid` / `partially_paid` / `paid` / `overdue`) from `amount_paid`, `amount`, and `due_date`.
4. Run `detectAnomaly` synchronously (rule-based, fast) — if `received_amount` does not match the expected remaining balance *at the moment of payment* (i.e., accounting for any prior partial payments), set `reconciliation_status = flagged` and create an `ANOMALY_FLAG` row.
5. Push the updated snapshot via real-time subscription to all connected dashboards.
6. (Non-blocking, follow-up step) Trigger `narrateAnomaly` if a flag was created — this call happens after the transaction response has already returned to the caller; it never delays or gates the write itself.

This must be synchronous through step 5, not batched, because the market's core validated failure mode (§8.1) is claiming real-time reconciliation while actually delivering it on a delay.

**Cheque handling (production-correct version — supersedes an earlier MVP-only simplification):**
- A cheque posts to `cheque_pending`, not `posted`. It is included in "recorded" totals but excluded from "collected/cleared" dashboard figures until resolved.
- `markChequeCleared(transactionId)` flips status to `posted`.
- `markChequeBounced(transactionId, reason)` reverses the transaction (writes `AUDIT_LOG`, reopens the fee balance) and must trigger an immediate defaulter-score recompute for the affected student — a bounce is functionally a new default event, not a no-op.
- A derived (not separately stored) "cheques pending clearance" view, filterable by age, surfaces cheques older than a configurable threshold (default: 5 days) for admin attention.

**UPI webhook idempotency:** before inserting a new `TRANSACTION` for a UPI event, check for an existing row with the same `ref_number`. If found, return the existing record rather than creating a duplicate. This is required because payment gateway webhooks are not guaranteed exactly-once delivery.

## Waiver Handling

- A `WAIVER` requires non-nullable `reason` and `approved_by` — no waiver can be created without both. This directly closes the market's most-repeated audit-trail complaint (§6.1 Rank 2).
- A waiver reduces the *effective amount owed*, not the historical transaction record — what was actually paid, what was waived, and what remains are three distinct, always-visible figures. They are never collapsed into a single adjusted number.
- Applying a waiver immediately triggers a defaulter-score recompute for the affected student (not deferred to the next scheduled batch job) — otherwise an admin could see a stale "high risk" badge immediately after resolving the underlying issue.
- Post-full-payment waiver/refund scenarios are explicitly out of scope (see `product_requirements.md` F-5) — applying a waiver to a fully-paid fee is not a handled workflow in this version.
- **Waiver against a `cheque_pending` transaction (added Phase 8 — previously unaddressed)**: a waiver may be applied while the linked transaction's cheque is still pending clearance. If that cheque subsequently bounces, the waiver is **not** automatically reversed alongside the transaction — a waiver is itself an audit-trail-native action (its own `reason` and `approved_by`) and reversing it requires the same deliberate action as creating it. `markChequeBounced` reopens the fee balance for the bounced amount only; any waiver already applied continues to reduce the effective amount owed independently. An admin who believes the waiver should also be reversed following a bounce must do so explicitly, producing its own `AUDIT_LOG` entry — this is a deliberate design choice to avoid one event (a bounce) silently cascading into undoing an unrelated, separately-approved decision (a waiver).

## Penalty Calculation

- Penalties are manually applied by an admin action (`applyPenalty`), reason-tagged identically to waivers. No automatic penalty-accrual engine is built, for the same reasoning as late fees: no research citation demands it, and the edge cases (compounding, caps, interaction with partial payment) are unspecified and out of scope until a product decision is made.

## Defaulter Risk Segmentation

Rule-based, per §10.1's explicit statement that a heuristic is sufficient — no ML.

**Scope filter, added Phase 15**: this formula runs only over `FEE_ASSIGNMENT` rows belonging to a `STUDENT` with `status = 'active'`. A student who has withdrawn, graduated, or transferred (`updateStudentStatus`, see `api_specification.md` Student Directory) is excluded from this computation entirely, regardless of any remaining balance or its `balance_disposition` — the Defaulter Tracking view exists to prioritize actionable, current risk among currently-enrolled students, not to accumulate a permanent, ever-growing list of every fee ever owed by anyone who has ever left the school. Their historical `DEFAULTER_SCORE` values are never deleted and remain visible on the Student Profile screen; only new computation and the active view's membership are affected.

```
risk_score = (days_overdue × 2)
           + (broken_promise_count × 15)
           + (remaining_balance_ratio × 30)

remaining_balance_ratio = (amount - amount_paid) / amount

risk_level:
  high    if risk_score > 60
  medium  if risk_score > 30
  low     otherwise
```

- `broken_promise_count` increments when a reminder is marked `simulated_sent` and the fee assignment's due date subsequently passes without full payment. This is inferred from existing `REMINDER_LOG` and `FEE_ASSIGNMENT` data — no separate tracked field is needed. Exact query (added Phase 8 — previously left as prose only, which is the kind of "looks simple, has a hidden temporal edge case" logic likely to be implemented inconsistently without an explicit definition):
  ```
  broken_promise_count(fee_assignment_id) =
    COUNT(REMINDER_LOG)
    WHERE REMINDER_LOG.fee_assignment_id = fee_assignment_id
    AND REMINDER_LOG.status = 'simulated_sent'
    AND FEE_ASSIGNMENT.due_date < CURRENT_DATE
    AND FEE_ASSIGNMENT.payment_status != 'paid'
  ```
  Note this counts *distinct reminders marked sent on an assignment that is currently still unpaid past its due date* — it does not attempt to reconstruct whether payment status ever fluctuated between sent-and-cleared and sent-and-broken over time; only current state matters, consistent with `DEFAULTER_SCORE` itself being a recomputed-not-accumulated value.
- Weights (2, 15, 30) and thresholds (60, 30) are configuration constants, not inline literals — they must live in a single config location so they can be tuned without touching the formula logic itself.
- A student who has partially paid scores proportionally lower than one who has paid nothing on an otherwise-identical overdue fee — this is a deliberate design requirement, not an incidental side effect of the formula.

## Reminder Strategy

Tiered, threshold-based drafting — never automatic sending (Governing Principle 3, restated here as a hard business rule, not just a UI constraint). **Scope clarified Phase 11, revised Phase 15**: Governing Principle 3 restricts *this reminder-notification system specifically* — drafted, logged, never-automatically-sent nudges about a due date. It has never restricted every SMS/email use case in this system; Push Notifications (Phase 9) and OTP-based parent login (Phase 11, see Parent Account & Login Strategy below) both involve real delivery over channels this principle's name might suggest are fully off-limits, and both are legitimate, deliberately-scoped exceptions to a narrower rule than the principle's short name implies — not violations of it. **Email joins this list of narrow exceptions as of Phase 15** (see Email Reminder Escalation, below) — the human-in-the-loop guarantee (no automatic sending, ever) is unchanged for every channel; what changes for email only is that the explicit admin "mark sent" action now also triggers one real dispatch.

```
Daily, for each FEE_ASSIGNMENT where due_date < today, payment_status != paid, and STUDENT.status = 'active' *(status filter added Phase 15 — see Defaulter Risk Segmentation above for why)*:
  tier = 1 if days_overdue in [1,6]
         2 if days_overdue in [7,13]
         3 if days_overdue >= 14

  if last_triggered_tier < tier:
    draft a reminder (Gemini-generated text, tone escalates with tier)
    write REMINDER_LOG row, status = logged
    update FEE_ASSIGNMENT.last_triggered_tier = tier
```

- A reminder never transitions to `simulated_sent`/`sent` automatically. An explicit admin action (`markReminderSent`) is required for every channel, with no exception.
- If the underlying due is cleared between drafting and sending, the reminder must be visually flagged as stale before an admin can act on it.
- **No WhatsApp/SMS API is ever called by this system, under any configuration** — unchanged from before Phase 15. **Revised Phase 15**: a real email API call *is* made, but only via the single explicit `markReminderSent` action described below, never automatically and never for any channel other than email.

### Email Reminder Escalation *(added Phase 15 — see `decision_log.md` Phase 15)*

**The problem this solves, stated precisely**: Web Push (Phase 9) only reaches a parent who has already installed the PWA and opted in to notifications — and a parent disengaged enough to be behind on fees is, on average, less likely to have done either of those things than an engaged parent. The reminder system's actual job is to reach parents who are *not* already checking a dashboard; push structurally under-serves exactly that group.

**Why email, specifically**: transactional email carries none of the barriers already documented elsewhere in this project as blocking real WhatsApp/SMS delivery — no DLT registration, no WhatsApp Business API pre-approval, no per-message regulatory cost (see Parent Account & Login Strategy, below, and `security.md` Known Gaps). It is the lowest-friction channel available that doesn't depend on the parent having installed anything.

**Provider**: Resend, selected after reviewing current transactional email options for a Next.js/Vercel stack at this project's scale — a free tier comfortably covering a single school's defaulter-reminder volume, first-party TypeScript SDK, no card required to start. Postmark was considered as a more established alternative and is a reasonable upgrade path if real-world deliverability ever demands it — not adopted now, since nothing about this build's scale requires it.

**Mechanism**: no new admin action and no separate "send email" button. The existing `markReminderSent` action (see `api_specification.md`, added Phase 15 — this action was itself a previously undocumented gap, closed at the same time) is what dispatches the email, for the `email`-channel `REMINDER_LOG` row, using the exact `drafted_text` an admin has already reviewed. The human-in-the-loop guarantee is identical to the WhatsApp/SMS channels: nothing is sent until that explicit action is taken.

**Failure handling**: a Resend dispatch failure (invalid address, bounce) sets `REMINDER_LOG.status = 'failed'` with `dispatch_error` populated, surfaced to the admin — never silently retried indefinitely, never presented as if it succeeded. A `REMINDER_LOG` row with no email on file for the linked parent is surfaced distinctly as "no email on file" rather than a failure, since it's a data-completeness gap, not a delivery problem.

**Explicitly not changed**: WhatsApp/SMS remain simulated-only. This is not a general loosening of Governing Principle 3 — it is a third narrow, named exception of the same kind already carved out for Push (Phase 9) and OTP login (Phase 11), added for the identical underlying reason: a real, structural gap in this system's ability to reach the people it exists to serve.

## Push Notification Strategy *(added Phase 9)*

**This is a genuinely separate system from the reminder strategy above, not an exception to it.** Governing Principle 3 ("no WhatsApp/SMS/email API is ever called") exists specifically to avoid the cost, compliance, and opt-in complexity of a *third-party messaging provider* in a hackathon build. Browser-native Web Push is architecturally different: no third-party account, no per-message cost, no paid API key — it uses a self-generated VAPID key pair and the browser's own Push API. Nothing about Governing Principle 3 was written to cover this, and an agent should not read it as prohibiting push notifications; the two systems solve different problems and neither substitutes for the other.

**Trigger events — deliberately narrow, not "notify on everything":**
- **Admin**: a `TRANSACTION` posts (`reconciliation_status = posted`) for their school, a cheque bounces (`markChequeBounced`), a new `ANOMALY_FLAG` is raised, `reconcileMissedUpiPayment` finds and posts a previously-missing payment, or **an offline-entered payment fails to sync due to a conflict (added Phase 10 — see Offline Payment Entry Strategy below)**, since a stuck conflict is exactly the kind of time-sensitive, easy-to-forget state this notification channel exists for.
- **Parent**: a payment involving their linked student is confirmed (`posted`) — this is a confirmation notification only, not a due-date reminder. Due-date reminders remain governed entirely by the Reminder Strategy above (simulated, logged, never auto-sent) — push is not used to route around that deliberate constraint. Keeping this boundary explicit prevents scope creep from turning a demo-friendly confirmation feature into a second, less-deliberate reminder channel.

**Delivery is best-effort and non-blocking**: a push send failure (expired subscription, browser permission revoked, offline device) must never affect the underlying write it's reporting on — the `TRANSACTION`/`ANOMALY_FLAG`/etc. row already committed before the push attempt fires, same non-blocking discipline already applied to Gemini narration calls elsewhere in this system.

## Parent Account & Login Strategy *(redesigned Phase 11 — was magic-link email only)*

**Account creation stays exactly as it already was — admin-created, no self-registration.** What changes is the login mechanism, not who's allowed to create an account. An admin creates a parent's `USER` row (capturing name, phone, optionally email, and which student(s) they're linked to via `PARENT_LINK`) through `createParentAccount` — see `api_specification.md`. A parent never arrives at a signup form; they only ever arrive at a login form for an account that already exists.

**Phone is now the required field, email is optional** — the reverse of the original design, and a deliberate reach-driven choice: SMS reaches this parent demographic more reliably than email checking habits do, and it also sidesteps the WhatsApp Business API approval barrier that made WhatsApp itself impractical for this build. See `decision_log.md` Phase 11 for the full comparison against the WhatsApp and static-SMS-password alternatives that were considered and rejected.

**Login is OTP-based on both channels — no password, ever, for parents.** Phone SMS OTP is the primary path; email OTP is an automatic fallback, not a hidden or deprecated option, so a parent (or a judge testing the product) is never blocked by a single channel's delivery failure.

**The no-self-registration principle must be actively enforced under an OTP model, not assumed to hold by default.** Supabase's OTP sign-in will, left at its default setting, silently create a new account for any phone/email it doesn't recognize — that default is itself a self-registration path and directly contradicts this system's admin-provisioning principle. Every OTP call **must** pass `shouldCreateUser: false` (see `security.md` Authentication). An OTP request for an unregistered number/address must fail with a clear message directing the person to their school, never silently succeed into a freshly-created, unlinked account that — per the original design reasoning this project already established — "has nothing to see" and would just be a confusing dead end.

**The demo path is honestly sandboxed, same discipline as Razorpay.** Real Twilio SMS delivery is configured and functional, but demo/judge-facing accounts use Supabase's Test OTP mechanism (fixed codes for specific numbers, no real SMS sent) so the live demo never depends on DLT-regulated SMS infrastructure actually being registered — which, for a hackathon-timeline team, it legitimately can't be (see `decision_log.md` Phase 11 for why: DLT registration requires a registered business entity, a real fee, and a multi-day approval window incompatible with this build's timeline).

## Offline Payment Entry Strategy *(added Phase 10)*

**Why this exists**: the official challenge brief names "offline workflows" as a core objective, not an optional nicety — this is a direct requirement, unlike most Phase 9 additions, which were design judgment. It creates a real tension with this project's own zero-lag pitch: every other channel posts and is *immediately, provably* correct, because the server has validated it. An offline-entered payment structurally cannot be validated until connectivity returns. The rules below exist specifically to make sure "not yet validated" is never quietly presented as "validated."

**Scope — cash and cheque only, never UPI.** UPI is inherently server-driven (webhook-confirmed); there is no meaningful "offline UPI entry" to build, and pretending otherwise would just be a worse version of the existing cheque-entry trust model wearing a different label. This is a natural, not arbitrary, boundary.

**Local queueing**: an offline cash/cheque entry is written to the device's local IndexedDB store, not the server, with a client-generated idempotent identifier (`local_id`, a UUID) created at entry time — same idempotency principle already governing UPI webhook `ref_number` uniqueness, applied locally so a retried sync attempt can never double-post the same entry.

**Sync is never silent about failure, and never auto-resolves a conflict.** When connectivity returns, each queued entry attempts to post through the **exact same `recordPayment` path** every other channel uses — same row-level lock, same overpayment check (see `financial_engine.md` §1 Concurrency). If the underlying `FEE_ASSIGNMENT` balance changed while the device was offline (e.g., the parent paid via UPI in the meantime) such that the queued entry would now overpay or otherwise conflict, the sync attempt must fail into an explicit **Sync Conflict** state — never silently discarded, never auto-adjusted to fit the new balance. An admin must explicitly review and resolve it (discard, or re-enter as a corrected amount through the normal flow), producing its own audit trail, consistent with every other adjustment in this system requiring a human, reasoned action.

**Dashboard/ledger accounting**: a queued-but-not-yet-synced payment must never count toward `amount_paid`, "collected today," or any other aggregate — it exists only in its own visible queue with a distinct state (`queued` / `syncing` / `synced` / `conflict`) until the server actually confirms it. Showing it as collected before the server agrees would directly contradict the zero-lag, always-current claim this entire system is built around.

**Known, accepted gap**: the local IndexedDB queue is unencrypted at rest on the admin's device. The data in it is minimal (amount, student reference, channel, timestamp) and already sits behind an authenticated session, but a lost device with entries still queued is a real, if small, exposure — documented here explicitly rather than solved with additional cryptographic machinery disproportionate to this project's scope, consistent with how `security.md` documents its other known gaps.

## Anomaly Detection

- **Amount mismatch**: triggered inline as part of the reconciliation algorithm above — `received_amount` does not equal the expected remaining balance at time of payment.
- **Duplicate channel reference**: two `TRANSACTION` rows sharing the same `channel`, `ref_number`, and `student_id` within a short window (default: 5 minutes) are flagged as `duplicate_channel_ref`, distinct from an amount mismatch.
- **Zero/negative amount**: rejected at input validation in `recordPayment` itself — this must never be a reachable state for anomaly detection to catch; it is prevented, not flagged.
- Cross-channel duplicate detection (e.g., a manually entered cash payment duplicating one already captured via OCR) is explicitly out of scope for this version (F-4) — no reliable matching heuristic has been specified.

## GST Logic

**Research basis**: GST treatment of Indian K-12 education is not a single global rate. Multiple independent sources (GST Council's own explainer, ClearTax, IndiaFilings, Razorpay, Tax2win — researched during Phase 6 design review) agree that core tuition and examination fees from institutions providing pre-school through higher-secondary education are exempt (NIL rate) under Notification No. 12/2017-Central Tax (Rate). School-provided transport to its own students is similarly exempt. Non-academic goods (uniforms, non-essential stationery) are taxable, generally at 18%, with some stationery categories reduced to 5% or NIL under September 2025 reforms.

**Unresolved conflict, preserved rather than papered over**: two sources (Razorpay, Tax2win) state private, for-profit-run schools may owe 18% GST on tuition itself, while the GST Council's own language and other sources describe the pre-school-to-higher-secondary exemption without an explicit for-profit carve-out at the K-12 level. This determination likely depends on a specific school's legal/registration structure, which this system cannot verify independently.

**Resulting business rule**: the system does not attempt to auto-determine exemption status. Each `FEE_TYPE` carries an admin-configured `gst_treatment` (`exempt` / `taxable`) and, if taxable, a `gst_rate`. The system applies whatever the admin configures, consistently, and displays it correctly on receipts — it does not make or imply a legal determination on the school's behalf. A `RECEIPT`'s GST detail is fixed at the time of the underlying transaction and does not change retroactively if the fee type's configuration is later edited.

**Inclusive vs. exclusive convention — researched and decided: GST-inclusive.** The `amount` configured on any `taxable` fee type is always the final, all-inclusive figure the parent actually pays — GST is calculated by back-calculating the tax component from that total, never added on top at payment time. This is a deliberate decision, not an implementation detail left open: a parent paying school fees is an end consumer, not a GST-registered business claiming input tax credit, and that is exactly the case Indian consumer-protection law governs — Legal Metrology Rules define MRP as inclusive of all taxes, and Indian consumer courts have specifically held that charging tax on top of an already-quoted consumer price is an unfair trade practice (*Aero Club (Woodland) vs. Rakesh Sharma*, NCDRC). B2B exclusive-pricing convention does not apply to this relationship. See `financial_engine.md` §5 for the exact back-calculation formula.

## Reporting Logic

- **Collected (today/week/month)**: sum of `TRANSACTION.amount` where `reconciliation_status = posted`, grouped by date range. `cheque_pending` rows are explicitly excluded from any "collected" figure until cleared.
- **Outstanding**: sum of `(amount - amount_paid)` across all `FEE_ASSIGNMENT` rows where `payment_status != paid`.
- **Revenue by channel**: grouped sum by `TRANSACTION.channel`, same `posted`-only filter as above.
- **Class-wise / fee-type-wise breakdown**: same aggregation logic, sliced on the relevant join — no separate calculation path.
- **Export (added Phase 14)**: `generateReconciliationReport` (see `api_specification.md`) reuses every formula above unchanged — it is a CSV/PDF formatting layer on top of the same aggregation, not a second calculation path that could silently diverge from what the live dashboard shows. Every export is logged to `AUDIT_LOG` (`report_exported`) — see `product_requirements.md` NFR-7 — since financial data leaving the platform for an accountant/auditor outside the system is worth a record even though no balance changes.

## Student Directory & Roster Management *(added Phase 14, revised Phase 15 — see `decision_log.md`)*

- **Onboarding is a genuine prerequisite, not an assumed given.** Every other rule in this document (fee assignment, reconciliation, defaulter scoring) operates on a `STUDENT` row that must already exist. `createStudent`/`bulkImportStudents` are the only actions that create one.
- **Dedup by `admission_number`, when supplied.** A `bulkImportStudents` row whose `admission_number` already exists for that school is treated as already-imported and skipped, not duplicated — this is what makes it safe to re-run the same import file (e.g. after a browser crash mid-upload) without manual cleanup first. A student created without an `admission_number` has no dedup check available and relies on the admin not re-creating them manually.
- **Partial-batch failure, not all-or-nothing.** A `bulkImportStudents` call must report success/failure per row. One malformed row (missing required field, invalid class value) must not discard the entire batch — this mirrors the same "one bad row shouldn't cost the whole operation" principle already applied to `bulkImportStudents`' sibling bulk operation, `assignFee`'s class-wide bulk assignment.
- **Student lifecycle is a status, not a boolean (revised Phase 15 — supersedes the original `is_active` design).** `STUDENT.status` (`active` \| `withdrawn` \| `graduated` \| `transferred`) captures *why* a student left, which a boolean deliberately cannot — the reason matters for the admin's own record-keeping, and the specific status doesn't change what happens next (see below), but losing it would make the Student Profile's history read as ambiguous later.
- **Every non-`active` status change with a nonzero balance requires an explicit disposition.** `updateStudentStatus` rejects the call outright if `balanceDisposition` is omitted while a remaining balance exists — the system never silently assumes either "forgive the debt" or "keep chasing it" on the admin's behalf. `write_off` reuses `applyWaiver` for the full remaining balance (no new financial mechanism); `carry_forward` changes no financial row, only the student's visibility in active risk tracking.
- **A student is never hard-deleted, at any status, once financial history exists.** Same soft-delete pattern `FEE_TYPE.is_active` already establishes, applied to the same underlying reason: deleting the row would silently corrupt the historical ledger and audit trail this entire system exists to keep intact. All history remains visible on the Student Profile regardless of status.
- **Student Profile is a read-only aggregation, not a new source of truth.** `getStudentProfile` assembles data already computed and stored elsewhere (fee assignments, transactions, waivers/penalties, reminders, defaulter score history) — it introduces no new business logic and cannot itself be the reason a number is wrong; if a figure on the Student Profile screen is incorrect, the bug is in the underlying table/computation it's reading, not in this aggregation.

## Configuration Constants (must live in a single, agent-discoverable config location, not scattered inline)

| Constant | Default | Used in |
|---|---|---|
| Risk weight — days overdue | 2 | Defaulter risk score |
| Risk weight — broken promises | 15 | Defaulter risk score |
| Risk weight — remaining balance ratio | 30 | Defaulter risk score |
| Risk threshold — high | 60 | Defaulter risk level |
| Risk threshold — medium | 30 | Defaulter risk level |
| Reminder tier 1 window | 1–6 days overdue | Reminder strategy |
| Reminder tier 2 window | 7–13 days overdue | Reminder strategy |
| Reminder tier 3 window | 14+ days overdue | Reminder strategy |
| Duplicate-ref detection window | 5 minutes | Anomaly detection |
| Cheque aging alert threshold | 5 days | Cheque pending view |

## References

Smart School FinTech — Consolidated Research Report (v2, Audited), §5.2, §6.1, §8.1, §9.1, §10.1, §12.1, §13.1–13.4. GST logic additionally sourced from: GST Council of India education services explainer (gstcouncil.gov.in); ClearTax GST on Educational Institutions guide; IndiaFilings GST on Educational Services; Razorpay Learn — GST on Education; Tax2win — GST on Education in India. Conflicting claims between these sources are preserved above rather than resolved, per the project's instruction to never invent certainty where research is inconclusive.
