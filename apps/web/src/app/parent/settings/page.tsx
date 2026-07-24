"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import { subscribeToPush, unsubscribeFromPush } from "@/app/actions/push";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";

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

  // We read the initial locale from localStorage in useEffect, 
  // but it's handled globally by our Sidebar toggle. 
  // We can show it here too just for completeness, but let's keep it simple.

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
          const parentUserId = session?.user?.id;
          if (parentUserId) {
            await unsubscribeFromPush(parentUserId, subscription.endpoint);
          }
          await subscription.unsubscribe();
        }
        setIsSubscribed(false);
      } else {
        // Request subscription
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          throw new Error("VAPID public key is not configured.");
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });

        const subJson = subscription.toJSON();
        
        const parentUserId = session?.user?.id;
        if (parentUserId) {
          await subscribeToPush(parentUserId, {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subJson.keys?.p256dh as string,
              auth: subJson.keys?.auth as string,
            }
          }, "Parent Web App");
        }
        
        setIsSubscribed(true);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while toggling notifications.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">{t("title")}</h1>
      </div>

      <GlassCard className="p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">{t("push_notifications")}</h2>
          <p className="text-text-secondary text-sm mb-4">
            {t("push_description")}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-risk-high/20 border border-risk-high/30 rounded-md text-text-primary text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center">
            <button
              onClick={handleTogglePush}
              disabled={loading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 focus:ring-offset-bg-base ${
                isSubscribed ? "bg-accent-primary" : "bg-border-glass"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isSubscribed ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className="ml-3 text-sm text-text-primary">
              {isSubscribed ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
