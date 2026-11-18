
const CACHE_NAME = "love-space-shell-v8";

const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      await Promise.allSettled(
        APP_FILES.map(file => cache.add(file))
      );

      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(key =>
            key.startsWith("love-space-shell-") &&
            key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);

        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone()).catch(() => {});
        }

        return response;
      } catch (error) {
        const cached = await caches.match(request);

        if (cached) return cached;

        if (request.mode === "navigate") {
          return (
            await caches.match("./index.html")
          ) || Response.error();
        }

        return Response.error();
      }
    })()
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
          body: event.data
            ? event.data.text()
            : "You have a new message."
        };
      }

      const title = payload.title || "Love Space ❤️";

      await self.registration.showNotification(title, {
        body: payload.body || "You have a new message.",
        icon: "./icon.svg",
        badge: "./icon.svg",
        tag: payload.tag || (
          payload.notificationId
            ? "love-space-" + payload.notificationId
            : "love-space-message"
        ),
        renotify: true,
        vibrate: [200, 100, 200],
        data: {
          url: payload.url || "./",
          notificationId: payload.notificationId || null
        }
      });
    })()
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const scope = self.registration.scope;

      let target = new URL(
        event.notification.data?.url || "?open=chat",
        scope
      );

      if (
        target.origin !== self.location.origin ||
        !target.href.startsWith(scope)
      ) {
        target = new URL("?open=chat", scope);
      }

      if (target.pathname === new URL(scope).pathname &&
          !target.searchParams.has("open")) {
        target.searchParams.set("open", "chat");
      }

      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });

      for (const client of windows) {
        if (client.url.startsWith(scope)) {
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
