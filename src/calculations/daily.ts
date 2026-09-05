import { AppData, DayEntry, Habit, Task } from "@/types/app-data";
import { addDays, weekday } from "@/core/date";
import { metricDaily } from "./metrics";
import { dueReviewPages } from "./quran";

export function emptyEntry(date: string): DayEntry {
  return { date, habits: {}, tasks: [], gym: false, runKm: 0, caloriesBurned: null, caloriesEaten: 0, protein: 0, carbs: 0, fat: 0, meals: [], quranMemPages: 0, quranReadPages: 0, shariaLessons: 0, dhikr: {}, sins: [], ideaWork: [], note: "", closed: false, shutdownStep: 0, xpAwarded: {} };
}
export const getEntry = (data: AppData, date: string): DayEntry => data.entries[date] ?? emptyEntry(date);

/** العادة مستحقة؟ يوم مجدول = required، يوم اختياري = optional، غير ذلك = off */
export type DueState = "required" | "optional" | "off";
export function habitDueState(h: Habit, date: string): DueState {
  if (!h.enabled) return "off";
  const wd = weekday(date);
  if (h.days.includes(wd)) return "required";
  if (h.optionalDays.includes(wd)) return "optional";
  return "off";
}
/** العادة مكتملة؟ يدويًا أو عبر metric مرتبط */
export function habitDone(data: AppData, h: Habit, date: string): boolean {
  const e = data.entries[date]; if (e?.habits?.[h.id]) return true;
  if (h.metric && e) return metricDaily(h.metric, data, date) > 0;
  return false;
}
/**
 * streak: نعدّ للخلف من date. يوم off أو optional غير منجز لا يكسر الـstreak (يُتخطّى).
 * يوم required غير منجز يكسر. optional منجز يزيد العداد.
 */
export function habitStreak(data: AppData, h: Habit, date: string, maxDays = 400): number {
  let streak = 0; let d = date;
  for (let i = 0; i < maxDays; i++) {
    const state = habitDueState(h, d); const done = habitDone(data, h, d);
    if (state === "required") { if (done) streak++; else if (d === date) { /* اليوم الحالي لم ينته بعد */ } else break; }
    else if (state === "optional" && done) streak++;
    d = addDays(d, -1);
    if (!data.entries[d] && i > 0 && state !== "off") { /* لا بيانات: استمر فقط إذا كان اليوم off */ const ns = habitDueState(h, d); if (ns === "required") { if (!data.entries[d]) break; } }
  }
  return streak;
}
export function activeHabits(data: AppData): Habit[] { return data.habits.filter((h) => h.enabled); }

