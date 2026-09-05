import { TrainingLog, TrainingSession } from "@/types/app-data";
import { addDays, monthKey, todayISO, weekStart, weekday } from "@/core/date";

/** XP جلسة التدريب — LEGACY_CONSTANT: 1 XP لكل 10 دقائق (حد أدنى 3، أقصى 30) */
export function trainingSessionXp(minutes: number): number { return Math.max(3, Math.min(30, Math.round(minutes / 10))); }

export interface TrainingStats {
  weekMinutes: number; weekSessions: number; monthMinutes: number; monthSessions: number; lifetimeMinutes: number; lifetimeSessions: number;
  last8Weeks: { label: string; minutes: number }[]; weekdayDist: { day: number; minutes: number }[]; bestDay: { date: string; minutes: number } | null; bestWeek: { week: string; minutes: number } | null; bestStreak: number; currentStreak: number;
  areaBreakdown: { areaId: string; name: string; color: string; minutes: number; sessions: number; percent: number }[];
}
export function trainingStats(log: TrainingLog, today = todayISO()): TrainingStats {
  const s = log.sessions; const ws = weekStart(today); const mk = monthKey(today);
  const week = s.filter((x) => x.date >= ws && x.date <= addDays(ws, 6)); const month = s.filter((x) => monthKey(x.date) === mk);
  const total = (xs: TrainingSession[]) => xs.reduce((a, x) => a + x.minutes, 0);
  const last8Weeks = Array.from({ length: 8 }, (_, i) => { const w = addDays(ws, -7 * (7 - i)); return { label: w.slice(5), minutes: total(s.filter((x) => x.date >= w && x.date <= addDays(w, 6))) }; });
  const weekdayDist = Array.from({ length: 7 }, (_, day) => ({ day, minutes: total(s.filter((x) => weekday(x.date) === day)) }));
  const byDay: Record<string, number> = {}; for (const x of s) byDay[x.date] = (byDay[x.date] ?? 0) + x.minutes;
  const bestDayEntry = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0]; const byWeek: Record<string, number> = {}; for (const [d, m] of Object.entries(byDay)) { const w = weekStart(d); byWeek[w] = (byWeek[w] ?? 0) + m; }
  const bestWeekEntry = Object.entries(byWeek).sort((a, b) => b[1] - a[1])[0];
  const days = Object.keys(byDay).sort(); let best = 0, cur = 0, prev = ""; for (const d of days) { cur = prev && addDays(prev, 1) === d ? cur + 1 : 1; best = Math.max(best, cur); prev = d; }
  let currentStreak = 0; for (let d = today; byDay[d]; d = addDays(d, -1)) currentStreak++; if (!byDay[today] && byDay[addDays(today, -1)]) { for (let d = addDays(today, -1); byDay[d]; d = addDays(d, -1)) currentStreak++; }
  const lifetime = total(s);
  const areaBreakdown = log.areas.map((a) => { const xs = s.filter((x) => x.areaId === a.id); const m = total(xs); return { areaId: a.id, name: a.name, color: a.color, minutes: m, sessions: xs.length, percent: lifetime ? Math.round((m / lifetime) * 100) : 0 }; }).sort((a, b) => b.minutes - a.minutes);
  return { weekMinutes: total(week), weekSessions: week.length, monthMinutes: total(month), monthSessions: month.length, lifetimeMinutes: lifetime, lifetimeSessions: s.length, last8Weeks, weekdayDist, bestDay: bestDayEntry ? { date: bestDayEntry[0], minutes: bestDayEntry[1] } : null, bestWeek: bestWeekEntry ? { week: bestWeekEntry[0], minutes: bestWeekEntry[1] } : null, bestStreak: best, currentStreak, areaBreakdown };
}
