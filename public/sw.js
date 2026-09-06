/* Me vs Me service worker — app-shell cache + network-first API + offline fallback
 *
 * مهم: اسم الكاش مرتبط بنسخة النشر (?v=… في رابط تسجيل الـSW).
 * بدون ذلك كانت ملفات /_next/static القديمة تُقدَّم من الكاش بعد كل نشر جديد،
 * فتتحمّل chunks لا تطابق الصفحة الجديدة وتظهر "This page couldn't load".
 */
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = `mevsme-${VERSION}`;
const SHELL = ["/day", "/week", "/month", "/manifest.webmanifest", "/pdf.worker.min.mjs"];

// أصول ثابتة يمكن تخزينها بأمان (أسماؤها تتغير مع كل بناء)
const isBuildAsset = (url) => url.pathname.startsWith("/_next/static/");
const isMedia = (url) => /\.(png|jpe?g|svg|webp|ico|woff2?|ttf|mjs)$/i.test(url.pathname);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // احذف كل كاشات النشرات السابقة
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
      await self.clients.claim();
    })(),
  );
});

async function networkFirst(req, preloadPromise) {
  try {
    const res = (preloadPromise && (await preloadPromise)) || (await fetch(req));
    if (res && res.ok && res.type === "basic") {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    if (req.mode === "navigate") return (await caches.match("/day")) || Response.error();
    throw new Error("offline");
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res && res.ok && res.type === "basic") {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
  }
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // API: الشبكة فقط (لا تخزين لبيانات المزامنة إطلاقًا)
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(req).catch(() => new Response(JSON.stringify({ offline: true }), { status: 503, headers: { "content-type": "application/json" } })),
    );
    return;
  }

  // صفحات HTML: الشبكة أولًا حتى لا تُقدَّم صفحة نشر قديم
  if (req.mode === "navigate") {
    e.respondWith(networkFirst(req, e.preloadResponse));
    return;
  }

  // ملفات البناء (أسماؤها فريدة لكل نشر) + الوسائط: الكاش أولًا
  if (isBuildAsset(url) || isMedia(url)) {
    e.respondWith(cacheFirst(req));
    return;
  }

  e.respondWith(networkFirst(req));
});

self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
  if (e.data === "CLEAR_CACHES") {
    e.waitUntil(caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))));
  }
});
