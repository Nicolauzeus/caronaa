const CACHE = "caronaa-static-v3";
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
