"use client";

import { NextIntlClientProvider } from "next-intl";
import { useState, useEffect } from "react";
import en from "@/i18n/en.json";
import hi from "@/i18n/hi.json";

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState("en");
  const [messages, setMessages] = useState<any>(en);

  useEffect(() => {
    // Check local storage for saved preference
    const saved = localStorage.getItem("finora_parent_locale");
    if (saved === "hi") {
      setLocale("hi");
      setMessages(hi);
    }
  }, []);

  // Listen for changes from other components (like the settings toggle)
  useEffect(() => {
    const handleLocaleChange = (e: Event) => {
      const newLocale = (e as CustomEvent).detail;
      setLocale(newLocale);
      setMessages(newLocale === "hi" ? hi : en);
      localStorage.setItem("finora_parent_locale", newLocale);
    };

    window.addEventListener("finora_locale_change", handleLocaleChange);
    return () => window.removeEventListener("finora_locale_change", handleLocaleChange);
  }, []);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
