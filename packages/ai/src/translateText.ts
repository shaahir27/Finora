/**
 * Gemini AI Batch Translation & Fallback Engine
 * Translates missing UI phrases or dynamic text into target Indian languages using Gemini API.
 * Supports single-phrase and high-efficiency batch translation (reducing API calls & rate limits).
 */

import { generateContent } from "./geminiClient";

const LANGUAGE_NAME_MAP: Record<string, string> = {
  hi: "Hindi (हिंदी)",
  bn: "Bengali (বাংলা)",
  mr: "Marathi (मराठी)",
  te: "Telugu (తెలుగు)",
  ta: "Tamil (தமிழ்)",
  gu: "Gujarati (ગુજરાતી)",
  kn: "Kannada (ಕನ್ನಡ)",
  en: "English",
};

export async function translateTextWithGemini(
  text: string,
  targetLocale: string
): Promise<string> {
  if (!text || targetLocale === "en") return text;

  const targetLang = LANGUAGE_NAME_MAP[targetLocale] || targetLocale;

  try {
    const prompt = `You are a professional translator for an Indian School Financial application.
Translate the following short UI phrase into ${targetLang}.
Return ONLY the exact translated text in native script, with zero additional explanations, markdown formatting, or surrounding quotes.

Text to translate: "${text}"`;

    const response = await generateContent(
      [{ role: "user", parts: [{ text: prompt }] }],
      { temperature: 0.1 }
    );

    const translated = response.trim().replace(/^["']|["']$/g, "");
    return translated || text;
  } catch (err) {
    console.error("Gemini AI Translation Fallback error:", err);
    return text;
  }
}

/**
 * Batch translation function — translates an array of phrases in a single Gemini API request
 * to optimize throughput, prevent rate limits, and minimize network overhead.
 */
export async function translateBatchWithGemini(
  phrases: string[],
  targetLocale: string
): Promise<Record<string, string>> {
  if (!phrases.length || targetLocale === "en") {
    return Object.fromEntries(phrases.map((p) => [p, p]));
  }

  const targetLang = LANGUAGE_NAME_MAP[targetLocale] || targetLocale;

  try {
    const prompt = `You are a professional translator for an Indian School Financial application.
Translate the JSON array of UI strings into ${targetLang}.
Respond ONLY with a valid JSON object mapping each original English key to its translated string in native script. Do NOT include markdown blocks or extra text.

Input JSON:
${JSON.stringify(phrases, null, 2)}`;

    const response = await generateContent(
      [{ role: "user", parts: [{ text: prompt }] }],
      { temperature: 0.1 }
    );

    const cleanJson = response
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(cleanJson);
  } catch (err) {
    console.error("Gemini AI Batch Translation error:", err);
    return Object.fromEntries(phrases.map((p) => [p, p]));
  }
}
