"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  Shield,
  ArrowLeft,
  ArrowRight,
  Zap,
  Lock,
  Sparkles,
  CheckCircle2,
  FileCode2,
  Bot,
  Eye,
  EyeOff,
} from "lucide-react";

const DEMO_EMAIL = "admin@school.edu";
const DEMO_PASSWORD = "demo1234";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const formId = useId();

  const handleFillDemo = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    await new Promise((r) => setTimeout(r, 400));

    const result = await signIn("admin-login", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password. Use admin@school.edu / demo1234");
      setIsLoading(false);
    } else {
      router.replace("/admin/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F1EA] flex flex-col justify-between p-4 sm:p-6 lg:p-12 relative font-sans">
      {/* Top Header Back Button */}
      <div className="flex justify-between items-center w-full max-w-6xl mx-auto z-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#475569] hover:text-[#0F5A47] bg-white/80 px-3.5 py-2 rounded-xl border border-[#0F5A47]/15 transition-all shadow-xs"
        >
          <ArrowLeft className="w-4 h-4 text-[#0F5A47]" />
          Back to Home
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0F5A47] to-[#0D7A5F] flex items-center justify-center font-extrabold text-white text-xs">
            F
          </div>
          <span className="font-extrabold text-sm text-[#0F172A] tracking-tight">Finora OS</span>
        </div>
      </div>

      {/* Main Split Container */}
      <div className="w-full max-w-5xl mx-auto my-auto py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
        {/* Left Side Visual Feature Highlights (Desktop/Laptop) */}
        <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0F5A47]/10 border border-[#0F5A47]/20 text-[#0F5A47] text-xs font-extrabold">
            <Shield className="w-4 h-4" />
            Finora Admin Operations Gateway
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0F172A] tracking-tight leading-tight">
            School Finance <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0F5A47] to-[#059669]">
              Control Center.
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-[#475569] font-medium leading-relaxed max-w-md mx-auto lg:mx-0">
            Access real-time reconciliation dashboards, Tally Prime XML export generators, AI defaulter reminder queues, and audit logs.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#0F172A] font-bold text-left max-w-md mx-auto lg:mx-0">
            <div className="p-3.5 bg-white/80 rounded-2xl border border-[#0F5A47]/15 flex items-center gap-2.5 shadow-xs">
              <Zap className="w-4 h-4 text-[#059669] shrink-0" />
              <span>0ms Bank Sync Lag</span>
            </div>
            <div className="p-3.5 bg-white/80 rounded-2xl border border-[#0F5A47]/15 flex items-center gap-2.5 shadow-xs">
              <FileCode2 className="w-4 h-4 text-[#0F5A47] shrink-0" />
              <span>Tally Prime XML Export</span>
            </div>
            <div className="p-3.5 bg-white/80 rounded-2xl border border-[#0F5A47]/15 flex items-center gap-2.5 shadow-xs">
              <Bot className="w-4 h-4 text-[#059669] shrink-0" />
              <span>AI Copilot Engine</span>
            </div>
            <div className="p-3.5 bg-white/80 rounded-2xl border border-[#0F5A47]/15 flex items-center gap-2.5 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-[#0F5A47] shrink-0" />
              <span>Audit-Backed Concessions</span>
            </div>
          </div>
        </div>

        {/* Right Side Login Card */}
        <div className="lg:col-span-6 w-full max-w-md mx-auto">
          <div className="bg-white/90 backdrop-blur-2xl border border-[#0F5A47]/20 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-[#0F5A47]/10 space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">Admin Sign In</h2>
              <p className="text-xs text-[#475569] font-medium">Enter your credentials to manage school ledgers</p>
            </div>

            {/* Quick Demo Fill Button */}
            <button
              type="button"
              onClick={handleFillDemo}
              className="w-full py-2.5 px-4 rounded-2xl bg-[#0F5A47]/10 hover:bg-[#0F5A47]/20 border border-[#0F5A47]/25 text-[#0F5A47] text-xs font-extrabold transition-all flex items-center justify-center gap-2 shadow-xs"
            >
              <Sparkles className="w-4 h-4 text-[#0F5A47]" />
              Auto-Fill Demo Admin Credentials
            </button>

            <form id={formId} onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="block text-xs font-extrabold text-[#475569] uppercase tracking-wider">
                  Email Address *
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  disabled={isLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@school.edu"
                  className="w-full bg-white border border-[#0F5A47]/20 rounded-xl px-4 py-3 text-xs text-[#0F172A] font-medium focus:outline-none focus:border-[#0F5A47] transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="login-password" className="block text-xs font-extrabold text-[#475569] uppercase tracking-wider">
                  Password *
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    required
                    disabled={isLoading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white border border-[#0F5A47]/20 rounded-xl px-4 py-3 pr-10 text-xs text-[#0F172A] font-medium focus:outline-none focus:border-[#0F5A47] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#0F172A]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs font-bold text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !email || !password}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#0F5A47] to-[#0D7A5F] text-white text-xs font-extrabold hover:opacity-95 transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? "Authenticating..." : "Sign In to Admin Dashboard"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="pt-2 text-center text-[11px] text-[#475569] font-medium border-t border-[#0F5A47]/15">
              Role: <span className="font-bold text-[#0F172A]">Finance Administrator</span> • Multi-School Scope
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="w-full max-w-6xl mx-auto text-center text-xs text-[#475569] font-semibold z-10">
        © 2026 Finora Technologies. All rights reserved.
      </div>
    </div>
  );
}
