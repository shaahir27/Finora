# Session Kickoff Prompts

Paste the relevant block to your AI coding agent when starting that session. Every prompt shares the same non-negotiables (Section A) — only Section B (session-specific scope) changes.

---

## Section A — identical in every prompt, do not shorten

```
Read docs/AI_INSTRUCTIONS.md in full before writing any code. It is the master
operating contract for this project and applies regardless of session.

Then read README.md's numbered reading order and the specification documents
relevant to the session below — cross-references between documents are
frequent and load-bearing, don't skip files docs/AI_INSTRUCTIONS.md or
README.md point you to.

Six non-negotiable governing principles apply across the entire system
(full list in docs/project_overview.md, "Governing Principles"). If any of
these ever seems to be in tension with speed or convenience, stop and flag
it rather than working around it:

1. Rules decide, AI narrates — AI is never in the write path of a payment.
2. Every override (waiver, penalty, cheque bounce, sync-conflict resolution)
   requires a non-empty reason and is permanently audit-logged.
3. No real WhatsApp/SMS/email delivery for the reminder-notification system
   specifically (push notifications and OTP login are different systems and
   are not exceptions to this — see docs/business_rules.md if unsure).
4. Row-Level Security in Postgres is the real access boundary, not the UI.
5. A queued-but-unsynced offline payment is never shown as posted, anywhere,
   until the server confirms it. Sync conflicts escalate for human review,
   never auto-resolve.
6. No self-registration, ever — every OTP call must pass
   shouldCreateUser: false.

Never invent a database table, column, or API not in docs/database_design.md
or docs/api_specification.md. Never rename an existing one. If you believe
something is missing from the spec, flag it — don't add it silently.

This session is not complete until: (a) its checkpoint in
docs/implementation_plan.md passes, (b) the automated tests for this session
in docs/testing_strategy.md pass, and (c) every feature built has a log in
build_history/ per docs/BUILD_LOGGING_PROTOCOL.md, using
docs/templates/log_schema.md. All three, not just one.

If any two documents in docs/ appear to contradict each other, check
docs/decision_log.md before resolving it yourself.

Confirm you've read the above and state your understanding of this
session's scope before writing any code.
```

---

## Section B — session-specific, append to Section A

### Session 1 — Member 1 (Team Lead)

```
SESSION 1 — Ledger Core (Fee Engine + Ledger Engine, No UI Polish)

Read in full: project_overview.md, product_requirements.md, business_rules.md,
database_design.md, api_specification.md, financial_engine.md,
system_architecture.md, implementation_plan.md Session 1.

Build: the fee engine (create/modify/remove any fee type), the transaction
model, waiver/penalty handling with mandatory audit-log entries, and the
core reconciliation math per financial_engine.md. No UI polish this session —
functional correctness and the audit trail are the entire point.

You are the only one working right now — nothing else in this project can
start until this session and Session 2 are both merged to main. Get the
schema and the audit-trail discipline right the first time; every other
session builds directly on top of what you create here without revisiting it.

Branch: feature/ledger-core
```

### Session 2 — Member 1 (Team Lead)

```
SESSION 2 — Razorpay Sandbox + Reconciliation State Machine

Read in full: implementation_plan.md Session 2, system_architecture.md
(Integration Contracts — Razorpay), financial_engine.md §4 (reconciliation
matching — note the off-by-one trap named explicitly there), business_rules.md
Offline Payment Entry Strategy (this session builds the offline queue's
WRITE path only — sync happens in Session 3, don't build that part yet),
testing_strategy.md Session 2.

Build: Razorpay sandbox UPI integration with webhook idempotency, the
cheque_pending/posted/flagged/reversed state machine, rule-based anomaly
detection (packages/rules — zero external API calls in this code path,
by design), and the offline cash/cheque entry form's local IndexedDB write
(queued state only — no sync logic in this session).

This is the session Members 2, 3, and 4 are all waiting on. Once this merges,
three people start work simultaneously against what you've built — treat
the checkpoint and tests in testing_strategy.md as the actual gate they are,
not a formality.

Branch: feature/reconciliation
```

### Session 3 — Member 3

