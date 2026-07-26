"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { GlassCard } from "@/components/GlassCard";
import { CopilotWidget } from "@/components/CopilotWidget";
import { Toaster } from "react-hot-toast";
import { 
  LayoutDashboard, BookOpen, AlertTriangle, Receipt, BellRing, 
  Users, UserCheck, FileBarChart, UploadCloud, WifiOff, SettingsIcon,
  Menu, X
} from "lucide-react";
import { signOut, useSession, SessionProvider } from "next-auth/react";

const PUBLIC_PATHS = ["/admin/login"];

function NavItem({ href, icon: Icon, children, onClick }: { href: string; icon: any; children: ReactNode; onClick?: () => void }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/admin" && pathname.startsWith(href));
  return (
    <Link 
      href={href} 
      {...(onClick ? { onClick: () => onClick() } : {})}
      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 ${
        isActive 
          ? "bg-[#0F5A47] text-white font-bold shadow-md shadow-[#0F5A47]/20 border border-[#0F5A47]/30" 
          : "text-text-secondary hover:bg-black/5 hover:text-text-primary font-medium"
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-text-secondary"}`} />
        <span className="text-xs tracking-tight">{children}</span>
      </div>
      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />}
    </Link>
  );
}

function NavGroup({ title, children }: { title: string, children: ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="px-4 text-[10px] uppercase tracking-widest text-text-secondary font-bold mb-2">{title}</h3>
      <div className="space-y-1">
        {children}
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </SessionProvider>
  );
}

function AdminLayoutInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const closeMenu = () => setIsMobileMenuOpen(false);

  useEffect(() => {
    if (
      status === "unauthenticated" &&
      !PUBLIC_PATHS.some((p) => pathname.startsWith(p))
    ) {
      router.replace("/admin/login");
    }
  }, [status, pathname, router]);

  // On login page, render children directly (no shell)
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return <>{children}</>;
  }

  // Auth check pending
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "rgba(15,90,71,0.5)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-bg-base flex flex-col md:flex-row overflow-hidden font-sans">
      <Toaster position="top-center" toastOptions={{ 
        style: { background: 'rgba(255, 255, 255, 0.95)', color: '#0F172A', backdropFilter: 'blur(16px)', border: '1px solid rgba(15, 90, 71, 0.2)' } 
      }} />
      <CopilotWidget schoolId="demo-school-id" />

      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-bg-surface border-b border-border-glass z-40 sticky top-0 shadow-xs">
        <Link href="/admin/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#0F5A47] to-[#059669] flex items-center justify-center text-white font-bold text-sm shadow-xs">
            F
          </div>
          <h1 className="text-lg font-bold text-text-primary tracking-tight">Finora Admin</h1>
        </Link>
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-1 rounded-lg hover:bg-black/5 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Open Admin Menu">
          <Menu className="w-6 h-6 text-text-primary" />
        </button>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <div className={`fixed inset-y-0 left-0 z-50 transform ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0 transition duration-200 ease-in-out md:flex w-64 flex-col bg-bg-surface border-r border-border-glass h-dvh`}>
        {/* Close button on mobile */}
        <div className="md:hidden absolute top-4 right-4 z-50">
          <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 rounded-lg hover:bg-black/5 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Close Admin Menu">
            <X className="w-6 h-6 text-text-primary" />
          </button>
        </div>
        
        <GlassCard className="w-full h-full rounded-none border-0 flex flex-col shadow-none" weight="standard">
          <div className="px-6 py-6 border-b border-border-glass mb-4">
            <Link href="/admin/dashboard" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#0F5A47] to-[#059669] flex items-center justify-center text-white font-bold text-lg shadow-md">
                F
              </div>
              <div>
                <h2 className="text-xl font-bold text-text-primary tracking-tight leading-none">Finora</h2>
                <p className="text-[10px] text-[#0F5A47] font-semibold uppercase tracking-wider mt-1">Smart School Admin</p>
              </div>
            </Link>
          </div>
          
          <nav className="flex-1 px-3 overflow-y-auto space-y-4">
            <NavGroup title="Main Workspaces">
              <NavItem href="/admin/dashboard" icon={LayoutDashboard} onClick={closeMenu}>Executive Dashboard</NavItem>
              <NavItem href="/admin/ledger" icon={BookOpen} onClick={closeMenu}>Finance Operations</NavItem>
              <NavItem href="/admin/students" icon={Users} onClick={closeMenu}>Students & Families</NavItem>
              <NavItem href="/admin/reminders" icon={BellRing} onClick={closeMenu}>Reminders Queue</NavItem>
            </NavGroup>
          </nav>

          <div className="p-4 border-t border-border-glass mt-auto bg-white/5 space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#0F5A47]/20 border border-[#0F5A47]/30 flex items-center justify-center font-bold text-xs text-[#0F5A47]">
                {(session?.user?.email?.[0] || "A").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-text-primary truncate">{session?.user?.email || "admin@school.edu"}</p>
                <p className="text-[10px] text-[#0F5A47] font-extrabold uppercase tracking-wider">School Admin</p>
              </div>
            </div>
            <button
              id="admin-logout-btn"
              type="button"
              onClick={async () => {
                await signOut({ redirect: false });
                window.location.href = window.location.origin + "/admin/login";
              }}
              className="w-full py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-500/10 transition-colors text-center cursor-pointer border border-red-500/20"
            >
              Sign out
            </button>
          </div>
        </GlassCard>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto min-h-[calc(100dvh-60px)] md:h-screen relative p-3 sm:p-6">
        {children}
      </main>
    </div>
  );
}
