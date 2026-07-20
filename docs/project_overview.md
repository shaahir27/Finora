# Project Overview — Smart School FinTech Platform

## Purpose

This document orients any engineer or AI coding agent joining this project. It states what the system is, who it serves, why it exists, and what "done" means for each build stage. It is the entry point into the documentation set — read this first, then `product_requirements.md` and `business_rules.md`, before touching `system_architecture.md` or `database_design.md`.

## Scope

The system is a production-ready digital fee management platform for K-12 schools in India, built initially for the PaperBuddy EduHack "Hack the Web" Smart School FinTech track, and designed from the outset to extend into a full production product beyond the hackathon window. This document covers the *what* and *why*; technical design lives in later documents.

## Source of Truth

All product and design decisions trace back to the audited research document: `Smart_School_FinTech_Consolidated_Report_v2_Audited.pdf`. Where this document states a rationale, it references the relevant research section (e.g., §13.1) rather than restating the research itself. If a decision has no traceable research citation, it is explicitly marked as design judgment, not market-validated fact.

## Governing Principles *(added — corrects a gap found during a full documentation audit: this section was referenced by name, "six non-negotiable governing principles... full list in project_overview.md," from README.md and this document's own Goals/Non-Goals sections, but no such list actually existed anywhere. Only Principles 1 and 3 were ever named by number, inline, at their point of use. Principles 2 and 4–6 below are consolidated here from ideas already stated and consistently enforced elsewhere in this doc set — this is a numbering and consolidation fix, not new rules being introduced.)*

1. **Rules decide, AI narrates.** Every money-affecting decision is made by deterministic code with zero external dependency. Gemini only narrates, drafts, explains, or answers questions — it is never in the write path of a payment, and a failed or slow AI call must never block or corrupt a payment-critical write. See `system_architecture.md` package isolation (`packages/rules` vs `packages/ai`) and AI Copilot Architecture — this principle extends to the Copilot without exception.
2. **Every override is on the record.** Waivers, penalties, cheque bounces, and sync-conflict resolutions all require a non-empty reason and are permanently audit-logged. No silent overrides, anywhere, regardless of which role or interface performs the action. See `business_rules.md` Waiver Handling and `database_design.md` `AUDIT_LOG`.
3. **No reminder is ever delivered without an explicit, logged, human "mark sent" action — and WhatsApp/SMS delivery specifically is never real, only simulated.** *(Revised Phase 15 — was "No real WhatsApp/SMS/email delivery for the reminder-notification system.")* WhatsApp/SMS remain drafted and logged only, exactly as originally specified — this build makes no claim to have solved WhatsApp Business API approval or SMS DLT registration. **Email is now a deliberate, narrow third exception to the "no real delivery" half of this principle** (alongside Push, Phase 9, and OTP login, Phase 11): when an admin takes the existing `markReminderSent` action, if the linked parent has an email on file, that same action also dispatches one real, non-blocking email with the already-reviewed drafted text. The human-in-the-loop guarantee is unchanged — nothing sends without that explicit admin action, for any channel. See `business_rules.md` Reminder Strategy → Email Reminder Escalation and `decision_log.md` Phase 15 for why: push notifications (Principle-adjacent, not a substitute) structurally under-reach the parents most behind on fees, since reaching them requires having already installed the PWA and opted in — exactly the opposite of the disengaged-parent profile the reminder system exists to reach.
4. **Row-Level Security is the real access boundary, not the UI.** A parent's session is structurally incapable of reading another family's data, enforced at the Postgres layer — the AI Copilot inherits this automatically because it only ever calls actions that are already RLS-scoped, never a new data path built just for it. See `security.md` Row-Level Security Policy and AI Copilot section.
5. **A queued-but-unsynced state is never presented as final, anywhere, under any circumstance.** An offline payment entry not yet confirmed by the server is never shown as posted, never counted in any aggregate, and a sync conflict escalates for explicit human review rather than being auto-resolved or silently dropped. See `business_rules.md` Offline Payment Entry Strategy.
6. **No self-registration, ever.** Every account — admin or parent — is provisioned by an admin (or seed process), never created by the person logging in. Under the OTP login model, this means every `signInWithOtp` call must pass `shouldCreateUser: false`; an unrecognized phone/email must fail with a clear error, never silently create a new account. See `business_rules.md` Parent Account & Login Strategy.

