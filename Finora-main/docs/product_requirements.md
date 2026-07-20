# Product Requirements

## Purpose

Defines every functional and non-functional requirement, user role, and feature-tier classification for the system. This is the authoritative feature list — `system_architecture.md`, `database_design.md`, and `ui_ux_specification.md` must not introduce functionality not traceable to this document.

## Scope

Covers both the hackathon MVP and the full production feature set, explicitly separated by tier so an agent building any single tier knows what is and is not in bounds for that pass.

## User Roles

### Admin
Full access to fee configuration, ledger, defaulter tracking, waivers/penalties, reminders, reports, OCR intake, and student directory/profile management (added Phase 14 — previously implied by this description but never actually specified, see `decision_log.md` Phase 14) — scoped to their own school only (multi-school isolation enforced even though only one school exists in the MVP).

### Parent
Restricted, read-and-pay access. Sees only their own linked child/children's dues, payment history, and receipts. Never sees risk scores, audit logs, waiver/penalty detail, or any other student's data. Enforced at the database layer (Row-Level Security), not merely hidden in the UI — see `security.md`.

## Feature Hierarchy

### Must Have (MVP-blocking)

| ID | Feature | Traces to |
|---|---|---|
| M-1 | Dynamic, schema-driven fee engine (no hardcoded fee types) | §5.2, §13.2 |
| M-2 | Transaction/waiver/penalty data model with native audit trail | §6.1 Rank 2, §13.3 |
| M-3 | Omnichannel payment capture: UPI (sandbox) + manual cash/cheque | §13.2, §12.1 |
| M-4 | Live, unified reconciliation ledger, zero manual step | §6.1 Rank 1, §9.1, §13.1 |
| M-5 | Prioritized, risk-segmented defaulter tracking (rule-based) | §2.1, §8.1, §9.1, §10.1 |
| M-6 | Glassmorphism admin dashboard bound to live data | §2.1, §2.7, §13.1, §13.2 |
| M-7 | Offline payment entry (cash/cheque) with queued local storage and explicit, never-silent sync-conflict resolution | Official challenge brief, "Challenge" section — "supporting multiple payment methods **and offline workflows**" (added Phase 10) — this is the strongest citation of any requirement in this table: literal brief text, not design judgment or research inference |
| M-8 | Student roster management (single + bulk creation) *(added Phase 14)* | Design judgment, no direct research citation — M-1 through M-7 all silently assume a `STUDENT` row already exists (`assignFee`, `recordPayment`, defaulter scoring all take `student_id` as a given); without this, none of them are actually reachable in a real school's onboarding flow. See `decision_log.md` Phase 14 |

### Should Have

| ID | Feature | Traces to |
|---|---|---|
| S-1 | Auto-generated digital receipts (PDF, A4 + thermal) | §5.1, §8.1 |
| S-2 | Simulated WhatsApp/SMS reminder drafting (logged, never sent) | §11.1, §11.2 |
| S-3 | Quick-action contextual dashboard buttons | §2.1, §2.5 |
| S-4 | GST-compliant receipt fields, configurable per fee type | §4.1 + GST research (see `business_rules.md`) |
| S-5 | Parent portal: login, view dues, pay via UPI sandbox, view history/receipts | §2.5, §4.3 |
| S-6 | Partial payment support, with due-date-governed (no-extension) remaining balance | Product-owner decision, no direct research citation |
| S-7 | Hindi toggle, parent-facing screens only | §8.2 (EduGradUP Hindi-interface finding) |
| S-8 | Installable PWA (manifest + service worker) | Design-review finding, Phase 9 — no direct market-research citation; added for hackathon "web solution" judging fit and install-driven demo impact, see `decision_log.md` Phase 9 |
| S-9 | Web Push notifications (admin: payment/anomaly/bounce alerts; parent: payment confirmation only) | Design-review finding, Phase 9 — depends on S-8; see `business_rules.md` Push Notification Strategy for exact trigger events and the deliberate boundary against becoming a second reminder channel |
| S-10 | Consolidated Student Profile view (fee assignments, full payment history, waivers/penalties, reminders, risk trend, in one screen) *(added Phase 14)* | Design judgment, no direct research citation — closes a gap where this screen was referenced by name in `ui_ux_specification.md`'s Add Parent flow (Phase 11) but never actually specified. See `decision_log.md` Phase 14 |
| S-11 | Reports & Export (reconciliation summary, CSV/PDF, for handoff to an accountant/auditor outside the platform) *(added Phase 14)* | Design judgment, no direct research citation — "reports" was already named in this document's own Admin role description and the dashboard's export button, with no backing spec until now. See `decision_log.md` Phase 14 |
| S-12 | Student lifecycle/exit handling (withdrawn/graduated/transferred, with explicit write-off-or-carry-forward balance disposition) *(added Phase 15)* | Raised directly ahead of build start: without this, the risk-segmented Defaulter Tracking view — this project's own named differentiator — would accumulate stale entries for students no longer enrolled. See `decision_log.md` Phase 15 |
| S-13 | Email reminder escalation via Resend (real, non-blocking, admin-triggered dispatch) *(added Phase 15)* | Raised directly ahead of build start: Web Push (S-9) structurally under-reaches the parents most behind on fees, since it requires the parent to have already installed the PWA and opted in. See `decision_log.md` Phase 15 |

