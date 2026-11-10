
const CACHE_NAME = "love-space-shell-v6";

const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key =>
            key.startsWith("love-space-shell-") &&
            key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  const isAppShell =
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/manifest.json") ||
    url.pathname.endsWith("/icon.svg");

  if (isAppShell) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request)
            .then(cached =>
              cached || caches.match("./index.html")
            )
        )
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

/* RECEIVE BACKGROUND PUSH NOTIFICATIONS */
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

    const title = payload.title || "Love Space ❤️";

    const options = {
      body: payload.body || "You have a new message.",
      icon: "./icon.svg",
      badge: "./icon.svg",
      tag: "love-space-message",
      renotify: true,
      vibrate: [200, 100, 200],
      data: {
        url: payload.url || "./?open=chat",
        notificationId: payload.notificationId || null
      }
    };

    await self.registration.showNotification(title, options);
  })());
});

/* OPEN CHAT WHEN NOTIFICATION IS TAPPED */
self.addEventListener("notificationclick", event => {
  event.notification.close();

  event.waitUntil((async () => {
    const target = new URL(
      event.notification.data?.url || "./?open=chat",
      self.registration.scope
    );

    if (target.origin !== self.location.origin) return;

    const windows = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });

    for (const client of windows) {
      if ("focus" in client) {
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
