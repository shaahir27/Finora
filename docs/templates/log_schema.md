# LOG_TEMPLATE
Use this exact structure for every feature log in `build_history/`. Copy it, replace every `{{PLACEHOLDER}}`, delete nothing else.

## 1. Overview
* **Name:** {{NAME}}
* **Session:** {{SESSION_NUMBER_AND_NAME}} — e.g. "Session 2 — Reconciliation"
* **Purpose:** {{PURPOSE}}
* **Traces to:** {{SPEC_REFERENCE}} — the exact requirement this satisfies, e.g. "product_requirements.md M-3".

## 2. Technical Rationale
* **How we achieved it:** {{TECH_SUMMARY}}
* **Alternatives considered:** {{ALTERNATIVES}} — write "none" if the spec dictated this approach directly.
* **Why we chose this path:** {{JUSTIFICATION}}

## 3. Database Schema Impact
* **Changes made:** {{DB_CHANGES}} — e.g., "Added `Waiver` model with foreign key to `FeeAssignment`". Write "none" if purely application-level code.

## 4. Core Logic & Necessary Functions
* **List of functions & files:** Key functions added or modified, and their exact file paths.
  * `functionName` (`exact/path/to/file.ts`): {{ROLE_DESCRIPTION}}
  ```typescript
  // {{CODE_SNIPPET}}
  // Note: Code snippets represent the function signature at the time this feature was built. Always check the actual file for the most up-to-date signature.
  ```

## 5. Testing & Verification
* **Automated tests:** {{TEST_FILE_PATHS}} — reference `docs/testing_strategy.md`'s test targets for this session.
* **Manually verified:** {{WHAT_WAS_CHECKED_BY_HAND}}

## 6. Dependencies & Deferred Work
* **Depends on:** {{OTHER_FEATURES_OR_EXTERNAL_SERVICES}}
* **Known issues/deferred:** {{ANYTHING_LEFT_INCOMPLETE_OR_A_DELIBERATE_SHORTCUT}} — an honest gap noted here is far more useful than a log that implies everything is finished when it isn't.

---

## Rules for using this template (not part of the log itself — read once, then follow every time)

1. **Never write a real secret value into a log.** Reference credentials by their env var name only (`TWILIO_ACCOUNT_SID`, not the actual SID).
2. **One feature, one file.** If a feature grows across sessions, update the original file.
3. **A genuinely new feature that merely calls or reuses an existing one gets its own new file**, with a cross-reference.
4. **Section 4 is mandatory, not optional**. Exact file paths and function roles are what make this directory useful for navigation later.
