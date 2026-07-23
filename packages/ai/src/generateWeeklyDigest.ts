/**
 * generateWeeklyDigest — AI Feature 6
 *
 * Narrates pre-computed weekly trend data into plain English for the Admin Copilot opening message.
 * 
 * "Rules decide, AI narrates" (Governing Principle 1):
 * - The trend figures (collections, cheque aging, risk tier movement) are computed by the
 *   calling server action using the SAME aggregation logic getLedgerSnapshot already uses.
 * - Gemini's job is ONLY to turn these already-computed numbers into a readable summary.
 * - Gemini does NOT compute any financial figure. If it fails, the raw data is still available.
 *
 * This function is also the source of the Copilot's opening message — copilotQuery calls it
 * internally on the first turn rather than having a separate summarization path.
 */

import { generateContent } from "./geminiClient";

export interface WeeklyDigestInput {
  schoolName: string;
  currentWeek: {
    collected: number;
    transactionCount: number;
    byChannel: Array<{ channel: string; amount: number }>;
    chequePendingCount: number;
    chequePendingTotalDays: number; // sum of days each pending cheque has been waiting
  };
  previousWeek: {
    collected: number;
    transactionCount: number;
  };
  riskTierMovement: {
    movedToHigh: number;   // students who moved to high risk this week
    movedToMedium: number;
    movedToLow: number;
    resolvedRisk: number;  // students who cleared all dues
  };
  outstandingTotal: number;
}

/**
 * Returns a 3–4 sentence weekly digest narration, or a fallback summary if Gemini fails.
 * Never throws — callers always get either an AI narration or a plain-text fallback.
 */
export async function generateWeeklyDigest(input: WeeklyDigestInput): Promise<string> {
  const trend =
    input.previousWeek.collected > 0
      ? input.currentWeek.collected >= input.previousWeek.collected
        ? `up ${Math.round(((input.currentWeek.collected - input.previousWeek.collected) / input.previousWeek.collected) * 100)}%`
        : `down ${Math.round(((input.previousWeek.collected - input.previousWeek.collected) / input.previousWeek.collected) * 100)}%`
      : "no prior week data";

  const prompt = `You are a school finance assistant writing a concise weekly summary for a school administrator.
Summarize the key points in 3-4 sentences in plain language. Be specific about the numbers.

Weekly data for ${input.schoolName}:
- This week's collections: ₹${input.currentWeek.collected} (${input.currentWeek.transactionCount} transactions, ${trend} vs last week's ₹${input.previousWeek.collected})
- By channel: ${input.currentWeek.byChannel.map((c) => `${c.channel} ₹${c.amount}`).join(", ")}
- Cheques pending clearance: ${input.currentWeek.chequePendingCount} (avg ${input.currentWeek.chequePendingCount > 0 ? Math.round(input.currentWeek.chequePendingTotalDays / input.currentWeek.chequePendingCount) : 0} days waiting)
- Outstanding dues total: ₹${input.outstandingTotal}
- Risk tier changes this week: ${input.riskTierMovement.movedToHigh} moved to HIGH, ${input.riskTierMovement.movedToMedium} to MEDIUM, ${input.riskTierMovement.resolvedRisk} resolved

Do NOT make recommendations, suggest waivers, or comment on individual students. Summarise factually.`;

  try {
    const text = await generateContent(
      [{ role: "user", parts: [{ text: prompt }] }],
      { temperature: 0.3 }
    );
    return text.trim();
  } catch {
    // Fallback: build a plain-text summary from the raw numbers
    const collectionChange =
      input.previousWeek.collected > 0
        ? input.currentWeek.collected >= input.previousWeek.collected
          ? `up ₹${input.currentWeek.collected - input.previousWeek.collected} from last week`
          : `down ₹${input.previousWeek.collected - input.currentWeek.collected} from last week`
        : "";

    return `This week: ₹${input.currentWeek.collected} collected across ${input.currentWeek.transactionCount} transactions${collectionChange ? ` — ${collectionChange}` : ""}. ${input.currentWeek.chequePendingCount} cheque(s) pending clearance. ${input.riskTierMovement.movedToHigh} student(s) moved to high risk; ${input.riskTierMovement.resolvedRisk} resolved. Outstanding dues: ₹${input.outstandingTotal}.`;
  }
}
