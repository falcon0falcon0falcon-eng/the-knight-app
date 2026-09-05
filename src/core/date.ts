// أدوات التاريخ — الأسبوع يبدأ السبت (legacy semantics)
export const pad = (n: number) => String(n).padStart(2, "0");
export function toISODate(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function todayISO(): string { return toISODate(new Date()); }
export function parseISO(s: string): Date { const [y, m, d] = s.split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); }
export function addDays(iso: string, n: number): string { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISODate(d); }
export function diffDays(a: string, b: string): number { return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000); }
export function isFutureDate(iso: string): boolean { return iso > todayISO(); }
export function weekday(iso: string): number { return parseISO(iso).getDay(); } // 0=Sun..6=Sat
/** بداية الأسبوع (السبت) */
export function weekStart(iso: string): string { const wd = weekday(iso); return addDays(iso, -((wd + 1) % 7)); }
export function weekEnd(iso: string): string { return addDays(weekStart(iso), 6); }
export function weekKey(iso: string): string { return weekStart(iso); }
export function weekDates(iso: string): string[] { const s = weekStart(iso); return Array.from({ length: 7 }, (_, i) => addDays(s, i)); }
export function monthKey(iso: string): string { return iso.slice(0, 7); }
export function monthStart(iso: string): string { return `${monthKey(iso)}-01`; }
export function monthEnd(iso: string): string { const d = parseISO(iso); return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
export function monthDates(iso: string): string[] { const s = monthStart(iso), e = monthEnd(iso); const out: string[] = []; for (let d = s; d <= e; d = addDays(d, 1)) out.push(d); return out; }
export function rangeDates(from: string, to: string): string[] { const out: string[] = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; }
export function addMonths(iso: string, n: number): string { const d = parseISO(iso); d.setMonth(d.getMonth() + n); return toISODate(d); }
export const WEEKDAY_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
export const WEEKDAY_SHORT_AR = ["أحد", "اثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];
export const MONTH_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
export function formatArabic(iso: string): string { const d = parseISO(iso); return `${WEEKDAY_AR[d.getDay()]} ${d.getDate()} ${MONTH_AR[d.getMonth()]} ${d.getFullYear()}`; }
export function formatShort(iso: string): string { const d = parseISO(iso); return `${d.getDate()} ${MONTH_AR[d.getMonth()]}`; }
export function nowISO(): string { return new Date().toISOString(); }
export function uid(prefix = ""): string { const r = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 14); return prefix ? `${prefix}_${r}` : r; }
export function clamp(n: number, a: number, b: number): number { return Math.max(a, Math.min(b, n)); }
export function round(n: number, p = 1): number { const f = 10 ** p; return Math.round(n * f) / f; }
export function avg(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
export function sum(xs: number[]): number { return xs.reduce((a, b) => a + b, 0); }
