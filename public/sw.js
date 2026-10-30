// Web Push service worker - the browser equivalent of android's UnifiedPush receiver. Pushes are
// content-free by design (ADR-0013/PROTOCOL.md §6: a push never carries room content, only a
// content-free wake-up), so this never has anything decryptable to show - just a generic "check
// the app" notification, same posture as android's own NotificationChannels being built from a
// post-sync diff, never the push payload itself. See src/settings/push.ts for registration.

self.addEventListener("push", (event) => {
  event.waitUntil(
    self.registration.showNotification("Squaddle", {
      body: "New activity - open Squaddle to see what changed.",
      tag: "squaddle-update",
      renotify: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        if ("focus" in client) {
          await client.focus();
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow("/rooms");
    })(),
  );
});
