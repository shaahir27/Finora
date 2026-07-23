/**
 * answerDashboardQuery — AI Feature 2
 *
 * Interprets a natural-language question from an admin against aggregated ledger data.
 * Gemini FORMATS and INTERPRETS the question — it does NOT generate SQL independently
 * and does NOT receive raw database credentials.
 *
 * The ledger snapshot is pre-fetched by the calling server action (getLedgerSnapshot)
 * and passed in as structured data — this is how "never raw DB access from Gemini" is
 * maintained even for the NL query feature.
 *
 * On failure: returns an error string. UI shows a plain error state (not a stuck spinner).
 */

import { generateContent } from "./geminiClient.js";

export interface LedgerContext {
  totalCollected: number;
  outstandingDuesTotal: number;
  reconciliationStats: { matchPercentage: number; flaggedCount: number };
  revenueByChannel: Array<{ channel: string; amount: number }>;
  /** Recent transactions, limited to avoid prompt bloat */
  recentTransactions: Array<{
    id: string;
    channel: string;
    amount: number;
    reconciliationStatus: string;
    studentName?: string;
    postedAt: string;
  }>;
}

/**
 * Answers a natural-language dashboard question against a pre-fetched ledger context.
 * Returns an answer string or an error string prefixed with "Error:".
 * Never generates SQL. Never receives DB credentials.
 */
export async function answerDashboardQuery(
  question: string,
  context: LedgerContext
): Promise<string> {
  const systemInstruction = `You are a school fee management assistant answering questions about a school's financial data.
Answer based ONLY on the data provided below. Do not guess, extrapolate, or use general financial knowledge 
to fill in data that isn't present. If the data doesn't contain enough information to answer, say so clearly.
Do NOT make financial decisions, suggest waivers, or recommend payment actions.`;

  const contextSummary = `
Current ledger data:
- Total collected this period: ₹${context.totalCollected}
- Outstanding dues: ₹${context.outstandingDuesTotal}
- Reconciliation match: ${context.reconciliationStats.matchPercentage}% (${context.reconciliationStats.flaggedCount} flagged)
- Revenue by channel: ${context.revenueByChannel.map((c) => `${c.channel}: ₹${c.amount}`).join(", ")}
- Recent transactions (last ${context.recentTransactions.length}):
${context.recentTransactions
  .map(
    (t) =>
      `  • ${t.channel} ₹${t.amount} | ${t.reconciliationStatus} | ${t.studentName ?? "unknown"} | ${t.postedAt}`
  )
  .join("\n")}

Admin question: ${question}`;

  try {
    const text = await generateContent(
      [{ role: "user", parts: [{ text: contextSummary }] }],
      { systemInstruction, temperature: 0.2 }
    );
    return text.trim();
  } catch (err) {
    return `Error: Unable to answer right now — ${err instanceof Error ? err.message : "Gemini unavailable"}. Try again shortly.`;
  }
}
