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
  const isActive = pathname.startsWith(href);
  return (
    <Link 
      href={href} 
      {...(onClick ? { onClick: () => onClick() } : {})}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
        isActive 
          ? "bg-[#0F5A47]/10 text-[#0F5A47] font-semibold shadow-[inset_3px_0_0_#0F5A47]" 
          : "text-text-secondary hover:bg-black/5 hover:text-text-primary"
      }`}
    >
      <Icon className={`w-4 h-4 ${isActive ? "text-[#0F5A47]" : "text-text-secondary"}`} />
      <span className="text-sm font-medium tracking-tight">{children}</span>
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
      process.env.NODE_ENV === "production" &&
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
    <div className="min-h-screen bg-bg-base flex flex-col md:flex-row overflow-hidden font-sans">
      <Toaster position="top-center" toastOptions={{ 
        style: { background: 'rgba(255, 255, 255, 0.95)', color: '#0F172A', backdropFilter: 'blur(16px)', border: '1px solid rgba(15, 90, 71, 0.2)' } 
      }} />
      <CopilotWidget schoolId="demo-school-id" />

      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-bg-surface border-b border-border-glass z-40">
        <Link href="/admin/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#0F5A47] to-[#059669] flex items-center justify-center text-white font-bold text-sm shadow-xs">
            F
          </div>
          <h1 className="text-lg font-bold text-text-primary tracking-tight">Finora Admin</h1>
        </Link>
        <button onClick={() => setIsMobileMenuOpen(true)}>
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
      <div className={`fixed inset-y-0 left-0 z-50 transform ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0 transition duration-200 ease-in-out md:flex w-64 flex-col bg-bg-surface border-r border-border-glass h-screen`}>
        {/* Close button on mobile */}
        <div className="md:hidden absolute top-4 right-4 z-50">
          <button onClick={() => setIsMobileMenuOpen(false)}>
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
            </NavGroup>
          </nav>

          <div className="p-4 border-t border-border-glass mt-auto bg-white/5">
            <p className="text-[10px] text-text-secondary uppercase tracking-wider">Logged in as</p>
            <p className="text-sm font-medium text-text-primary truncate mt-0.5">{session?.user?.email || "admin@school.edu"}</p>
            <button
              id="admin-logout-btn"
              type="button"
              onClick={() => signOut({ callbackUrl: "/admin/login" })}
              className="mt-3 text-xs font-medium text-red-400 hover:text-red-300 transition-colors"
            >
              Sign out
            </button>
          </div>
        </GlassCard>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto h-[calc(100vh-65px)] md:h-screen relative">
        {children}
      </main>
    </div>
  );
}
