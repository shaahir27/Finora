import Link from "next/link";
import { ReactNode } from "react";
import { GlassCard } from "@/components/GlassCard";

export default function AdminLayout({ children }: { children: ReactNode }) {
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
          <Link href="/admin/students" className="block px-4 py-2 rounded-md text-text-primary hover:bg-white/10 transition-colors">
            Student Directory
          </Link>
          <Link href="/admin/offline-sync" className="block px-4 py-2 rounded-md text-text-primary hover:bg-white/10 transition-colors">
            Offline Sync Queue
          </Link>
          <Link href="/admin/settings" className="block px-4 py-2 rounded-md text-text-primary hover:bg-white/10 transition-colors">
            Settings
          </Link>
        </nav>

        <div className="p-4 border-t border-border-glass">
          <p className="text-sm text-text-secondary">Logged in as</p>
          <p className="text-sm font-medium text-text-primary truncate">admin@school.edu</p>
        </div>
      </GlassCard>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto h-screen">
        {children}
      </main>
    </div>
  );
}
