"use client";

import { useState, useEffect } from "react";
import { Volume2, VolumeX, Languages } from "lucide-react";
import { getSoundboxPreferences, setSoundboxPreferences, type SoundboxLanguage } from "@/lib/soundbox";

export function SoundboxToggle() {
  const [enabled, setEnabled] = useState(true);
  const [language, setLanguage] = useState<SoundboxLanguage>("en");

  useEffect(() => {
    const prefs = getSoundboxPreferences();
    setEnabled(prefs.enabled);
    setLanguage(prefs.language);
  }, []);

  const toggleEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    setSoundboxPreferences({ enabled: next });
  };

  const toggleLanguage = () => {
    const next: SoundboxLanguage = language === "en" ? "hi" : "en";
    setLanguage(next);
    setSoundboxPreferences({ language: next });
  };

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 border border-[#0F5A47]/20 shadow-xs backdrop-blur-md">
      <button
        type="button"
        onClick={toggleEnabled}
        title={enabled ? "Soundbox Audio On" : "Soundbox Audio Off"}
        className={`flex items-center gap-1 text-xs font-bold transition-colors ${
          enabled ? "text-[#0F5A47]" : "text-[#94A3B8]"
        }`}
      >
        {enabled ? <Volume2 className="w-4 h-4 text-[#0F5A47] animate-pulse" /> : <VolumeX className="w-4 h-4 text-[#94A3B8]" />}
        <span className="hidden sm:inline">Soundbox {enabled ? "ON" : "OFF"}</span>
      </button>

      {enabled && (
        <button
          type="button"
          onClick={toggleLanguage}
          title="Switch Soundbox Voice Language"
          className="ml-1 px-1.5 py-0.5 rounded-md bg-[#0F5A47]/10 hover:bg-[#0F5A47]/20 text-[10px] font-extrabold uppercase text-[#0F5A47] transition-all flex items-center gap-0.5"
        >
          <Languages className="w-3 h-3 text-[#0F5A47]" />
          <span>{language === "en" ? "ENG" : "HIN"}</span>
        </button>
      )}
    </div>
  );
}
