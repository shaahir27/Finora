# Feature: Hindi Toggle (next-intl i18n)

## 1. Overview
* **Name:** Hindi Toggle
* **Session:** Session 5 — Parent Portal
* **Purpose:** Provides English/Hindi language switching for the entire `/parent/*` namespace using `next-intl`. The toggle is persistent (localStorage) and reactive (custom DOM event bus so the sidebar toggle and any settings page stay in sync without a full re-render).
* **Traces to:** `docs/ai_instructions.md` Section 5 — "Parent Portal: must use next-intl for Hindi toggle."

## 2. Technical Rationale
* **How we achieved it:** `next-intl` installed as a client-only provider (`NextIntlClientProvider`) — not using Next.js middleware routing pattern, since the `/parent` namespace is self-contained and route-based locale prefixes would conflict with the admin namespace. Translation bundles are imported statically (`en.json`, `hi.json`); the `I18nProvider` component swaps `messages` and `locale` on a `finora_locale_change` CustomEvent, which is the lightest possible reactive sync without a global state manager. Sidebar has an A/अ toggle button.
* **Alternatives considered:** Route-prefix locale (`/parent/en/dues` vs `/parent/hi/dues`). Rejected — adds complexity and breaks the session token (sessionStorage is path-independent but URL changes would still be jarring UX).
* **Why we chose this path:** Client-side provider keeps it self-contained and avoids any middleware changes that could interfere with the admin auth flow.

## 3. Database Schema Impact
* **Changes made:** None — locale preference stored in `localStorage` only.

## 4. Core Logic & Necessary Functions
* **List of functions & files:**
  * `I18nProvider` (`apps/web/src/components/I18nProvider.tsx`): Wraps children in `NextIntlClientProvider`; listens for `finora_locale_change` events and swaps message bundle.
  * `en.json` (`apps/web/src/i18n/en.json`): English translation strings for all parent portal namespaces (Navigation, Dues, Payment, History, Settings, Copilot).
  * `hi.json` (`apps/web/src/i18n/hi.json`): Hindi translation strings — bilingual where English terms are embedded for clarity (e.g., "अदत्त (Unpaid)").
  ```typescript
  // Toggle trigger (in sidebar):
  window.dispatchEvent(new CustomEvent("finora_locale_change", { detail: "hi" }));
  // Consumer (in I18nProvider):
  window.addEventListener("finora_locale_change", (e) => setMessages(e.detail === "hi" ? hi : en));
  ```

## 5. Testing & Verification
* **Automated tests:** None for pure i18n string loading (trivial). Toggle mechanism tested manually.
* **Manually verified:** A/अ button in sidebar switches all headings, labels, and nav items between English and Hindi without page reload.

## 6. Dependencies & Deferred Work
* **Depends on:** `next-intl` package (installed via `pnpm add next-intl --filter web`).
* **Known issues/deferred:** Hindi strings use parenthetical English for highly technical terms (GST, UPI, OTP) — intentional for the demo audience.
