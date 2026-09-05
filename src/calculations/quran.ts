import { QuranMemorization } from "@/types/app-data";
import { diffDays } from "@/core/date";

export const QURAN_PAGES = 604;
export const QURAN_UNITS = 240; // أرباع الأحزاب
export const PAGES_PER_UNIT = QURAN_PAGES / QURAN_UNITS; // ≈ 2.52
export const JUZ_COUNT = 30;

/** رقم الجزء لصفحة (تقريب قياسي: الجزء 1 يبدأ ص1، الجزء n يبدأ 2 + (n-1)*20 تقريبًا) */
export function juzOfPage(page: number): number { if (page <= 21) return 1; return Math.min(30, Math.floor((page - 22) / 20) + 2); }
export function pagesOfJuz(juz: number): number[] { const start = juz === 1 ? 1 : 22 + (juz - 2) * 20; const end = juz === 30 ? 604 : juz === 1 ? 21 : start + 19; return Array.from({ length: end - start + 1 }, (_, i) => start + i); }
export function unitOfPage(page: number): number { return Math.min(QURAN_UNITS, Math.max(1, Math.ceil(page / PAGES_PER_UNIT))); }

export interface QuranProgress { memorized: number; units: number; percent: number; dueReviews: number; strongPages: number }
export function quranProgress(q: QuranMemorization, today: string): QuranProgress {
  const pages = Object.keys(q.pages).map(Number);
  const due = dueReviewPages(q, today);
  const strong = Object.values(q.pages).filter((p) => p.reviews >= 5).length;
  const units = new Set(pages.map(unitOfPage)).size;
  return { memorized: pages.length, units, percent: Math.round((pages.length / QURAN_PAGES) * 1000) / 10, dueReviews: due.length, strongPages: strong };
}
/**
 * صفحات المراجعة المستحقة: آخر مراجعة/حفظ أقدم من interval.
 * كل مراجعة ناجحة تطيل الفاصل تدريجيًا (spaced): interval * (1 + reviews * 0.5) بحد أقصى 60 يوم.
 */
export function dueReviewPages(q: QuranMemorization, today: string): number[] {
  const base = q.reviewIntervalDays || 7; const out: number[] = [];
  for (const [p, st] of Object.entries(q.pages)) { const last = (st.lastReviewAt || st.memorizedAt).slice(0, 10); const interval = Math.min(60, Math.round(base * (1 + st.reviews * 0.5))); if (diffDays(last, today) >= interval) out.push(Number(p)); }
  return out.sort((a, b) => a - b);
}
/** تحذير المراجعة: نسبة الصفحات المستحقة من المحفوظ */
export function reviewWarning(q: QuranMemorization, today: string): { level: "ok" | "warn" | "danger"; ratio: number } {
  const total = Object.keys(q.pages).length; if (!total) return { level: "ok", ratio: 0 };
  const ratio = dueReviewPages(q, today).length / total;
  return { level: ratio > 0.4 ? "danger" : ratio > 0.15 ? "warn" : "ok", ratio };
}
export function quranGoalProgress(q: QuranMemorization, goalPages: number): number { return Math.min(100, Math.round((Object.keys(q.pages).length / Math.max(1, goalPages)) * 100)); }
