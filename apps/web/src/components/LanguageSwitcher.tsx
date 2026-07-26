"use client";

import { useState, useEffect, useRef } from "react";
import { Globe, Check } from "lucide-react";
import { playTactileSound } from "@/lib/playTactileSound";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", script: "English" },
  { code: "hi", label: "Hindi", script: "हिंदी" },
  { code: "bn", label: "Bengali", script: "বাংলা" },
  { code: "mr", label: "Marathi", script: "मराठी" },
  { code: "te", label: "Telugu", script: "తెలుగు" },
  { code: "ta", label: "Tamil", script: "தமிழ்" },
  { code: "gu", label: "Gujarati", script: "ગુજરાતી" },
  { code: "kn", label: "Kannada", script: "ಕನ್ನಡ" },
];

export function LanguageSwitcher() {
  const [currentLocale, setCurrentLocale] = useState("en");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("finora_parent_locale") || "en";
    setCurrentLocale(saved);

    // Also sync when changed from another component
    const handleLocaleChange = (e: Event) => {
      setCurrentLocale((e as CustomEvent).detail);
    };
    window.addEventListener("finora_locale_change", handleLocaleChange);
    return () => window.removeEventListener("finora_locale_change", handleLocaleChange);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSelectLanguage = (code: string) => {
    playTactileSound("click");
    setCurrentLocale(code);
    localStorage.setItem("finora_parent_locale", code);
    // Dispatch event — I18nProvider listens to this and re-renders all translated text
    window.dispatchEvent(new CustomEvent("finora_locale_change", { detail: code }));
    setIsOpen(false);
  };

  const activeLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === currentLocale) || SUPPORTED_LANGUAGES[0];

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 rounded-xl bg-white border border-[#0F5A47]/20 text-[#0F172A] text-xs font-extrabold hover:bg-[#0F5A47]/10 transition-all flex items-center gap-1.5 shadow-sm whitespace-nowrap"
      >
        <Globe className="w-3.5 h-3.5 text-[#0F5A47] flex-shrink-0" />
        <span>{activeLang?.script}</span>
      </button>

      {isOpen && (
        <div
          className="absolute left-0 mt-2 w-52 rounded-2xl bg-white border border-[#0F5A47]/20 shadow-2xl z-[9999] overflow-hidden font-sans"
          style={{ maxWidth: "calc(100vw - 1rem)" }}
        >
          <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase text-[#475569] tracking-wider border-b border-[#0F5A47]/15 bg-[#F4F1EA]">
            Select Language (भाषा बदलें)
          </div>
          <div className="max-h-60 overflow-y-auto divide-y divide-black/5">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = currentLocale === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleSelectLanguage(lang.code)}
                  className={`w-full px-3.5 py-2.5 text-left text-xs font-bold transition-all flex items-center justify-between ${
                    isSelected
                      ? "bg-[#0F5A47]/10 text-[#0F5A47]"
                      : "text-[#0F172A] hover:bg-black/5"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-extrabold">{lang.script}</span>
                    <span className="text-[10px] text-[#475569] font-medium">{lang.label}</span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[#0F5A47] flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
