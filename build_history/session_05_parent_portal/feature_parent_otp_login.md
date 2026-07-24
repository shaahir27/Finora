# Feature: Parent OTP Login

## 1. Overview
* **Name:** Parent OTP Login
* **Session:** Session 5 — Parent Portal
* **Purpose:** Provide a phone-OTP-first (email fallback) login page at `/parent/login` for parents. Enforces `shouldCreateUser: false` on every Supabase OTP call to prevent unauthorized signups.
* **Traces to:** `docs/ai_instructions.md` — Governing Principle 6 (OTP must never create new auth users); `docs/api_specification.md` — Parent Auth contract.

## 2. Technical Rationale
* **How we achieved it:** Supabase `signInWithOtp` with `shouldCreateUser: false`. On phone-OTP (primary), an unprovisioned number returns a 400 that is caught and surfaced as "Number not registered" instead of leaking the raw Supabase error. Email is an alternative method for parents who were provisioned with an email address. A 60-second resend cooldown is enforced client-side to prevent abuse.
* **Alternatives considered:** Magic link email-only. Rejected — spec requires phone-primary since many parents in the target market may not have/remember an email.
* **Why we chose this path:** Matches `docs/api_specification.md` "parent auth" contract: phone OTP primary, email fallback, never auto-creates a user.

## 3. Database Schema Impact
* **Changes made:** None — relies on Supabase Auth (no PARENT_LINK changes; those were provisioned by the admin).

## 4. Core Logic & Necessary Functions
* **List of functions & files:**
  * `ParentLoginPage` (`apps/web/src/app/parent/login/page.tsx`): Client component handling both OTP request and verification flows.
  * `supabase` (`apps/web/src/lib/supabase-client.ts`): Supabase browser client singleton.
  ```typescript
  // Critical constraint — enforced on every signInWithOtp call:
  await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
  await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
  ```

## 5. Testing & Verification
* **Automated tests:** `apps/web/tests/session5.test.ts` — No dedicated OTP test (Supabase auth cannot be unit-mocked cleanly; integration test would require a Supabase test project).
* **Manually verified:** Page renders, toggle between phone/email works, resend cooldown countdown functions correctly.

## 6. Dependencies & Deferred Work
* **Depends on:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars.
* **Known issues/deferred:** Integration test for actual OTP flow deferred — would require a test Supabase project with phone auth enabled.
