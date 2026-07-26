"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/lib/supabase-client";
import { signIn } from "next-auth/react";
import {
  Smartphone,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Calculator,
  Bot,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";

export default function ParentLoginPage() {
  const router = useRouter();
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleFillDemoParent = () => {
    if (method === "phone") {
      setPhone("+919999999999");
    } else {
      setEmail("parent@demo.com");
    }
    setError(null);
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const identifier = method === "phone" ? phone : email;
      if (
        process.env.NODE_ENV !== "production" &&
        (identifier === "parent@demo.com" || identifier === "+919999999999")
      ) {
        setOtpSent(true);
        setOtp("123456");
        setResendCooldown(60);
        setLoading(false);
        return;
      }

      if (method === "phone") {
        if (!phone.startsWith("+")) {
          throw new Error("Please include country code, e.g. +91");
        }

        const { error: authError } = await supabase.auth.signInWithOtp({
          phone,
          options: {
            shouldCreateUser: false,
          },
        });

        if (authError) {
          if (
            authError.message.includes("Signups not allowed") ||
            authError.status === 400 ||
            authError.status === 422
          ) {
            throw new Error(
              "Number not registered. Please contact school admin to register."
            );
          }
          throw authError;
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: false,
          },
        });

        if (authError) {
          if (
            authError.message.includes("Signups not allowed") ||
            authError.status === 400 ||
            authError.status === 422
          ) {
            throw new Error(
              "Email not registered. Please contact school admin to register."
            );
          }
          throw authError;
        }
      }

      setOtpSent(true);
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message || "Failed to send verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await signIn("parent-otp", {
        phone: method === "phone" ? phone : "",
        email: method === "email" ? email : "",
        otp,
        type: method === "phone" ? "sms" : "email",
        redirect: false,
      });

      if (result?.error) {
        throw new Error("Invalid verification code. Please try again.");
      }

      router.push("/parent/dues");
    } catch (err: any) {
      setError(err.message || "Failed to verify code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F1EA] flex flex-col justify-between p-4 sm:p-6 lg:p-12 relative font-sans">
      {/* Top Navigation */}
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
            ₹
          </div>
          <span className="font-extrabold text-sm text-[#0F172A] tracking-tight">Finora Parent</span>
        </div>
      </div>

      {/* Split Main Container */}
      <div className="w-full max-w-5xl mx-auto my-auto py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
        {/* Left Side Parent Cockpit Highlights (Desktop/Laptop) */}
        <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0F5A47]/10 border border-[#0F5A47]/20 text-[#0F5A47] text-xs font-extrabold">
            <Smartphone className="w-4 h-4 text-[#0F5A47]" />
            Smart School Parent Cockpit
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0F172A] tracking-tight leading-tight">
            School Fee Payments <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0F5A47] to-[#059669]">
              Made Simple.
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-[#475569] font-medium leading-relaxed max-w-md mx-auto lg:mx-0">
            Pay tuition fees with 1-click UPI, simulate custom monthly installment plans, and talk to your AI assistant in Hindi or English.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#0F172A] font-bold text-left max-w-md mx-auto lg:mx-0">
            <div className="p-3.5 bg-white/80 rounded-2xl border border-[#0F5A47]/15 flex items-center gap-2.5 shadow-xs">
              <Smartphone className="w-4 h-4 text-[#059669] shrink-0" />
              <span>1-Click Mobile UPI</span>
            </div>
            <div className="p-3.5 bg-white/80 rounded-2xl border border-[#0F5A47]/15 flex items-center gap-2.5 shadow-xs">
              <Calculator className="w-4 h-4 text-[#0F5A47] shrink-0" />
              <span>Installment Simulator</span>
            </div>
            <div className="p-3.5 bg-white/80 rounded-2xl border border-[#0F5A47]/15 flex items-center gap-2.5 shadow-xs">
              <Bot className="w-4 h-4 text-[#059669] shrink-0" />
              <span>Bilingual AI Support</span>
            </div>
            <div className="p-3.5 bg-white/80 rounded-2xl border border-[#0F5A47]/15 flex items-center gap-2.5 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-[#0F5A47] shrink-0" />
              <span>Instant Tax Receipts</span>
            </div>
          </div>
        </div>

        {/* Right Side OTP Card */}
        <div className="lg:col-span-6 w-full max-w-md mx-auto">
          <div className="bg-white/90 backdrop-blur-2xl border border-[#0F5A47]/20 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-[#0F5A47]/10 space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">Parent Sign In</h2>
              <p className="text-xs text-[#475569] font-medium">Verify your phone or email to access dues</p>
            </div>

            {/* Auto-Fill Demo Parent Button */}
            <button
              type="button"
              onClick={handleFillDemoParent}
              className="w-full py-2.5 px-4 rounded-2xl bg-[#0F5A47]/10 hover:bg-[#0F5A47]/20 border border-[#0F5A47]/25 text-[#0F5A47] text-xs font-extrabold transition-all flex items-center justify-center gap-2 shadow-xs"
            >
              <Sparkles className="w-4 h-4 text-[#0F5A47]" />
              Auto-Fill Demo Parent ({method === "phone" ? "+919999999999" : "parent@demo.com"})
            </button>

            {!otpSent ? (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold text-[#475569] uppercase tracking-wider">
                    {method === "phone" ? "Mobile Phone Number *" : "Email Address *"}
                  </label>
                  {method === "phone" ? (
                    <input
                      type="tel"
                      required
                      disabled={loading}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+919999999999"
                      className="w-full bg-white border border-[#0F5A47]/20 rounded-xl px-4 py-3 text-xs text-[#0F172A] font-medium focus:outline-none focus:border-[#0F5A47]"
                    />
                  ) : (
                    <input
                      type="email"
                      required
                      disabled={loading}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="parent@demo.com"
                      className="w-full bg-white border border-[#0F5A47]/20 rounded-xl px-4 py-3 text-xs text-[#0F172A] font-medium focus:outline-none focus:border-[#0F5A47]"
                    />
                  )}
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs font-bold text-red-600">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || (method === "phone" ? !phone : !email)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#0F5A47] to-[#0D7A5F] text-white text-xs font-extrabold hover:opacity-95 transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? "Sending Code..." : "Send Verification Code"}
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMethod(method === "phone" ? "email" : "phone");
                      setError(null);
                    }}
                    className="text-xs font-bold text-[#0F5A47] hover:underline"
                  >
                    {method === "phone" ? "Use email instead" : "Use phone number instead"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="text-center space-y-1 bg-[#F4F1EA] p-3 rounded-2xl border border-[#0F5A47]/15">
                  <p className="text-xs text-[#475569] font-medium">
                    Enter code sent to <span className="font-extrabold text-[#0F172A]">{method === "phone" ? phone : email}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="text-[11px] font-bold text-[#0F5A47] hover:underline"
                  >
                    Change {method === "phone" ? "number" : "email"}
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-extrabold text-[#475569] uppercase tracking-wider text-center">
                    6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    disabled={loading}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full bg-white border border-[#0F5A47]/20 rounded-xl px-4 py-3 text-center text-xl font-extrabold tracking-widest text-[#0F172A] focus:outline-none focus:border-[#0F5A47]"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs font-bold text-red-600">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#0F5A47] to-[#0D7A5F] text-white text-xs font-extrabold hover:opacity-95 transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {loading ? "Verifying..." : "Verify Code & Sign In"}
                </button>
              </form>
            )}

            <div className="pt-2 text-center text-[11px] text-[#475569] font-medium border-t border-[#0F5A47]/15">
              Secure Parent Portal Gateway • Finora V2.6
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-6xl mx-auto text-center text-xs text-[#475569] font-semibold z-10">
        © 2026 Finora Technologies. All rights reserved.
      </div>
    </div>
  );
}
