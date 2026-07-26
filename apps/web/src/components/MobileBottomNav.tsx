"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LayoutDashboard, CreditCard, Sparkles, Settings } from "lucide-react";

export function MobileBottomNav() {
  const pathname = usePathname();
  const t = useTranslations("Navigation");

  const navItems = [
    { labelKey: "dues", href: "/parent/dues", icon: LayoutDashboard },
    { labelKey: "history", href: "/parent/history", icon: CreditCard },
    { labelKey: "copilot", href: "/parent/copilot", icon: Sparkles },
    { labelKey: "settings", href: "/parent/settings", icon: Settings },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#F4F1EA]/95 backdrop-blur-xl border-t border-[#0F5A47]/20 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 px-3 shadow-lg shadow-[#0F5A47]/10">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl min-w-[64px] min-h-[44px] justify-center transition-all duration-200 active:scale-95 ${
                isActive
                  ? "bg-[#0F5A47] text-white shadow-md shadow-[#0F5A47]/20 font-extrabold"
                  : "text-[#475569] hover:text-[#0F172A] hover:bg-black/5 font-bold"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-[#0F5A47]"}`} />
              <span className="text-[10px] tracking-tight leading-none">
                {t(item.labelKey as any)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
