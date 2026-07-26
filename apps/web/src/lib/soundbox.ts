/**
 * apps/web/src/lib/soundbox.ts
 *
 * Client-side AI Audio Soundbox helper using native W3C SpeechSynthesis API.
 * Provides bilingual (Hindi & English) spoken confirmation for cash/cheque/UPI
 * fee payments posted at the admin desk. Zero external API keys required.
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

  let phrase = "";
  if (lang === "hi") {
    phrase = `${name} के लिए ₹${formattedAmount} रुपये का भुगतान प्राप्त हुआ।`;
  } else {
    phrase = `Payment of ₹${formattedAmount} received for ${name}.`;
  }

  // Cancel any ongoing speech to avoid queue congestion
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(phrase);
  utterance.rate = 0.95; // Slightly slower for crisp clarity
  utterance.pitch = 1.0;
  utterance.lang = lang === "hi" ? "hi-IN" : "en-IN";

  // Try finding an appropriate voice
  const voices = window.speechSynthesis.getVoices();
  const matchedVoice = voices.find((v) =>
    lang === "hi" ? v.lang.includes("hi") : v.lang.includes("en-IN") || v.lang.includes("en-US")
  );
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  window.speechSynthesis.speak(utterance);
}
