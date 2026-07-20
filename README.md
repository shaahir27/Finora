# Smart School FinTech Platform — Documentation

## What This Is

A production-ready digital fee management system for schools, originally scoped for the PaperBuddy EduHack "Hack the Web" Smart School FinTech track, designed to continue as a full production product beyond the hackathon. It replaces spreadsheets, paper receipts, and manual bank reconciliation with a single live ledger — every fee, payment (UPI/cash/cheque), waiver, and penalty tracked and reconciled in real time — paired with a risk-segmented defaulter view and a parent-facing payment portal.

## Source of Truth

Every design decision in this documentation set traces back to the *Smart School FinTech — Consolidated Research Report (v2, Audited)*, treated throughout the design process as the sole source of truth for market context, problem framing, and hackathon requirements. Where a decision was design judgment rather than research-mandated (e.g., deployment strategy, exact risk-scoring thresholds), it is explicitly flagged as such in the relevant document.

## How to Read This Documentation Set

**If you are an AI coding agent, read `AI_INSTRUCTIONS.md` first, in full, before anything below.** It's the master operating contract — hard boundaries, cross-session rules, code standards — and applies regardless of which session you've been assigned. The numbered list below is the deep-dive knowledge base you read after that, and mostly only the parts relevant to your assigned session (though `project_overview.md`, `business_rules.md`, and `decision_log.md` are worth reading in full regardless of assignment, since the governing principles and cross-cutting rules in those three apply everywhere).

Read in this order for first-time onboarding to the project:

1. **`project_overview.md`** — what the system is, why it exists, the six non-negotiable governing principles that apply across every module.
2. **`product_requirements.md`** — full feature tiering (Must/Should/Nice/Future/Out-of-Scope) and functional/non-functional requirements.
3. **`business_rules.md`** — every money-affecting rule: fee engine, reconciliation, waivers, defaulter scoring, reminders, anomaly detection, GST.
4. **`system_architecture.md`** — tech stack, module boundaries, integration contracts, deployment, scalability.
5. **`database_design.md`** — schema, entities, relationships, schema-enforced constraints.
6. **`api_specification.md`** — every server action/API contract, grouped by module.
7. **`financial_engine.md`** — calculation mechanics and state machines underlying the business rules.
8. **`security.md`** — authentication, Row-Level Security policy, secrets handling.
9. **`user_flows.md`** — six core end-to-end workflows tying the above together.
10. **`ui_ux_specification.md`** — every screen, both roles, required elements and edge cases.
11. **`design_system.md`** — visual tokens, typography, component treatment. Color palette (Forest Ledger, Option A) is final and locked — build against the hex values in that document directly, not semantic placeholders.
12. **`implementation_plan.md`** — six-session build sequence with checkpoints.
13. **`testing_strategy.md`** — automated test targets per session, added Phase 8 to close a gap the original design phase left open (see `decision_log.md` Phase 8). Read alongside `implementation_plan.md` — each session's checkpoint is not complete until this document's tests for that session also pass.
14. **`decision_log.md`** — full history of decisions, reversals, and open items. **Consult this first if any two documents appear to disagree** — it is very likely a documented, deliberate revision.
15. **`BUILD_LOGGING_PROTOCOL.md`** — not a specification document like 1–14 above; governs how you document your own work in `build_history/` as you build. Read this once before Session 1. `templates/log_schema.md` (in the same folder) is the exact template it requires you to use for every feature log.
16. **`AI_INSTRUCTIONS.md`** — see the note above; read this before 1–15, not after. Listed last here only because it's the master contract, not a knowledge-base document — it doesn't fit the same "read in dependency order" logic as 1–14.

For the reasoning behind any "added Phase N" or "revised Phase N" annotation throughout these documents, see the corresponding entry in `decision_log.md` — it's the full, permanent record of every remediation and feature addition, kept as a single running history rather than split across separate files.

## For AI Coding Agents

This documentation set is written specifically to minimize ambiguity for AI-agent-driven implementation:

