---
feature_name: "AI Narration Features"
session: "Session 4"
status: "completed"
type: "core_feature"
---

# Feature Log: AI Narration Features

## Description
Implements the core AI narration features using Gemini (Features 1, 2, 3, 4):
- Defaulter Insight: Plain language explanation of risk level.
- Dashboard Query: NL query over pre-fetched ledger data.
- Anomaly Narration: Plain language explanation of detected anomalies.
- Reminder Drafting: AI-drafted reminder messages based on tier and channel.

## Core Logic & Necessary Functions
- `packages/ai/src/geminiClient.ts`: Shared REST client with 15s timeout.
- `packages/ai/src/narrateDefaulterInsight.ts` & `apps/web/src/app/actions/ai.ts` -> `narrateDefaulterInsightAction`
- `packages/ai/src/answerDashboardQuery.ts` & `apps/web/src/app/actions/ai.ts` -> `answerDashboardQueryAction`
- `packages/ai/src/narrateAnomaly.ts` & `apps/web/src/app/actions/ai.ts` -> `narrateAnomalyAction`
- `packages/ai/src/draftReminderText.ts` & `apps/web/src/app/actions/ai.ts` -> `draftReminderTextAction`

All features follow the non-blocking ordering guarantee. Narration occurs async-after-write or on-demand, never inside a payment write path.

## Database Schema Impact
- Updated `schema.prisma`:
  - Added `ReminderLog` model (and Enums: `ReminderChannel`, `ReminderStatus`) for storing drafted and sent reminders.
  - Added `OcrStaging` model (see OCR upload feature).

## Testing & Verification
- Unit tests in `session4.test.ts` verify that `narrateAnomalyAction` does not affect prior write results and is decoupled from transactions.
