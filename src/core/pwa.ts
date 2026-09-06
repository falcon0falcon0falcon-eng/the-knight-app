"use client";

/**
 * إنقاذ ذاتي عند تلف كاش الـService Worker (أشهر سبب لرسالة "This page couldn't load"
 * بعد نشر جديد: chunk قديم من الكاش لا يطابق الصفحة الجديدة).
 */

export const BUILD_VERSION = process.env.NEXT_PUBLIC_BUILD_VERSION || "dev";
const HEAL_FLAG = "mevsme:self-healed";

/** يلغي تسجيل كل الـservice workers ويمسح كل الكاشات (لا يمس IndexedDB / بياناتك) */
export async function clearAppCaches(): Promise<void> {
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* تجاهل */
  }
  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* تجاهل */
  }
}

/** مسح الكاش ثم إعادة تحميل الصفحة (البيانات المحلية في IndexedDB تبقى كما هي) */
export async function clearCachesAndReload(): Promise<void> {
  await clearAppCaches();
  location.reload();
}

/** هل الخطأ ناتج عن فشل تحميل chunk (كاش قديم / نشر جديد)؟ */
export function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err ?? "");
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(msg);
}

/**
 * يُنفَّذ مرة واحدة فقط لكل جلسة: عند اكتشاف فشل تحميل chunk نمسح الكاش ونعيد التحميل تلقائيًا.
 * الحارس (sessionStorage) يمنع أي حلقة إعادة تحميل لا نهائية.
 */
export async function healChunkFailure(): Promise<boolean> {
  try {
    if (sessionStorage.getItem(HEAL_FLAG)) return false;
    sessionStorage.setItem(HEAL_FLAG, String(Date.now()));
  } catch {
    return false;
  }
  await clearAppCaches();
  location.reload();
  return true;
}

/** يربط مستمعات عامة لالتقاط فشل الـchunks (نافذة + وعود مرفوضة) */
export function installChunkErrorGuard(): () => void {
  if (typeof window === "undefined") return () => {};
  const onError = (e: ErrorEvent) => {
    if (isChunkLoadError(e.error ?? e.message)) void healChunkFailure();
  };
  const onRejection = (e: PromiseRejectionEvent) => {
    if (isChunkLoadError(e.reason)) void healChunkFailure();
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}

/** تسجيل الـSW مرتبطًا بنسخة النشر + إعادة التحميل عند تفعيل نسخة جديدة */
export function registerServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (process.env.NODE_ENV !== "production") return;
  const url = `/sw.js?v=${encodeURIComponent(BUILD_VERSION)}`;
  navigator.serviceWorker
    .register(url)
    .then((reg) => {
      reg.update().catch(() => {});
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        sw?.addEventListener("statechange", () => {
          // نسخة جديدة جاهزة وهناك نسخة قديمة تتحكم: فعّلها فورًا
          if (sw.state === "installed" && navigator.serviceWorker.controller) sw.postMessage("SKIP_WAITING");
        });
      });
    })
    .catch(() => {});

  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
}
