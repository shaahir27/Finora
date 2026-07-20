# System Architecture — Smart School FinTech Platform

## Purpose

Defines the technical shape of the system: stack, module boundaries, data flow, deployment, and scalability posture. This is the document an AI coding agent should consult before deciding where a new piece of logic belongs.

## Scope

Architecture, integrations, deployment strategy, scalability considerations. Schema detail lives in `database_design.md`; endpoint/action signatures live in `api_specification.md`; business logic detail lives in `business_rules.md`.

---

## Technology Stack

Next.js 15 (App Router) + TypeScript · Supabase (Postgres, Auth, Row-Level Security, Realtime, Storage) · Prisma ORM · Tailwind + shadcn/ui · Recharts · Gemini API (server-side, paid tier) · Razorpay (sandbox mode only) · Monorepo · Vercel deployment · **`web-push` (self-generated VAPID keys, no third-party provider) + Next.js native PWA support (`manifest.json` + service worker) — added Phase 9**, see PWA & Push Notifications section below. **Twilio, as Supabase Auth's configured phone-OTP provider — added Phase 11**, see Parent Authentication section below. **TanStack Query (React Query) v5, wrapping every Supabase Realtime subscription and server action call — added Phase 15**, see Client State Management section below. **Resend, for the one real (non-simulated) reminder-delivery channel — added Phase 15**, see Email Reminder integration contract below and `business_rules.md` Email Reminder Escalation.

## High-Level Architecture

```
Admin web dashboard  ─┐
(glassmorphism UI)     ├──▶ Next.js app router ──▶ Fee engine     ─┐
Parent web portal    ─┘     (server actions,      Ledger engine   ├─▶ Postgres (RLS)
(Hindi toggle, UPI)         auth middleware)       + Razorpay      │   Realtime
                                                   Rule engine     │   Storage
                                                   (pure fns)      │
                                                   AI layer        ┘
                                                   + Gemini API
```

Layout notes:
- The app layer is one funnel (Next.js Server Actions doing auth + routing), not four separate backend services.
- Only Ledger engine (Razorpay) and AI layer (Gemini) carry external dependencies. Fee engine and Rule engine are pure internal logic — two-thirds of the service layer has zero external API surface to audit, which matters directly for any judge/reviewer explainability question.
- Everything funnels through one Postgres instance. No separate AI-specific or payments-specific datastore. One source of truth is the entire point of the reconciliation requirement — introducing a second datastore anywhere would reintroduce the batch-sync problem this product exists to solve.

## Monorepo Package Structure

```
smart-fee-platform/
├── apps/
│   └── web/          → Next.js app (admin + parent UI, Server Actions, API routes)
│                        also owns push-notification send calls — see note below on why this lives here, not in packages/rules or packages/ai
├── packages/
│   ├── db/             → Prisma schema, migrations, generated client
│   ├── ai/              → Gemini prompt templates + calling logic for all 7 AI features (added Phase 9: Copilot function-calling, Weekly Digest — was 5)
│   ├── payments/        → Razorpay sandbox integration, webhook handlers
│   └── rules/           → Defaulter risk scoring, anomaly detection, reminder-trigger logic
```

