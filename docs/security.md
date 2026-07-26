# Security — Smart School FinTech Platform

## Purpose

The authoritative specification of authentication, authorization, Row-Level Security policy, and secrets handling. An AI coding agent must treat the RLS policies below as the actual enforcement mechanism — application-layer checks are a UX convenience on top of RLS, never a substitute for it.

## Scope

Authentication flow, RLS policy per table per role, secrets management, and known/accepted current gaps. Does not cover business logic (see `business_rules.md`) or infrastructure deployment detail beyond secrets handling (see `system_architecture.md`).

---

## Authentication

- **Provider**: Supabase Auth for both roles.
- **Admin**: email + password. No self-registration — accounts provisioned by a super-admin or seed process.
- **Parent (redesigned Phase 11 — was magic-link email only)**: OTP-based, no password, dual-channel — phone SMS is the primary path, email is an automatic fallback. No self-registration in either channel: an admin must create the `USER` + `PARENT_LINK` rows first (via `createParentAccount`, see `api_specification.md`) before any OTP can succeed for that phone/email.
  - **The mechanism that actually enforces "no self-registration" under an OTP model, stated explicitly because it's easy to get wrong**: Supabase's `signInWithOtp` will, by default, silently create a new `auth.users` row for a phone/email it doesn't recognize — that default is a self-registration path, and it must be explicitly disabled. Every OTP call from the parent login screen, phone or email, **must pass `shouldCreateUser: false`**. An OTP request for a number/address with no matching admin-created account must fail with a clear "this number isn't registered — contact your school" message, never silently provision a blank account.
  - **Phone (primary)**: Supabase Auth's native phone provider, configured with Twilio (see Secrets Management). For the hackathon build, demo/judge-facing accounts use Supabase's built-in **Test OTP** mapping (specific phone numbers mapped to a fixed code in config) — real SMS sending is skipped entirely for those numbers, so the demo path never touches DLT-regulated infrastructure, has no delivery risk, and costs nothing. Real Twilio delivery remains configured and functional for any number outside the test set, honestly labeled as sandbox-adjacent rather than claimed as production-ready SMS delivery — DLT registration for actual production SMS is a named Future Extension, not something this build claims to have solved (see `business_rules.md` Parent Account & Login Strategy).
  - **Email (fallback)**: Supabase's built-in email OTP, no external provider or API key required at hackathon scale. Exists specifically so a parent (or a judge testing with their own number) isn't blocked if their number isn't in the Test OTP set or Twilio delivery is unreliable on the day.
  - **Known, accepted risk carried over from the phone channel**: SMS-based OTP inherits SIM-swap fraud exposure, a real and documented attack vector in India. This is the same trade-off virtually every Indian consumer banking/UPI app already makes, and is treated the same way here — disclosed, not solved with additional out-of-scope verification machinery.
- Session carries `role` (`admin` \| `parent`) and, for admin, `school_id` — both read from the `USER` table via the authenticated session, not trusted from client input.
- **Application-Layer Guards (`require-session.ts`)**: Server Actions invoke `requireAdminForSchool(schoolId)` or `requireParentSession()` at their entry point. Unauthenticated demo fallbacks require explicit `ALLOW_UNAUTHENTICATED_DEMO_ACTIONS="true"` (or `NODE_ENV="test"`).
- **Parent IDOR Protection**: All parent-facing server actions derive `parentUserId` and `parentLinkId` directly from `requireParentSession()` session context (never accepting `parentUserId` as an untrusted client argument) and verify `guardianOf` student-link ownership before executing payments or returning dues/receipts.
- **Session/token expiry (added Phase 8 — previously unspecified)**: both roles use Supabase Auth's default session expiry and refresh-token behavior, with no custom override. This is a deliberate "don't touch the default" decision, not an oversight left unstated — worth documenting explicitly rather than leaving it silently unspecified, given how much emphasis this document places elsewhere on not leaving security-adjacent behavior to inference.

---

## Row-Level Security Policy

### Admin role

