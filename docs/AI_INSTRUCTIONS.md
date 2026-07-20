# AI Instructions — Master Rules for Every Coding Agent on This Project

This is the operating contract for any AI coding agent (Claude Code, Cursor, Antigravity, or otherwise) working on this codebase. Read this in full before writing any code, in addition to whatever session-specific documents apply to your assignment.

## 1. Documentation Is the Single Source of Truth

- Read every file inside `/docs` relevant to your assigned session before writing any code — not just the one document that seems most relevant. Cross-references between documents are frequent and load-bearing (see `README.md`'s reading order).
- If `/docs` doesn't specify something, that's a signal to ask, not to invent a reasonable-sounding default. Undocumented behavior should be treated as undecided, not as your decision to make silently.
- If two documents appear to disagree, check `decision_log.md` before resolving the conflict yourself — it is very likely a documented, deliberate revision, and the fix is usually "read the later decision," not "guess which document is right."

## 2. Hard Boundaries — Never Do These Without Explicit Instruction

- **Never invent a database table, column, or relationship** not in `database_design.md`. If your feature seems to need one that isn't there, stop and flag it — don't add it silently and continue.
- **Never invent an API/server action** not in `api_specification.md`. Same rule, same reasoning.
- **Never rename an existing API, function, database column, or response field.** Other sessions and other team members' code depend on these names exactly as documented. A rename that isn't reflected in `docs/` breaks integration in a way that won't show up until someone else's session tries to call it.
- **Never modify the database schema** unless the session you're assigned explicitly calls for a schema change per `database_design.md`.
- **Never modify a module outside your assigned session's scope** — with the specific, sanctioned exceptions listed in Section 5 below. Those exceptions exist precisely because a handful of features genuinely do require touching another session's files; outside that list, stay in your lane.
- **Never implement ad hoc loading/error/conflict handling on a financial-data screen (added Phase 15).** Every such screen renders off the typed five-state union in `system_architecture.md` Client State Management (`idle`/`loading`/`synced`/`stale`/`conflict`) — a component-local `isLoading`/`error` pair, however reasonable it looks in isolation, is exactly the kind of "reasonable-sounding default" Section 1 above already warns against inventing.

## 3. Follow the Specification Exactly

- Follow `business_rules.md` exactly — these are product decisions, not suggestions. If a rule seems wrong or produces an awkward implementation, flag it rather than working around it silently.
- Follow `api_specification.md` exactly — parameter names, return shapes, and the described behavior (including error/edge cases) are all part of the contract, not just the happy path.
- Follow `implementation_plan.md` exactly — build only your assigned session's scope, in the order specified. A session's "Checkpoint before proceeding" and its tests in `testing_strategy.md` are both part of that session's definition of done, not optional extras.
- Follow the existing folder structure (see README.md Project Structure). Don't introduce a new top-level convention because it seems cleaner — raise it as a suggestion instead.
- Reuse existing utilities, types, and patterns wherever one already does what you need. Check before writing a new one.

## 4. Code Quality Standards

- Keep TypeScript strict — no `any` as a shortcut past a type error you don't want to solve.
- Prefer modular code: small, focused functions and components over large ones that do several unrelated things.
- Make small, focused commits — one logical change per commit, not a session's entire output as one commit.
- Explain architectural decisions before making them, especially anything that isn't a direct, literal implementation of what `docs/` already specifies. A one-paragraph explanation before the code is worth more than a large diff with no context.

## 5. Sanctioned Cross-Session Touches

Section 2 says "never modify a module outside your session's scope" — these are the specific, real exceptions to that rule, because this project's actual architecture has a small number of features that genuinely span two sessions. If your work matches one of these, touching the other session's files is expected, not a violation:

- **Session 3 wiring push-notification triggers into Session 2's `recordPayment`/`markChequeBounced`/`detectAnomaly` code.** Push dispatch is deliberately called from the orchestration layer *after* these Session 2 functions succeed — see `system_architecture.md` PWA & Push Notifications. This requires editing Session 2 files from within Session 3's work.
- **Session 5 extending Session 4's `copilotQuery` with the Parent whitelist.** The Copilot is one shared function taking a `role` parameter, not two separate functions — Session 4 builds it with the Admin whitelist; Session 5 adds the Parent whitelist to that same function. See `system_architecture.md` AI Copilot Architecture.
- **Session 5 extending Session 3's push infrastructure with the parent-side toggle and payment-confirmation trigger.** Same `PUSH_SUBSCRIPTION` table and `sendPushNotification` function Session 3 builds — Session 5 adds a second trigger and a second settings surface, not a parallel system.
- **Session 6 wrapping Session 4's `processOcrUpload`/`answerDashboardQuery` with rate limiting.** These functions exist from Session 4; Session 6 adds a rate-limit check around calls to them, per `system_architecture.md` Rate Limiting / Cost Control.
- **Session 3 building the Student Directory and Student Profile screens against Session 1's `createStudent`/`bulkImportStudents`/`updateStudent`/`getStudentProfile`/`updateStudentStatus` actions (added Phase 14, extended Phase 15).** These server actions are built in Session 1 (they're a prerequisite for `assignFee`); the screens that expose them, including the "Change Status" control (added Phase 15), are built in Session 3 alongside the rest of the real-data UI. Session 3 does not re-implement or duplicate this logic — it wires existing Session 1 actions to a new screen.
- **Session 6 wrapping `generateReconciliationReport` with the same rate limit as the two Gemini-backed endpoints above (added Phase 14).** Same pattern as the immediately preceding item, applied to a third admin-facing endpoint added in Phase 14 rather than Phase 4 — see `system_architecture.md` Rate Limiting / Cost Control.

Outside this list, if you find yourself needing to edit a file clearly owned by another session's scope, stop and flag it — don't assume it's an unlisted exception.

## 6. When You're Genuinely Unsure

State the ambiguity and your best-guess resolution, then proceed with that guess clearly marked — don't silently pick one interpretation and hide that a decision was made. A one-line "docs/business_rules.md doesn't specify X, I'm assuming Y because Z, flag if wrong" costs nothing and saves a much more expensive later correction.

## 7. Build Logging

See `BUILD_LOGGING_PROTOCOL.md` for the full rules — every feature you build gets a log in `build_history/`, using `templates/log_schema.md`. This is part of your session's definition of done, not a separate cleanup task.
