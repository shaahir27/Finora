/**
 * Shared Gemini API client for packages/ai.
 *
 * Rules (system_architecture.md — Gemini integration contract):
 * - Server-side only. Never imported from a client component.
 * - API key is read from GEMINI_API_KEY env var — never committed, never in client bundle.
 * - A failed/slow/malformed Gemini response must NEVER block or corrupt a money-affecting write.
 *   All callers must handle null / thrown errors gracefully (fallback, not crash).
 */

export interface GeminiTextPart {
  text: string;
}

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiTextPart[];
}

export interface GeminiGenerateOptions {
  model?: string;
  systemInstruction?: string;
  temperature?: number;
}

/**
 * Calls the Gemini generateContent REST endpoint.
 * Returns the text of the first candidate's first part, or throws on network/API error.
 * Callers are responsible for catching and falling back.
 */
export async function generateContent(
  contents: GeminiContent[],
  options: GeminiGenerateOptions = {}
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Check Vercel environment variables.");
  }

  const model = options.model ?? "gemini-3.1-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body: Record<string, unknown> = { contents };
  if (options.systemInstruction) {
    body.systemInstruction = { parts: [{ text: options.systemInstruction }] };
  }
  if (options.temperature !== undefined) {
    body.generationConfig = { temperature: options.temperature };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // 15-second hard timeout — never let a slow Gemini response stall the UI indefinitely
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}
