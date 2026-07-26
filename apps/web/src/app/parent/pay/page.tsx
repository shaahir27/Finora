"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/GlassCard";
import { payDueViaUpi, simulateSandboxPayment } from "@/app/actions/parents";
import { useTranslations } from "next-intl";

function PayForm() {
  const t = useTranslations("Payment");
  const router = useRouter();
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get("assignmentId");
  const initialAmount = searchParams.get("amount");

  const [amount, setAmount] = useState(initialAmount || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);

  useEffect(() => {
    if (!assignmentId || !initialAmount) {
      router.replace("/parent/dues");
    }
  }, [assignmentId, initialAmount, router]);

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        throw new Error("Invalid amount");
      }
      
      const order = await payDueViaUpi(assignmentId!, numAmount);
      setOrderData(order);
    } catch (err: any) {
      setError(err.message || "Failed to initiate payment");
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatePayment = async () => {
    // We now use a real backend call to simulate the webhook
    setLoading(true);
    try {
      await simulateSandboxPayment(assignmentId!, parseFloat(amount));
      setSuccess(true);
      // Wait a moment then go back to dues
      setTimeout(() => router.push("/parent/dues"), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to simulate payment");
    } finally {
      setLoading(false);
    }
  };

  if (!assignmentId || !initialAmount) return null;

  const isPartial = parseFloat(amount) < parseFloat(initialAmount);

  if (success) {
    return (
      <GlassCard className="p-8 text-center max-w-md mx-auto">
        <div className="w-16 h-16 bg-risk-low/20 text-risk-low rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
        <h2 className="text-2xl font-bold text-text-primary mb-2">{t("success")}</h2>
        <p className="text-text-secondary">Redirecting to dues...</p>
      </GlassCard>
    );
  }

  if (orderData) {
    return (
      <GlassCard className="p-8 text-center max-w-md mx-auto">
        <h2 className="text-xl font-bold text-text-primary mb-4">Complete Payment</h2>
        <p className="text-text-secondary mb-6">Razorpay Order ID: {orderData.id}</p>
        <button
          onClick={handleSimulatePayment}
          disabled={loading}
          className="w-full py-3 bg-accent-primary text-white rounded-md font-medium hover:bg-opacity-90 transition-opacity"
        >
          {loading ? "Processing..." : "Simulate Sandbox Success"}
        </button>
      </GlassCard>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">{t("title")}</h1>
        <p className="text-text-secondary mt-1">{t("subtitle")}</p>
      </div>

      <GlassCard className="p-6">
        <form onSubmit={handleInitiate} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">{t("amount_to_pay")}</label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-text-secondary font-bold">₹</span>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                max={initialAmount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-white border border-[#0F5A47]/20 rounded-xl pl-8 pr-4 py-3 text-base md:text-lg text-text-primary outline-none focus:border-[#0F5A47] shadow-xs min-h-[44px]"
              />
            </div>
            <p className="text-xs text-text-secondary mt-2 flex justify-between font-medium">
              <span>Remaining Balance: ₹{initialAmount}</span>
            </p>
          </div>

          {isPartial && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[#0F172A] text-xs font-medium leading-relaxed">
              <strong>Note:</strong> You are making a partial payment. The remaining balance of ₹{(parseFloat(initialAmount) - parseFloat(amount)).toFixed(2)} will still be due by the original due date.
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 text-xs font-semibold">
              {error}
            </div>
          )}

          <div className="pt-4 border-t border-border-glass">
            <button
              type="submit"
              disabled={loading || !amount || parseFloat(amount) <= 0}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-[#0F5A47] to-[#0D7A5F] text-white rounded-xl text-xs font-bold hover:opacity-95 active:scale-95 transition-all disabled:opacity-50 shadow-md min-h-[44px]"
            >
              {loading ? "Processing..." : t("proceed")}
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={<div className="text-text-secondary">Loading...</div>}>
      <PayForm />
    </Suspense>
  );
}