### Nice to Have

| ID | Feature | Traces to |
|---|---|---|
| N-1 | Anomaly flagging on reconciliation (amount mismatch, duplicate ref) | §10.1 |
| N-2 | Natural-language dashboard query | §10.1, §10.2 |
| N-3 | AI-narrated defaulter insight and anomaly explanation | §10.1 |
| N-4 | OCR-based receipt/cheque ingestion (confirm-gated before posting) | §8.2 |
| N-5 | AI-generated weekly digest (collections trend, cheque aging, risk movement) | Design-review finding, Phase 9 — no research citation; reuses existing rule-computed aggregates, see `api_specification.md` `generateWeeklyDigest` |
| N-6 | AI Copilot, admin and parent surfaces (function-calling over whitelisted read-only actions, never a write path) | Design-review finding, Phase 9 — added specifically to make the AI-powered nature of the product visible to end users, not just present in the architecture; see `system_architecture.md` AI Copilot Architecture for the security/scope guardrails this requirement is conditioned on |

### Future Scope (design-ready, not built now)

| ID | Feature | Traces to |
|---|---|---|
| F-1 | EMI/financing — "Coming Soon" static stub only | §15.1, §3.3 |
| F-2 | ML-based (non-rule-based) defaulter risk scoring | §10.1, §10.2 |
| F-3 | Cheque aging / clearance state tracking beyond MVP simple version | §5.2 |
| F-4 | Cross-channel duplicate payment detection (manual entries vs. OCR) | Design-review finding, no research citation |
| F-5 | Post-full-payment waiver/refund workflow | Design-review finding, no research citation |
| F-6 | Automatic (accrual-based) late fee / penalty calculation | No research citation |
| F-7 | Multi-language interface beyond Hindi toggle, government integration, Tally sync | §8.2, §9.2 |
| F-8 | Gemini-narrated one-paragraph summary on the Reports & Export output *(added Phase 14)* | Considered, explicitly deferred — see `decision_log.md` Phase 14: would fit the existing "rules compute, Gemini narrates" pattern, but adding an 8th AI feature touches five documents for a narration convenience the report doesn't functionally need |

### Out of Scope

- Live production payment gateway with real KYC/PCI compliance (§14.1, §12.1).
- Multi-tenant SaaS infrastructure, native mobile apps (architecture supports this later; not built now).
- Financial forecasting / cash-flow prediction models (§10.2 — no anchor in core requirements).

## Functional Requirements (numbered, agent-referenceable)

**Fee Engine**
- FR-1: Admin can create, edit, deactivate a fee type with configurable name, category, and GST treatment.
- FR-2: Admin can assign a fee type to a single student or bulk-assign to a class/section, with per-assignment amount and due date.
- FR-3: Deactivating a fee type must not affect existing assignments already using it.

**Ledger / Payments**
- FR-4: Admin can record a cash or cheque payment manually against a fee assignment.
- FR-5: System accepts UPI payments via Razorpay sandbox webhook.
- FR-6: Every payment event posts to the ledger within the same database transaction as the fee assignment balance update — no batch/delayed reconciliation.
- FR-7: A payment amount may be less than the remaining balance (partial payment); it may never exceed it.
- FR-8: UPI webhook processing is idempotent — duplicate webhook delivery for the same reference must not double-post.

**Waivers / Penalties**
- FR-9: A waiver or penalty requires a non-empty reason and a non-nullable approver at the point of creation; neither can be submitted without both.
- FR-10: A waiver reduces the effective amount owed without altering the historical record of amounts actually paid.
- FR-11: Applying a waiver immediately recomputes the affected student's defaulter risk score.

