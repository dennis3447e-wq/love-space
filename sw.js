
const CACHE_NAME = "love-space-shell-v7";

const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(key => key.startsWith("love-space-shell-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, copy);
          });
        }

        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        return cached || caches.match("./index.html");
      })
  );
});

self.addEventListener("push", event => {
  event.waitUntil(
    (async () => {
      let payload = {};

      try {
        payload = event.data ? event.data.json() : {};
      } catch {
        payload = {
          body: event.data ? event.data.text() : "You have a new message."
        };
      }

      const title = payload.title || "Love Space ❤️";

      const options = {
        body: payload.body || "You have a new message.",
        icon: "./icon.svg",
        badge: "./icon.svg",
        tag: payload.notificationId
          ? "love-space-" + payload.notificationId
          : "love-space-message",
        renotify: true,
        vibrate: [200, 100, 200],
        data: {
          notificationId: payload.notificationId || null
        }
      };

      await self.registration.showNotification(title, options);
    })()
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const target = new URL("./?open=chat", self.registration.scope);

      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });

      for (const client of windows) {
        if (client.url.startsWith(self.registration.scope)) {
          await client.focus();

          if ("navigate" in client) {
            await client.navigate(target.href);
          }

          return;
        }
      }

      await self.clients.openWindow(target.href);
    })()
  );
});
