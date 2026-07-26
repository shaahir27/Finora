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
  const pathname = usePathname();

  const navItems = [
    { labelKey: "dues", href: "/parent/dues", icon: "📊" },
    { labelKey: "history", href: "/parent/history", icon: "💳" },
    { labelKey: "copilot", href: "/parent/copilot", icon: "🤖" },
    { labelKey: "settings", href: "/parent/settings", icon: "⚙️" },
  ];

  return (
    <div className="w-full h-full bg-[#F4F1EA] flex flex-col justify-between p-4 border-r border-[#0F5A47]/15">
      <div className="space-y-6">
        <div className="flex justify-between items-center px-2 pt-2">
          <Link href="/parent/dues" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white bg-gradient-to-br from-[#0F5A47] to-[#0D7A5F] shadow-md shadow-[#0F5A47]/20">
              ₹
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-text-primary tracking-tight">Finora</h2>
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Parent Portal</p>
            </div>
          </Link>
        </div>
        
        <nav className="space-y-1.5 pt-4">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                {...(closeMenu ? { onClick: closeMenu } : {})}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? "bg-[#0F5A47] text-white shadow-md shadow-[#0F5A47]/20"
                    : "text-text-secondary hover:text-text-primary hover:bg-black/5"
                }`}
              >
                <span>{item.icon}</span>
                <span>{t(item.labelKey as any)}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-[#0F5A47]/15 px-2">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/parent/login" })}
          className="w-full py-2 px-3 rounded-xl text-xs font-bold text-red-600 hover:bg-red-500/10 transition-colors text-left flex items-center gap-2"
        >
          <span>🚪</span>
          <span>{t("logout")}</span>
        </button>
      </div>
    </div>
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

  useEffect(() => {
    if (
      status === "unauthenticated" &&
      process.env.NODE_ENV === "production" &&
      !PUBLIC_PATHS.some((p) => pathname.startsWith(p))
    ) {
      router.replace("/parent/login");
    }
  }, [status, pathname, router]);

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

  return (
    <I18nProvider>
      <div className="min-h-screen bg-bg-base flex flex-col md:flex-row overflow-hidden">
        {/* Mobile Top Bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#EBE7DF] border-b border-[#0F5A47]/15 z-40 sticky top-0">
          <Link href="/parent/dues" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white bg-gradient-to-br from-[#0F5A47] to-[#0D7A5F] shadow-sm">
              ₹
            </div>
            <div>
              <h1 className="text-base font-extrabold text-text-primary tracking-tight">Finora</h1>
              <p className="text-[9px] font-bold text-text-secondary uppercase tracking-wider">Parent Portal</p>
            </div>
          </Link>
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-xl bg-white border border-[#0F5A47]/20 text-[#0F5A47] active:scale-95 transition-transform"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden"
            onClick={closeMenu}
          />
        )}

        {/* Sidebar Navigation */}
        <div className={`fixed inset-y-0 left-0 z-50 transform ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0 transition-transform duration-200 ease-in-out md:flex w-64 flex-col bg-bg-surface border-r border-border-glass h-screen`}>
          {/* Close button on mobile */}
          <div className="md:hidden absolute top-3.5 right-3.5 z-50">
            <button 
              onClick={closeMenu}
              className="p-1.5 rounded-lg bg-[#0F5A47]/10 text-[#0F5A47]"
            >
              <X className="w-5 h-5 text-text-primary" />
            </button>
          </div>
          
          <ParentSidebar closeMenu={closeMenu} />
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto min-h-[calc(100vh-57px)] md:h-screen p-3.5 sm:p-6 md:p-8 relative">
          {children}
        </main>
      </div>
    </I18nProvider>
  );
}
