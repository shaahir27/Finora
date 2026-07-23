/**
 * answerHowDoI — Copilot helper tool
 *
 * Retrieval-grounded Q&A over curated excerpts from user_flows.md and ui_ux_specification.md.
 * Answers are drawn from THIS SYSTEM's actual behavior, not general financial system knowledge.
 *
 * "Retrieval-grounded, not free-generation" (api_specification.md):
 * The excerpt set below is curated from the actual spec documents. Gemini synthesizes
 * an answer FROM these excerpts — it does not generate guidance about how fee management
 * systems "typically" work in general.
 *
 * This is one of the whitelisted tools available to copilotQuery for both roles.
 * It is NOT a standalone user-facing action (hence no "use server" directive — it is
 * called from within copilotQuery, which is a server-only function).
 */

import { generateContent } from "./geminiClient.js";

type Role = "admin" | "parent";

// ---------------------------------------------------------------------------
// Curated excerpt set — drawn verbatim or paraphrased from docs/user_flows.md
// and docs/ui_ux_specification.md. Session 5 may add parent-specific entries.
// ---------------------------------------------------------------------------

const ADMIN_EXCERPTS: Record<string, string> = {
  "record payment":
    "Go to Dashboard > Ledger. Click 'Record Payment'. Select the student, fee type, amount, and channel (UPI/Cash/Cheque). For cheque, the payment will show as 'Pending' until you mark it cleared from the ledger. UPI uses the Razorpay sandbox; a link is sent or you enter the ref number manually.",
  "apply waiver":
    "Navigate to the student's fee row. Click 'Apply Waiver'. Enter the amount, a mandatory reason (required — no waiver can exist without a reason), and confirm. This triggers a defaulter score recompute immediately. Every waiver is permanently audit-logged.",
  "apply penalty":
    "From the ledger or student profile, click 'Apply Penalty' on a transaction. Enter amount and a mandatory reason. Penalties are logged in the audit trail.",
  "mark cheque cleared":
    "In the Ledger, find the cheque_pending transaction. Click 'Mark Cleared'. The payment moves from pending to posted and counts in the collected total.",
  "mark cheque bounced":
    "In the Ledger, find the cheque_pending transaction. Click 'Mark Bounced'. Enter a mandatory reason. The balance is reopened and the student's defaulter score is immediately recomputed.",
  "ocr upload":
    "Click 'OCR Upload' in the sidebar. Upload a receipt image. The system extracts amount, date, and reference number — review these carefully, correct if needed, then click Confirm. Nothing posts to the ledger until you explicitly confirm.",
  "view anomalies":
    "Flagged transactions appear with an orange badge in the Ledger. Click on a flagged transaction to see the anomaly reason. Anomalies require manual review — the system flags them but does not auto-resolve them.",
  "send reminder":
    "Go to the Reminders Queue (sidebar). Draft a reminder using the 'Draft' button — the AI will generate message text. Review it, then click 'Mark Sent' to log it as sent. WhatsApp and SMS reminders are simulated (logged but not actually delivered). Email is delivered in real if the parent has an email on file.",
  "defaulter view":
    "The Defaulter Tracking screen shows all students with outstanding dues, sorted by risk level (High → Medium → Low). Only active students appear. Students who have withdrawn/graduated/transferred are excluded. Click a student to see their AI-generated insight and full history.",
  "student profile":
    "Click any student in the Student Directory or Defaulter view to open their profile. The profile shows all fee assignments, full payment history across all channels, waivers, penalties, reminders, and defaulter risk history.",
  "student status":
    "To withdraw, graduate, or transfer a student: open their profile, click 'Change Status'. If they have an outstanding balance, you must choose to either write it off (creates a waiver) or carry it forward. The student is removed from the active Defaulter view either way.",
  "offline payment":
    "If you lose internet connectivity while recording a cash or cheque payment, the form will automatically queue the entry locally. A badge in the sidebar shows pending entries. When connectivity returns, click 'Sync Now' to post them. If a conflict occurs (e.g., the balance changed while you were offline), it appears in the Offline Sync Queue for manual review.",
  "push notifications":
    "In Settings, enable push notifications. You'll receive alerts when payments post, cheques bounce, or anomalies are flagged. Each alert links directly to the relevant item. You can disable notifications at any time from the same settings page.",
  "weekly digest":
    "The AI Copilot opens with a weekly digest showing the past 7 days vs the prior 7 days: collections trend, cheque aging summary, and which students moved to a higher or lower risk tier.",
};

const PARENT_EXCERPTS: Record<string, string> = {
  "view dues":
    "After logging in, your dashboard shows all outstanding fees for your linked child/children. If you have more than one child at the school, a selector at the top lets you switch between them. Each due shows the amount, what it's for, and the due date.",
  "pay fee":
    "Click 'Pay Now' next to a fee. You can pay the full amount or a partial amount (must be greater than zero). Payment goes through UPI via Razorpay sandbox. You'll receive a confirmation once the payment is processed. The due date does not change for any remaining balance after a partial payment.",
  "view payment history":
    "The 'Payment History' section shows all your past payments, their status (posted/pending), and links to download receipts.",
  "download receipt":
    "From Payment History, click the download icon next to a posted transaction to download the GST-formatted receipt as a PDF.",
  "gst on fees":
    "GST is charged on taxable fee types only. The fee amount shown to you is GST-inclusive — meaning GST is already included in the total, not added on top. Exempt fee types (such as core tuition at most schools) do not have GST.",
  "login":
    "You log in with your registered phone number. A one-time password (OTP) is sent via SMS. If SMS doesn't arrive, you can also use your registered email address for an email OTP. Contact your school's finance office if you can't log in — they manage account registration and only registered accounts can receive an OTP.",
  "push notifications":
    "In your account settings, you can enable push notifications to receive a confirmation the moment a payment posts. You can disable this at any time.",
};

/**
 * Finds the most relevant excerpt(s) for a given topic and role, then asks Gemini
 * to synthesize a grounded answer. Falls back to the raw excerpt if Gemini fails.
 */
export async function answerHowDoI(role: Role, topic: string): Promise<string> {
  const excerpts = role === "admin" ? ADMIN_EXCERPTS : PARENT_EXCERPTS;

  // Find relevant excerpts by keyword matching (simple, deterministic — no AI in the retrieval step)
  const topicLower = topic.toLowerCase();
  const relevant = Object.entries(excerpts)
    .filter(([key]) => topicLower.includes(key) || key.split(" ").some((w) => topicLower.includes(w)))
    .map(([, value]) => value);

  if (relevant.length === 0) {
    return `I don't have specific guidance on "${topic}" in my knowledge base. Please check with your school's finance office or refer to the help documentation.`;
  }

  const excerptText = relevant.join("\n\n");

  try {
    const prompt = `You are a helpful assistant for a school fee management system. 
Answer the user's question using ONLY the guidance excerpts provided below.
Do not add information from general knowledge. If the excerpts don't fully answer the question, say so.

User question: "${topic}"
User role: ${role}

Guidance excerpts:
${excerptText}

Provide a clear, concise answer in 2-4 sentences.`;

    const text = await generateContent(
      [{ role: "user", parts: [{ text: prompt }] }],
      { temperature: 0.2 }
    );
    return text.trim();
  } catch {
    // Fallback: return the raw excerpt directly
    return relevant[0] ?? "I don't have information on that topic.";
  }
}
