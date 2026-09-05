import { AppData, Challenge, Course, Lesson } from "@/types/app-data";
import { addDays, rangeDates, todayISO, weekStart } from "@/core/date";
import { metricDaily } from "./metrics";

export interface ChallengeState { daysElapsed: number; daysLeft: number; endDate: string; daily: Record<string, number>; total: number; percent: number; successDays: number; failed: boolean; succeeded: boolean; weeks: { week: string; value: number; ok: boolean }[]; todayValue: number }
/** قيمة يوم من التحدي: يدوي من progress، أو من metric، أو من دورة */
export function challengeDayValue(c: Challenge, data: AppData, date: string): number {
  if (c.source === "manual") return c.progress[date] ?? 0;
  if (c.source.startsWith("course:")) { const course = data.courses.find((x) => x.id === c.source.slice(7)); return course ? course.lessons.filter((l) => l.done && l.doneAt?.slice(0, 10) === date).length : 0; }
  return metricDaily(c.source, data, date) + (c.progress[date] ?? 0);
}
export function challengeState(c: Challenge, data: AppData, today = todayISO()): ChallengeState {
  const endDate = addDays(c.startDate, c.durationDays - 1); const last = today < endDate ? today : endDate;
  const dates = c.startDate <= last ? rangeDates(c.startDate, last) : []; const daily: Record<string, number> = {}; let total = 0;
  for (const d of dates) { daily[d] = challengeDayValue(c, data, d); total += daily[d]; }
  const daysElapsed = dates.length; const daysLeft = Math.max(0, c.durationDays - daysElapsed);
  let percent = 0, successDays = 0, failed = false, succeeded = false; const weeks: ChallengeState["weeks"] = [];
  if (c.type === "daily") { successDays = dates.filter((d) => daily[d] >= c.target).length; const missed = dates.filter((d) => d < today && daily[d] < c.target).length; failed = missed > 0; percent = Math.round((successDays / c.durationDays) * 100); succeeded = !failed && successDays >= c.durationDays; }
  else if (c.type === "weekly") { const wk: Record<string, number> = {}; for (const d of dates) { const w = weekStart(d); wk[w] = (wk[w] ?? 0) + daily[d]; } for (const [w, v] of Object.entries(wk)) weeks.push({ week: w, value: v, ok: v >= c.target }); const totalWeeks = Math.ceil(c.durationDays / 7); const completedWeeks = weeks.filter((x) => addDays(x.week, 6) < today); failed = completedWeeks.some((x) => !x.ok); percent = Math.round((weeks.filter((x) => x.ok).length / totalWeeks) * 100); succeeded = !failed && weeks.filter((x) => x.ok).length >= totalWeeks; }
  else { percent = Math.min(100, Math.round((total / Math.max(1, c.target)) * 100)); succeeded = total >= c.target; failed = !succeeded && today > endDate; }
  return { daysElapsed, daysLeft, endDate, daily, total, percent: Math.min(100, percent), successDays, failed, succeeded, weeks, todayValue: daily[today] ?? 0 };
}
/** الحالة المشتقة لتحديث status تلقائيًا (auto challenge progress) */
export function resolveChallengeStatus(c: Challenge, data: AppData, today = todayISO()): Challenge["status"] {
  if (c.status !== "active") return c.status; const s = challengeState(c, data, today);
  if (s.succeeded) return "success"; if (s.failed && (c.type !== "boss" || today > s.endDate)) return "failed"; return "active";
}
export function courseStats(c: Course) { const done = c.lessons.filter((l) => l.done); const mins = c.lessons.reduce((a, l) => a + l.durationMin, 0); const doneMins = done.reduce((a, l) => a + l.durationMin, 0); return { lessons: c.lessons.length, done: done.length, percent: c.lessons.length ? Math.round((done.length / c.lessons.length) * 100) : 0, minutes: mins, doneMinutes: doneMins, leftMinutes: mins - doneMins }; }
export function nextLesson(c: Course): Lesson | undefined { return c.lessons.find((l) => !l.done); }
