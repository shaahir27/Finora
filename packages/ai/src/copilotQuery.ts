/**
 * copilotQuery — AI Feature 7 (Admin Copilot + Parent Copilot stub)
 *
 * Function-calling over a role-specific whitelist of existing, already-RLS-scoped actions.
 * See system_architecture.md AI Copilot Architecture for full design rationale.
 *
 * SECURITY MODEL (security.md AI Copilot section):
 * - The whitelist IS the security boundary.
 * - Every whitelisted action already enforces school_id / PARENT_LINK scoping at the RLS layer.
 * - Gemini cannot see data a whitelisted action wouldn't return anyway.
 * - NO new "copilot-only" data paths are created. If a question requires data not reachable via
 *   the existing whitelisted actions, the Copilot cannot answer it — by design.
 *
 * WRITE ACTIONS ARE PERMANENTLY EXCLUDED (implementation_plan.md Session 4 constraint):
 * The following must NEVER appear in either whitelist, under any framing or future edit:
 *   recordPayment, applyWaiver, applyPenalty, markChequeBounced, reconcileMissedUpiPayment
 * The automated test in session4.test.ts asserts this statically against the array below.
 *
 * SESSION 5 NOTE: Session 5 (Member 4, Parent portal) extends PARENT_COPILOT_WHITELIST
 * in this same file. Search for "PARENT_COPILOT_WHITELIST" to find the extension point.
 * Do NOT create a separate copilotQuery function for parents — this single function handles
 * both roles via the role parameter. See AI_INSTRUCTIONS.md Section 5.
 */

import { generateContent, type GeminiContent } from "./geminiClient";
import { answerHowDoI } from "./answerHowDoI";

// ---------------------------------------------------------------------------
// ADMIN COPILOT WHITELIST
// Explicitly greppable array — do NOT inline these as conditional logic.
// Each entry names an action that Gemini may call on behalf of an admin user.
// Session 5 adds to PARENT_COPILOT_WHITELIST below, NOT this array.
//
// PERMANENTLY EXCLUDED (never add these):
//   recordPayment | applyWaiver | applyPenalty | markChequeBounced | reconcileMissedUpiPayment
// ---------------------------------------------------------------------------
export const ADMIN_COPILOT_WHITELIST: readonly string[] = [
  "getLedgerSnapshot",
  "getRemindersQueue",
  "narrateAnomaly",
  "narrateDefaulterInsight",
  "generateWeeklyDigest",
  "answerHowDoI",
] as const;

// ---------------------------------------------------------------------------
// PARENT COPILOT WHITELIST
// Session 5 (Member 4): extend this array with parent-facing read actions.
// See AI_INSTRUCTIONS.md Section 5 — this is a sanctioned cross-session touch.
// Also assert that risk_level / DEFAULTER_SCORE / WAIVER / AUDIT_LOG never appear here.
//
// PERMANENTLY EXCLUDED:
//   Any write action, any admin-only action, any action returning DEFAULTER_SCORE/WAIVER/AUDIT_LOG data.
// ---------------------------------------------------------------------------
export const PARENT_COPILOT_WHITELIST: readonly string[] = [
  "getMyChildrenDues",
  "getMyPaymentHistory",
  "answerHowDoI",
  "gstExplainerTool",
] as const;

// ---------------------------------------------------------------------------
// Tool definitions for Gemini function-calling
// ---------------------------------------------------------------------------

const ADMIN_TOOLS = [
  {
    name: "getLedgerSnapshot",
    description: "Get the current ledger summary including total collected, outstanding dues, flagged transactions, and revenue by channel. Use this for financial overview questions.",
    parameters: {
      type: "object",
      properties: {
        question: { type: "string", description: "The specific financial question to answer using ledger data" },
      },
      required: ["question"],
    },
  },
  {
    name: "getRemindersQueue",
    description: "Get the current reminders queue — pending reminders, stale reminders (dues already cleared), and their statuses.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "narrateDefaulterInsight",
    description: "Get an AI explanation for a specific student's defaulter risk level.",
    parameters: {
      type: "object",
      properties: {
        studentId: { type: "string", description: "The student's ID" },
        studentName: { type: "string", description: "The student's name for context" },
      },
      required: ["studentId"],
    },
  },
  {
    name: "generateWeeklyDigest",
    description: "Get the weekly financial summary comparing this week to last week.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "answerHowDoI",
    description: "Answer a how-to question about using the fee management system. Use for questions about processes, workflows, or navigation.",
    parameters: {
      type: "object",
      properties: {
        topic: { type: "string", description: "The topic or task the user is asking how to do" },
      },
      required: ["topic"],
    },
  },
];