- Full `SELECT`/`INSERT`/`UPDATE` on all tables, but every policy filters on `school_id = (SELECT school_id FROM USER WHERE id = auth.uid())`. **No cross-school access, even for admins** — an admin at School A can never see School B's data, regardless of how the application UI is built. This is a hard RLS constraint, not an application-level convenience check.
- **`getStudentProfile` and `generateReconciliationReport` (added Phase 14)** carry no separate RLS policy beyond the blanket rule above — both are ordinary `school_id`-scoped admin reads over existing tables (`FEE_ASSIGNMENT`, `TRANSACTION`, `WAIVER`, `PENALTY`, `REMINDER_LOG`, `DEFAULTER_SCORE`), not a new data path. Called out explicitly here only because Phase 14 added them, matching this document's existing practice of naming new admin actions rather than assuming the blanket rule is self-evidently understood to cover them.
- **`updateStudentStatus` and `markReminderSent` (added Phase 15)**: same blanket rule, no separate policy. `updateStudentStatus`'s `write_off` path internally calls `applyWaiver`, which is already RLS/audit-covered — no new write surface is introduced. `markReminderSent`'s email dispatch reads only the already-scoped `REMINDER_LOG`/`PARENT_LINK` chain to find the recipient address; it introduces no new table or access path either.

### Parent role

| Table | Access | Policy basis |
|---|---|---|
| STUDENT | `SELECT` only | via `PARENT_LINK.user_id = auth.uid()` → `guardian_of` → `student_id` |
| FEE_ASSIGNMENT | `SELECT` only | joined through the same student-link chain. No `INSERT`/`UPDATE` — parents never write fee assignments |
| TRANSACTION | `SELECT` filtered to their linked student's transactions; `INSERT` **only** via the `recordPayment`/`payDueViaUpi` server action path, channel locked to `upi` | parents cannot manually post a cash/cheque entry, and cannot write to `TRANSACTION` directly outside the sanctioned action |
| RECEIPT | `SELECT` only | via transaction → student → parent_link chain |
| WAIVER, PENALTY, AUDIT_LOG, ANOMALY_FLAG, OCR_STAGING, REMINDER_LOG, DEFAULTER_SCORE | **No access at all** | admin-only concepts by design — a parent seeing "risk_level: high" attached to their own child is a trust/UX problem as much as a scope one, not merely an unbuilt feature |
| PUSH_SUBSCRIPTION *(added Phase 9)* | `SELECT`/`INSERT`/`DELETE` on own rows only, both roles | `user_id = auth.uid()` — identical scoping pattern to every other user-linked table, no special case |
| OFFLINE_SYNC_CONFLICT *(added Phase 10)* | `SELECT`/`UPDATE` for any admin at the same school, not just `submitted_by` | **deliberately not user-scoped, unlike everything else in this table** — same `school_id`-wide visibility pattern already used for `ANOMALY_FLAG`/`DEFAULTER_SCORE`, since a stuck conflict needs to be resolvable by whichever admin is available, not just the one whose device happened to queue it |

- This split directly answers any judging/review question about §2.6's data-security criterion: **RLS policy, not application-layer filtering, is what prevents a parent from seeing another family's dues** — the agent should be able to demonstrate this by attempting a direct (non-application) query as a parent role and confirming it's blocked at the database level, not just hidden in the UI.

### AI Copilot *(added Phase 9)*

The Copilot inherits every RLS boundary above automatically, and this is deliberate, not incidental — see `system_architecture.md` AI Copilot Architecture. It calls only pre-existing, already-RLS-scoped server actions (function-calling over a fixed whitelist), never raw SQL and never a new "copilot-only" data path. The practical implication for testing: **the same prompt-injection or cross-tenant-access attempt that fails against the ordinary parent/admin UI should also fail against the Copilot, for the identical reason** — there is no code path where a cleverly-worded chat message reaches data the whitelist's underlying actions wouldn't already return. If an agent ever finds itself writing a new database query specifically to answer a Copilot question, that is the signal something has gone wrong — the fix is to expose a properly-scoped server action and add *that* to the whitelist, never to let Copilot construct or receive raw query access.

---

## Secrets Management

