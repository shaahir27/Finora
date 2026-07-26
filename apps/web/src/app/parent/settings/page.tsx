"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import { subscribeToPush, unsubscribeFromPush } from "@/app/actions/push";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { Bell, Smartphone, ShieldCheck, Mail } from "lucide-react";

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export default function ParentSettingsPage() {
  const t = useTranslations("Settings");
  const { data: session } = useSession();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preference states
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [emailReceiptsEnabled, setEmailReceiptsEnabled] = useState(true);
  const [preferredChannel, setPreferredChannel] = useState("upi");

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setIsSubscribed(!!sub);
        });
      });
    }
  }, []);

  const handleTogglePush = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error("Push notifications are not supported in this browser.");
      }

      const registration = await navigator.serviceWorker.ready;

      if (isSubscribed) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await unsubscribeFromPush(subscription.endpoint);
          await subscription.unsubscribe();
        }
        setIsSubscribed(false);
        toast.success("Push notifications disabled");
      } else {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          throw new Error("VAPID public key is not configured.");
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });

        const subJson = subscription.toJSON();
        
        await subscribeToPush({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subJson.keys?.p256dh as string,
            auth: subJson.keys?.auth as string,
          }
        }, "Parent Web App");
        
        setIsSubscribed(true);
        toast.success("Push notifications enabled!");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while toggling notifications.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans">
      <div>
        <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">
          Parent Settings & Preferences
        </h1>
        <p className="text-text-secondary text-sm mt-0.5 font-medium">
          Manage notification channels, receipt alerts, and payment preferences.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Push Notifications Card */}
        <GlassCard className="p-6 border-[#0F5A47]/15 space-y-4">
          <div className="flex items-center gap-2.5 text-[#0F5A47]">
            <Bell className="w-5 h-5" />
            <h2 className="text-lg font-bold text-text-primary">
              Web Push Notifications
            </h2>
          </div>
          <p className="text-xs text-text-secondary font-medium leading-relaxed">
            Receive real-time alerts for fee due dates, payment acknowledgments, and school receipts directly on your browser.
          </p>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 text-xs font-semibold">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border-glass">
            <span className="text-xs font-bold text-text-primary">
              Browser Push Alert Status
            </span>
            <button
              onClick={handleTogglePush}
              disabled={loading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isSubscribed ? "bg-[#0F5A47]" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isSubscribed ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </GlassCard>

        {/* WhatsApp & Email Communication Preferences */}
        <GlassCard className="p-6 border-[#0F5A47]/15 space-y-4">
          <div className="flex items-center gap-2.5 text-[#0F5A47]">
            <Smartphone className="w-5 h-5" />
            <h2 className="text-lg font-bold text-text-primary">
              Communication Channels
            </h2>
          </div>

          <div className="space-y-4 divide-y divide-border-glass">
            {/* WhatsApp */}
            <div className="flex items-center justify-between pt-2">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-text-primary">WhatsApp Payment Receipts & Reminders</p>
                <p className="text-[11px] text-text-secondary font-medium">Receive instant digital receipts and due reminders via WhatsApp</p>
              </div>
              <button
                onClick={() => {
                  setWhatsappEnabled(!whatsappEnabled);
                  toast.success(`WhatsApp alerts ${!whatsappEnabled ? "enabled" : "disabled"}`);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  whatsappEnabled ? "bg-[#0F5A47]" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    whatsappEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Email Receipts */}
            <div className="flex items-center justify-between pt-4">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-text-primary">Email Tax Certificates & Statements</p>
                <p className="text-[11px] text-text-secondary font-medium">Send monthly Section 80C tax summaries to registered email</p>
              </div>
              <button
                onClick={() => {
                  setEmailReceiptsEnabled(!emailReceiptsEnabled);
                  toast.success(`Email statements ${!emailReceiptsEnabled ? "enabled" : "disabled"}`);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  emailReceiptsEnabled ? "bg-[#0F5A47]" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    emailReceiptsEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </GlassCard>

        {/* Preferred Payment Method & Security */}
        <GlassCard className="p-6 border-[#0F5A47]/15 space-y-4">
          <div className="flex items-center gap-2.5 text-[#0F5A47]">
            <ShieldCheck className="w-5 h-5" />
            <h2 className="text-lg font-bold text-text-primary">
              Default Payment Method & Security
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <label className="font-bold text-text-primary block text-xs uppercase tracking-wider">
              Default Quick-Pay Channel:
            </label>
            <select
              value={preferredChannel}
              onChange={(e) => {
                setPreferredChannel(e.target.value);
                toast.success(`Default channel set to ${e.target.value.toUpperCase()}`);
              }}
              className="w-full bg-white border border-[#0F5A47]/20 rounded-xl px-4 py-3 font-bold text-text-primary outline-none focus:border-[#0F5A47] text-base sm:text-xs min-h-[44px]"
            >
              <option value="upi">UPI (GPay / PhonePe / Paytm / BHIM)</option>
              <option value="netbanking">Net Banking</option>
              <option value="card">Credit / Debit Card</option>
            </select>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
