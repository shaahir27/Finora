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

const SESSION_KEY = "finora_admin_authed";
const PUBLIC_PATHS = ["/admin/login"];

function NavItem({ href, icon: Icon, children, onClick }: { href: string, icon: any, children: ReactNode, onClick?: () => void }) {
  const pathname = usePathname();
  const isActive = pathname.startsWith(href);
  return (
    <Link 
      href={href} 
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${
        isActive 
          ? "bg-[#4CAF82]/10 text-[#4CAF82] shadow-[inset_2px_0_0_#4CAF82]" 
          : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="text-sm font-medium">{children}</span>
    </Link>
  );
}

function NavGroup({ title, children }: { title: string, children: ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="px-4 text-[10px] uppercase tracking-widest text-gray-500 mb-2">{title}</h3>
      <div className="space-y-0.5">
        {children}
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authChecked, setAuthChecked] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const closeMenu = () => setIsMobileMenuOpen(false);

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
    <div className="min-h-screen bg-bg-base flex flex-col md:flex-row overflow-hidden">
      <Toaster position="top-center" toastOptions={{ 
        style: { background: 'rgba(15, 17, 21, 0.9)', color: '#fff', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' } 
      }} />
      <CopilotWidget />

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
        
        <GlassCard className="w-full h-full rounded-none border-0 flex flex-col" weight="standard">
          <div className="px-6 py-6 border-b border-border-glass mb-4">
            <h2 className="text-2xl font-bold text-text-primary tracking-tight">Finora</h2>
            <p className="text-[10px] text-text-secondary uppercase tracking-widest mt-1">Admin Portal</p>
          </div>
          
          <nav className="flex-1 px-3 overflow-y-auto">
            <NavGroup title="Overview">
              <NavItem href="/admin/dashboard" icon={LayoutDashboard} onClick={closeMenu}>Dashboard</NavItem>
            </NavGroup>
            
            <NavGroup title="Financial Operations">
              <NavItem href="/admin/ledger" icon={BookOpen} onClick={closeMenu}>Ledger</NavItem>
              <NavItem href="/admin/defaulters" icon={AlertTriangle} onClick={closeMenu}>Defaulters</NavItem>
              <NavItem href="/admin/receipts" icon={Receipt} onClick={closeMenu}>Receipts</NavItem>
              <NavItem href="/admin/reminders" icon={BellRing} onClick={closeMenu}>Reminders Queue</NavItem>
            </NavGroup>

            <NavGroup title="Directory">
              <NavItem href="/admin/students" icon={Users} onClick={closeMenu}>Students</NavItem>
              <NavItem href="/admin/parents" icon={UserCheck} onClick={closeMenu}>Parents</NavItem>
            </NavGroup>

            <NavGroup title="System Tools">
              <NavItem href="/admin/reports" icon={FileBarChart} onClick={closeMenu}>Reports & Export</NavItem>
              <NavItem href="/admin/ocr" icon={UploadCloud} onClick={closeMenu}>OCR Upload</NavItem>
              <NavItem href="/admin/offline-sync" icon={WifiOff} onClick={closeMenu}>Offline Sync</NavItem>
              <NavItem href="/admin/settings" icon={SettingsIcon} onClick={closeMenu}>Settings</NavItem>
            </NavGroup>
          </nav>

          <div className="p-4 border-t border-border-glass mt-auto bg-white/5">
            <p className="text-[10px] text-text-secondary uppercase tracking-wider">Logged in as</p>
            <p className="text-sm font-medium text-text-primary truncate mt-0.5">admin@school.edu</p>
            <button
              id="admin-logout-btn"
              type="button"
              onClick={() => { sessionStorage.removeItem(SESSION_KEY); router.replace("/admin/login"); }}
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