const PARENT_TOOLS = [
  {
    name: "getMyChildrenDues",
    description: "Get the outstanding fee dues for the parent's linked children.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "getMyPaymentHistory",
    description: "Get the payment history for the parent's linked children.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "answerHowDoI",
    description: "Answer a how-to question about using the parent portal.",
    parameters: {
      type: "object",
      properties: {
        topic: { type: "string", description: "The topic the parent is asking about" },
      },
      required: ["topic"],
    },
  },
  {
    name: "gstExplainerTool",
    description: "Get the GST tax treatment and rate for a specific fee type to explain it to the parent.",
    parameters: {
      type: "object",
      properties: {
        feeType: { type: "string", description: "The name of the fee type to get tax rules for" },
      },
      required: ["feeType"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool context — pre-fetched data passed in by the server action
// Gemini never fetches data directly. The calling action fetches, passes in here.
// ---------------------------------------------------------------------------
export interface CopilotToolContext {
  /** For getLedgerSnapshot tool */
  ledgerSnapshot?: {
    totalCollected: number;
    outstandingDuesTotal: number;
    reconciliationStats: { matchPercentage: number; flaggedCount: number };
    revenueByChannel: Array<{ channel: string; amount: number }>;
    recentTransactions: Array<{
      id: string;
      channel: string;
      amount: number;
      reconciliationStatus: string;
      studentName?: string;
      postedAt: string;
    }>;
  };
  /** For getRemindersQueue tool */
  remindersQueue?: Array<{
    id: string;
    studentName: string;
    feeType: string;
    draftedText: string;
    tier: number;
    channel: string;
    status: string;
    isStale: boolean;
  }>;
  /** For generateWeeklyDigest tool */
  weeklyDigestNarration?: string;
  /** For getMyChildrenDues (parent role) */
  childrenDues?: Array<{
    studentName: string;
    feeType: string;
    amount: number;
    amountPaid: number;
    remainingBalance: number;
    dueDate: string;
    paymentStatus: string;
  }>;
  /** For getMyPaymentHistory (parent role) */
  paymentHistory?: Array<{
    amount: number;
    channel: string;
    status: string;
    postedAt: string;
    feeType: string;
  }>;
  /** For gstExplainerTool (parent role) */
  gstRules?: Array<{
    feeType: string;
    gstTreatment: string;
    gstRate: number | null;
  }>;
  /** School name for context */
  schoolName?: string;
  /** Role for answerHowDoI scoping */
  role: "admin" | "parent";
}

export interface CopilotMessage {
  role: "user" | "model";
  text: string;
}

export type CopilotResponse =
  | { type: "answer"; text: string }
  | { type: "suggestion"; suggestion: string; label: string; deepLink: string }
  | { type: "error"; text: string };

/**
 * Main Copilot entry point. Handles both admin and parent roles.
 * 
 * Conversation history lives in client-side React state — this function is stateless
 * server-side. No COPILOT_SESSION table exists or is needed. (api_specification.md)
 */
export async function copilotQuery(
  role: "admin" | "parent",
  message: string,
  conversationHistory: CopilotMessage[],
  toolContext: CopilotToolContext
): Promise<CopilotResponse> {
  const tools = role === "admin" ? ADMIN_TOOLS : PARENT_TOOLS;
  const whitelist = role === "admin" ? ADMIN_COPILOT_WHITELIST : PARENT_COPILOT_WHITELIST;

  // Build conversation history for Gemini
  const contents: GeminiContent[] = conversationHistory.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));
  contents.push({ role: "user", parts: [{ text: message }] });

  const systemInstruction = role === "admin"
    ? `You are an AI assistant for a school fee management system, helping school finance administrators.
You have access to specific financial data tools. When answering questions:
- Use the provided tools to get accurate data — do not guess financial figures.
- You may SUGGEST actions (e.g., "you have 3 stale reminders to review") but NEVER execute actions.
- You cannot record payments, apply waivers, apply penalties, or make any financial changes.
- If asked to perform a financial action, politely explain you can only provide information and suggest the admin use the relevant screen.
- Keep responses concise and professional.
School: ${toolContext.schoolName ?? "your school"}`
    : `You are an AI assistant helping a parent manage school fee payments.
You have access to your children's fee and payment information.
- Answer based only on the provided data — do not guess.
- You cannot make payments, but you can explain fees and direct the parent to the payment screen.
- Do not reveal information about other families' fees or payments.
- Keep responses clear and friendly.`;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");

    const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
      contents,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      tools: [{ functionDeclarations: tools }],
      generationConfig: { temperature: 0.3 },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      throw new Error(`Gemini API error ${res.status}`);
    }

    const data = await res.json();
    const candidate = data?.candidates?.[0];

    // Check for a function call request
    const functionCall = candidate?.content?.parts?.find(
      (p: Record<string, unknown>) => p.functionCall
    )?.functionCall as { name: string; args: Record<string, unknown> } | undefined;

    if (functionCall) {
      // Validate function call is in the whitelist — safety check
      if (!whitelist.includes(functionCall.name)) {
        return {
          type: "error",
          text: "I can't perform that action. Please use the relevant screen in the admin portal.",
        };
      }

      // Resolve the tool call using pre-fetched context
      const toolResult = await resolveToolCall(functionCall.name, functionCall.args, toolContext);

      // Make a second call to Gemini with the tool result
      const contentsWithResult: GeminiContent[] = [
        ...contents,
        {
          role: "model",
          parts: [{ text: `[Fetched ${functionCall.name}: ${JSON.stringify(toolResult).slice(0, 500)}]` }],
        },
        {
          role: "user",
          parts: [{ text: "Based on the data above, please answer my question." }],
        },
      ];

      const answer = await generateContent(contentsWithResult, {
        systemInstruction,
        temperature: 0.3,
      });

      // Check if we should return a suggestion with a deep link
      const suggestion = detectSuggestion(functionCall.name, toolResult);
      if (suggestion) {
        return suggestion;
      }

      return { type: "answer", text: answer.trim() };
    }

    // Direct text response (no function call needed)
    const text = candidate?.content?.parts?.[0]?.text;
    if (text) {
      return { type: "answer", text: text.trim() };
    }

    return { type: "error", text: "I couldn't generate a response. Please try again." };
  } catch (err) {
    return {
      type: "error",
      text: `I'm having trouble right now — ${err instanceof Error ? err.message : "please try again shortly"}.`,
    };
  }
}

