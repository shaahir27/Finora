"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { GlassCard } from "@/components/GlassCard";

const SESSION_KEY = "finora_admin_authed";
const PUBLIC_PATHS = ["/admin/login"];

export default function AdminLayout({ children }: { children: ReactNode }) {
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
      router.replace("/admin/login");
    } else {
      setAuthChecked(true);
    }
  }, [pathname, router]);

  // On login page, render children directly (no shell)
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return <>{children}</>;
  }

  // Auth check pending — show nothing to avoid flash
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "rgba(76,175,130,0.4)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <GlassCard className="w-full md:w-64 rounded-none border-t-0 border-l-0 border-b-0 flex flex-col gap-6" weight="standard">
        <div className="px-4 py-2">
          <h2 className="text-2xl font-bold text-text-primary tracking-tight">Finora</h2>
          <p className="text-xs text-text-secondary uppercase tracking-widest mt-1">Admin Portal</p>
        </div>
        
        <nav className="flex-1 px-2 space-y-1">
          <Link href="/admin/dashboard" className="block px-4 py-2 rounded-md text-text-primary hover:bg-white/10 transition-colors">
            Dashboard
          </Link>
          <Link href="/admin/defaulters" className="block px-4 py-2 rounded-md text-text-primary hover:bg-white/10 transition-colors">
            Defaulter Tracking
          </Link>
          <Link href="/admin/parents" className="block px-4 py-2 rounded-md text-text-primary hover:bg-white/10 transition-colors">
            Parents
          </Link>
          <Link href="/admin/students" className="block px-4 py-2 rounded-md text-text-primary hover:bg-white/10 transition-colors">
            Student Directory
          </Link>
          <Link href="/admin/offline-sync" className="block px-4 py-2 rounded-md text-text-primary hover:bg-white/10 transition-colors">
            Offline Sync Queue
          </Link>
          <Link href="/admin/settings" className="block px-4 py-2 rounded-md text-text-primary hover:bg-white/10 transition-colors">
            Settings
          </Link>
          {/* Session 4 — AI Layer */}
          <Link href="/admin/reminders" className="block px-4 py-2 rounded-md text-text-primary hover:bg-white/10 transition-colors">
            Reminders Queue
          </Link>
          <Link href="/admin/receipts" className="block px-4 py-2 rounded-md text-text-primary hover:bg-white/10 transition-colors">
            Receipts
          </Link>
          <Link href="/admin/reports" className="block px-4 py-2 rounded-md text-text-primary hover:bg-white/10 transition-colors">
            Reports & Export
          </Link>
          <Link href="/admin/copilot" className="block px-4 py-2 rounded-md text-text-primary hover:bg-white/10 transition-colors">
            ✦ AI Copilot
          </Link>
          <Link href="/admin/ocr" className="block px-4 py-2 rounded-md text-text-primary hover:bg-white/10 transition-colors">
            OCR Upload
          </Link>
        </nav>

        <div className="p-4 border-t border-border-glass">
          <p className="text-sm text-text-secondary">Logged in as</p>
          <p className="text-sm font-medium text-text-primary truncate">admin@school.edu</p>
          <button
            id="admin-logout-btn"
            type="button"
            onClick={() => { sessionStorage.removeItem(SESSION_KEY); router.replace("/admin/login"); }}
            className="mt-2 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            Sign out
          </button>
        </div>
      </GlassCard>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto h-screen">
        {children}
      </main>
    </div>
  );
}
