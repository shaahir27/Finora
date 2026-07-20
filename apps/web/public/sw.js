self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Push Notifications
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Finora";
  const options = {
    body: data.body || "You have a new notification.",
    icon: "/icon-192x192.png",
    badge: "/icon-192x192.png",
    data: {
      url: data.url || "/admin/dashboard",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        let matchingClient = null;
        for (let i = 0; i < windowClients.length; i++) {
          const windowClient = windowClients[i];
          if (windowClient.url === urlToOpen) {
            matchingClient = windowClient;
            break;
          }
        }

        if (matchingClient) {
          return matchingClient.focus();
        } else {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});

// Background Sync
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-offline-payments") {
    event.waitUntil(syncPayments());
  }
});

async function syncPayments() {
  // In a real implementation, this would read from IndexedDB, 
  // then call the server action (or a fetch endpoint since server actions are RPC over POST)
  // We'll implement the UI queue part in offline-sync/page.tsx which manually uses server actions.
  // The service worker sync event just notifies all clients to trigger their sync.
  
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: "TRIGGER_SYNC" });
  });
}
