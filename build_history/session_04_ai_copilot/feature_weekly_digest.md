---
feature_name: "Weekly Digest"
session: "Session 4"
status: "completed"
type: "core_feature"
---

# Feature Log: Weekly Digest

## Description
Implements the weekly digest feature (Feature 6). AI narrates pre-computed weekly trend data into plain English, serving as the opening message for the Admin Copilot.

## Core Logic & Necessary Functions
- `apps/web/src/app/actions/ai.ts` -> `generateWeeklyDigestAction`: Queries the database to aggregate collection totals, cheque aging, and risk tier movement, adhering to "Rules decide, AI narrates."
- `packages/ai/src/generateWeeklyDigest.ts`: Prompts Gemini to format the pre-computed numbers into a readable 3-4 sentence summary.

## Database Schema Impact
- None.

## Testing & Verification
- Validated that the action safely falls back to a plain-text summary if Gemini fails.