- Every document states its **Purpose, Scope, and References** — use References to trace any requirement back to its origin (the research document or a specific project decision) rather than assuming intent.
- **`decision_log.md` is the tiebreaker.** If a spec in one document seems to conflict with another, check the log before resolving the conflict yourself — the more recent, explicitly-reasoned decision is authoritative.
- **No open items remain in the design phase.** Two items were previously tracked as open and are now both resolved: the color palette (`design_system.md` — Forest Ledger, Option A, fully specified with verified WCAG contrast ratios, final) and the GST-inclusive-vs-exclusive calculation convention (`financial_engine.md` §5, `business_rules.md` §8 — GST-inclusive, fully specified). A documentation-sync defect previously left stale "not yet decided" language in `financial_engine.md` §5 and stale "deferred to product owner" language referring to the palette in this file, `decision_log.md`, and `implementation_plan.md` — all four have been corrected to match the actual decided state as of Phase 8 (Design Audit Remediation). See `decision_log.md` Phase 8 for the full correction record. **Phase 10 note**: offline payment entry (M-7, `product_requirements.md`) is fully designed and documented, not an open item — but it's worth knowing it's the one Must-Have requirement sourced directly from the official brief text rather than research/design judgment, which is why it's called out specifically rather than blended into the Phase 9 additions around it.
- Six non-negotiable governing principles apply across the entire system (full list in `project_overview.md`) — the most consequential for implementation: **AI (Gemini) never makes a money-affecting decision, only narrates or drafts**, and every AI call must be non-blocking relative to any payment-critical write. **This principle extends to the Copilot (added Phase 9) without exception**: its whitelist of callable actions contains zero write paths for either role — see `system_architecture.md` AI Copilot Architecture. **A parallel principle governs offline entry (added Phase 10)**: a queued-but-unsynced payment is never presented as posted, anywhere, under any circumstance — see `business_rules.md` Offline Payment Entry Strategy. **A fourth, equally non-negotiable principle governs parent login (added Phase 11)**: no self-registration, ever — every OTP call must pass `shouldCreateUser: false`, or an unrecognized phone/email silently gets a brand-new account instead of a clear error. See `business_rules.md` Parent Account & Login Strategy.
- **Read `docs/BUILD_LOGGING_PROTOCOL.md` before starting Session 1, in addition to everything above.** It governs a separate directory, `build_history/` (project root, alongside `docs/` — not inside it), where you document what you actually built, session by session, as you go. This is distinct from everything else in `docs/`: `docs/` is the specification, decided before any code existed; `build_history/` is the construction record, written by you as work happens. A session is not complete — per that protocol's own Definition of Done — until its features are logged and its checkpoint and tests both pass, not just one or the other.

## Build Sequence

See `implementation_plan.md` for the full six-session breakdown. Summary: Session 1 (ledger core, **student directory `createStudent`/`bulkImportStudents` — Phase 14**, **`updateStudentStatus` student lifecycle — Phase 15**) → Session 2 (payments + reconciliation state machine, **offline queue write path — Phase 10**) → Session 3 (dashboard, wired to real data, **PWA + admin push notifications, offline sync + conflict resolution — Phase 9/10**, **Student Directory + Student Profile screens — Phase 14**, **TanStack Query / five-state client rendering — Phase 15**) → Session 4 (AI layer — 7 features as of Phase 9, **admin Copilot + weekly digest**) → Session 5 (parent portal, **parent push + parent Copilot — Phase 9, phone/email OTP login — Phase 11**) → Session 6 (receipts, reminders UI, rate limiting, demo rehearsal, **Reports & Export — Phase 14**, **email reminder escalation via Resend — Phase 15**).

## Technology Stack

Next.js 15 (App Router) + TypeScript · Supabase (Postgres, Auth, RLS, Realtime, Storage) · Prisma ORM · Tailwind + shadcn/ui · Recharts · Gemini API (server-side) · Razorpay (sandbox only) · Monorepo · Vercel · **`web-push` (self-generated VAPID keys) + native PWA support — added Phase 9** · **Twilio, as Supabase Auth's phone-OTP provider — added Phase 11** · **TanStack Query v5, wrapping every Realtime subscription and server action call — added Phase 15** · **Resend, for the one real (non-simulated) reminder-delivery channel — added Phase 15**.

## Project Structure

```
/
├── README.md                 → this file
├── docs/                     → specification (read-only during build — see AI_INSTRUCTIONS.md)
│   ├── AI_INSTRUCTIONS.md
│   ├── BUILD_LOGGING_PROTOCOL.md
│   ├── templates/log_schema.md
│   └── *.md                  → the 15 specification documents listed above
├── build_history/            → construction record, written by agents as they build
│   ├── index.md
│   └── session_01_ledger_core/ ... session_06_polish_demo/
├── src/                      → application code
├── prisma/                   → schema + migrations
└── components/               → shared UI components
```

## Development Workflow