```
SESSION 3 — Glassmorphism Admin Dashboard, PWA + Admin Push, Offline Sync

Read in full: ui_ux_specification.md (ADMIN screens), design_system.md,
system_architecture.md (PWA & Push Notifications, Offline Payment Queue),
database_design.md (PUSH_SUBSCRIPTION), api_specification.md (Push
Notifications, Offline Payment Sync), business_rules.md (Push Notification
Strategy), implementation_plan.md Session 3, testing_strategy.md Session 3.

Build: the live admin dashboard wired to real backend data (no mock numbers,
ever), PWA setup (manifest, service worker, iOS install banner), push
notification infrastructure and the admin-side triggers, and the offline
sync execution (Background Sync + manual "Sync Now") that completes what
Session 2 started — the conflict-escalation path matters more than the
happy path here, per the checkpoint.

Sanctioned cross-session touch: you will wire push-notification calls into
Session 2's recordPayment/markChequeBounced/detectAnomaly code. This is
expected — see docs/AI_INSTRUCTIONS.md Section 5, not a violation of
"don't modify other sessions' modules."

Coordinate with Member 2 (Session 4) on the admin app shell/navigation —
you're both adding routes to it independently; check in before either of
you touches the shared nav component.

Branch: feature/admin-dashboard
```

### Session 4 — Member 2

```
SESSION 4 — AI Layer (7 Features), Admin Copilot, Weekly Digest

Read in full: api_specification.md (AI Layer, Offline Payment Sync section
NOT needed), system_architecture.md (Gemini integration contract, AI Copilot
Architecture), security.md (AI Copilot section), implementation_plan.md
Session 4, testing_strategy.md Session 4.

Build: all seven AI features — the five narration/drafting/OCR features plus
the weekly digest and the Admin Copilot. The Copilot is function-calling over
a fixed whitelist of existing, already-permission-scoped actions — never raw
database access, never a write action in the whitelist, under any framing.
Write the whitelist as an explicit, greppable array — Session 5 needs to find
and extend it cleanly with the Parent whitelist later, and your own tests
this session should assert against that array directly, not just test one
example conversation.

Every AI call in this session must be non-blocking relative to any
payment-critical write — narration happens after the write already
succeeded, never before or during.

Coordinate with Member 3 (Session 3) on the admin app shell/navigation —
you're both adding routes to it independently.

Branch: feature/ai-copilot
```

### Session 5 — Member 4

```
SESSION 5 — Parent Portal + Hindi Toggle, Parent Push + Parent Copilot,
Parent OTP Login

Read in full: ui_ux_specification.md (PARENT screens, ADMIN — Add Parent),
security.md (Parent Authentication), business_rules.md (Parent Account &
Login Strategy), database_design.md (USER.phone, PARENT_LINK),
api_specification.md (Parent Account Management, Parent-Facing Actions),
system_architecture.md (Parent Authentication section), implementation_plan.md
Session 5, testing_strategy.md Session 5.

Build order matters this session — sequence it this way, not in the order
features are listed in the spec:
1. Core parent portal first: createParentAccount (admin-side), OTP login
   (phone primary via Twilio + Supabase Auth, email fallback — both calls
   MUST pass shouldCreateUser: false), dues, payment, history, receipts,
   Hindi toggle. This only depends on Sessions 1+2 and can start immediately.
2. Parent push toggle LAST — this extends Member 3's PUSH_SUBSCRIPTION table
   and sendPushNotification function from Session 3. Don't start this until
   Session 3 has that function committed.
3. Parent Copilot LAST — this extends Member 2's copilotQuery function from
   Session 4 with a Parent whitelist. Don't start this until Session 4 has
   that function committed. The single most important test here: attempt an
   OTP request against a phone/email that was never provisioned via
   createParentAccount, and confirm it fails cleanly rather than silently
   creating an account.

If Sessions 3 or 4 are running behind when you reach steps 2 or 3, work on
something else in your own scope and come back — don't guess at their
function signatures.

Branch: feature/parent-portal
```

### Session 6 — Member 4

```
SESSION 6 — Differentiators, Receipts, Reminders, Rate Limiting, Polish,
Demo Rehearsal

DO NOT START THIS SESSION until Sessions 3, 4, and 5 are all merged to main —
confirm this before reading further, not just "my own Session 5 is done."

Read in full: implementation_plan.md Session 6, testing_strategy.md Session 6,
financial_engine.md §5 (GST — for receipts), system_architecture.md Rate
Limiting / Cost Control.

Build: PDF receipts (A4 + thermal, with correct GST fields), the reminders
queue UI, the EMI "Coming Soon" stub, and rate limiting wrapped around
Member 2's processOcrUpload and answerDashboardQuery from Session 4 —
sanctioned cross-session touch, see docs/AI_INSTRUCTIONS.md Section 5.

Reserve real time at the end for the full demo rehearsal: cash + UPI +
cheque all posting to one live ledger, run at least twice on the actual
presentation device. Also deliberately simulate a Gemini failure (bad API
key or throttled network) for each of the seven AI features and confirm
each degrades the way its spec says it should — this is checking the
non-blocking design holds under a real failure, not just reading correctly
in the code.

Branch: feature/polish-demo (open this branch only after 3/4/5 are merged)
```
