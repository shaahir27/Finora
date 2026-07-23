/**
 * draftReminderText — AI Feature 4
 *
 * Drafts a fee reminder message for a given student/fee assignment and reminder tier.
 * Returns the drafted text only — it does NOT write to REMINDER_LOG.
 * The calling server action (draftReminderTextAction in actions/ai.ts) writes the log row
 * with status: "logged". This function is a pure text generator.
 *
 * Governing Principle 3: No reminder is ever delivered without an explicit,
 * logged, human "mark sent" action. This function only DRAFTS — nothing sends.
 */

import { generateContent } from "./geminiClient";

export interface ReminderDraftInput {
  studentName: string;
  guardianName?: string | undefined;
  feeTypeName: string;
  amountDue: number;
  dueDate: string; // ISO date string
  daysOverdue: number;
  tier: 1 | 7 | 14; // reminder tier per business_rules.md §6
  channel: "whatsapp" | "sms" | "email";
  schoolName: string;
}

/**
 * Returns drafted reminder text appropriate for the channel and tier.
 * Throws if Gemini fails — callers should handle the error (show retry UI, etc.).
 * Unlike narration features, this is user-initiated so an error should be surfaced rather
 * than silently swallowed.
 */
export async function draftReminderText(input: ReminderDraftInput): Promise<string> {
  const urgencyMap: Record<number, string> = {
    1: "gentle first reminder",
    7: "follow-up reminder",
    14: "urgent reminder — significantly overdue",
  };

  const urgency = urgencyMap[input.tier] ?? "reminder";

  const channelInstructions: Record<string, string> = {
    whatsapp: "Format for WhatsApp: concise, friendly, 2-3 short paragraphs. Can include an emoji.",
    sms: "Format for SMS: very short (under 160 characters if possible), no emojis, plain text only.",
    email: "Format as a polite email with a subject line, greeting, body paragraph, and closing.",
  };

  const prompt = `You are a school finance communication assistant. Draft a ${urgency} to a parent/guardian.

Student: ${input.studentName}
Guardian: ${input.guardianName ?? "Parent/Guardian"}
Fee type: ${input.feeTypeName}
Amount due: ₹${input.amountDue}
Due date: ${input.dueDate}
Days overdue: ${input.daysOverdue}
School: ${input.schoolName}

${channelInstructions[input.channel] ?? ""}

Important: Do NOT promise payment extensions, waive fees, or make any financial commitments. 
Keep the tone professional and empathetic. This draft will be reviewed by school staff before sending.`;

  const text = await generateContent(
    [{ role: "user", parts: [{ text: prompt }] }],
    { temperature: 0.5 }
  );

  return text.trim();
}