- Secrets in scope: Supabase service role key, Razorpay sandbox key/secret, Gemini API key, VAPID public/private key pair (added Phase 9 — self-generated, not third-party-issued, but stored with the same discipline as the others), **Twilio Account SID + Auth Token (added Phase 11) — configured inside Supabase Auth's dashboard settings, not read directly by application code, since phone OTP is handled entirely by Supabase Auth's native provider integration, not a custom integration this project's own server actions call directly**, **Resend API key (added Phase 15) — read directly by the `markReminderSent` server action for the email dispatch described in `business_rules.md` Email Reminder Escalation, following the same "Server Actions only" access pattern as Razorpay and Gemini below.**
- **Storage**: Vercel environment variables only. Never committed to the repository, never present in any client-side bundle. Twilio credentials are the one exception to "Vercel env var" for *storage location* specifically — they live in Supabase's own Auth provider configuration (still never in the repo, never client-exposed), since that's where Supabase's native phone-auth integration expects them.
- **Access pattern**: all third-party API calls (Razorpay, Gemini, Resend — added Phase 15) happen exclusively inside Server Actions — never in a client component, never in a route that returns data directly to the browser without passing through server-side logic first. **Phone/email OTP calls (added Phase 11) are the one auth-adjacent exception to "Server Actions only"** — `signInWithOtp`/`verifyOtp` are called directly from the client via the Supabase JS SDK, which is the standard and correct pattern for Supabase Auth (the SDK talks to Supabase's own Auth server, not to Twilio directly — the client never sees or handles Twilio credentials at any point).
- **Rotation**: a documented rotation procedure (manual is acceptable at current scale) must exist for every secret listed above. This requirement is carried forward directly from a prior project experience where an exposed service account key required emergency rotation — treat "stored as an env var" as necessary but not sufficient; the team must also know the rotation steps before a key is ever exposed, not figure them out during an incident.

---

## Known, Currently Accepted Gaps (explicitly flagged, not silently absent)

- **Rate limiting**: Implemented in-memory via `rateLimit.ts` across AI endpoints (`processOcrUploadAction`, `answerDashboardQueryAction`), `generateReconciliationReport`, and export actions. Moving to shared KV store (`@upstash/redis`) is documented as a serverless infrastructure deployment step.
- **No webhook replay-attack protection beyond signature verification** — Razorpay's signature check is the only defense against a forged webhook payload; no additional nonce/timestamp-window check is currently specified. Acceptable for sandbox-only integration; would need review before any live-gateway upgrade (which is explicitly out of scope regardless — see `product_requirements.md`).
- **PII handling**: `USER.email`, `USER.phone` (added Phase 11), `STUDENT.name`, and payment history constitute personal data. No field-level encryption is specified beyond what Supabase provides by default at rest. If this becomes a real production concern beyond the hackathon, a dedicated data-privacy review is a Future Extension, not something to improvise ad hoc during feature build.
- **Server Actions attack surface (added Phase 8)**: Next.js Server Actions have a distinct attack surface from a conventional REST API (action-endpoint enumeration, CSRF considerations specific to the framework's own action-invocation mechanism). This document's existing emphasis on RLS-as-real-enforcement covers data-access authorization, but does not separately address Server Action-specific hardening. Flagged as a gap of the same class as the other items in this section — not solved here, but not silently absent either.
- **Unencrypted local offline-payment queue (added Phase 10)**: entries queued for offline sync (`business_rules.md` Offline Payment Entry Strategy) sit in the device's IndexedDB unencrypted at rest. Data is minimal (amount, student reference, channel, timestamp) and already behind an authenticated session, but a lost device with entries still queued is a real, if small, exposure. Documented explicitly rather than addressed with additional client-side cryptography disproportionate to this project's scope.
- **Email deliverability is not guaranteed (added Phase 15)**: Resend's free tier is sufficient for this project's volume, but no bounce/complaint-handling automation, sender-domain reputation warmup, or retry-with-backoff strategy is specified beyond the single `failed` status surfaced to the admin (see `business_rules.md` Email Reminder Escalation). At real production scale beyond a single school, dedicated deliverability tooling is a reasonable Future Extension, not something this build claims to have solved.

---

## Assumptions

- Supabase's default encryption-at-rest and TLS-in-transit are sufficient for the current build; no additional application-level encryption layer is specified.
- Both roles authenticate through the same Supabase Auth instance, distinguished only by the `role` field and associated RLS policies — there is no separate auth system per role.

## Future Extensions

Rate limiting on AI-backed and upload endpoints, webhook replay protection beyond signature verification, field-level encryption review for PII if the product moves toward real production launch, formal secrets-rotation automation (currently manual-acceptable).

## References

RLS design traces to Phase 3/Phase 4 of this project's design process (the parent-scope negotiation that established the RLS-first approach to the parent portal). The secrets-rotation requirement and the rate-limiting/webhook-replay gaps were surfaced during Phase 6 design review. See `decision_log.md`.
