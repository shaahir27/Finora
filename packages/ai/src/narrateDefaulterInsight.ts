/**
 * narrateDefaulterInsight — AI Feature 1
 *
 * Generates a plain-language narrative for an admin viewing a specific student's
 * defaulter card. Called lazily (on-demand) when the admin opens a student card — NOT
 * precomputed for every student in the list.
 *
 * Ordering guarantee (system_architecture.md Gemini integration contract):
 * This function is ASYNC relative to any payment-critical write. It is called AFTER
 * the write's response has already returned — never before or during a DB transaction.
 *
 * On failure: returns null. UI MUST fall back to DEFAULTER_SCORE.computed_reason.
 */

import { generateContent } from "./geminiClient";

export interface DefaulterInsightInput {
  studentName: string;
  riskLevel: "high" | "medium" | "low";
  computedReason: string;
  totalFees: number;
  totalPaid: number;
  remainingBalance: number;
  maxDaysOverdue: number;
  brokenPromiseCount: number;
}

/**
 * Returns a short, admin-friendly narrative (2–3 sentences) explaining the student's
 * defaulter risk in plain language, or null if Gemini fails.
 */
export async function narrateDefaulterInsight(
  input: DefaulterInsightInput
): Promise<string | null> {
  try {
    const prompt = `You are a school finance assistant. Briefly explain (2-3 sentences, no jargon) 
why this student has a ${input.riskLevel} default risk level to a school administrator.

Student: ${input.studentName}
Risk level: ${input.riskLevel}
Rule-based reason: ${input.computedReason}
Total fee assigned: ₹${input.totalFees}
Total paid: ₹${input.totalPaid}
Remaining balance: ₹${input.remainingBalance}
Days overdue: ${input.maxDaysOverdue}
Missed reminder count: ${input.brokenPromiseCount}

Write the explanation in a professional, empathetic tone. Do NOT make payment decisions or suggest waivers.`;

    const text = await generateContent(
      [{ role: "user", parts: [{ text: prompt }] }],
      { temperature: 0.3 }
    );

    return text.trim();
  } catch {
    // Silent failure — caller must fall back to computed_reason
    return null;
  }
}
