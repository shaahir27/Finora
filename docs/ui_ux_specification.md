# UI/UX Specification — Smart School FinTech Platform

## Purpose

Complete, screen-by-screen UI/UX requirements written for an AI coding agent to build every page with minimal ambiguity. This document specifies structure, required elements, states, and edge cases — not visual styling detail (see `design_system.md` for tokens, typography, spacing, and component treatment). Color values are final and locked (Forest Ledger, Option A — see `design_system.md`, corrected Phase 8) — build against the semantic token names, which resolve to those final hex values, never a separate hardcoded value.

## Scope

Every screen across both role surfaces (Admin, Parent), their required elements, data bindings, states, and edge cases. Business logic behind each screen is specified in `business_rules.md` and `financial_engine.md`; this document covers presentation and interaction only.

---

## Global Requirements (apply to every screen)

- Glassmorphism treatment throughout: translucent card surfaces, backdrop blur, layered depth (§2.1, §13.1 of the research — a named, scored requirement, not decorative preference).
- **Every glass surface must have a solid-fill fallback** behind a reduced-transparency/low-end-device check. Blur/transparency is a named accessibility and performance risk (§14.1) — this fallback is a hard requirement, not optional polish.
- Two entirely distinct navigation shells — Admin and Parent never share a layout, header, or route namespace.
- No dashboard or report figure may ever be hardcoded or mocked — every displayed number binds to a live query (a named common mistake in the research to avoid).
- Responsive: Admin surface optimized for desktop (primary use case — staff at a desk); Parent surface optimized for mobile (primary use case — a parent on their phone).
- Risk-level, payment-status, and reconciliation-status indicators use consistent semantic coloring across every screen they appear on (see `design_system.md` for the token mapping) — a "high risk" badge must look the same wherever it appears.
- **PWA install prompt** *(added Phase 9)*: Android/desktop Chrome show the browser's native install prompt automatically — no custom UI needed there. iOS Safari has no native prompt, so a dismissible banner ("Add to Home Screen for the full app experience — tap Share, then Add to Home Screen") must render specifically when the user-agent is iOS Safari and the app is not already running in standalone mode. Dismissing it must not re-show it every session — persist the dismissal in local client state.
- **Push notification opt-in** *(added Phase 9)*: a settings toggle, present on both Admin and Parent surfaces (each scoped to that role's own `PUSH_SUBSCRIPTION` rows), defaulting to off — the browser permission prompt must only fire on explicit user action (clicking the toggle), never automatically on page load, since an unprompted permission request is a well-documented way to get a notification permission permanently denied by the browser before the user even understands what they're agreeing to. **Push is not this system's only reach channel for a disengaged parent (Phase 15)** — it structurally requires the parent to have already installed the PWA and opted in, which is exactly the profile least likely among the parents most behind on fees; see `business_rules.md` Email Reminder Escalation for the channel that exists specifically to reach that group.
- **Five-state data-rendering contract** *(added Phase 15 — see `system_architecture.md` Client State Management)*: every screen displaying financial data (Dashboard, Ledger, Defaulter Tracking, Student Profile, Offline Sync Queue, Reports & Export) must render off the typed union `idle -> loading -> synced | stale | conflict`, not a generic loading/error/data pair, and no component may invent its own ad hoc handling outside this pattern. `stale` covers a dropped Realtime connection or a pending sync; `conflict` covers an unreconciled offline entry — a `conflict`-state value must never share the visual treatment of `synced` data, anywhere.

---

## ADMIN — Login
- Email + password (Supabase Auth). No self-registration.
- States: default, error (generic "invalid credentials" message, no field-specific hints — avoids leaking which field was wrong), loading.

## ADMIN — Dashboard (home)
- **Purpose**: satisfies the brief's named, scored dashboard requirement directly.
- **Required elements**: real-time "collected today" metric, outstanding dues total, reconciliation status indicator (% matched / count flagged), revenue-by-channel breakdown (UPI/cash/cheque), risk-segmented defaulter list (top N with a link to the full Defaulter screen), quick-action buttons (send reminder, export, mark paid).
- **Data binding**: all metrics from `getLedgerSnapshot` via Supabase Realtime — must visibly update without page refresh when a transaction posts from anywhere else in the system.
- **Edge case**: if the Realtime connection drops, render the `stale` state per `system_architecture.md` Client State Management (added Phase 15) rather than silently displaying outdated numbers as `synced`.

## ADMIN — Copilot Tab *(added Phase 9)*
- **Purpose**: persistent conversational surface over the existing narration/query AI features, plus the new weekly digest and how-do-I guidance — see `system_architecture.md` AI Copilot Architecture for the full whitelist and guardrails.
- **Required elements**: chat interface (message history for the current session only — not persisted, see `api_specification.md` `copilotQuery`), a set of quick-suggestion chips for common questions ("this week's collections," "stale reminders," "how do I mark a cheque bounced"), and deep-link buttons rendered inline when the Copilot proposes an action (e.g., "Open Reminders Queue") — clicking navigates to the real screen; the Copilot itself never performs the action.
- **First message on open**: the weekly digest (`generateWeeklyDigest`), auto-loaded each time the tab is opened for a new session — not re-fetched on every message, only on tab open, to avoid an unnecessary regeneration cost per message.
- **States**: loading (digest/response generating), error (Gemini call failed — fall back to a plain message directing the admin to the relevant screen directly, never a blank or stuck-spinner state), empty (first-ever open, no conversation yet — shows the digest and suggestion chips only).
- **Explicitly not present**: no free-text field that could be mistaken for a command console — the UI framing (chat bubbles, suggestion chips) should read as "ask a question," not "type a command," reinforcing that this surface answers and suggests, it does not execute.

## ADMIN — Student Directory (Roster) *(added Phase 14, revised Phase 15 — see `decision_log.md`)*
- **Purpose**: the actual onboarding entry point this system was missing — every other admin screen (Fee Engine, Ledger, Defaulter Tracking) assumes students already exist.
- **Required elements**: searchable/filterable student list (by name, class, admission number, **status — added Phase 15**), a "Add Student" action opening a small form (name, class, admission number optional), and a "Bulk Import" action accepting a CSV upload.
- **Bulk import result state**: after `bulkImportStudents` runs, show a per-row result — succeeded / skipped (already imported, matched by admission number) / failed (with the specific reason, e.g. missing required field) — never a single pass/fail message for the whole file, since a partial failure is the expected case to handle gracefully, not an edge case to paper over.
- **Row click** → navigates to that student's **Student Profile** screen (below).
- **Default filter, revised Phase 15**: the list defaults to `status = active` only — `withdrawn`/`graduated`/`transferred` students are hidden by default (not deleted, just not cluttering the default roster view) but reachable via the status filter, never hidden with no way back.
- **Row-level "manage status" action, revised Phase 15 — supersedes the original binary deactivate/reactivate control**: opens the same status-change flow described on the Student Profile screen below (status selector + `balanceDisposition` prompt if a balance is owed) — kept identical between the two entry points rather than a second, slightly-different control living here.

## ADMIN — Fee Engine
- **Screens**: fee type list (create/edit/deactivate, with GST treatment and rate fields per fee type), fee assignment (single student or bulk by class), assignment history per student.
- **GST labeling requirement**: for any `taxable` fee type, the amount field must be labeled to make clear it is the final, all-inclusive figure the parent pays (e.g., "Amount (GST-inclusive)"), never presented as a pre-tax figure with GST added afterward — this reflects the decided inclusive convention in `business_rules.md` §8 and `financial_engine.md` §5, not a UI copywriting choice left to the agent's discretion.
- **Required**: form fields render dynamically from the fee type schema — no field is hardcoded to a fixed template.
- **Edge case**: deactivating a fee type must not affect or delete historical `FEE_ASSIGNMENT` rows already using it — deactivation only prevents new assignments, existing ones remain fully visible and functional.

## ADMIN — Ledger
- **Purpose**: the reconciliation centerpiece.
- **Required elements**: live transaction feed, filterable by channel/status/date/student; manual entry form for cash/cheque; UPI entries shown read-only (system-generated via webhook, never manually editable).
- **Cash/cheque entry form is offline-capable (added Phase 10)**: the same form, not a separate one — if the browser is offline when submitted, the entry writes to the local IndexedDB queue instead of calling `recordPayment` directly, with immediate on-screen confirmation that it's *queued*, not posted (distinct visual treatment, never the same "success" state as a normal post). See `system_architecture.md` Offline Payment Queue.
- **Cheque-specific tab/filter**: a distinct view for "cheques pending clearance," sortable by age (days since posted), with inline `markChequeCleared` / `markChequeBounced` actions per row — this view did not exist in earlier iterations of this spec and is required per the finalized cheque-clearance logic.
- **Payment-status/reconciliation-status display**: every row shows both the transaction's `reconciliation_status` (posted/flagged/reversed/cheque_pending) and, where relevant, the parent `FEE_ASSIGNMENT.payment_status` (unpaid/partially_paid/paid/overdue) — these are two distinct pieces of state and must not be collapsed into one badge.
- **Edge case**: a `flagged` (anomaly) row must be visually distinct from `posted`/`cheque_pending` rows and link through to the Anomaly Detail screen.

## ADMIN — Offline Sync Queue *(added Phase 10)*
- **Purpose**: makes the offline payment queue's state fully visible and resolvable — never a silent background process.
- **Persistent indicator**: a badge (visible from any admin screen, not just this one) showing the count of entries in `queued`/`syncing` state — zero when nothing is pending, so its absence is itself informative.
- **Required elements**: list of queued entries with their state (`queued` / `syncing` / `synced` / `conflict`), a manual "Sync Now" button (the primary path on iOS, a convenience elsewhere — see `system_architecture.md`), and a distinct **Sync Conflict** section for entries `reportSyncConflict` has escalated.
- **Sync Conflict resolution**: selecting a conflicted entry shows the original queued amount/channel/student alongside the current actual balance that caused the conflict, with two explicit actions — "Discard" (no further write) or "Re-enter corrected amount" (deep-links to the normal entry form pre-filled, then marks the conflict resolved once that new entry posts). Never an auto-resolve button — see `business_rules.md` Offline Payment Entry Strategy for why.
- **Edge case**: entries queued on a *different* device than the one currently open are, by construction, not visible in this device's local IndexedDB — only escalated conflicts (server-side, school-wide) are visible across devices. The UI should not imply this screen shows every school's pending offline entries everywhere; it shows this device's queue plus the school's conflicts.
- **Mapping to the five-state union (added Phase 15)**: this screen's own `queued`/`syncing`/`synced`/`conflict` entry states are a domain-specific vocabulary layered on top of, not a replacement for, the render-state union in `system_architecture.md` Client State Management — `queued`/`syncing` render as `loading`, an escalated entry renders as `conflict`, and a fully posted entry renders as `synced`, so this screen participates in the same mandatory contract as every other financial-data screen rather than being a one-off exception to it.

## ADMIN — Defaulter Tracking
- **Purpose**: the named, under-served market gap this product targets directly.
- **Required elements**: list grouped/colored by `risk_level` (never merely sorted by days-overdue), per-student card showing remaining balance (not original fee amount, if partially paid), days overdue, broken-promise count, AI-narrated insight text, quick-action "send reminder" / "escalate."
- **Partial-payment display rule**: a student who has paid 80% and is overdue on the remainder must show the 20% remaining prominently — showing the full original fee amount here would misrepresent their actual risk and mislead the admin.
- **Edge case**: if AI narration (`narrateDefaulterInsight`) fails or hasn't returned yet, the card must still render fully using the raw rule-engine output (`computed_reason`) — narration is enhancement, never a rendering dependency.

## ADMIN — Student Profile *(added Phase 14, revised Phase 15 — see `decision_log.md`)*
- **Purpose**: closes a real gap — this screen was referenced by name in the Add Parent screen below (Phase 11) but never actually specified anywhere until now. A single consolidated view of one student, reachable regardless of whether they're currently at-risk (the Defaulter Tracking view only ever surfaces at-risk students).
- **Reachable from**: Student Directory row click, a linked-name click from any Ledger row, and the Defaulter Tracking card's student name.
- **Required elements, bound to `getStudentProfile`**: header (name, class, admission number, **status badge — `active`/`withdrawn`/`graduated`/`transferred`, revised Phase 15**), current fee assignments with balance/status, full transaction history across all channels (same row format as the Ledger, filtered to this student — no separate rendering logic), waiver/penalty history with reasons, reminder history, and a risk-tier trend over time (not just the current `DEFAULTER_SCORE`, its history) — one page, no need to cross-reference the Ledger or Defaulter views separately for this student.
- **"Change Status" action** *(added Phase 15)*: opens a status selector (`active`/`withdrawn`/`graduated`/`transferred`) → `updateStudentStatus`. **If the student has a nonzero remaining balance, the form must not submit without an explicit `balanceDisposition` choice** (`Write off remaining balance` / `Keep balance on record, remove from active tracking`) — this is a hard submit-blocking requirement, not a soft warning, mirroring the Waiver/Penalty Modal's non-empty-reason requirement below. The write-off option must visibly state it will create a waiver requiring the same audit trail as any other waiver.
- **Immediately visible after a status change**: the student disappears from the active Defaulter Tracking view (if they were on it) on the very next load — this is a direct, user-visible consequence worth confirming in the UI itself (a brief confirmation toast: "Aarav removed from active defaulter tracking"), not something the admin has to infer happened correctly.
- **No parent linked state**: if the student has no `PARENT_LINK`, show a visible "no parent linked yet" prompt that deep-links to Add Parent, pre-filled with this student — this is the exact link the Add Parent screen below already assumes exists.
- **Edge case**: same rendering-independence rule as Defaulter Tracking — if any AI narration elsewhere on this student's record hasn't returned or fails, the raw rule-computed data (balances, `computed_reason`, reminder tier) must still render fully; this screen is a pure aggregation over already-correct data and introduces no new AI dependency of its own.
- **Five-state rendering (added Phase 15)**: this screen renders off the `idle -> loading -> synced | stale | conflict` union per `system_architecture.md` Client State Management, same as every other financial-data screen — no separate ad hoc handling for its aggregation call.

## ADMIN — Waiver/Penalty Modal
- **Required fields**: reason (required, non-empty), amount, approver (auto-filled from session, not editable). Form must not submit without both reason and amount present.
- **Post-submit**: confirmation showing that an audit log entry was created, not just a generic "saved" message — reinforces the audit-trail claim visibly to the person using it.

## ADMIN — Anomaly Detail
- **Required elements**: expected amount vs. received amount, flag reason, AI narration (with raw-reason fallback if narration hasn't arrived or failed), resolve/dismiss action.

## ADMIN — Reminders Queue *(revised Phase 15 — see `decision_log.md` Phase 15)*
- **Required elements**: list of `logged` reminders with drafted text editable before sending, "mark sent" action (`markReminderSent`), visual stale-reminder warning if the underlying due was cleared after the reminder was drafted but before it was sent.
- **Channel-dependent "mark sent" outcome (revised Phase 15)**: for `whatsapp`/`sms` rows, "mark sent" flips to `simulated_sent` and triggers no real delivery, unchanged from before Phase 15. For `email` rows, the same button dispatches a real, non-blocking send via Resend and the row transitions to a loading indicator, then `sent` or `failed` once it resolves — never presented identically to the simulated-only channels, since one is a real delivery attempt and the other structurally isn't.
- **"No email on file" state (added Phase 15)**: an `email`-channel row for a parent with no email on record shows this explicitly, distinct from a `failed` send — it's a data-completeness gap, not a delivery failure, and the row should surface a deep-link to add the parent's email rather than a retry action that would just fail again.
- **`failed` state (added Phase 15)**: shows `dispatch_error` and a manual retry action — a bounce/invalid-address failure is visibly actionable, never silently retried in the background.

## ADMIN — OCR Upload
- **Required elements**: image upload, extracted-fields form (editable, pre-filled from Gemini's extraction), explicit "confirm and post" action.
- **Hard requirement**: the UI must make it structurally impossible to post a transaction without the explicit confirm step — no auto-submit on upload, no implicit confirmation from merely viewing the extracted fields.

## ADMIN — Receipts
- **Required elements**: receipt list per transaction, format toggle (A4/thermal), GST field display (treatment, rate, computed amount — or exemption basis text if exempt), download/reprint action.

## ADMIN — Reports & Export *(added Phase 14 — see `decision_log.md` Phase 14)*
- **Purpose**: closes a gap where "reports" was already named in this project's Admin role description (`product_requirements.md`) and the Dashboard's export quick-action button (above), with no screen or action ever specified for either.
- **Required elements**: date-range picker, format toggle (CSV/PDF), a preview of the same figures the Dashboard already shows for that range (collected by channel, outstanding, waived, class-wise breakdown) before committing to export, and a "Generate" action calling `generateReconciliationReport`.
- **No new numbers computed here** — every figure previewed and exported must match `getLedgerSnapshot`'s output for the same date range exactly; this screen is a formatting/export layer, not a second source of truth for any figure.
- **Post-export**: a visible confirmation that the export was logged (matches the audit-trail-visibility pattern already used on the Waiver/Penalty modal above) — reinforces to the admin that data leaving the platform is on record, not a silent action.
- **Dashboard's existing "export" quick-action button (above) deep-links here**, pre-filled with a sensible default range (current month) rather than requiring the admin to re-select it — the button already existed in this document without a destination; this is that destination.

---

## PARENT — Global (Hindi Toggle)
**Added Phase 8** — S-7 in `product_requirements.md` specified a Hindi toggle for parent-facing screens but this document never carried that requirement into a concrete screen-level spec.
- Toggle visible on every Parent-surface screen (persistent, not per-page), English/Hindi, defaulting to English.
- **Scoping is route-based, not component-based**: the toggle applies to the entire Parent route tree. Any component *shared* between Admin and Parent surfaces (e.g., the `payment_status` badge component reused per `design_system.md`'s Component Library) must carry a translated label set for its Parent-context usage even though the identical component renders English-only on Admin routes — the component itself must accept a locale, it cannot assume English globally just because Admin never toggles it.
- Admin surface has no Hindi toggle and is not in scope for translation at all — this was already true by omission in `product_requirements.md`, now stated explicitly here to prevent an agent from assuming shared-component translation implies Admin-side translation.

## PARENT — Copilot Tab *(added Phase 9)*
- **Purpose**: same architectural pattern as the Admin Copilot, distinct whitelist — see `system_architecture.md` AI Copilot Architecture. Responds in Hindi automatically if the parent's Hindi toggle (above) is on, for that session.
- **Required elements**: chat interface, quick-suggestion chips scoped to parent-relevant questions ("when is the next due date," "why does my receipt show GST," "where's last month's receipt"), deep-links to the Dues/History screens where relevant.
- **GST explanations must read the stored `gst_treatment` for the relevant fee type, never generate a fresh determination** — same restraint as the rest of this system's GST handling (see `business_rules.md` GST Logic). If a parent asks a GST question the stored data can't answer (e.g., "is my school allowed to charge this"), the Copilot must decline to speculate and suggest contacting the school directly, not attempt a legal answer.
- **Never shows**: risk_level, defaulter status, or any admin-only concept, for the same RLS-inherited reason the rest of the Parent surface can't show them (see `security.md` AI Copilot section) — this isn't a prompt instruction, it's structural: the Copilot's whitelist contains no tool that could return this data in the first place.
- **States**: same loading/error/empty pattern as Admin Copilot.

## PARENT — Login *(redesigned Phase 11 — was magic-link email only)*
- **Required elements**: phone number input (default/primary path, pre-formatted for E.164 entry), a visible "Log in with email instead" link that swaps to an email input, OTP code input (6 digits) shown after either channel's OTP is requested, a resend action respecting Supabase's default 60-second cooldown.
- **Copy requirement**: the phone/email input screen must not read like a signup form — no "create account," no "sign up" language anywhere. If an OTP request fails because the number/email isn't registered, the error must say so plainly and direct the person to contact their school, never imply they should try a different email/number to sign up instead.
- **State handling**: requesting an OTP → code-entry screen (with a visible "change number/email" back action, not a dead end) → verifying → success (redirect to Dues) or clear error (wrong code, expired code, unregistered number/email — three distinct messages, not one generic failure state).
- **Edge case**: a parent with both phone and email on file always sees phone as the default; switching to email is always available, never hidden behind a loading state or only shown after a phone failure — it's a standing option, not a fallback-only escape hatch.

## ADMIN — Add Parent *(added Phase 11)*
- **Purpose**: the provisioning counterpart to the redesigned parent login — this is where the "admin creates the account" half of the flow actually happens.
- **Required elements**: name, phone (required, validated E.164 on blur, not just on submit), email (optional), student-link selector (search/select one or more existing students to link via `PARENT_LINK`) — `createParentAccount` rejects submission with zero students linked, so the form should disable submit rather than let that request round-trip and fail.
- **Where it lives**: reachable from the **Student Profile** screen's "no parent linked yet" prompt (links directly here, pre-filled with that student — see `ui_ux_specification.md` ADMIN — Student Profile, added Phase 14; this reference was previously to a screen that hadn't actually been specified yet) and from a standalone "Parents" admin section for the general case (linking an existing parent to an additional child, or the initial bulk-enrollment flow).
- **Edge case**: creating a parent whose phone number already exists on another `USER` row must fail with a clear "already registered" message and a link to add the new student to *that* existing account instead (via `addStudentToParent`) — never silently create a second, duplicate parent account for the same phone number.

## PARENT — Dues (home)
- **Required elements**: linked child's fee breakdown by category, total remaining due, due date, pay action.
- **Multi-child rule**: if the logged-in parent has more than one `PARENT_LINK`, render a child selector (tabs or dropdown) above the dues card. If exactly one, **no selector element exists in the DOM at all** — not merely hidden — to avoid dead UI for the common single-child case.
- **Never shows**: risk_level, defaulter status, waiver/audit data, or any admin-only concept — this is an RLS-backed boundary (see `security.md`), and the UI must not attempt to display data the query layer wouldn't return anyway.

## PARENT — Pay
- **Required elements**: amount field, pre-filled with the full remaining balance, editable down to any value greater than 0 and up to the remaining balance (partial payment allowed).
- **Required messaging**: a visible statement of the consequence of partial payment — e.g., "Remaining balance must be paid by [due_date] or this fee moves to overdue" — since there is no separate grace period, this must be visible at the moment of payment, not buried afterward.
- **States**: default, UPI sandbox checkout in progress, success (showing updated remaining balance, not just "payment successful"), failure (with retry option).

## PARENT — History + Receipts
- **Required elements**: past transactions for the currently selected linked child, receipt download per transaction (reuses the same `RECEIPT`/`pdf_url` the admin side generates — no separate parent-side receipt logic).

---

## Cross-Screen Consistency Rules

- `payment_status` badge styling (unpaid/partial/paid/overdue) must be identical wherever it appears — ledger rows, defaulter cards, dashboard, parent dues screen (parent sees a plain-language version, not the raw enum).
- Any screen displaying a monetary figure sourced from a derived field (`amount_paid`, `remaining_balance`) must never display a value that could be stale relative to the underlying `TRANSACTION` table — if Realtime hasn't yet propagated an update, prefer a loading/stale indicator over a wrong number.

## Assumptions

- Both surfaces are web-only for the current build; no native mobile app screens are specified.
- Exact default sort order for the child selector (alphabetical vs. by class) is left to the agent's judgment — low-stakes, not specified by research or prior decisions.

## Future Extensions

A bulk-review screen for the reminders queue, a cheque-aging alert screen beyond the basic pending-list view already specified. (Full defaulter-detail drill-down beyond the summary card, previously listed here, is now substantially covered by the Student Profile screen added Phase 14 — see `decision_log.md` Phase 14.)

## References

Screen requirements trace to Phase 4 of this project's design process, updated through Phase 6 (multi-child, partial payment, cheque-pending tab additions) and the GST field requirement from the finalized financial engine. See `decision_log.md` for the full history of what was added, removed, or reconsidered at each phase.
