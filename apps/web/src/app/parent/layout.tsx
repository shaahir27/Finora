"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { GlassCard } from "@/components/GlassCard";
import I18nProvider from "@/components/I18nProvider";
import { useTranslations } from "next-intl";
import { signOut, useSession, SessionProvider } from "next-auth/react";
import { Menu, X } from "lucide-react";

const PUBLIC_PATHS = ["/parent/login"];

function ParentSidebar({ closeMenu }: { closeMenu?: () => void }) {
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
    <GlassCard className="w-full h-full rounded-none border-0 flex flex-col gap-6" weight="standard">
      <div className="px-4 py-2 flex justify-between items-center mt-2">
        <div>
          <h2 className="text-2xl font-bold text-text-primary tracking-tight">Finora</h2>
          <p className="text-xs text-text-secondary uppercase tracking-widest mt-1">Parent Portal</p>
        </div>
        <button 
          onClick={toggleLocale}
          className="px-2 py-1 bg-white/10 rounded text-xs text-text-primary hover:bg-white/20 transition-colors mr-8 md:mr-0"
        >
          {locale === "en" ? "A/अ" : "अ/A"}
        </button>
      </div>
      
      <nav className="flex-1 px-2 space-y-1">
        <Link href="/parent/dues" {...(closeMenu ? { onClick: closeMenu } : {})} className="block px-4 py-2 rounded-md text-text-primary hover:bg-white/10 transition-colors">
          {t("dues")}
        </Link>
        <Link href="/parent/history" {...(closeMenu ? { onClick: closeMenu } : {})} className="block px-4 py-2 rounded-md text-text-primary hover:bg-white/10 transition-colors">
          {t("history")}
        </Link>
        <Link href="/parent/copilot" {...(closeMenu ? { onClick: closeMenu } : {})} className="block px-4 py-2 rounded-md text-text-primary hover:bg-white/10 transition-colors">
          ✦ {t("copilot")}
        </Link>
        <Link href="/parent/settings" {...(closeMenu ? { onClick: closeMenu } : {})} className="block px-4 py-2 rounded-md text-text-primary hover:bg-white/10 transition-colors">
          {t("settings")}
        </Link>
      </nav>

      <div className="p-4 border-t border-border-glass">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/parent/login" })}
          className="text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          {t("logout")}
        </button>
      </div>
    </GlassCard>
  );
}

export default function ParentLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ParentLayoutInner>{children}</ParentLayoutInner>
    </SessionProvider>
  );
}

function ParentLayoutInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const closeMenu = () => setIsMobileMenuOpen(false);

  // On login page, render children directly (no shell)
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return <I18nProvider>{children}</I18nProvider>;
  }

  // Auth check pending
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "rgba(76,175,130,0.4)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  // If unauthenticated (should be handled by middleware, but just in case)
  if (status === "unauthenticated") {
    return null;
  }

  return (
    <I18nProvider>
      <div className="min-h-screen bg-bg-base flex flex-col md:flex-row overflow-hidden">
        {/* Mobile Top Bar */}
        <div className="md:hidden flex items-center justify-between p-4 bg-bg-surface border-b border-border-glass z-40">
          <h1 className="text-xl font-bold text-text-primary">Finora</h1>
          <button onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className="w-6 h-6 text-text-primary" />
          </button>
        </div>

        {/* Mobile Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={closeMenu}
          />
        )}

        {/* Sidebar Navigation */}
        <div className={`fixed inset-y-0 left-0 z-50 transform ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0 transition duration-200 ease-in-out md:flex w-64 flex-col bg-bg-surface border-r border-border-glass h-screen`}>
          {/* Close button on mobile */}
          <div className="md:hidden absolute top-4 right-4 z-50">
            <button onClick={closeMenu}>
              <X className="w-6 h-6 text-text-primary" />
            </button>
          </div>
          
          <ParentSidebar closeMenu={closeMenu} />
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto h-[calc(100vh-65px)] md:h-screen p-4 md:p-8 relative">
          {children}
        </main>
      </div>
    </I18nProvider>
  );
}