// ---------------------------------------------------------------------------
// Tool resolution — maps function name to pre-fetched context data
// Gemini's "tool calls" are resolved from context passed in by the server action,
// NOT by making new DB calls inside this function. That would bypass RLS scoping.
// ---------------------------------------------------------------------------
async function resolveToolCall(
  name: string,
  args: Record<string, unknown>,
  context: CopilotToolContext
): Promise<unknown> {
  switch (name) {
    case "getLedgerSnapshot":
      return context.ledgerSnapshot ?? { error: "Ledger data not available in this context" };

    case "getRemindersQueue":
      return context.remindersQueue ?? [];

    case "generateWeeklyDigest":
      return context.weeklyDigestNarration ?? "Weekly digest not yet available.";

    case "narrateDefaulterInsight":
    case "narrateAnomaly":
      // These are server actions that make their own Gemini calls.
      // In Copilot context, return a stub — the actual narration is on the student's card.
      return { message: "Please open the student's profile card to see their AI insight." };

    case "answerHowDoI": {
      const topic = typeof args.topic === "string" ? args.topic : "general usage";
      return await answerHowDoI(context.role, topic);
    }

    case "getMyChildrenDues":
      return context.childrenDues ?? [];

    case "getMyPaymentHistory":
      return context.paymentHistory ?? [];

    case "gstExplainerTool":
      if (!context.gstRules) return { error: "GST rules not available in this context" };
      const feeTypeStr = String(args.feeType).toLowerCase();
      const rule = context.gstRules.find((r) => r.feeType.toLowerCase().includes(feeTypeStr) || feeTypeStr.includes(r.feeType.toLowerCase()));
      if (rule) return rule;
      return { error: `No GST rules found for fee type '${args.feeType}'` };

    default:
      return { error: `Tool '${name}' is not available.` };
  }
}

// ---------------------------------------------------------------------------
// Suggestion detection — some tool responses warrant a deep-link suggestion
// rather than a plain text answer. The Copilot may SUGGEST, never execute.
// ---------------------------------------------------------------------------
function detectSuggestion(
  toolName: string,
  result: unknown
): CopilotResponse | null {
  if (toolName === "getRemindersQueue" && Array.isArray(result)) {
    const stale = (result as Array<{ isStale: boolean }>).filter((r) => r.isStale).length;
    if (stale > 0) {
      return {
        type: "suggestion",
        suggestion: "open_reminders_queue",
        label: `${stale} reminder${stale > 1 ? "s" : ""} are stale (dues cleared) — review them`,
        deepLink: "/admin/reminders",
      };
    }
  }

  if (toolName === "getMyChildrenDues" && Array.isArray(result)) {
    const unpaid = (result as Array<{ remainingBalance: number; studentName: string; feeType: string }>).filter(
      (d) => d.remainingBalance > 0
    );
    if (unpaid.length > 0) {
      const first = unpaid[0];
      if (first) {
        return {
          type: "suggestion",
          suggestion: "pay_dues",
          label: `Pay ${first.studentName}'s ${first.feeType} (₹${first.remainingBalance})`,
          deepLink: "/parent/dues",
        };
      }
    }
  }

  return null;
}
