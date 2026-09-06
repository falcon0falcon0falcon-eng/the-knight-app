"use client";
import { useEffect, useState } from "react";
import { clearCachesAndReload, isChunkLoadError, healChunkFailure } from "@/core/pwa";

/**
 * حدود خطأ للصفحات: بدل شاشة "This page couldn't load" الفارغة،
 * نعرض رسالة عربية + إصلاح بضغطة واحدة (مسح كاش التطبيق فقط — بياناتك المحلية لا تُمس).
 */
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [busy, setBusy] = useState(false);
  const chunk = isChunkLoadError(error);

  useEffect(() => {
    // فشل تحميل chunk بعد نشر جديد: أصلح تلقائيًا مرة واحدة
    if (chunk) void healChunkFailure();
  }, [chunk]);

  return (
    <div className="grid min-h-screen place-items-center p-6 text-center" dir="rtl">
      <div className="card max-w-md space-y-3 p-6">
        <div className="text-4xl" aria-hidden>
          ⚠️
        </div>
        <h1 className="text-lg font-black">تعذّر فتح هذه الصفحة</h1>
        <p className="text-sm text-muted">
          {chunk
            ? "يبدو أن نسخة مخزّنة قديمة من التطبيق. اضغط «إصلاح وإعادة تحميل» لتحديثها."
            : "حدث خطأ غير متوقع أثناء عرض الصفحة. بياناتك محفوظة محليًا ولم تتأثر."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="touch rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white" onClick={() => reset()}>
            إعادة المحاولة
          </button>
          <button
            type="button"
            className="touch rounded-xl bg-surface-2 px-4 py-2 text-sm font-bold"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await clearCachesAndReload();
            }}
          >
            {busy ? "جارٍ الإصلاح…" : "إصلاح وإعادة تحميل"}
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- تنقّل كامل متعمّد: قد تكون حزم العميل تالفة فلا يصلح next/link */}
          <a className="touch rounded-xl bg-surface-2 px-4 py-2 text-sm font-bold" href="/day">
            الصفحة الرئيسية
          </a>
        </div>
        <details className="text-start text-[11px] text-muted">
          <summary className="cursor-pointer">تفاصيل تقنية</summary>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words" dir="ltr">
            {error.name}: {error.message}
            {error.digest ? `\ndigest: ${error.digest}` : ""}
          </pre>
        </details>
      </div>
    </div>
  );
}
