/**
 * @smart-school/ai — public exports
 *
 * IMPORTANT: All exports from this package are server-side only.
 * Never import from this package in a client component or a file without "use server".
 * API key and Gemini calls must NEVER reach the browser.
 */

// AI Feature 1 — Defaulter narration
export { narrateDefaulterInsight } from "./narrateDefaulterInsight.js";
export type { DefaulterInsightInput } from "./narrateDefaulterInsight.js";

// AI Feature 2 — Dashboard NL query
export { answerDashboardQuery } from "./answerDashboardQuery.js";
export type { LedgerContext } from "./answerDashboardQuery.js";

// AI Feature 3 — Anomaly narration
export { narrateAnomaly } from "./narrateAnomaly.js";
export type { AnomalyContext } from "./narrateAnomaly.js";

// AI Feature 4 — Reminder text drafting
export { draftReminderText } from "./draftReminderText.js";
export type { ReminderDraftInput } from "./draftReminderText.js";

// AI Feature 5 — OCR receipt extraction
export { processOcrUpload } from "./processOcrUpload.js";
export type { OcrExtractionResult } from "./processOcrUpload.js";

// AI Feature 6 — Weekly digest
export { generateWeeklyDigest } from "./generateWeeklyDigest.js";
export type { WeeklyDigestInput } from "./generateWeeklyDigest.js";

// AI Feature 7 — Copilot (Admin + Parent)
export {
  copilotQuery,
  ADMIN_COPILOT_WHITELIST,
  PARENT_COPILOT_WHITELIST,
} from "./copilotQuery.js";
export type {
  CopilotMessage,
  CopilotResponse,
  CopilotToolContext,
} from "./copilotQuery.js";

// Copilot helper tool (also used standalone by the server action)
export { answerHowDoI } from "./answerHowDoI.js";
