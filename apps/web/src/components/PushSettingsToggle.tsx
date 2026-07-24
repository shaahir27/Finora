"use client";

import { useEffect, useState } from "react";
import { subscribeToPush, unsubscribeFromPush } from "@/app/actions/push";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushSettingsToggle({ userId }: { userId: string }) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      checkSubscription();
    } else {
      setLoading(false);
    }
  }, []);

  async function checkSubscription() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (err) {
      console.error("Error checking push subscription:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle() {
    if (loading) return;
    setLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;

      if (isSubscribed) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          await unsubscribeFromPush(userId, subscription.endpoint);
        }
        setIsSubscribed(false);
      } else {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          alert("VAPID public key not configured.");
          setLoading(false);
          return;
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });

        const subJSON = subscription.toJSON();
        
        await subscribeToPush(userId, {
          endpoint: subJSON.endpoint!,
          keys: {
            p256dh: subJSON.keys!.p256dh!,
            auth: subJSON.keys!.auth!
          }
        }, navigator.userAgent);
        
        setIsSubscribed(true);
      }
    } catch (err) {
      console.error("Failed to toggle push notifications", err);
      alert("Failed to toggle push notifications. Check browser permissions.");
    } finally {
      setLoading(false);
    }
  }

  if (!isSupported) {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-md">
        Push notifications are not supported in this browser.
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-surface-glass border border-gray-200 dark:border-gray-800 rounded-md shadow-sm">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Push Notifications</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Receive alerts for received payments, bounced cheques, and sync conflicts.
        </p>
      </div>
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent-core focus:ring-offset-2 ${
          isSubscribed ? "bg-accent-core" : "bg-gray-200 dark:bg-gray-700"
        } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            isSubscribed ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
