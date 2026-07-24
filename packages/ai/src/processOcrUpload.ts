/**
 * processOcrUpload — AI Feature 5a
 *
 * Sends a receipt image URL to Gemini Vision and extracts structured payment fields.
 * Returns extracted fields only — does NOT write to OCR_STAGING.
 * The calling server action (processOcrUploadAction) writes to OCR_STAGING with confirmed: false.
 *
 * HARD CONSTRAINT: This function and its caller may NEVER cause a TRANSACTION row to be created.
 * Only confirmOcrEntry (Feature 5b) may post an OCR-originated payment, and only after
 * explicit admin confirmation. See api_specification.md — confirmOcrEntry.
 */

import { generateContent } from "./geminiClient";

export interface OcrExtractionResult {
  /** Extracted payment amount in INR, or null if not found/ambiguous */
  amount: number | null;
  /** ISO date string of the payment date, or null */
  date: string | null;
  /** Reference number (cheque number, UPI ref, etc.), or null */
  refNumber: string | null;
  /** Payer name if visible, or null */
  payerName: string | null;
  /** Raw explanation from Gemini about what it found */
  extractionNotes: string;
  /** Confidence: high | medium | low */
  confidence: "high" | "medium" | "low";
}

/**
 * Extracts payment fields from a receipt image URL using Gemini Vision.
 * Throws if the API call fails — callers should handle the error and show a retry UI.
 */
export async function processOcrUpload(imageUrl: string): Promise<OcrExtractionResult> {
  const prompt = `You are a payment receipt OCR assistant for a school fee management system.
Extract the following fields from this receipt image if visible:
1. Payment amount (in Indian Rupees / INR)
2. Payment date (ISO 8601 format: YYYY-MM-DD)
3. Reference number (cheque number, UPI transaction ID, or similar)
4. Payer name

Respond ONLY with valid JSON in this exact structure (no markdown code block):
{
  "amount": <number or null>,
  "date": "<YYYY-MM-DD string or null>",
  "refNumber": "<string or null>",
  "payerName": "<string or null>",
  "extractionNotes": "<brief explanation of what you found and any ambiguity>",
  "confidence": "<high|medium|low>"
}

If a field is not visible or ambiguous, use null. Do NOT guess amounts from context.`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  // Use the multimodal endpoint with an inline image URL
  const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            fileData: {
              mimeType: "image/jpeg",
              fileUri: imageUrl,
            },
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.1 },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini OCR API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini returned an empty OCR response.");
  }

  try {
    const parsed = JSON.parse(text.trim()) as OcrExtractionResult;
    return parsed;
  } catch {
    // Gemini returned non-JSON — wrap it in a low-confidence result
    return {
      amount: null,
      date: null,
      refNumber: null,
      payerName: null,
      extractionNotes: `Could not parse structured response: ${text.slice(0, 200)}`,
      confidence: "low",
    };
  }
}
