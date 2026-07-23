/**
 * @smart-school/ai — public exports
 *
 * IMPORTANT: All exports from this package are server-side only.
 * Never import from this package in a client component or a file without "use server".
 * API key and Gemini calls must NEVER reach the browser.
 */

// AI Feature 1 — Defaulter narration
export { narrateDefaulterInsight } from "./narrateDefaulterInsight";
export type { DefaulterInsightInput } from "./narrateDefaulterInsight";

// AI Feature 2 — Dashboard NL query
export { answerDashboardQuery } from "./answerDashboardQuery";
export type { LedgerContext } from "./answerDashboardQuery";

// AI Feature 3 — Anomaly narration
export { narrateAnomaly } from "./narrateAnomaly";
export type { AnomalyContext } from "./narrateAnomaly";

// AI Feature 4 — Reminder text drafting
export { draftReminderText } from "./draftReminderText";
export type { ReminderDraftInput } from "./draftReminderText";

// AI Feature 5 — OCR receipt extraction
export { processOcrUpload } from "./processOcrUpload";
export type { OcrExtractionResult } from "./processOcrUpload";

// AI Feature 6 — Weekly digest
export { generateWeeklyDigest } from "./generateWeeklyDigest";
export type { WeeklyDigestInput } from "./generateWeeklyDigest";

// AI Feature 7 — Copilot (Admin + Parent)
export {
  copilotQuery,
  ADMIN_COPILOT_WHITELIST,
  PARENT_COPILOT_WHITELIST,
} from "./copilotQuery";
export type {
  CopilotMessage,
  CopilotResponse,
  CopilotToolContext,
} from "./copilotQuery";

// Copilot helper tool (also used standalone by the server action)
export { answerHowDoI } from "./answerHowDoI";
