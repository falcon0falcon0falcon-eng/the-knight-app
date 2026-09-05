import { AppData, AreaId } from "@/types/app-data";
import { rangeDates } from "@/core/date";

export interface MetricDef { id: string; label: string; unit: string; area: AreaId; daily: (data: AppData, date: string) => number }

const entry = (data: AppData, date: string) => data.entries[date];
const sumBy = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);

/** سجل الـmetrics — مصدر الحقيقة لكل التقدم المشتق من بيانات حقيقية */
export const METRICS: MetricDef[] = [
  { id: "gymSessions", label: "جلسات جيم", unit: "جلسة", area: "physical", daily: (d, dt) => (entry(d, dt)?.gym ? 1 : 0) },
  { id: "runKm", label: "كيلومترات جري", unit: "كم", area: "physical", daily: (d, dt) => entry(d, dt)?.runKm ?? 0 },
  { id: "caloriesBurned", label: "سعرات محروقة", unit: "kcal", area: "physical", daily: (d, dt) => entry(d, dt)?.caloriesBurned ?? 0 },
  { id: "quranMemPages", label: "صفحات حفظ", unit: "صفحة", area: "deen", daily: (d, dt) => entry(d, dt)?.quranMemPages ?? 0 },
  { id: "quranReadPages", label: "صفحات قراءة قرآن", unit: "صفحة", area: "deen", daily: (d, dt) => entry(d, dt)?.quranReadPages ?? 0 },
  { id: "shariaLessons", label: "دروس شرعية", unit: "درس", area: "deen", daily: (d, dt) => entry(d, dt)?.shariaLessons ?? 0 },
  { id: "dhikrCount", label: "أذكار", unit: "ذكر", area: "deen", daily: (d, dt) => sumBy(Object.values(entry(d, dt)?.dhikr ?? {}), (x) => x) },
  { id: "tasksDone", label: "مهام منجزة", unit: "مهمة", area: "mental", daily: (d, dt) => (entry(d, dt)?.tasks ?? []).filter((t) => t.done).length },
  { id: "habitsDone", label: "عادات منجزة", unit: "عادة", area: "mental", daily: (d, dt) => Object.values(entry(d, dt)?.habits ?? {}).filter(Boolean).length },
  { id: "readingMinutes", label: "دقائق قراءة", unit: "دقيقة", area: "mental", daily: (d, dt) => sumBy(d.books, (b) => sumBy(b.sessions.filter((s) => s.date === dt), (s) => s.minutes)) },
  { id: "readingPages", label: "صفحات كتب", unit: "صفحة", area: "mental", daily: (d, dt) => sumBy(d.books, (b) => sumBy(b.sessions.filter((s) => s.date === dt), (s) => Math.max(0, s.to - s.from))) },
  { id: "courseLessons", label: "دروس دورات", unit: "درس", area: "academic", daily: (d, dt) => sumBy(d.courses, (c) => c.lessons.filter((l) => l.done && l.doneAt?.slice(0, 10) === dt).length) },
  { id: "courseMinutes", label: "دقائق دورات", unit: "دقيقة", area: "academic", daily: (d, dt) => sumBy(d.courses, (c) => sumBy(c.lessons.filter((l) => l.done && l.doneAt?.slice(0, 10) === dt), (l) => l.durationMin)) },
  { id: "trainingMinutes", label: "دقائق تدريب", unit: "دقيقة", area: "career", daily: (d, dt) => sumBy(d.trainingLog.sessions.filter((s) => s.date === dt), (s) => s.minutes) },
  { id: "trainingSessions", label: "جلسات تدريب", unit: "جلسة", area: "career", daily: (d, dt) => d.trainingLog.sessions.filter((s) => s.date === dt).length },
  { id: "ideaMinutes", label: "دقائق إبداع", unit: "دقيقة", area: "creativity", daily: (d, dt) => sumBy(entry(d, dt)?.ideaWork ?? [], (w) => w.minutes) },
  { id: "brainDumps", label: "تفريغات عقل", unit: "تفريغ", area: "mental", daily: (d, dt) => d.brainDumps.filter((b) => b.date === dt).length },
  { id: "cleanDays", label: "أيام نظيفة", unit: "يوم", area: "mental", daily: (d, dt) => (d.relapseLog.some((r) => r.date === dt) ? 0 : d.sobrietyStartAt && dt >= d.sobrietyStartAt.slice(0, 10) ? 1 : 0) },
  { id: "cravingsResisted", label: "رغبات مقاومة", unit: "مرة", area: "mental", daily: (d, dt) => d.cravingEvents.filter((c) => c.date === dt && c.outcome === "resisted").length },
  { id: "recoveryTasksDone", label: "مهام تعافٍ", unit: "مهمة", area: "mental", daily: (d, dt) => d.recoveryTasks.filter((t) => t.done && t.doneAt?.slice(0, 10) === dt).length },
  { id: "income", label: "دخل", unit: "ج", area: "career", daily: (d, dt) => sumBy(d.financeEntries.filter((f) => f.date === dt && f.type === "income"), (f) => f.amount) },
  { id: "savings", label: "ادخار", unit: "ج", area: "career", daily: (d, dt) => sumBy(d.savingsEntries.filter((s) => s.date === dt), (s) => s.amount) },
  { id: "checkIns", label: "تسجيلات تعافٍ", unit: "مرة", area: "mental", daily: (d, dt) => d.recoveryEntries.filter((r) => r.date === dt).length },
  { id: "tadabur", label: "تدبر", unit: "تدبر", area: "deen", daily: (d, dt) => d.quranTadabur.filter((t) => t.date === dt).length },
  { id: "practices", label: "ممارسات هوية", unit: "ممارسة", area: "mental", daily: (d, dt) => sumBy(d.identityPrinciples, (p) => sumBy(p.practices, (pr) => pr.log.filter((x) => x === dt).length)) },
];
export const metricById = (id: string) => METRICS.find((m) => m.id === id);
export function metricValue(id: string, data: AppData, from: string, to: string): number {
  const m = metricById(id); if (!m) return 0;
  return rangeDates(from, to).reduce((a, dt) => a + m.daily(data, dt), 0);
}
export function metricDaily(id: string, data: AppData, date: string): number { return metricById(id)?.daily(data, date) ?? 0; }