1. Clone the repository.
2. Read `docs/AI_INSTRUCTIONS.md`, then the specification documents relevant to your assigned session.
3. Check out your feature branch (see Git Workflow below — one branch per session, not per person).
4. Let your AI coding agent read the documentation before it writes anything.
5. Implement your assigned session, per `implementation_plan.md`.
6. Verify your session's checkpoint and its tests in `testing_strategy.md` both pass, and its `build_history/` log is complete — all three are part of that session's definition of done, not separate steps.
7. Push your branch.
8. Open a Pull Request.
9. Team Lead reviews and merges into `main`.

## Team Distribution

Four members, six sessions, matching `implementation_plan.md` exactly — no session content changes, only who builds what and in what order.

**Member 1 (Team Lead) — Sessions 1 & 2**
Project setup, database, Prisma, the ledger engine, financial engine, payment engine, Razorpay integration, reconciliation state machine, API contracts, GitHub management, final review and merge for every PR. **Student Directory server actions and `updateStudentStatus` (added Phase 14, Phase 15) also belong here — see Feature Ownership below.**

**Member 2 — Session 4**
Gemini integration, the five original AI features, the Admin Copilot (including the shared `copilotQuery` function and its Admin whitelist — see the note below on why this is a shared, not solely-owned, piece), OCR, weekly digest.

**Member 3 — Session 3**
Admin dashboard, analytics, charts, real-time wiring, push notification infrastructure (`PUSH_SUBSCRIPTION`, `sendPushNotification`, admin-side triggers), offline sync UI, PWA setup. **Student Directory (Roster) and Student Profile screens, plus the TanStack Query / five-state rendering setup every later session's UI builds on (added Phase 14, Phase 15) — see Feature Ownership below.**

**Member 4 — Session 5, then Session 6 once Sessions 3 and 4 are both merged (see Development Order below — this is a real change from a straightforward "Member 4 does 5 then 6")**
Parent portal, parent dashboard, parent payments, OTP login (Twilio + Supabase Auth setup), the Parent Copilot whitelist (extending Member 2's `copilotQuery`, not a new function), PDF receipts, testing, bug fixing, demo preparation, final polish. **Reports & Export and the Resend-based email reminder escalation (added Phase 14, Phase 15) also land in this member's Session 6 — see Feature Ownership below.**

## Development Order

**Phase 1 — Sequential, Member 1 only.** Session 1, then Session 2. Nothing else starts until Session 2 is merged to `main`. At that point the project has a complete, stable backend: database, ledger engine, financial engine, payment engine, Razorpay, reconciliation, and every API these depend on. No frontend or AI work needs mock data for its *core* scope from this point on.

**Phase 2 — Parallel, Members 2, 3, and 4 (core scope only).** Sessions 3, 4, and the *core* of Session 5 (parent portal, OTP login, dues, payments, history, Hindi toggle) all build directly against the real Session 1+2 backend, independently, at the same time.

**Within Phase 2, sequence your own session's work to protect two soft dependencies that the "everything is parallel now" framing understates:**
- The Parent Copilot piece of Session 5 extends Member 2's `copilotQuery` function — it can't be started until that function exists (Session 4, not necessarily finished, but at least that specific function committed). Member 4 should build the core parent portal first and the Copilot piece last, by which point Member 2 will typically have it ready.
- The parent push toggle piece of Session 5 extends Member 3's `PUSH_SUBSCRIPTION` table and `sendPushNotification` function — same pattern, same reason, same fix: build it last within your own Session 5 work, not first.

**Phase 3 — Integration, Member 4, after Sessions 3, 4, and 5 are all merged to `main`.** This is Session 6, and it is not simply "whatever Member 4 does after finishing Session 5" — it requires Member 2's Session 4 (`processOcrUpload`/`answerDashboardQuery`, which Session 6 wraps with rate limiting) and Member 3's Session 3 to both be merged first, because the demo rehearsal step is an end-to-end test of the whole system, not just the parent portal. Don't start Session 6 until all three of Sessions 3, 4, and 5 show up in `main`.

## Git Workflow

One branch per session — six branches, not four — since two sessions crammed onto one branch (Member 1's 1+2, Member 4's 5+6) produces a much larger, harder-to-review PR than the checkpoint-gated session structure in `implementation_plan.md` already assumes:

```
main
feature/ledger-core         (Session 1, Member 1)
feature/reconciliation      (Session 2, Member 1)
feature/admin-dashboard     (Session 3, Member 3)
feature/ai-copilot          (Session 4, Member 2)
feature/parent-portal       (Session 5, Member 4)
feature/polish-demo         (Session 6, Member 4 — opened only once 3/4/5 are merged)
```

Workflow:
1. Pull latest `main`.
2. Create your session's feature branch.
3. Develop only your assigned session's scope, plus the sanctioned cross-session touches in `AI_INSTRUCTIONS.md` Section 5.
4. Commit frequently, small focused commits.
5. Push the branch.
6. Open a Pull Request.
7. Team Lead reviews.
8. Merge into `main`.

Never push directly to `main`.

## Merge Conflict Strategy

Two different problems, easy to conflate:

**Git conflict** — two people edited the same lines of the same file. Git flags this automatically; your AI agent can usually help resolve it once told which version is correct per `docs/`.

**Integration conflict** — the merge succeeds cleanly, but the modules don't actually work together, because an assumption one session made doesn't hold once another session's code is also present. This project has specific, known integration points where this risk is real, not theoretical — the sanctioned cross-session touches in `AI_INSTRUCTIONS.md` Section 5 (push triggers wired into Session 2, the shared `copilotQuery` function, rate limiting wrapping Session 4, **the Student Directory/Profile screens wired to Session 1's actions, rate limiting wrapping `generateReconciliationReport` — both added Phase 14**) are exactly the spots to check first if something merges cleanly but behaves wrong. A second, subtler integration point: Member 2 (Session 4, OCR upload screen) and Member 3 (Session 3, dashboard shell/navigation) are both adding routes to the same admin app shell — this can be a literal Git conflict (if both edit the same navigation file) or a silent integration conflict (if both merge cleanly but the nav ends up with a broken or duplicate entry). Coordinate this specific handoff directly rather than assuming Git will catch it.