**Defaulter Tracking**
- FR-12: Defaulter risk is computed via a documented rule-based formula (see `business_rules.md`), never machine-learned.
- FR-13: Risk computation accounts for remaining balance ratio, not original fee amount, when a partial payment has been made.
- FR-14: The defaulter view groups/sorts by computed risk level, not solely by days overdue.

**Reminders**
- FR-15: Reminder drafting is tiered by days-overdue threshold.
- FR-16: A drafted reminder is never sent automatically; an admin must explicitly mark it sent. *(Revised Phase 15 — was "and no real delivery API is ever called.")* This remains true without exception for the WhatsApp/SMS channels. **For the email channel only, the same explicit "mark sent" action also dispatches one real, non-blocking email** via the provider named in `system_architecture.md` Email Reminder integration contract — see `business_rules.md` Email Reminder Escalation for why this narrow exception exists and `decision_log.md` Phase 15 for the full reasoning.
- FR-17: If dues are cleared after a reminder is drafted but before it is marked sent, the UI must flag the reminder as stale.

**Parent Portal**
- FR-18: Parent authenticates via OTP — phone SMS primary, email fallback (redesigned Phase 11, was magic link); no self-registration in either channel.
- FR-19: Parent views dues for their own linked child/children only, enforced via Row-Level Security.
- FR-20: Parent pays via the same UPI sandbox flow used by admin-recorded payments — no separate payment integration.
- FR-21: Parent views payment history and downloads receipts for their linked child/children only.
- FR-22 (multi-child): If a parent has more than one `PARENT_LINK`, the UI presents a child selector; if exactly one, no selector element is rendered.

**OCR**
- FR-23: An OCR-extracted payment record must be explicitly confirmed by an admin before it can post to the ledger; no automatic posting from OCR output under any condition.

**GST**
- FR-24: GST treatment (exempt/taxable) and rate are configured per fee type by the admin; the system never infers exemption status.
- FR-25: Receipts derive GST detail from the fee type's configuration at time of transaction, not recalculated retroactively if the configuration later changes.

**PWA / Push Notifications** *(added Phase 9)*
- FR-26: The app is installable as a PWA on Android, desktop, and iOS 16.4+; iOS Safari specifically shows an explicit "Add to Home Screen" instruction, since it has no native install prompt.
- FR-27: Offline mode shows a "last synced at [time]" banner over cached data rather than presenting stale data as current — consistent with the product's zero-lag claim, per `system_architecture.md` PWA & Push Notifications.
- FR-28: A push notification send failure never blocks or delays the underlying write it reports on; an expired/revoked subscription is deleted, not retried indefinitely.
- FR-29: Parent push notifications are limited to payment confirmations only — due-date reminders remain governed exclusively by the existing simulated Reminder Strategy (FR-16), never routed through push instead.

**AI Copilot / Weekly Digest** *(added Phase 9)*
- FR-30: The Copilot may only call a fixed, role-specific whitelist of pre-existing, already-RLS-scoped server actions; it must never be given raw database access or the ability to construct its own queries.
- FR-31: The Copilot must never call a write action (`recordPayment`, `applyWaiver`, `applyPenalty`, `markChequeBounced`, `reconcileMissedUpiPayment`) for either role, under any framing of the user's request — it may only propose an action and deep-link to the screen where a human performs it.
- FR-32: The Parent Copilot's GST explanations must read the already-stored `gst_treatment`/rate/exemption text for the relevant fee type; it must never generate a novel tax determination.
- FR-33: Copilot conversation history is session-scoped client-side state only; no conversation is persisted server-side.

**Offline Payment Entry** *(added Phase 10 — directly required by the official brief, see M-7)*
- FR-34: Offline entry is available for cash and cheque only; the entry form must reject (not silently accept) an attempt to queue a UPI payment offline.
- FR-35: A queued-but-unsynced offline entry must never be counted in any dashboard aggregate, defaulter balance calculation, or reconciliation figure until the server has actually confirmed the post.
- FR-36: A sync attempt that would result in an overpayment or otherwise conflict with the current server-side balance must escalate to an explicit, school-visible Sync Conflict — never silently discarded, never auto-adjusted to fit the new balance.
- FR-37: Sync conflicts must be visible and resolvable by any admin at the school, not only the admin whose device originally queued the entry.
- FR-38: Because Background Sync is not reliably supported on iOS Safari — an explicit PWA target per FR-26 — a manual "Sync Now" action is required as a primary path, not an edge-case fallback.

