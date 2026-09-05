/* Me vs Me service worker — app-shell cache + network-first API + offline fallback */
const VERSION = "mevsme-v1";
const SHELL = ["/day", "/week", "/month", "/manifest.webmanifest", "/icons/icon-512.png", "/pdf.worker.min.mjs"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL).catch(() => {}))); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", (e) => {
  const req = e.request; if (req.method !== "GET") return; const url = new URL(req.url); if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) { e.respondWith(fetch(req).catch(() => new Response(JSON.stringify({ offline: true }), { headers: { "content-type": "application/json" }, status: 503 }))); return; }
  if (req.mode === "navigate") { e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return r; }).catch(() => caches.match(req).then((r) => r || caches.match("/day")))); return; }
  e.respondWith(caches.match(req).then((cached) => { const net = fetch(req).then((r) => { if (r.ok && (url.pathname.startsWith("/_next/static") || url.pathname.match(/\.(png|svg|mjs|js|css|woff2?)$/))) caches.open(VERSION).then((c) => c.put(req, r.clone())); return r; }).catch(() => cached); return cached || net; }));
});
self.addEventListener("message", (e) => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });
