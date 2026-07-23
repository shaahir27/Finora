/**
 * narrateAnomaly — AI Feature 3
 *
 * Generates a plain-language explanation of a detected payment anomaly.
 *
 * CRITICAL ORDERING GUARANTEE (system_architecture.md, Phase 6 design review fix):
 * This function is called ASYNCHRONOUSLY — after the triggering recordPayment response
 * has ALREADY returned to the client. It is NEVER called inside the DB transaction
 * that posts the payment. A failure here must NEVER affect the payment that was posted.
 *
 * Pattern in the server action:
 *   const result = await recordPayment(...);          // writes to DB, returns
 *   narrateAnomalyAction(anomalyFlagId).catch(noop);  // fires after, best-effort
 *   return result;                                     // already returned above
 *
 * On failure: returns null. UI MUST fall back to ANOMALY_FLAG.flag_reason.
 */

import { generateContent } from "./geminiClient";

export interface AnomalyContext {
  flagReason: string;
  expectedAmount: number;
  receivedAmount: number;
  studentName: string;
  channel: string;
  refNumber?: string | undefined;
}

/**
 * Returns a brief, human-readable explanation of why the anomaly was flagged, or null on failure.
 */
export async function narrateAnomaly(
  context: AnomalyContext
): Promise<string | null> {
  try {
    const prompt = `You are a school finance assistant. Briefly explain (1-2 sentences) this payment anomaly to a school administrator.

Anomaly type: ${context.flagReason}
Expected amount: ₹${context.expectedAmount}
Received amount: ₹${context.receivedAmount}
Student: ${context.studentName}
Payment channel: ${context.channel}
${context.refNumber ? `Reference number: ${context.refNumber}` : ""}

Be factual and brief. Do NOT make decisions or suggest any action.`;

    const text = await generateContent(
      [{ role: "user", parts: [{ text: prompt }] }],
      { temperature: 0.2 }
    );
    return text.trim();
  } catch {
    return null;
  }
}
