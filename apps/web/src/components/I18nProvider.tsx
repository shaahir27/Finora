"use client";

import { NextIntlClientProvider } from "next-intl";
import { useState, useEffect } from "react";
import en from "@/i18n/en.json";
import hi from "@/i18n/hi.json";
import bn from "@/i18n/bn.json";
import mr from "@/i18n/mr.json";
import te from "@/i18n/te.json";
import ta from "@/i18n/ta.json";
import gu from "@/i18n/gu.json";
import kn from "@/i18n/kn.json";

const MESSAGE_MAP: Record<string, any> = {
  en,
  hi,
  bn,
  mr,
  te,
  ta,
  gu,
  kn,
};

// Deep-merge: fills missing keys in target locale with English fallback values
function mergeWithFallback(target: any, fallback: any): any {
  const result: any = { ...fallback };
  for (const key of Object.keys(target)) {
    if (
      typeof target[key] === "object" &&
      target[key] !== null &&
      typeof fallback[key] === "object"
    ) {
      result[key] = mergeWithFallback(target[key], fallback[key]);
    } else {
      result[key] = target[key];
    }
  }
  return result;
}

function getMessages(locale: string): any {
  const target = MESSAGE_MAP[locale] || en;
  if (locale === "en") return en;
  // Always merge so any missing key falls back to English instead of throwing
  return mergeWithFallback(target, en);
}

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState("en");
  const [messages, setMessages] = useState<any>(en);

  useEffect(() => {
    const saved = localStorage.getItem("finora_parent_locale") || "en";
    setLocale(saved);
    setMessages(getMessages(saved));
  }, []);

  useEffect(() => {
    const handleLocaleChange = (e: Event) => {
      const newLocale = (e as CustomEvent).detail as string;
      setLocale(newLocale);
      setMessages(getMessages(newLocale));
      localStorage.setItem("finora_parent_locale", newLocale);
    };
    window.addEventListener("finora_locale_change", handleLocaleChange);
    return () => window.removeEventListener("finora_locale_change", handleLocaleChange);
  }, []);

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      // Silently ignore missing keys (returns key name) — never throws
      onError={() => {}}
      getMessageFallback={({ key }) => key.split(".").pop() ?? key}
    >
      <div className={locale !== "en" ? "indic-locale-spacing" : ""}>
        {children}
      </div>
    </NextIntlClientProvider>
  );
}