**Student Directory** *(added Phase 14 — see `decision_log.md` Phase 14)*
- FR-39: Admin can create a single student record, and separately bulk-create students via file import, both scoped to their own school.
- FR-40: A bulk import validates and reports success/failure per row; one invalid row must not abort the entire batch.
- FR-41: A student record is never hard-deleted while linked `FEE_ASSIGNMENT` or `TRANSACTION` rows exist — deactivation only, preserving historical financial data, same pattern already established for `FEE_TYPE` (FR-3). *(Revised Phase 15 — "deactivation" is now expressed as a `status` value, not a boolean; see FR-44.)*
- FR-42: Admin can view a single consolidated Student Profile — fee assignments, full payment history across all channels, waivers/penalties with reasons, reminder history, and risk tier trend over time — without cross-referencing the Ledger and Defaulter views separately.

**Reporting & Export** *(added Phase 14 — see `decision_log.md` Phase 14)*
- FR-43: Admin can generate a reconciliation report (collected by channel, outstanding, waived, class-wise breakdown) for an arbitrary date range, exportable as CSV or PDF, using the exact aggregation logic already defined in `business_rules.md` Reporting Logic — no separate computation path, so the exported figures can never drift from what the live dashboard shows for the same range.

**Student Lifecycle & Exit Handling** *(added Phase 15 — see `decision_log.md` Phase 15)*
- FR-44: Admin can set a student's status to `withdrawn`, `graduated`, or `transferred` in addition to `active`; the status must be visible on the Student Directory and Student Profile.
- FR-45: If a status-changing student has a nonzero remaining balance, the action must not complete without an explicit choice between writing off the balance (via the existing waiver mechanism) or carrying it forward unchanged — neither may be assumed by default.
- FR-46: A student whose status is not `active` is excluded from the risk-segmented Defaulter Tracking view and the daily reminder-trigger job, regardless of remaining balance or the disposition chosen — their historical data remains fully visible on their Student Profile.

**Email Reminder Escalation** *(added Phase 15 — see `decision_log.md` Phase 15)*
- FR-47: When an admin marks an `email`-channel reminder sent, the system dispatches one real, non-blocking email to the linked parent using the already-drafted text, if an email is on file; if not, the UI must surface "no email on file" distinctly rather than failing silently or attempting the send anyway.

## Non-Functional Requirements

- NFR-1: Dashboard and ledger views update via real-time subscription, not polling.
- NFR-2: No AI (Gemini) call may block or gate a money-affecting write — narration/drafting happens asynchronously relative to the payment or flag write itself.
- NFR-3: Glassmorphism visual treatment must degrade to a solid-fill fallback on devices/contexts where blur/transparency would compromise legibility or performance (§14.1).
- NFR-4: All financial data access is scoped by school_id at the database layer, even in the single-school MVP, to avoid later re-architecture for multi-school support.
- NFR-5: Secrets (Razorpay, Gemini, Supabase service role, VAPID key pair — added Phase 9, Twilio Account SID/Auth Token — added Phase 11, Resend API key — added Phase 15) are never committed to source control and are documented with a rotation procedure.
- NFR-6: System must remain usable on both desktop (primary admin context) and mobile (primary parent context).
- NFR-7 *(added Phase 14)*: Every report export produces an `AUDIT_LOG` row (who generated it, what date range) — financial data leaving the platform is treated with the same audit discipline as a waiver, penalty, or reversal, even though an export itself changes no balance.
- NFR-8 *(added Phase 15)*: Every screen displaying financial data must render off the typed five-state union (`idle -> loading -> synced | stale | conflict`) specified in `system_architecture.md` Client State Management — no component may implement its own ad hoc loading/error/conflict handling outside that pattern.

## Open Items Carried Forward (explicitly unresolved, not silently dropped)

- Whether late fees should ever become auto-accruing in a future version (F-6).
- Cross-channel duplicate detection for manually entered payments (F-4).
- Post-full-payment waiver/refund workflow (F-5).
- The unresolved conflict in GST research between sources on private-school tuition GST liability (see `business_rules.md` for detail) — the system is designed to be configurable regardless of how this resolves for any specific school.

## References

Smart School FinTech — Consolidated Research Report (v2, Audited). Section references throughout this document refer to it. GST-specific claims additionally reference the GST research pass conducted during Phase 6 (see `business_rules.md` §GST for source list).