## Problem Statement

Schools collect fees through parallel, disconnected channels — cash at the counter, UPI payment links, cheques, bank transfers — none of which reconcile to a single ledger in real time. The most-repeated, most-validated pain point across independent research sources (§6.1 Rank 1) is reconciliation lag: administrators cannot answer "how much have we collected, and who still owes what?" without manual, delayed cross-checking. A secondary, equally validated gap (§6.1 Rank 2) is the absence of an audit trail on manually applied waivers and discounts.

## Product Vision

A single system where every fee-related event — a cash payment at the counter, a UPI transaction, a cheque deposit, a waiver, a penalty — posts to one live ledger instantly, with no reconciliation delay and no unaudited manual override. Administrators see accurate, real-time financial state at all times. Parents see and pay their own dues through a simple, restricted view of the same underlying data. No existing competitor combines true real-time omnichannel reconciliation with risk-segmented defaulter tracking and a premium dashboard experience (§13.4) — this combination is the system's core differentiation.

## Stakeholders

- **School administrators / finance staff** — primary users; full access to fee configuration, ledger, defaulter tracking, waivers, reminders.
- **Parents** — secondary users; restricted, read-and-pay access scoped to their own linked child/children only.
- **Judges (hackathon context)** — evaluate against the official rubric, confirmed directly from the challenge brief (updated Phase 10, previously only partially known): **Innovation & Creativity, Problem Solving Approach, Technical Excellence, Software Architecture, Code Quality, UI/UX Design, Scalability & Performance, Business Impact, Product Demonstration & Presentation** — nine criteria, not the four previously cited here. Two are not otherwise addressed anywhere in this documentation set and are worth naming explicitly: **Code Quality** (no document currently states a coding-standard/lint/review expectation — left to normal engineering judgment, not a gap this project is treating as unaddressed, just not previously written down) and **Product Demonstration & Presentation** (partially covered by `implementation_plan.md` Session 6's rehearsal step, but that step is about the demo *working*, not about how it's *narrated/paced* — worth a deliberate presentation script, not just a working build, closer to demo day).
- **Future stakeholders (explicitly out of current scope, named for continuity)** — teachers, education authority analytics consumers, multi-school SaaS operators. The architecture is designed to support these without rework, per the project's production-first instruction, but none are built in the current scope.

## Goals

1. Deliver a live, unified reconciliation ledger across UPI, cash, and cheque channels with zero manual reconciliation step (§13.1).
2. Deliver audit-trail-native handling of every waiver and penalty (§6.1 Rank 2).
3. Deliver risk-segmented, not flatly-listed, defaulter tracking (§13.3).
4. Deliver a glassmorphism-standard admin dashboard bound to live data, satisfying the brief's explicitly named UI/UX judging criterion (§2.1, §2.8).
5. Deliver a minimal, reused-infrastructure parent portal (view dues, pay, view history) without duplicating backend logic.
6. Build all of the above on an architecture that scales to real multi-school production use without requiring redesign.
7. **Added Phase 10**: support offline cash/cheque entry with an honest, never-silent sync-and-conflict story — directly required by the official challenge brief's "offline workflows" line, not optional. This goal is in tension with Goal 1's zero-lag claim by nature (an offline entry is, briefly, un-reconciled) and is deliberately designed to resolve that tension through visible queue/conflict states rather than by pretending the tension doesn't exist — see `business_rules.md` Offline Payment Entry Strategy.

## Non-Goals (explicit, to prevent scope drift)

