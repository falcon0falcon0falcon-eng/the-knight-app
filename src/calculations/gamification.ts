import { AREAS, AreaId, XpEvent } from "@/types/app-data";

/**
 * LEGACY_CONSTANT — منحنى XP.
 * xpToNext(level): XP المطلوبة للانتقال من level إلى level+1.
 * إذا كانت قيم النسخة القديمة مختلفة، عدّل هنا فقط؛ كل ما عداه مشتق.
 */
export function xpToNext(level: number): number { return Math.round(100 * Math.pow(1.15, Math.max(0, level - 1))); }
/** مجموع XP المطلوب للوصول إلى level (level 1 = 0) */
export function xpForLevel(level: number): number { let t = 0; for (let l = 1; l < level; l++) t += xpToNext(l); return t; }
export function levelFromXp(totalXp: number): { level: number; current: number; needed: number; progress: number } {
  let level = 1; let remaining = Math.max(0, totalXp);
  while (remaining >= xpToNext(level) && level < 200) { remaining -= xpToNext(level); level++; }
  const needed = xpToNext(level);
  return { level, current: remaining, needed, progress: needed ? remaining / needed : 1 };
}
export type Rank = "E" | "D" | "C" | "B" | "A" | "S";
export function rankForLevel(level: number): Rank { if (level >= 50) return "S"; if (level >= 40) return "A"; if (level >= 30) return "B"; if (level >= 20) return "C"; if (level >= 10) return "D"; return "E"; }
export const RANK_LABEL: Record<Rank, string> = { E: "مبتدئ", D: "متدرّب", C: "مقاتل", B: "فارس", A: "قائد", S: "أسطورة" };
export const RANK_COLOR: Record<Rank, string> = { E: "#94a3b8", D: "#22c55e", C: "#3b82f6", B: "#8b5cf6", A: "#f59e0b", S: "#fbbf24" };

export function totalXp(log: XpEvent[]): number { return log.reduce((a, e) => a + e.amount, 0); }
export function xpBetween(log: XpEvent[], from: string, to: string): number { return log.filter((e) => e.date >= from && e.date <= to).reduce((a, e) => a + e.amount, 0); }
export function xpByArea(log: XpEvent[], from?: string, to?: string): Record<AreaId, number> {
  const out = Object.fromEntries(AREAS.map((a) => [a.id, 0])) as Record<AreaId, number>;
  for (const e of log) { if (from && e.date < from) continue; if (to && e.date > to) continue; if (e.area && e.amount > 0) out[e.area] += e.amount; }
  return out;
}
/** درجة كل محور 0–100 نسبةً لأعلى محور (مع الوزن الاختياري) */
export function areaScores(log: XpEvent[], weights: Record<AreaId, number>, from?: string, to?: string): Record<AreaId, number> {
  const raw = xpByArea(log, from, to);
  const weighted = Object.fromEntries(AREAS.map((a) => [a.id, raw[a.id] * (weights[a.id] ?? 1)])) as Record<AreaId, number>;
  const max = Math.max(1, ...Object.values(weighted));
  return Object.fromEntries(AREAS.map((a) => [a.id, Math.round((weighted[a.id] / max) * 100)])) as Record<AreaId, number>;
}
export function weightedAreaScore(scores: Record<AreaId, number>, weights: Record<AreaId, number>): number {
  const tw = AREAS.reduce((a, x) => a + (weights[x.id] ?? 1), 0);
  return Math.round(AREAS.reduce((a, x) => a + scores[x.id] * (weights[x.id] ?? 1), 0) / Math.max(1, tw));
}
/** XP للمهمة حسب الصعوبة — LEGACY_CONSTANT */
export function taskXp(difficulty: number): number { return [0, 5, 10, 15, 25, 40][Math.max(1, Math.min(5, difficulty))]; }
/** بونص streak: كل N أيام متتالية → bonusXp — LEGACY_CONSTANT */
export function streakBonusXp(streak: number, everyDays: number, bonusXp: number): number { return everyDays > 0 && streak > 0 && streak % everyDays === 0 ? bonusXp : 0; }
export const LEVEL_MILESTONES = [5, 10, 20, 30, 40, 50, 75, 100];
export function celebrationsFor(prevLevel: number, newLevel: number): { level: number; rankUp: boolean }[] {
  const out: { level: number; rankUp: boolean }[] = [];
  for (let l = prevLevel + 1; l <= newLevel; l++) out.push({ level: l, rankUp: rankForLevel(l) !== rankForLevel(l - 1) });
  return out;
}