/** المهام المرحّلة: غير منجزة من الأيام السابقة (حتى 7 أيام) ولم تُرحّل بعد */
export function carriedTasks(data: AppData, date: string): Task[] {
  const out: Task[] = []; const existing = new Set((data.entries[date]?.tasks ?? []).map((t) => t.carriedFrom ?? t.id));
  for (let i = 1; i <= 7; i++) { const d = addDays(date, -i); const e = data.entries[d]; if (!e) continue; for (const t of e.tasks) if (!t.done && t.source !== "carried" && !existing.has(t.id) && !existing.has(t.carriedFrom ?? "")) out.push({ ...t, id: `${t.id}_c${date}`, source: "carried", carriedFrom: t.id, done: false, createdAt: `${date}T00:00:00.000Z` }); }
  return out;
}
/** مهام الأسبوع المخططة لهذا اليوم (تظهر تلقائيًا) */
export function plannedTasks(data: AppData, date: string, weekKey: string): Task[] {
  const planned = data.weeklyPlans[weekKey]?.[date] ?? []; const existing = new Set((data.entries[date]?.tasks ?? []).map((t) => t.planId));
  return planned.filter((p) => !existing.has(p.id)).map((p) => ({ id: `plan_${p.id}`, title: p.title, area: p.area, difficulty: p.difficulty, xp: 0, metrics: p.metrics, done: false, source: "weekly", planId: p.id, createdAt: `${date}T00:00:00.000Z` }));
}
/** مهام التعافي لليوم */
export function recoveryDayTasks(data: AppData, date: string): Task[] {
  const existing = new Set((data.entries[date]?.tasks ?? []).map((t) => t.recoveryTaskId));
  return data.recoveryTasks.filter((r) => r.date === date && !existing.has(r.id)).map((r) => ({ id: `rec_${r.id}`, title: r.title, area: "mental" as const, difficulty: 2 as const, xp: r.xp, metrics: [], done: r.done, source: "recovery" as const, recoveryTaskId: r.id, createdAt: `${date}T00:00:00.000Z` }));
}
/** مهمة مراجعة القرآن تتولد تلقائيًا عند وجود صفحات مستحقة */
export function quranReviewTask(data: AppData, date: string): Task | null {
  const due = dueReviewPages(data.quranMemorization, date); if (!due.length) return null;
  const existing = (data.entries[date]?.tasks ?? []).find((t) => t.source === "quran"); if (existing) return null;
  return { id: `quran_review_${date}`, title: `مراجعة القرآن: ${due.length} صفحة مستحقة`, area: "deen", difficulty: 2, xp: 10, metrics: ["quranReadPages"], done: false, source: "quran", createdAt: `${date}T00:00:00.000Z` };
}
/** كل مهام اليوم = المخزنة + المشتقة (لا تُكتب حتى يتفاعل المستخدم) */
export function allDayTasks(data: AppData, date: string, weekKey: string): Task[] {
  const stored = data.entries[date]?.tasks ?? [];
  const q = quranReviewTask(data, date);
  return [...stored, ...plannedTasks(data, date, weekKey), ...recoveryDayTasks(data, date), ...carriedTasks(data, date), ...(q ? [q] : [])];
}

export interface DayProgress { percent: number; requiredTotal: number; requiredDone: number; optionalDone: number; questsTotal: number; questsDone: number; recoveryTotal: number; recoveryDone: number; missing: { kind: "habit" | "task" | "recovery"; id: string; title: string }[] }
/** الإنجاز اليومي = required habits + optional done + custom quests + recovery tasks */
export function computeDayProgress(data: AppData, date: string, weekKey: string): DayProgress {
  const habits = activeHabits(data);
  let requiredTotal = 0, requiredDone = 0, optionalDone = 0; const missing: DayProgress["missing"] = [];
  for (const h of habits) { const st = habitDueState(h, date); const done = habitDone(data, h, date); if (st === "required") { requiredTotal++; if (done) requiredDone++; else missing.push({ kind: "habit", id: h.id, title: h.name }); } else if (st === "optional" && done) optionalDone++; }
  const tasks = allDayTasks(data, date, weekKey);
  const quests = tasks.filter((t) => t.source !== "recovery"); const rec = tasks.filter((t) => t.source === "recovery");
  for (const t of quests) if (!t.done) missing.push({ kind: "task", id: t.id, title: t.title });
  for (const t of rec) if (!t.done) missing.push({ kind: "recovery", id: t.id, title: t.title });
  const total = requiredTotal + quests.length + rec.length;
  const done = requiredDone + quests.filter((t) => t.done).length + rec.filter((t) => t.done).length;
  const base = total ? done / total : 0;
  // العادات الاختيارية المنجزة تُضيف بونص حتى 10%
  const percent = Math.min(100, Math.round(base * 100 + Math.min(10, optionalDone * 3)));
  return { percent, requiredTotal, requiredDone, optionalDone, questsTotal: quests.length, questsDone: quests.filter((t) => t.done).length, recoveryTotal: rec.length, recoveryDone: rec.filter((t) => t.done).length, missing };
}
export function dayScore(data: AppData, date: string, weekKey: string): number | null {
  const e = data.entries[date]; if (!e) return null; if (typeof e.score === "number") return e.score; return computeDayProgress(data, date, weekKey).percent;
}
