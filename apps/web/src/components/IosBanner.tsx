"use client";

import { useEffect, useState } from "react";

export function IosBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if device is iOS
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    // Check if app is in standalone mode
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone;
    // Check if dismissed before
    const isDismissed = localStorage.getItem("ios-banner-dismissed") === "true";

    if (isIos && !isStandalone && !isDismissed) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#1B1712] border-t border-gray-200 dark:border-gray-800 p-4 shadow-lg flex items-start gap-4">
      <div className="flex-1">
        <p className="text-sm text-gray-800 dark:text-gray-200">
          Add to Home Screen for the full app experience — tap Share, then Add to Home Screen
        </p>
      </div>
      <button
        onClick={() => {
          localStorage.setItem("ios-banner-dismissed", "true");
          setShow(false);
        }}
        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        Dismiss
      </button>
    </div>
  );
}
