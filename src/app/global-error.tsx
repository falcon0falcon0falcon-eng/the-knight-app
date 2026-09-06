"use client";
import { clearCachesAndReload } from "@/core/pwa";

/** آخر خط دفاع: خطأ خارج شجرة الصفحة (يستبدل شاشة الخطأ الافتراضية الفارغة) */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, background: "#0b0d12", color: "#e8ecf4", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <div style={{ maxWidth: 420, background: "#141822", border: "1px solid #232936", borderRadius: 20, padding: 24 }}>
            <div style={{ fontSize: 40 }}>⚠️</div>
            <h1 style={{ fontSize: 18, margin: "8px 0" }}>تعذّر تحميل التطبيق</h1>
            <p style={{ fontSize: 13, opacity: 0.7, lineHeight: 1.7 }}>
              غالبًا نسخة مخزّنة قديمة. اضغط «إصلاح وإعادة تحميل» — بياناتك المحفوظة على الجهاز لن تتأثر.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
              <button
                type="button"
                onClick={() => void clearCachesAndReload()}
                style={{ padding: "10px 16px", borderRadius: 12, border: 0, background: "#6c8cff", color: "#fff", fontWeight: 700, cursor: "pointer" }}
              >
                إصلاح وإعادة تحميل
              </button>
              <button
                type="button"
                onClick={() => reset()}
                style={{ padding: "10px 16px", borderRadius: 12, border: 0, background: "#232936", color: "#e8ecf4", fontWeight: 700, cursor: "pointer" }}
              >
                إعادة المحاولة
              </button>
            </div>
            <pre style={{ marginTop: 14, fontSize: 10, opacity: 0.5, direction: "ltr", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {error.name}: {error.message}
              {error.digest ? `\ndigest: ${error.digest}` : ""}
            </pre>
          </div>
        </div>
      </body>
    </html>
  );
}
