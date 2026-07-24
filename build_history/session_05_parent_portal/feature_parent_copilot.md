# Feature: Parent Copilot

## 1. Overview
* **Name:** Parent Copilot
* **Session:** Session 5 — Parent Portal
* **Purpose:** Gives parents an AI assistant at `/parent/copilot` that can answer questions about their dues, payment history, and GST on school fees. Uses the same `copilotQuery` infrastructure as the admin copilot, gated by a separate `PARENT_COPILOT_WHITELIST`.
* **Traces to:** `docs/ai_instructions.md` Section 5 — "SESSION 5 NOTE: extend PARENT_COPILOT_WHITELIST in this same file"; `packages/ai/src/copilotQuery.ts` comment.

## 2. Technical Rationale
* **How we achieved it:** Extended `PARENT_COPILOT_WHITELIST` in `copilotQuery.ts` with `gstExplainerTool` (already had `getMyChildrenDues`, `getMyPaymentHistory`, `answerHowDoI`). Added `gstExplainerTool` to `PARENT_TOOLS` array and `resolveToolCall` switch. Extended `CopilotToolContext` with `gstRules` field. In `copilotQueryAction` (ai.ts), populated `gstRules` from the fee types linked to this parent's children — so Gemini can explain whether a specific fee is exempt or taxable, and at what GST rate. The `/parent/copilot/page.tsx` uses the same chat UI pattern as the admin copilot, with quick-prompt chips for common parent questions.
* **Alternatives considered:** A separate `parentCopilotQuery` function. Explicitly rejected by `copilotQuery.ts` documentation: "Do NOT create a separate copilotQuery function for parents."
* **Why we chose this path:** Single function, dual-role dispatch via `role` parameter — maintains the security model (whitelist IS the security boundary).

## 3. Database Schema Impact
* **Changes made:** None.

## 4. Core Logic & Necessary Functions
* **List of functions & files:**
  * Modified `PARENT_COPILOT_WHITELIST` (`packages/ai/src/copilotQuery.ts`): Added `"gstExplainerTool"`.
  * Modified `PARENT_TOOLS` (`packages/ai/src/copilotQuery.ts`): Added `gstExplainerTool` tool definition.
  * Modified `CopilotToolContext` (`packages/ai/src/copilotQuery.ts`): Added `gstRules?: Array<{feeType, gstTreatment, gstRate}>`.
  * Modified `resolveToolCall` (`packages/ai/src/copilotQuery.ts`): Added `case "gstExplainerTool"` handler.
  * Modified `copilotQueryAction` (`apps/web/src/app/actions/ai.ts`): Populates `toolContext.gstRules` from fee types of the parent's linked students.
  * `ParentCopilotPage` (`apps/web/src/app/parent/copilot/page.tsx`): Chat UI, quick-prompts, suggestion deep-links.
  * `getParentLinkId` / `getParentSchoolId` (`apps/web/src/app/actions/parents.ts`): Helpers for the client to resolve and cache the IDs needed to scope copilot queries.
  ```typescript
  // Security assertion (verified in session5.test.ts Test 7):
  expect(PARENT_COPILOT_WHITELIST).not.toContain("recordPayment");
  // ...all write actions permanently excluded
  ```

## 5. Testing & Verification
* **Automated tests:** `apps/web/tests/session5.test.ts` — Test 7: asserts that no write action (recordPayment, applyWaiver, applyPenalty, markChequeBounced, etc.) appears in `PARENT_COPILOT_WHITELIST`.
* **Manually verified:** Quick prompt chips render; conversation history accumulates correctly client-side; loading dots animation works.

## 6. Dependencies & Deferred Work
* **Depends on:** `GEMINI_API_KEY` env var; `parentLinkId` and `schoolId` cached in `sessionStorage` by `/parent/dues` on first load.
* **Known issues/deferred:** If the parent navigates to `/parent/copilot` before visiting `/parent/dues`, `schoolId` and `parentLinkId` may not yet be cached — copilot will fall back to empty context and Gemini will note it cannot find data. A more robust solution (e.g., fetching these IDs in `layout.tsx`) is deferred to Session 6 polish.