AI may assist in resolving Git conflicts. Every merge must still be reviewed and tested by the Team Lead — especially anything touching the ledger, payments, financial engine, or business rules, where a wrong resolution has real financial-correctness consequences, not just a broken UI.

## Feature Ownership

| Member | Owns |
|---|---|
| 1 | Backend, database, Prisma, ledger, payments, financial engine, APIs, **Student Directory server actions (`createStudent`/`bulkImportStudents`/`updateStudent`) — added Phase 14**, **`updateStudentStatus` (student lifecycle/exit) — added Phase 15** |
| 2 | Gemini, AI features, OCR, weekly digest, **the shared `copilotQuery` function + Admin whitelist** |
| 3 | Dashboard, analytics, charts, realtime UI, push notification infrastructure, PWA, **Student Directory (Roster) and Student Profile screens — added Phase 14, shares this session's data layer**, **TanStack Query / five-state client rendering setup — added Phase 15, foundational to this session's own screens** |
| 4 | Parent portal, OTP login, **the Parent whitelist added to Member 2's `copilotQuery`**, parent-side push toggle, receipts, testing, demo, **Reports & Export (`generateReconciliationReport`) — added Phase 14, same session as the rest of Session 6's polish work**, **Resend/`markReminderSent` email escalation — added Phase 15, completes the Reminders Queue this member already owns** |

Developers should avoid modifying modules owned by others — except the sanctioned cross-session touches listed in `AI_INSTRUCTIONS.md` Section 5, which are expected, not violations of this rule.

## Best Practices

- Read documentation before coding, every time — not just once at project start.
- Never assume undocumented behavior; ask instead.
- Never rename API response fields or database columns — other sessions depend on the exact names in `docs/`.
- Follow API contracts exactly, including error/edge-case behavior, not just the happy path.
- Keep commits small and focused.
- Test before pushing — your session's checkpoint and `testing_strategy.md` tests, not just "it looks right."
- Open Pull Requests; never push to `main` directly.
- Resolve merge conflicts before merging, and separately verify there isn't an integration conflict hiding behind a clean merge.
- Ask your AI agent to explain non-trivial changes before you accept them.
- Review AI-generated code before committing it — especially anything touching the sanctioned cross-session touches (six as of Phase 14, extended in scope but not in count by Phase 15 — see `AI_INSTRUCTIONS.md` Section 5), where a subtly wrong implementation is easy to merge without noticing.

## Status

Full design phase (MVP scoping → product design → system design → UI/UX → business intelligence → design review) complete and internally reviewed. Documentation complete. Team distribution, git workflow, and cross-session dependencies mapped for a 4-member build. Implementation not yet started.
