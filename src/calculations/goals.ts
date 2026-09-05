import { AppData, Goal, GoalTemplate, HabitMiss } from "@/types/app-data";
import { addDays, addMonths, avg, monthDates, monthEnd, monthKey, monthStart, todayISO, weekDates, weekEnd, weekKey, weekStart } from "@/core/date";
import { metricValue } from "./metrics";
import { dayScore, activeHabits, habitDueState, habitDone } from "./daily";
import { xpBetween } from "./gamification";
import { quranProgress } from "./quran";

export interface PeriodRange { key: string; from: string; to: string; period: "week" | "month" }
export const weekRange = (iso: string): PeriodRange => ({ key: weekKey(iso), from: weekStart(iso), to: weekEnd(iso), period: "week" });
export const monthRange = (iso: string): PeriodRange => ({ key: monthKey(iso), from: monthStart(iso), to: monthEnd(iso), period: "month" });
export const prevRange = (r: PeriodRange): PeriodRange => (r.period === "week" ? weekRange(addDays(r.from, -7)) : monthRange(addMonths(r.from, -1)));

export interface GoalProgress { value: number; target: number; percent: number; done: boolean }
/** تقدم الهدف من البيانات الحقيقية حسب نوعه */
export function goalProgress(g: Goal, data: AppData, r: PeriodRange): GoalProgress {
  let value = 0; let target = g.target;
  switch (g.kind) {
    case "recurring": value = g.metric ? metricValue(g.metric, data, r.from, r.to) : g.manualValue ?? 0; break;
    case "manual": value = g.done ? 1 : 0; target = 1; break;
    case "milestone": value = (g.metric ? metricValue(g.metric, data, g.carriedFrom ?? r.from, r.to) : 0) + (g.manualValue ?? 0); break;
    case "percentage": {
      if (g.goalRef === "quranMem") { const q = quranProgress(data.quranMemorization, r.to); value = Math.round((q.memorized / Math.max(1, data.goalSettings.quranMemGoalPages)) * 100); }
      else if (g.goalRef === "savings") { const s = data.savingsEntries.reduce((a, x) => a + x.amount, 0); value = Math.round((s / Math.max(1, data.goalSettings.savingsGoal)) * 100); }
      else if (g.goalRef === "income") { const s = data.financeEntries.filter((f) => f.type === "income" && f.date >= r.from && f.date <= r.to).reduce((a, x) => a + x.amount, 0); value = Math.round((s / Math.max(1, data.goalSettings.incomeGoal)) * 100); }
      else if (g.goalRef === "weight") { const gs = data.goalSettings; const w = [...data.bodyEntries].filter((b) => b.weight).sort((a, b) => a.date.localeCompare(b.date)); const first = w[0]?.weight, last = w[w.length - 1]?.weight; value = first && last && gs.weightGoal ? Math.round(Math.min(100, Math.max(0, ((first - last) / (first - gs.weightGoal)) * 100))) : 0; }
      else value = g.manualValue ?? 0;
      break;
    }
  }
  const done = g.kind === "manual" ? g.done : value >= target && target > 0;
  return { value, target, percent: target ? Math.min(100, Math.round((value / target) * 100)) : 0, done };
}
/** إنشاء أهداف الفترة من القوالب + ترحيل milestones غير المكتملة من الفترة السابقة */
export function materializeGoals(existing: Goal[], templates: GoalTemplate[], data: AppData, r: PeriodRange, mkId: () => string): Goal[] {
  const mine = existing.filter((g) => g.periodKey === r.key); const out: Goal[] = [...mine];
  for (const t of templates) if (!mine.some((g) => g.templateId === t.id)) out.push({ ...t, id: mkId(), periodKey: r.key, carried: false, done: false, templateId: t.id });
  const prev = prevRange(r); const prevGoals = existing.filter((g) => g.periodKey === prev.key && g.kind === "milestone");
  for (const pg of prevGoals) { const p = goalProgress(pg, data, prev); if (!p.done && !mine.some((g) => g.carriedFrom === (pg.carriedFrom ?? pg.periodKey) && g.title === pg.title)) out.push({ ...pg, id: mkId(), periodKey: r.key, carried: true, carriedFrom: pg.carriedFrom ?? prev.from, done: false, doneAt: undefined }); }
  return out;
}

export interface PeriodReport { range: PeriodRange; xp: number; avgScore: number; scoredDays: number; days: { date: string; score: number | null; xp: number }[]; habitMissPenalty: number; misses: HabitMiss[]; bestDay?: string; closedDays: number }
export function periodReport(data: AppData, r: PeriodRange): PeriodReport {
  const dates = r.period === "week" ? weekDates(r.from) : monthDates(r.from); const today = todayISO();
  const days = dates.map((date) => ({ date, score: date <= today ? dayScore(data, date, weekKey(date)) : null, xp: xpBetween(data.xpLog, date, date) }));
  const scored = days.filter((d) => d.score != null);
  const misses = data.habitMisses.filter((m) => m.date >= r.from && m.date <= r.to);
  const best = scored.length ? scored.reduce((a, b) => ((b.score ?? 0) > (a.score ?? 0) ? b : a)) : undefined;
  return { range: r, xp: xpBetween(data.xpLog, r.from, r.to), avgScore: Math.round(avg(scored.map((d) => d.score ?? 0))), scoredDays: scored.length, days, habitMissPenalty: misses.reduce((a, m) => a + m.penalty, 0), misses, bestDay: best?.date, closedDays: dates.filter((d) => data.entries[d]?.closed).length };
}
/** متوسطات عمرية: كل الأسابيع التي فيها بيانات */
export function lifetimeAverages(data: AppData): { avgWeeklyXp: number; avgScore: number; weeks: number; totalDays: number } {
  const dates = Object.keys(data.entries).sort(); if (!dates.length) return { avgWeeklyXp: 0, avgScore: 0, weeks: 0, totalDays: 0 };
  const weeks = new Set(dates.map(weekKey)); const scores = dates.map((d) => dayScore(data, d, weekKey(d))).filter((s): s is number => s != null);
  const xp = data.xpLog.reduce((a, e) => a + e.amount, 0);
  return { avgWeeklyXp: Math.round(xp / Math.max(1, weeks.size)), avgScore: Math.round(avg(scores)), weeks: weeks.size, totalDays: dates.length };
}
/** حساب الأيام التي فاتت فيها عادات مطلوبة (لحساب penalties) لأيام مغلقة/ماضية */
export function computeHabitMisses(data: AppData, from: string, to: string, penalty: number): HabitMiss[] {
  const out: HabitMiss[] = []; const today = todayISO();
  for (let d = from; d <= to && d < today; d = addDays(d, 1)) { if (!data.entries[d]) continue; for (const h of activeHabits(data)) if (habitDueState(h, d) === "required" && !habitDone(data, h, d)) out.push({ id: `miss_${d}_${h.id}`, date: d, habitId: h.id, penalty }); }
  return out;
}
export function trendSeries(data: AppData, weeks: number, endIso: string): { label: string; score: number; xp: number }[] {
  const out: { label: string; score: number; xp: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) { const r = weekRange(addDays(weekStart(endIso), -7 * i)); const rep = periodReport(data, r); out.push({ label: r.from.slice(5), score: rep.avgScore, xp: rep.xp }); }
  return out;
}
