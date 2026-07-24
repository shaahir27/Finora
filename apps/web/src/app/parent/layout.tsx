"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { GlassCard } from "@/components/GlassCard";
import I18nProvider from "@/components/I18nProvider";
import { useTranslations } from "next-intl";

const SESSION_KEY = "finora_parent_authed";
const PUBLIC_PATHS = ["/parent/login"];

function ParentSidebar() {
  const t = useTranslations("Navigation");
  const router = useRouter();
  const [locale, setLocale] = useState("en");

  useEffect(() => {
    setLocale(localStorage.getItem("finora_parent_locale") || "en");
    const handleLocaleChange = (e: Event) => {
      setLocale((e as CustomEvent).detail);
    };
    window.addEventListener("finora_locale_change", handleLocaleChange);
    return () => window.removeEventListener("finora_locale_change", handleLocaleChange);
  }, []);

  const toggleLocale = () => {
    const newLocale = locale === "en" ? "hi" : "en";
    window.dispatchEvent(new CustomEvent("finora_locale_change", { detail: newLocale }));
  };

  return (
    <GlassCard className="w-full md:w-64 rounded-none border-t-0 border-l-0 border-b-0 flex flex-col gap-6" weight="standard">
      <div className="px-4 py-2 flex justify-between items-center mt-2">
        <div>
          <h2 className="text-2xl font-bold text-text-primary tracking-tight">Finora</h2>
          <p className="text-xs text-text-secondary uppercase tracking-widest mt-1">Parent Portal</p>
        </div>
        <button 
          onClick={toggleLocale}
          className="px-2 py-1 bg-white/10 rounded text-xs text-text-primary hover:bg-white/20 transition-colors"
        >
          {locale === "en" ? "A/अ" : "अ/A"}
        </button>
      </div>
      
      <nav className="flex-1 px-2 space-y-1">
        <Link href="/parent/dues" className="block px-4 py-2 rounded-md text-text-primary hover:bg-white/10 transition-colors">
          {t("dues")}
        </Link>
        <Link href="/parent/history" className="block px-4 py-2 rounded-md text-text-primary hover:bg-white/10 transition-colors">
          {t("history")}
        </Link>
        <Link href="/parent/copilot" className="block px-4 py-2 rounded-md text-text-primary hover:bg-white/10 transition-colors">
          ✦ {t("copilot")}
        </Link>
        <Link href="/parent/settings" className="block px-4 py-2 rounded-md text-text-primary hover:bg-white/10 transition-colors">
          {t("settings")}
        </Link>
      </nav>

      <div className="p-4 border-t border-border-glass">
        <button
          type="button"
          onClick={() => { sessionStorage.removeItem(SESSION_KEY); router.replace("/parent/login"); }}
          className="text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          {t("logout")}
        </button>
      </div>
    </GlassCard>
  );
}

export default function ParentLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
    if (isPublic) {
      setAuthChecked(true);
      return;
    }
    const authed = sessionStorage.getItem(SESSION_KEY) === "1";
    if (!authed) {
      router.replace("/parent/login");
    } else {
      setAuthChecked(true);
    }
  }, [pathname, router]);

  // On login page, render children directly (no shell)
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return <I18nProvider>{children}</I18nProvider>;
  }

  // Auth check pending
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "rgba(76,175,130,0.4)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <I18nProvider>
      <div className="min-h-screen bg-bg-base flex flex-col md:flex-row">
        <ParentSidebar />
        <main className="flex-1 overflow-auto h-screen p-4 md:p-8">
          {children}
        </main>
      </div>
    </I18nProvider>
  );
}