`packages/rules` is deliberately isolated from `packages/ai` — this is the physical embodiment of "rules decide, AI narrates" (Governing Principle #1). Anyone inspecting `packages/rules` should see every money-affecting decision with zero API dependency in the code path.

**Student Directory and Reports & Export (added Phase 14)** live in `apps/web` server actions, backed by `packages/db` for schema and `packages/rules` for the aggregation formulas `generateReconciliationReport` reuses (the same `packages/rules` functions `getLedgerSnapshot` and `generateWeeklyDigest` already call — no new package, no duplicated aggregation logic). Neither feature touches `packages/ai` — the report's export step was deliberately not given a Gemini-narrated summary (see `decision_log.md` Phase 14), so the "7 AI features" count in this section's own heading remains accurate and unchanged.

**Push notifications are dispatched from the Server Action orchestration layer in `apps/web`, never from inside `packages/rules` or `packages/payments` (added Phase 9).** A rule engine function decides an anomaly is real, or a payment engine function decides a transaction posted — the calling Server Action, after that decision already succeeded and committed, is what fires the push send as a separate, best-effort step. This preserves the "zero external API dependency" purity of `packages/rules` that Governing Principle #1 depends on — the rule engine still can't be broken by an external service being down, because it never touches one.

---

## Integration Contracts

### Razorpay (UPI, sandbox only)

- `initiateUpiSandboxPayment` creates a sandbox order.
- `handleRazorpayWebhook` is the **only** consumer of Razorpay's async response.
- **Idempotency (mandatory)**: before inserting a `TRANSACTION`, check for an existing row with the same `ref_number`. Webhook delivery can duplicate; a duplicate delivery must return the existing record, never insert a second one. This is a financial-correctness requirement, not a nice-to-have.
- **Failure modes**:
  - Webhook signature verification failure → reject and log; do not post a transaction.
  - Webhook timeout/non-delivery → the payment may exist in Razorpay but never reach the ledger. **Revised Phase 8**: an *automatic* polling-based reconciliation fallback remains a Future Extension, not required now — but a *manual* recovery path (`reconcileMissedUpiPayment`, see `api_specification.md`) is now built, so this is no longer a gap with zero recovery option, only a gap with no automatic recovery. Do not silently assume webhooks always arrive; do not assume an admin has no way to fix it when they don't.
- Sandbox mode only — no live KYC/PCI integration. This is a hard constraint, not a temporary shortcut.

### Gemini API (7 AI features, updated Phase 9: defaulter insight narration, dashboard NL query, anomaly narration, reminder drafting, OCR field extraction, Copilot function-calling, weekly digest generation)

- **Hard failure rule**: a failed, slow, rate-limited, or malformed Gemini response must never block or corrupt a money-affecting write. Concretely:
  - `detectAnomaly` (rule-based) runs synchronously inside the payment write and always completes.
  - `narrateAnomaly` and `narrateDefaulterInsight` (Gemini) run **after** the payment/query response has already returned — asynchronous, best-effort. If narration fails, the UI falls back to the raw rule-engine reason string (e.g., `flag_reason`), never blocks or shows an error state for the underlying data.
  - `draftReminderText` and `processOcrUpload` are inherently non-critical-path (they produce staged/logged content, not direct ledger writes), so ordinary error handling (retry, show error, allow manual retry) is sufficient.
  - `copilotQuery` and `generateWeeklyDigest` (added Phase 9) are pure read/narration paths by construction — see Copilot Architecture below — so this hard failure rule is structurally satisfied for them (there is no write for a failure to corrupt), not just followed by convention.
- Server-side only, paid tier — never called from a client component, key never present in client bundle.
- **Demo-day quota risk (added Phase 9)**: external commentary on AI-heavy hackathon builds specifically flags that live demos calling large commercial APIs can hit rate limits or cost caps at the worst possible moment. This system's non-blocking design already prevents a Gemini failure from breaking correctness — but "degrades gracefully" and "rehearsed as a fallback" are different guarantees. See `implementation_plan.md` Session 6 for the specific rehearsal step this requires (a pre-confirmed fallback narration example, tested by deliberately simulating a Gemini failure before the actual demo, not discovered live).

### Email Reminder (Resend) *(added Phase 15)*

- **Purpose**: the one narrow, real (non-simulated) delivery channel in the reminder-notification system — see `business_rules.md` Email Reminder Escalation for the full rationale (push notifications structurally under-reach the parents most behind on fees).
- **Trigger**: exclusively `markReminderSent` (see `api_specification.md`), for `REMINDER_LOG` rows on the `email` channel. No other code path may call Resend — there is no "send now" bulk action, no automatic dispatch from the daily reminder-trigger job, and no path that bypasses the admin's explicit review of the drafted text first.
- **Non-blocking**: the email dispatch happens after `REMINDER_LOG.status` has already been read/updated in the same call — same ordering discipline as every Gemini narration call and push notification in this system (NFR-2). A slow or failed Resend call must never leave the admin's "mark sent" click hanging or in an ambiguous state; the UI reflects `sent`/`failed` once the dispatch resolves, asynchronously.
- **Failure handling**: `failed` status with `dispatch_error` populated (see `database_design.md` `REMINDER_LOG`) — never silently retried, never presented as delivered when it wasn't.
- **Server-side only**: called exclusively from the `markReminderSent` Server Action, same access pattern as Razorpay and Gemini — see `security.md` Secrets Management.

---

## PWA & Push Notifications *(added Phase 9)*

**Why now, not from the start**: the original scope was a responsive web app; installability and push were out of scope by omission, not by a considered decision. Both are now added because they're cheap relative to their payoff — a few hours of Next.js-native work, not a new subsystem — and because push notifications directly visualize the product's core "zero reconciliation lag" claim in a way a live demo audience actually notices, more effectively than the dashboard number updating silently.

**PWA**: `manifest.json` (app name, icons generated from the existing app icon, `theme_color` set to `--color-bg-base` from `design_system.md` so the OS chrome matches the app itself, `display: standalone`) plus a service worker for install support, push receipt, and (added Phase 10) offline payment sync. **Offline behavior is scoped narrowly and deliberately, not full offline-first sync**: this product's entire value proposition is *zero-lag, always-current* data, so a service worker that aggressively caches *ledger/dashboard* data for offline viewing would work against that claim — that part of the original Phase 9 decision stands unchanged. What's added in Phase 10 is different in kind: offline *write* (recording a new cash/cheque payment while disconnected), not offline *read* of already-existing data. The two are not in tension — one risks showing stale numbers as current, the other explicitly never does (see Offline Payment Queue below). The service worker caches static assets and hosts the offline payment queue's Background Sync registration; if a request for *live dashboard/ledger* data fails while offline, the UI still shows a "you're offline — last synced at [time]" banner over the last-fetched data, unchanged from Phase 9. Android/desktop Chrome show the install prompt automatically; iOS Safari (16.4+, required for push) has no native install prompt, so the UI must show an explicit "Add to Home Screen" instruction banner on iOS Safari specifically, detected via user-agent.

**Push notifications**: uses the browser Push API with a self-generated VAPID key pair (`web-push` npm package, `webpush.generateVAPIDKeys()` — run once, stored as `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` env vars alongside existing secrets). No third-party messaging provider, no per-message cost, no separate paid API key — this is a materially different integration from the explicitly-out-of-scope WhatsApp/SMS/email path in `business_rules.md` Governing Principle 3; see that document's Push Notification Strategy section for the full distinction and the exact trigger events. `PUSH_SUBSCRIPTION` rows (see `database_design.md`) are RLS-scoped to their owning user, same as every other user-linked table.

---

## Offline Payment Queue *(added Phase 10)*

**Why this is architecturally distinct from the Phase 9 offline/PWA work above, not an extension of it**: Phase 9's offline handling is about *reading* already-synced data gracefully when the network drops. This is about *writing* new, not-yet-validated data while disconnected — a fundamentally different problem, since a write can conflict with server state in a way a stale read never can. Treating them as the same problem would have been the easiest way to get this wrong.

- **Local storage**: browser IndexedDB, written directly from the cash/cheque entry form already built in Session 2 — no new form, the existing form gains an offline-capable write path. Each entry gets a client-generated `local_id` (UUID) at creation time, the idempotency anchor for the entire flow.
- **Sync trigger**: the service worker's Background Sync API registers a sync attempt automatically when connectivity returns, on browsers that support it. **iOS Safari does not reliably support Background Sync**, and iOS is an explicit PWA target for this project (see Phase 9) — so a visible, manual "Sync Now" action in the UI is not a fallback for an edge case, it's a required primary path for a meaningful fraction of the target install base, not an afterthought.
- **Sync execution**: each queued entry calls `syncOfflinePayment`, which internally calls the exact same `recordPayment` function every other channel uses — same row-level lock, same overpayment check (`financial_engine.md` §1). No parallel, offline-specific posting logic exists; the offline queue is a *deferred call* to the same function, not a different function.
- **Conflict escalation**: if `recordPayment` would now reject the entry (balance changed while offline), the client calls `reportSyncConflict`, which writes a school-visible `OFFLINE_SYNC_CONFLICT` row (see `database_design.md` — deliberately not device- or user-scoped) and triggers an admin push notification (see Push Notification Strategy trigger list). The entry is never silently dropped and never auto-adjusted to fit the new balance.
- **Dashboard truth**: `getLedgerSnapshot` and every other aggregate query only ever reads `posted` `TRANSACTION` rows — a queued-but-unsynced offline entry doesn't exist in that table yet, so this requires no special-case filtering logic to keep it out of "collected today." It's excluded by construction, the same way a bounced cheque's reversed transaction is excluded from `amount_paid` per the existing derivation logic (`financial_engine.md` §1).

---

## Client State Management *(added Phase 15 — see `decision_log.md` Phase 15)*

**The gap this closes**: every screen showing financial data was previously specified only as "must bind to a live query, never mock data" (`ui_ux_specification.md` Global Requirements) — correct about *what* renders, silent on *how* loading/stale/conflict states are represented. This system already has two states that must never be conflated with "showing current data" — a dropped Realtime connection, and a queued-but-unsynced offline entry (Governing Principle 5) — and leaving each screen free to invent its own ad hoc handling was a real risk of one of those two states silently reading as "synced" somewhere.

**TanStack Query (React Query) v5** wraps every Supabase Realtime subscription and every server action call used by a financial-data screen. Every such screen must derive its render state from exactly one of five values, never a generic loading/error/data pair and never a component-invented equivalent:

```
idle -> loading -> synced | stale | conflict
```

- **`idle`**: query not yet initiated (component not yet mounted, or waiting on a prerequisite like a selected date range).
- **`loading`**: initial fetch in flight, no data yet to show.
- **`synced`**: data reflects the current server state, Realtime connection live — the only state a number may render in without a qualifying visual treatment.
- **`stale`**: data was received but a newer sync/update is pending confirmation — this is not a new concept, it formalizes the existing "Realtime connection dropped" indicator (`ui_ux_specification.md` ADMIN — Dashboard edge case) and the existing offline "last synced at [time]" banner (FR-27) into one consistent state instead of two independently-implemented ones.
- **`conflict`**: an offline entry exists that has not been reconciled against the server state — this formalizes the existing `OFFLINE_SYNC_CONFLICT` concept (Offline Payment Queue, above) as a first-class render state rather than a screen-specific special case. Per Governing Principle 5, a `conflict`-state entry must never render with the same visual treatment as `synced` data, on any screen.
- **No component may invent its own ad hoc loading/error handling outside this five-value union.** This is a hard requirement for every dashboard, ledger, and reconciliation screen (Dashboard, Ledger, Defaulter Tracking, Student Profile, Offline Sync Queue, Reports & Export) — not a suggestion left to per-component judgment.
- **No new business logic changes as a result of this section.** `stale` and `conflict` don't mean anything different than they already meant in the documents referenced above — this section exists to mandate one consistent rendering contract for concepts that already existed, not to introduce new ones.

---

## Parent Authentication *(redesigned Phase 11 — was magic-link email only)*

**No custom OTP infrastructure — this is entirely Supabase Auth's native phone/email OTP support, configured, not built.** No custom server action generates, stores, or validates an OTP code anywhere in this system; that logic lives inside Supabase Auth itself. This project's own code is limited to: configuring Twilio as the phone provider in Supabase's dashboard, calling `supabase.auth.signInWithOtp({ phone })` / `verifyOtp()` directly from the client (same pattern for the email fallback), and — critically — the account-provisioning action (`createParentAccount`, see `api_specification.md`) that must exist before any OTP can succeed for a given phone/email.

- **`shouldCreateUser: false` is mandatory on every OTP call, both channels.** Left at Supabase's default, `signInWithOtp` silently provisions a new account for an unrecognized phone/email — that default directly contradicts this system's no-self-registration principle (`business_rules.md` Parent Account & Login Strategy) and must be explicitly overridden, not assumed safe by omission.
- **Twilio is configured inside Supabase's own Auth provider settings, not called directly by this project's server actions.** The Next.js app never holds a Twilio credential or makes a Twilio API call itself — the Supabase JS SDK talks to Supabase's Auth server, which talks to Twilio. This keeps the "third-party API calls happen server-side only" principle intact in spirit (no credential exposure risk) even though the literal call pattern here is client-SDK-to-Supabase rather than client-to-Server-Action-to-third-party.
- **Demo/judge-facing accounts use Supabase's built-in Test OTP mapping** — a small set of phone numbers configured with fixed OTP codes, for which Supabase skips real SMS sending entirely. This is the SMS equivalent of Razorpay sandbox mode: the architecture is genuinely Twilio-integrated and production-shaped, but the numbers actually used in a live demo never touch real, DLT-regulated SMS delivery. Real Twilio delivery remains functional and testable for any number outside the test set; full DLT registration for production-scale SMS is a named Future Extension (see `business_rules.md` for why it's out of reach within this build's timeline).
- **Email OTP fallback requires no additional provider or credential** — Supabase's built-in email sending handles it at hackathon scale. Exists specifically so a single channel's delivery failure (Twilio hiccup, a phone number outside the test set) never fully blocks a login attempt.

---

## AI Copilot Architecture *(added Phase 9)*

Two copilot surfaces — Admin and Parent — both built on the same architectural pattern, not two separate systems:

- **Function-calling over a whitelisted tool set, never raw data access.** `copilotQuery(role, message, conversationHistory)` gives Gemini a fixed list of existing server actions it may call (per role — see below), described as tools in the function-calling sense. Gemini decides *which* whitelisted action(s) to call and *how to phrase the answer*; it never generates SQL, never receives direct database credentials, and never calls anything outside its role's whitelist. This is the same non-negotiable shape as the existing `answerDashboardQuery` — the Copilot generalizes that pattern into a persistent conversational tab rather than introducing a new one.
- **The whitelist is the actual security boundary, and it inherits RLS for free.** Every whitelisted tool is an existing action that already enforces `school_id`/`PARENT_LINK` scoping at the RLS layer. A parent's Copilot session cannot see another family's data — not because Gemini is instructed not to look, but because the only tools it can call already can't return that data to anything, Copilot included. An agent implementing this must not create new "copilot-only" data-access functions that bypass existing RLS-scoped actions — that would silently reopen exactly the isolation guarantee `security.md` spends most of its length establishing.
- **Whitelist contents, by role**:
  - **Admin**: `getLedgerSnapshot`, `getRemindersQueue`, `narrateAnomaly`, `narrateDefaulterInsight`, `generateWeeklyDigest`, and a doc-grounded `answerHowDoI(topic)` helper (retrieval over `user_flows.md`/`ui_ux_specification.md` content, not free-form generation about the product). **Explicitly excluded, permanently, not just for v1**: `recordPayment`, `applyWaiver`, `applyPenalty`, `markChequeBounced`, `reconcileMissedUpiPayment`, or any other write action. The Copilot may propose an action ("3 reminders look stale — want to open the queue?") and deep-link to the real screen; it must never execute one itself. This is the same audit-trail-native principle already applied to waivers/penalties elsewhere — a human performs the action, every time, no exceptions carved out for convenience.
  - **Parent**: `getMyChildrenDues`, `getMyPaymentHistory`, a GST explainer tool that reads the *already-stored* `gst_treatment`/rate/exemption text for a fee type (never lets Gemini freelance a tax determination — GST is the one area this system deliberately never makes its own legal call, per `business_rules.md` GST Logic, and the Copilot must not quietly reopen that restraint), and `answerHowDoI(topic)` scoped to parent-relevant topics only.
- **No persistent chat history storage (deliberate scope boundary).** Conversation state lives in client-side React state for the duration of the session only — not written to a database table. This avoids an unnecessary new PII-adjacent data store and matches the general principle of not building infrastructure beyond what a specific, evidenced use case requires. If conversation history across sessions becomes a real product need later, that's a Future Extension, not an oversight now.
- **Bilingual for free**: if a parent has the Hindi toggle (S-7) enabled, `copilotQuery` responds in Hindi for that session — this reuses the existing locale mechanism rather than introducing a second one.

---

## Authentication & Authorization

- **Authentication**: Supabase Auth. Admin — email/password. Parent — OTP, phone primary / email fallback, no password (redesigned Phase 11, was magic link — see Parent Authentication section above).
- **Authorization**: Row-Level Security at the Postgres layer is the actual enforcement mechanism, not application-layer filtering. See `security.md` for the full policy set. Two roles: `admin` (full access, `school_id`-scoped) and `parent` (read + limited write, scoped through `PARENT_LINK` to their own child(ren) only).
- No self-registration for either role in the current build — admin accounts are provisioned by a super-admin/seed process; parent accounts are provisioned by an admin creating the `PARENT_LINK`.

---

## Deployment Strategy

Design judgment, not research-mandated — flagged as such since the research document doesn't specify deployment infrastructure.

- **Environments — revised Phase 8**: single `production` environment remains acceptable **for the hackathon submission itself** — a 6-day build window doesn't justify environment-parity overhead at that scope, and this reasoning stands. However, this project is explicitly framed (see `README.md`, `project_overview.md`) as continuing into a full production product, and the original text filed environment separation alongside other Future Extensions of comparable priority (e.g., per-school Realtime scoping) — that grouping understated the risk. **Before any real production launch, a second Supabase project plus a Vercel preview environment is a hard blocker, not an optional Future Extension**: schema migrations, Razorpay webhook changes, and RLS policy edits must never be tested for the first time against an environment holding real fee data. This is the one item on the Future Extensions list below that should not be scheduled at the same priority as the others.
- **Secrets**: Supabase service role key, Razorpay sandbox keys, Gemini API key — stored as Vercel environment variables, never committed to the repository. No key may appear in any client-side bundle; all third-party calls happen inside Server Actions only.
- **Secrets rotation**: even though only one environment exists, a documented (can be manual) rotation procedure must exist for every credential — this is a direct lesson carried forward from a prior project where an exposed service account key required emergency rotation. Do not treat "store as env var" as sufficient on its own.
- **Migrations**: Prisma migrations applied manually before each deploy relevant to a schema change — not an automated CI/CD migration pipeline. Appropriate at this scale; revisit if the team or environment count grows.
- **Rollback**: Vercel's deployment history (redeploy a previous build) serves as the rollback mechanism — no custom tooling needed at this scale.
- **Hosting**: Vercel for the Next.js app; Supabase-hosted Postgres/Auth/Realtime/Storage.

---

## Scalability Considerations

Design judgment, not a hackathon-time concern in practice, but the architecture should support the full future product without rework, per the project's own instruction not to redesign for a smaller MVP:

- Postgres (Supabase) with proper foreign keys and indexes on `student_id`, `school_id`, `fee_assignment_id` scales to real school sizes (thousands of students) without schema changes.
- RLS-based multi-tenancy (`school_id` scoping on every table) means multi-school support is structurally already present — no re-architecture needed to onboard a second school, only data.
- Supabase Realtime is fine per-channel at MVP scale; at real scale, Realtime subscriptions should be scoped per-school rather than global — noted here as a Future Extension, not a current build task.
- **Named risk**: synchronous Gemini calls (even the async-after-write ones) would become a bottleneck at real transaction volume if left as direct calls. A queue-based async narration pattern is a Future Extension — flagged, not solved now, since current volume makes this invisible.

## Rate Limiting / Cost Control

Not addressed in research. **Revised Phase 8**: previously flagged as a gap with no assigned owner or session, filed alongside lower-stakes Future Extensions. It is now an in-scope Session 6 deliverable (see `implementation_plan.md`) — a simple per-admin-session rate limit on `processOcrUpload` and `answerDashboardQuery`, not deferred past the initial build. **Extended Phase 14**: `generateReconciliationReport` added to the same rate limit — an admin-facing action that can generate a potentially large export carries the same burst/cost-abuse risk as the two Gemini-backed endpoints already in scope here, even though it makes no external API call itself. At hackathon/early-production scale the realistic abuse risk remains low, but "low risk" was previously being used to justify "unscheduled," which this correction fixes.

## Assumptions

- Single school per deployment for MVP, though schema and RLS support multiple.
- Admin and parent both access via web browser only; no native mobile app in current scope.

## Future Extensions

**Corrected Phase 9** — this summary line previously still listed "rate limiting on AI-backed endpoints" and "staging environment" as undifferentiated Future Extensions after the body text above (Deployment Strategy, Rate Limiting / Cost Control) had already reclassified both during Phase 8 — the same class of log-vs-document drift caught and process-corrected in `decision_log.md` Phase 8. Corrected list: polling-based Razorpay reconciliation fallback, queue-based async AI narration, per-school Realtime channel scoping, automated CI migration pipeline, persistent Copilot conversation history (see `system_architecture.md` AI Copilot Architecture — deliberately not built now), automatic (vs. manual) push-notification retry backoff for transient delivery failures beyond the 404/410 delete-on-expiry case already specified.

Not Future Extensions, already in-scope per corrected Phase 8/9 text: rate limiting (Session 6, `implementation_plan.md`), a staging environment (hard blocker before real production, not deferred indefinitely).

## References

Tech stack and architectural choices trace to Phase 3 of this project's design process; integration failure-mode rules and secrets-rotation requirement were added during Phase 6 design review. See `decision_log.md` for the full history, including the two design-review fixes (webhook idempotency, async narration) that shaped the integration contracts above.