- Live production payment gateway / KYC integration — sandbox only (§12.1, §14.1).
- Multi-tenant SaaS infrastructure or native mobile apps at this stage. **Clarified Phase 9**: an installable PWA (added this phase, see `decision_log.md` Phase 9) is not a native mobile app and does not contradict this non-goal — no App Store/Play Store submission, no native codebase, just a web app that can be installed via the browser's own manifest/service-worker mechanism. An agent should not read the PWA addition as reopening this non-goal.
- Machine-learning-based risk scoring — rule-based only (§10.1).
- Financial forecasting or cash-flow prediction models.
- EMI/financing functionality beyond a static "Coming Soon" roadmap stub (§15.1).
- Automatic (accrual-based) late fee or penalty calculation — both are manually applied, reason-tagged actions.
- Real WhatsApp/SMS delivery — reminders are drafted and logged only, never actually sent (Governing Principle 3). **Push notifications (added Phase 9) are a separate, deliberately narrow system and do not reopen this non-goal** — see `business_rules.md` Push Notification Strategy for the exact boundary. **Neither does phone/email OTP delivery for parent login (added Phase 11)** — Governing Principle 3 restricts the *reminder notification system* specifically (drafted content nudging a parent about a due date), not authentication infrastructure. Real Twilio SMS and real Supabase email genuinely are sent for OTP delivery — that's the entire point of the login redesign — and this is not an exception carved into the principle, it's a different category of system the principle was never written to cover. See `business_rules.md` Parent Account & Login Strategy.

## Success Criteria

- A live demo can record a cash payment, a sandbox UPI payment, and a cheque entry, and show all three reflected in one ledger and one dashboard number with zero manual step and no perceptible lag (§13.1 — this is the single most important functional proof point). **Added Phase 9**: the same demo, if the admin has push notifications enabled, should show a live notification arriving on a second device the moment each payment posts — a second, independent proof of the same zero-lag claim.
- Every waiver/penalty in the system has a non-nullable reason and approver, and is visible in an audit log (§6.1 Rank 2).
- The defaulter view is sorted/grouped by computed risk level, not simply by days overdue.
- No dashboard figure is ever sourced from mock or static data (§13.2's named failure mode).
- A parent can log in, view only their own child's dues, pay via UPI sandbox, and see that payment reflected on the admin's live dashboard in the same moment.
- **Added Phase 9**: a judge or first-time user should be able to open the Copilot tab (admin or parent) and get a correct, useful answer to a real question about their own data within the first exchange — this is the concrete bar for "the Copilot is not there for show," per the design conversation recorded in `decision_log.md` Phase 9.

## Key Constraints

- 6-day build window for the hackathon deliverable (full production scope may extend beyond this).
- Team owns and must be able to explain all AI-assisted code (§2.7 rubric rule).
- No live KYC / production payment processing under any circumstance during the hackathon build.
- Every AI (Gemini) call must be non-blocking with respect to money-affecting actions — rules decide, AI narrates (Governing Principle 1).

## Assumptions

- The hackathon's stated tech-freedom (§2.1) is taken at face value; the "Riverpod" hint in the brief is treated as a signal about expected technical challenge (async payment state), not a mandate (per the brief's own explicit tech-freedom clause).
- GST treatment is configured per fee type by the admin, not auto-determined by the system, since the system cannot independently verify a school's legal/registration status (see `business_rules.md`).
- The judging rubric (§2.7) is assumed unmodified per-track; this was flagged as an unresolved assumption in the original research and is carried forward unchanged.

## Document Map

| Document | Covers |
|---|---|
| `project_overview.md` (this file) | Why the project exists, who it's for, what success means |
| `product_requirements.md` | Functional/non-functional requirements, user roles, feature hierarchy |
| `business_rules.md` | Fee engine, reconciliation, waiver/penalty, defaulter, reminder, anomaly, GST logic |
| `system_architecture.md` | Tech stack, architecture diagram, module boundaries |
| `database_design.md` | Full schema, entity relationships |
| `api_specification.md` | Server action contracts |
| `financial_engine.md` | Detailed calculation logic |
| `security.md` | Auth, RLS, secrets handling |
| `user_flows.md` | Step-by-step workflows |
| `ui_ux_specification.md` | Screen-by-screen requirements |
| `design_system.md` | Component library, tokens (final color palette, locked — see Phase 8 in `decision_log.md`) |
| `implementation_plan.md` | Build sequence |
| `testing_strategy.md` | Automated test targets per session, added Phase 8 |
| `decision_log.md` | Every major decision and its rationale/citation |

**Phase history note**: this project's full decision history — including the Phase 8 design-audit remediation and every "added Phase N" feature since — lives entirely in `decision_log.md`, kept as one running record rather than split across separate per-phase files.

## References

Smart School FinTech — Consolidated Research Report (v2, Audited), prepared for Shaahir, July 8, 2026. All section references (§n.n) in this document and its companions refer to this report.
