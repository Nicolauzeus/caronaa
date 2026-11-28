const CACHE = "caronaa-static-v4";
const SHELL = ["/offline.html", "/pwa-icon-192.png", "/pwa-icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  // Take over immediately so a rebuilt app stops asking for files it replaced.
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("caronaa-static-") && key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

const isShell = (pathname) => SHELL.includes(pathname);
const isMedia = (pathname) =>
  /^\/(assets|__l5e\/assets-v1)\//.test(pathname) && /\.(png|jpe?g|webp|gif|svg|woff2?)$/.test(pathname);
const isCode = (pathname) =>
  /^\/(assets|__l5e\/assets-v1)\//.test(pathname) && /\.(js|css|mjs)$/.test(pathname);

// A saved page must never be stored under a file URL: that turns one missing
// build file into a permanent crash instead of a single reload.
function matchesKind(pathname, contentType) {
  const type = (contentType || "").toLowerCase();
  if (/\.(png|jpe?g|webp|gif|svg)$/.test(pathname)) return type.startsWith("image/");
  if (/\.woff2?$/.test(pathname)) return type.startsWith("font/") || type.includes("woff");
  if (/\.webmanifest$/.test(pathname)) return type.includes("manifest") || type.startsWith("application/");
  return type.startsWith("text/html");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // Never cache HTML containing sessions, RPCs or user data.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }
  // Hashed modules and stylesheets always come from the network: a stale copy
  // is exactly what makes a route disappear after a deploy.
  if (isCode(url.pathname)) return;
  if (!isShell(url.pathname) && !isMedia(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok && !response.redirected && matchesKind(url.pathname, response.headers.get("content-type"))) {
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) return cached;
      throw error;
    }
  })());
});

// F07 ride-request push: high-priority alert that opens the order when tapped.
const PUSH_FALLBACK_BODY = "Nova corrida CARONAA! Toque para ver detalhes.";

function safeRideUrl(raw) {
  try {
    const url = new URL(typeof raw === "string" && raw ? raw : "/home", self.location.origin);
    // Only ever open pages of this app, never an address sent from outside.
    return url.origin === self.location.origin ? url.href : new URL("/home", self.location.origin).href;
  } catch {
    return new URL("/home", self.location.origin).href;
  }
}

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  if (!payload || typeof payload !== "object") payload = {};
  const data = payload.data && typeof payload.data === "object" ? payload.data : {};
  const title = typeof payload.title === "string" && payload.title ? payload.title : "CARONAA";
  const body = typeof payload.body === "string" && payload.body ? payload.body : PUSH_FALLBACK_BODY;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/pwa-icon-192.png",
      badge: "/pwa-icon-192.png",
      vibrate: [400, 200, 400, 200, 800, 200, 800],
      tag: "caronaa-ride-request",
      renotify: true,
      requireInteraction: true,
      silent: false,
      timestamp: Date.now(),
      actions: [{ action: "open", title: "Ver corrida" }],
      data: { url: safeRideUrl(data.url || payload.url), orderId: data.orderId ?? payload.orderId ?? null },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safeRideUrl(event.notification.data && event.notification.data.url);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      const focused = await existing.focus();
      const client = focused || existing;
      if (client.url !== target && typeof client.navigate === "function") {
        try { await client.navigate(target); } catch { /* uncontrolled tab: focus is enough */ }
      }
      return;
    }
    await self.clients.openWindow(target);
  })());
});
