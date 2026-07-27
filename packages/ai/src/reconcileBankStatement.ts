/**
 * reconcileBankStatement — Bank Statement Auto-Reconciliation Engine
 *
 * Parses raw bank statement text or CSV (ICICI, HDFC, SBI, Axis, etc.)
 * Extracts bank line items: UTR / RRN ref number, amount, date, depositor narration.
 * Performs two-phase matching:
 *  1. Rule Matcher: Matches exact UTR/RRN numbers against transaction/assignment records.
 *  2. Gemini AI Matcher: For un-matched bank lines, uses Gemini AI to semantically compare
 *     depositor narration (e.g. "NEFT-INB-Rahul Sharma Class 5") against unpaid student fee assignments.
 */

import { generateContent } from "./geminiClient";

export interface BankLineItem {
  lineId: string;
  date: string;
  refNumber: string;
  amount: number;
  narration: string;
  channel: "upi" | "cash" | "cheque";
}

export interface StudentFeeContext {
  id: string; // feeAssignmentId
  studentId: string;
  studentName: string;
  admissionNumber: string | null;
  className: string;
  feeTypeName: string;
  amount: number;
  remainingBalance: number;
  dueDate: string;
}

export interface MatchedBankItem {
  bankLine: BankLineItem;
  matchedAssignment: StudentFeeContext;
  confidence: "100% (UTR Match)" | "High (AI Match)" | "Medium (Probable Match)";
  reason: string;
}

export interface BankReconciliationResult {
  autoMatched: MatchedBankItem[];
  probableMatches: Array<{
    bankLine: BankLineItem;
    candidateAssignments: StudentFeeContext[];
    reason: string;
  }>;
  unlinkedSuspense: BankLineItem[];
}

/**
 * Helper to parse raw bank statement CSV or text lines into BankLineItem objects.
 */
export function parseBankStatementText(text: string): BankLineItem[] {
  if (!text || !text.trim()) return [];

  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const items: BankLineItem[] = [];

  let counter = 1;

  for (const line of lines) {
    // Skip header lines
    if (
      line.toLowerCase().includes("date") &&
      (line.toLowerCase().includes("amount") || line.toLowerCase().includes("balance") || line.toLowerCase().includes("narration"))
    ) {
      continue;
    }

    const parts = line.includes(",")
      ? line.split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""))
      : line.split(/\t+|\s{2,}/).map((p) => p.trim());

    if (parts.length < 2) continue;

    let amount = 0;
    let dateStr = new Date().toISOString().split("T")[0]!;
    let refNumber = `REF-${Date.now()}-${counter}`;
    let channel: "upi" | "cash" | "cheque" = "upi";

    for (const part of parts) {
      const cleanNum = part.replace(/[₹,]/g, "");
      if (!isNaN(Number(cleanNum)) && Number(cleanNum) > 0 && amount === 0) {
        amount = Number(cleanNum);
      } else if (/^(UTR|RRN|UPI|CHQ|NEFT|IMPS|FT|TXN)[A-Z0-9_-]+/i.test(part) || /^\d{6,16}$/.test(part)) {
        refNumber = part;
      } else if (/\d{2}[\/-]\d{2}[\/-]\d{2,4}/.test(part)) {
        dateStr = part;
      }
    }

    const upperLine = line.toUpperCase();
    if (upperLine.includes("CHQ") || upperLine.includes("CHEQUE") || upperLine.includes("CLR")) {
      channel = "cheque";
    } else if (upperLine.includes("CASH") || upperLine.includes("DEPOSIT") || upperLine.includes("CDM")) {
      channel = "cash";
    } else {
      channel = "upi";
    }

    if (amount > 0) {
      items.push({
        lineId: `line-${counter++}`,
        date: dateStr,
        refNumber,
        amount,
        narration: line,
        channel,
      });
    }
  }

  return items;
}

/**
 * Reconciles bank statement items against unpaid student fee assignments.
 */
