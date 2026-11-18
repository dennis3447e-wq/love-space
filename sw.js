
const CACHE_NAME = "love-space-shell-v8";

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
  event.waitUntil((async () => {
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
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  // Always request fresh HTML from GitHub Pages.
  if (
    request.mode === "navigate" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith("/sw.js")
  ) {
    event.respondWith(
      fetch(new Request(request, { cache: "no-store" }))
        .then(response => {
          if (response.ok && !url.pathname.endsWith("/sw.js")) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache =>
              cache.put(request, copy)
            );
          }
          return response;
        })
        .catch(async () => {
          return (
            await caches.match(request) ||
            await caches.match("./index.html")
          );
        })
    );
    return;
  }

  // Network first for other same-origin files.
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache =>
            cache.put(request, copy)
          );
        }
        return response;
      })
      .catch(async () => {
        return await caches.match(request);
      })
  );
});

self.addEventListener("push", event => {
  event.waitUntil((async () => {
    let payload = {};

    try {
      payload = event.data ? event.data.json() : {};
    } catch {
      payload = {
        body: event.data ? event.data.text() : "You have a new message."
      };
    }

    await self.registration.showNotification(
      payload.title || "Love Space ❤️",
      {
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
      }
    );
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  event.waitUntil((async () => {
    const target = new URL(
      "./?open=chat",
      self.registration.scope
    );

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
  })());
});
