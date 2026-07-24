"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/lib/supabase-client";

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

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (method === "phone") {
        if (!phone.startsWith("+")) {
          throw new Error("Please include the country code, e.g. +91");
        }
        
        // CRITICAL: shouldCreateUser: false prevents unauthorized signups
        const { error: authError } = await supabase.auth.signInWithOtp({
          phone,
          options: {
            shouldCreateUser: false,
          },
        });

        if (authError) {
          // Identify unprovisioned user error to show correct messaging
          if (authError.message.includes("Signups not allowed") || authError.status === 400 || authError.status === 422) {
             throw new Error("Number not registered. Please contact your school to link your account.");
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
          if (authError.message.includes("Signups not allowed") || authError.status === 400 || authError.status === 422) {
            throw new Error("Email not registered. Please contact your school to link your account.");
          }
          throw authError;
        }
      }

      setOtpSent(true);
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: method === "phone" ? phone : undefined,
        email: method === "email" ? email : undefined,
        token: otp,
        type: method === "phone" ? "sms" : "email",
      });

      if (verifyError) {
        if (verifyError.message.toLowerCase().includes("expired")) {
           throw new Error("OTP has expired. Please request a new one.");
        }
        throw new Error("Invalid OTP code. Please try again.");
      }

      // Check role mapping if we have an API for it, or just rely on layout guard
      if (data.user) {
        sessionStorage.setItem("finora_parent_authed", "1");
        sessionStorage.setItem("finora_parent_user_id", data.user.id);
        router.push("/parent/dues");
      }
    } catch (err: any) {
      setError(err.message || "Failed to verify OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center p-4 relative">
      <Link 
        href="/" 
        className="absolute top-6 left-6 z-50 text-sm font-medium text-text-secondary hover:text-white flex items-center gap-2 transition-colors"
      >
        <span>←</span> Back to Home
      </Link>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Finora</h1>
          <p className="text-text-secondary mt-2">Parent Portal</p>
        </div>

        <GlassCard className="p-6">
          {!otpSent ? (
            <form onSubmit={handleRequestOtp} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  {method === "phone" ? "Phone Number" : "Email Address"}
                </label>
                {method === "phone" ? (
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-white/5 border border-border-glass rounded-md px-4 py-2 text-text-primary focus:outline-none focus:border-accent-primary"
                    placeholder="+919876543210"
                  />
                ) : (
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-border-glass rounded-md px-4 py-2 text-text-primary focus:outline-none focus:border-accent-primary"
                    placeholder="parent@example.com"
                  />
                )}
              </div>

              {error && (
                <div className="p-3 bg-risk-high/20 border border-risk-high/30 rounded-md text-text-primary text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || (method === "phone" ? !phone : !email)}
                className="w-full py-2 bg-accent-primary text-white rounded-md font-medium hover:bg-opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Verification Code"}
              </button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setMethod(method === "phone" ? "email" : "phone");
                    setError(null);
                  }}
                  className="text-sm text-accent-primary-text hover:text-white transition-colors"
                >
                  {method === "phone" ? "Log in with email instead" : "Log in with phone instead"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="text-center">
                <p className="text-text-secondary text-sm">
                  Enter the 6-digit code sent to <br />
                  <span className="font-medium text-text-primary">
                    {method === "phone" ? phone : email}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtp("");
                    setError(null);
                  }}
                  className="text-xs text-accent-primary-text hover:text-white transition-colors mt-2"
                >
                  Change {method === "phone" ? "number" : "email"}
                </button>
              </div>

              <div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full bg-white/5 border border-border-glass rounded-md px-4 py-3 text-center text-xl tracking-widest text-text-primary focus:outline-none focus:border-accent-primary"
                  placeholder="------"
                />
              </div>

              {error && (
                <div className="p-3 bg-risk-high/20 border border-risk-high/30 rounded-md text-text-primary text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full py-2 bg-accent-primary text-white rounded-md font-medium hover:bg-opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify Code"}
              </button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  disabled={resendCooldown > 0 || loading}
                  onClick={handleRequestOtp}
                  className="text-sm text-text-secondary hover:text-white transition-colors disabled:opacity-50"
                >
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : "Didn't receive a code? Resend"}
                </button>
              </div>
            </form>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
