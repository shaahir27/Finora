---
feature_name: "Admin Copilot"
session: "Session 4"
status: "completed"
type: "core_feature"
---

# Feature Log: Admin Copilot

## Description
Implements the AI Copilot (Feature 7) providing function-calling over a role-specific whitelist. Also includes the "How-do-I" retrieval-grounded tool.

## Core Logic & Necessary Functions
- `packages/ai/src/copilotQuery.ts`: Function-calling orchestrator. Defines `ADMIN_COPILOT_WHITELIST` and the stub for `PARENT_COPILOT_WHITELIST`. Hard constraint: No write actions allowed.
- `packages/ai/src/answerHowDoI.ts`: Tool that grounds answers in curated documentation excerpts rather than general knowledge.
- `apps/web/src/app/actions/ai.ts` -> `copilotQueryAction`: Pre-fetches context (e.g. ledger snapshot, reminders queue) to pass to Gemini, enforcing RLS scoping before AI touches it.
- `apps/web/src/app/admin/copilot/page.tsx`: Chat interface with suggestion deep-links and client-side conversation state.

## Database Schema Impact
- None. Conversation history is intentionally not persisted (no COPILOT_SESSION table).

## Testing & Verification
- Unit tests in `session4.test.ts` statically assert that `recordPayment`, `applyWaiver`, and other write actions are NEVER in the whitelists.