export async function reconcileBankStatement(
  statementText: string,
  openFeeAssignments: StudentFeeContext[]
): Promise<BankReconciliationResult> {
  const bankLines = parseBankStatementText(statementText);

  if (bankLines.length === 0 || openFeeAssignments.length === 0) {
    return {
      autoMatched: [],
      probableMatches: [],
      unlinkedSuspense: bankLines,
    };
  }

  const autoMatched: MatchedBankItem[] = [];
  const remainingBankLines: BankLineItem[] = [];

  // Phase 1: Direct Rule Matching (UTR / Ref Number or exact name match)
  for (const line of bankLines) {
    let matchedIndex = -1;

    // Check exact UTR match
    if (line.refNumber && line.refNumber.length > 5) {
      matchedIndex = openFeeAssignments.findIndex(
        (fa) => fa.id === line.refNumber || fa.studentName.toLowerCase() === line.refNumber.toLowerCase()
      );
    }

    // Check exact name + exact remaining balance match
    if (matchedIndex === -1) {
      matchedIndex = openFeeAssignments.findIndex((fa) => {
        const nameInNarration = line.narration.toLowerCase().includes(fa.studentName.toLowerCase());
        const amountMatch = Math.abs(fa.remainingBalance - line.amount) < 0.01;
        return nameInNarration && amountMatch;
      });
    }

    if (matchedIndex !== -1) {
      const assignment = openFeeAssignments[matchedIndex]!;
      autoMatched.push({
        bankLine: line,
        matchedAssignment: assignment,
        confidence: "100% (UTR Match)",
        reason: `Matched exact student details for ${assignment.studentName} (₹${assignment.remainingBalance}).`,
      });
    } else {
      remainingBankLines.push(line);
    }
  }

  // Phase 2: Gemini AI Semantic Matching for remaining lines
  const probableMatches: BankReconciliationResult["probableMatches"] = [];
  const unlinkedSuspense: BankLineItem[] = [];

  if (remainingBankLines.length > 0) {
    try {
      const prompt = `You are an AI Bank Statement Auto-Reconciliation Engine for an Indian School.
Match the bank statement transaction lines to the candidate unpaid student fee assignments.

Unpaid Student Fee Assignments:
${JSON.stringify(
  openFeeAssignments.map((fa) => ({
    assignmentId: fa.id,
    studentName: fa.studentName,
    admissionNumber: fa.admissionNumber,
    className: fa.className,
    feeType: fa.feeTypeName,
    dueAmount: fa.remainingBalance,
  })),
  null,
  2
)}

Unmatched Bank Statement Lines:
${JSON.stringify(remainingBankLines, null, 2)}

Respond strictly in valid JSON with an array of matches:
[
  {
    "lineId": "line-X",
    "matchedAssignmentId": "feeAssignmentId",
    "confidence": "High" | "Medium",
    "reason": "Brief explanation"
  }
]
If a line cannot be matched to any student, do not include it in the JSON. Return ONLY JSON without markdown blocks.`;

      const response = await generateContent(
        [{ role: "user", parts: [{ text: prompt }] }],
        { temperature: 0.1 }
      );

      const cleanJson = response.replace(/```json/g, "").replace(/```/g, "").trim();
      const aiMatches: Array<{
        lineId: string;
        matchedAssignmentId: string;
        confidence: "High" | "Medium";
        reason: string;
      }> = JSON.parse(cleanJson);

      const matchedLineIds = new Set<string>();

      for (const m of aiMatches) {
        const bankLine = remainingBankLines.find((l) => l.lineId === m.lineId);
        const assignment = openFeeAssignments.find((fa) => fa.id === m.matchedAssignmentId);

        if (bankLine && assignment) {
          matchedLineIds.add(bankLine.lineId);
          autoMatched.push({
            bankLine,
            matchedAssignment: assignment,
            confidence: m.confidence === "High" ? "High (AI Match)" : "Medium (Probable Match)",
            reason: m.reason,
          });
        }
      }

      for (const line of remainingBankLines) {
        if (!matchedLineIds.has(line.lineId)) {
          const candidates = openFeeAssignments.filter((fa) => Math.abs(fa.remainingBalance - line.amount) < 1.0);
          if (candidates.length > 0) {
            probableMatches.push({
              bankLine: line,
              candidateAssignments: candidates,
              reason: "Amount matches candidate student fees, but depositor name could not be verified automatically.",
            });
          } else {
            unlinkedSuspense.push(line);
          }
        }
      }
    } catch (err) {
      console.error("Gemini Bank Reconciliation AI Matcher error:", err);
      for (const line of remainingBankLines) {
        const candidates = openFeeAssignments.filter((fa) => Math.abs(fa.remainingBalance - line.amount) < 1.0);
        if (candidates.length > 0) {
          probableMatches.push({
            bankLine: line,
            candidateAssignments: candidates,
            reason: "Amount matches candidate student fees.",
          });
        } else {
          unlinkedSuspense.push(line);
        }
      }
    }
  }

  return {
    autoMatched,
    probableMatches,
    unlinkedSuspense,
  };
}
