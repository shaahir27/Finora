/**
 * apps/web/src/lib/soundbox.ts
 *
 * Client-side AI Audio Soundbox helper using native W3C SpeechSynthesis API.
 * Provides bilingual (Hindi & English) spoken confirmation for cash/cheque/UPI
 * fee payments posted at the admin desk or parent portal. Zero external API keys required.
 */

export type SoundboxLanguage = "en" | "hi";

interface SoundboxOptions {
  enabled: boolean;
  language: SoundboxLanguage;
}

const STORAGE_KEY_ENABLED = "finora_soundbox_enabled";
const STORAGE_KEY_LANG = "finora_soundbox_lang";

export function getSoundboxPreferences(): SoundboxOptions {
  if (typeof window === "undefined") {
    return { enabled: true, language: "en" };
  }
  const enabledStr = localStorage.getItem(STORAGE_KEY_ENABLED);
  const langStr = localStorage.getItem(STORAGE_KEY_LANG) as SoundboxLanguage;
  return {
    enabled: enabledStr !== "false",
    language: langStr === "hi" ? "hi" : "en",
  };
}

export function setSoundboxPreferences(options: Partial<SoundboxOptions>) {
  if (typeof window === "undefined") return;
  if (options.enabled !== undefined) {
    localStorage.setItem(STORAGE_KEY_ENABLED, String(options.enabled));
  }
  if (options.language !== undefined) {
    localStorage.setItem(STORAGE_KEY_LANG, options.language);
  }
}

/**
 * Speaks an audible fee confirmation phrase using the browser's speech synthesizer.
 * Supports native Devanagari Hindi as well as Romanized phonetic fallback for OS
 * environments (e.g. Windows without native Hindi voice packs) to ensure 100% reliable Hindi audio.
 */
export function playPaymentSoundbox(
  amount: number,
  studentName?: string,
  classInfo?: string,
  overrideLang?: SoundboxLanguage
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  const prefs = getSoundboxPreferences();
  if (!prefs.enabled) return;

  const lang = overrideLang || prefs.language;
  const formattedAmount = amount.toLocaleString("en-IN");
  const name = studentName || "Student";

  // Cancel any ongoing speech to prevent queue overlap
  window.speechSynthesis.cancel();

  const voices = window.speechSynthesis.getVoices();
  const hasNativeHindiVoice = voices.some(
    (v) => v.lang.toLowerCase().includes("hi") || v.name.toLowerCase().includes("hindi")
  );

  let phrase = "";
  let targetLang = "en-IN";

  if (lang === "hi") {
    if (hasNativeHindiVoice) {
      phrase = `${name} के लिए ₹${formattedAmount} रुपये का भुगतान प्राप्त हुआ।`;
      targetLang = "hi-IN";
    } else {
      // Romanized phonetic Hindi fallback for OS without native Devanagari SAPI voice pack
      phrase = `${name} ke liye ${formattedAmount} rupees ka bhugtan praapt hua.`;
      targetLang = "en-IN";
    }
  } else {
    phrase = `Payment of ₹${formattedAmount} received for ${name}.`;
    targetLang = "en-IN";
  }

  const utterance = new SpeechSynthesisUtterance(phrase);
  utterance.rate = 0.92; // Optimized rate for clear pronunciation
  utterance.pitch = 1.0;
  utterance.lang = targetLang;

  // Match best voice available
  const matchedVoice = voices.find((v) => {
    const vLang = v.lang.toLowerCase();
    const vName = v.name.toLowerCase();
    if (lang === "hi") {
      return (
        vLang.includes("hi") ||
        vName.includes("hindi") ||
        vLang.includes("en-in") ||
        vName.includes("india")
      );
    }
    return vLang.includes("en-in") || vName.includes("india") || vLang.includes("en-us");
  });

  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  window.speechSynthesis.speak(utterance);
}
