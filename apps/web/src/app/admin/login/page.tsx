"use client";

/**
 * Admin Login Page — /admin/login
 *
 * Demo-mode login gate. Uses hardcoded credentials for the hackathon demo.
 * Real Supabase Auth for admins is a Session 6 scope item.
 *
 * Credentials: admin@school.edu / demo1234
 *
 * On success: sets sessionStorage flag "finora_admin_authed" and redirects
 * to /admin/dashboard. The admin layout reads this flag on every page load.
 */

import { useState, useId } from "react";
import { useRouter } from "next/navigation";

const DEMO_EMAIL = "admin@school.edu";
const DEMO_PASSWORD = "demo1234";
const SESSION_KEY = "finora_admin_authed";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const formId = useId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Simulate a brief network delay for realism
    await new Promise((r) => setTimeout(r, 600));

    if (
      email.trim().toLowerCase() === DEMO_EMAIL &&
      password === DEMO_PASSWORD
    ) {
      sessionStorage.setItem(SESSION_KEY, "1");
      router.replace("/admin/dashboard");
    } else {
      setError("Invalid email or password. Try admin@school.edu / demo1234");
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "var(--color-bg-base)",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Background glow orbs */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-20%",
            left: "-10%",
            width: "50vw",
            height: "50vw",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(45,106,79,0.18) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-10%",
            right: "-10%",
            width: "40vw",
            height: "40vw",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(76,175,130,0.12) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl"
            style={{ background: "linear-gradient(135deg, #4CAF82, #2D6A4F)", boxShadow: "0 8px 32px rgba(76,175,130,0.3)" }}
            aria-hidden="true"
          >
            ₹
          </div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Finora</h1>
          <p className="text-text-secondary text-sm mt-1">School Finance Platform</p>
        </div>

        {/* Login card */}
        <div
          className="rounded-2xl p-8 space-y-6"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          }}
        >
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Admin Sign In</h2>
            <p className="text-sm text-text-secondary mt-1">
              Sign in to your admin dashboard
            </p>
          </div>

          <form id={formId} onSubmit={handleSubmit} className="space-y-4" aria-label="Admin login form">
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@school.edu"
                required
                disabled={isLoading}
                className="w-full rounded-xl px-4 py-3 text-sm text-text-primary outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  caretColor: "#4CAF82",
                }}
                onFocus={(e) => (e.target.style.border = "1px solid rgba(76,175,130,0.5)")}
                onBlur={(e) => (e.target.style.border = "1px solid rgba(255,255,255,0.1)")}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="login-password" className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  className="w-full rounded-xl px-4 py-3 pr-12 text-sm text-text-primary outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    caretColor: "#4CAF82",
                  }}
                  onFocus={(e) => (e.target.style.border = "1px solid rgba(76,175,130,0.5)")}
                  onBlur={(e) => (e.target.style.border = "1px solid rgba(255,255,255,0.1)")}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" strokeLinecap="round" strokeLinejoin="round"/>
                      <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="flex items-start gap-2 text-sm p-3 rounded-xl"
                role="alert"
                style={{ background: "rgba(200,100,100,0.08)", border: "1px solid rgba(200,100,100,0.2)", color: "#E06060" }}
              >
                <span aria-hidden="true">✕</span>
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]"
              style={{
                background: "linear-gradient(135deg, #4CAF82, #2D6A4F)",
                color: "#fff",
                boxShadow: "0 4px 16px rgba(76,175,130,0.3)",
              }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="16" height="16" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Signing in…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Demo hint */}
          <div
            className="text-center text-xs p-3 rounded-xl"
            style={{ background: "rgba(76,175,130,0.06)", border: "1px solid rgba(76,175,130,0.12)" }}
          >
            <p className="text-text-secondary">
              Demo credentials:{" "}
              <span className="font-mono text-text-primary">admin@school.edu</span>
              {" / "}
              <span className="font-mono text-text-primary">demo1234</span>
            </p>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-text-secondary mt-6 opacity-60">
          Finora · Session 4 Demo Preview
        </p>
      </div>
    </div>
  );
}
