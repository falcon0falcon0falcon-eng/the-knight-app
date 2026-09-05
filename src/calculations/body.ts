import { BodyEntry, BodyProfile, DayEntry, GoalSettings, LIFTS, LiftId, Photo } from "@/types/app-data";
import { clamp, round } from "@/core/date";

/** Mifflin-St Jeor */
export function bmr(profile: BodyProfile, weightKg: number | undefined): number {
  if (!weightKg) return 0; const age = new Date().getFullYear() - profile.birthYear;
  const base = 10 * weightKg + 6.25 * profile.heightCm - 5 * age; return Math.round(profile.sex === "male" ? base + 5 : base - 161);
}
/** BMR fallback يعمل فقط عند غياب قيمة الحرق المُدخلة */
export function effectiveBurn(entry: DayEntry, profile: BodyProfile, weightKg: number | undefined): { burn: number; fromBmr: boolean } {
  if (entry.caloriesBurned != null && entry.caloriesBurned > 0) return { burn: entry.caloriesBurned, fromBmr: false };
  return { burn: Math.round(bmr(profile, weightKg) * (profile.activity || 1.2)), fromBmr: true };
}
export function netCalories(entry: DayEntry, profile: BodyProfile, weightKg: number | undefined): number { return entry.caloriesEaten - effectiveBurn(entry, profile, weightKg).burn; }
/** التغير المتوقع في الوزن (كجم) — 7700 kcal ≈ 1 kg */
export function expectedWeightChange(netKcal: number): number { return round(netKcal / 7700, 3); }
export function macroCalories(p: number, c: number, f: number) { return { protein: p * 4, carbs: c * 4, fat: f * 9, total: p * 4 + c * 4 + f * 9 }; }

export function latestEntry(entries: BodyEntry[], field?: keyof BodyEntry): BodyEntry | undefined {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  return field ? sorted.find((e) => e[field] != null) : sorted[0];
}
export function latestWeight(entries: BodyEntry[]): number | undefined { return latestEntry(entries, "weight")?.weight; }
export function firstValue(entries: BodyEntry[], field: keyof BodyEntry): number | undefined { const s = [...entries].sort((a, b) => a.date.localeCompare(b.date)).find((e) => e[field] != null); return s ? (s[field] as number) : undefined; }
export function latestValue(entries: BodyEntry[], field: keyof BodyEntry): number | undefined { const e = latestEntry(entries, field); return e ? (e[field] as number) : undefined; }

/** US Navy body fat — heuristic */
export function estimateBodyFat(profile: BodyProfile, waist?: number, neck?: number, hip?: number): number | null {
  if (!waist || !neck || waist <= neck) return null; const h = profile.heightCm; const log10 = Math.log10;
  const v = profile.sex === "male" ? 495 / (1.0324 - 0.19077 * log10(waist - neck) + 0.15456 * log10(h)) - 450 : 495 / (1.29579 - 0.35004 * log10(waist + (hip ?? waist) - neck) + 0.221 * log10(h)) - 450;
  return isFinite(v) ? round(clamp(v, 3, 60), 1) : null;
}
/** عمر بيولوجي تقديري — heuristic توعوي وليس تشخيصًا */
export function estimateBioAge(profile: BodyProfile, vo2max?: number, rhr?: number, bodyFat?: number | null): number | null {
  const age = new Date().getFullYear() - profile.birthYear; if (!vo2max && !rhr && bodyFat == null) return null;
  let delta = 0;
  if (vo2max) { const expected = profile.sex === "male" ? 50 - 0.4 * (age - 20) : 42 - 0.35 * (age - 20); delta += clamp((expected - vo2max) / 3, -8, 10); }
  if (rhr) delta += clamp((rhr - 62) / 5, -4, 6);
  if (bodyFat != null) { const ideal = profile.sex === "male" ? 15 : 23; delta += clamp((bodyFat - ideal) / 3, -4, 6); }
  return Math.round(age + delta);
}
export interface MetricProgress { key: string; label: string; unit: string; first?: number; current?: number; goal?: number; percent: number; direction: "down" | "up" }
export const BODY_METRICS: { key: keyof BodyEntry & string; label: string; unit: string; direction: "down" | "up"; goalKey: keyof GoalSettings }[] = [
  { key: "weight", label: "الوزن", unit: "كجم", direction: "down", goalKey: "weightGoal" },
  { key: "waist", label: "الخصر", unit: "سم", direction: "down", goalKey: "waistGoal" },
  { key: "chest", label: "الصدر", unit: "سم", direction: "up", goalKey: "chestGoal" },
  { key: "arm", label: "الذراع", unit: "سم", direction: "up", goalKey: "armGoal" },
  { key: "thigh", label: "الفخذ", unit: "سم", direction: "up", goalKey: "thighGoal" },
  { key: "neck", label: "الرقبة", unit: "سم", direction: "down", goalKey: "waistGoal" },
  { key: "vo2max", label: "VO₂ Max", unit: "", direction: "up", goalKey: "vo2maxGoal" },
  { key: "rhr", label: "نبض الراحة", unit: "bpm", direction: "down", goalKey: "rhrGoal" },
];
export function bodyProgress(entries: BodyEntry[], goals: GoalSettings): MetricProgress[] {
  return BODY_METRICS.map((m) => {
    const first = firstValue(entries, m.key), current = latestValue(entries, m.key), goal = goals[m.goalKey] as number | undefined;
    let percent = 0;
    if (first != null && current != null && goal != null && first !== goal) percent = clamp(Math.round(((current - first) / (goal - first)) * 100), 0, 100);
    return { key: m.key, label: m.label, unit: m.unit, first, current, goal, percent, direction: m.direction };
  });
}
export function overallBodyProgress(p: MetricProgress[]): number { const withGoal = p.filter((x) => x.goal != null && x.first != null); return withGoal.length ? Math.round(withGoal.reduce((a, x) => a + x.percent, 0) / withGoal.length) : 0; }
export function personalRecords(entries: BodyEntry[]): Record<LiftId, { weight: number; reps: number; date: string } | null> {
  const out = Object.fromEntries(LIFTS.map((l) => [l.id, null])) as Record<LiftId, { weight: number; reps: number; date: string } | null>;
  for (const e of entries) for (const l of LIFTS) { const v = e.lifts?.[l.id]; if (v && (!out[l.id] || v.weight > out[l.id]!.weight)) out[l.id] = { ...v, date: e.date }; }
  return out;
}
export function liftSeries(entries: BodyEntry[], lift: LiftId) { return [...entries].filter((e) => e.lifts?.[lift]).sort((a, b) => a.date.localeCompare(b.date)).map((e) => ({ date: e.date, weight: e.lifts![lift]!.weight, reps: e.lifts![lift]!.reps })); }
export function metricSeries(entries: BodyEntry[], key: keyof BodyEntry) { return [...entries].filter((e) => e[key] != null).sort((a, b) => a.date.localeCompare(b.date)).map((e) => ({ date: e.date, value: e[key] as number })); }
export function nearestBodyEntry(entries: BodyEntry[], date: string): BodyEntry | undefined {
  let best: BodyEntry | undefined; let bd = Infinity;
  for (const e of entries) { const d = Math.abs(new Date(e.date).getTime() - new Date(date).getTime()); if (d < bd) { bd = d; best = e; } }
  return best;
}
export function photoGroups(photos: Photo[]): Record<string, Photo[]> { const g: Record<string, Photo[]> = {}; for (const p of photos) (g[p.group || p.date] ??= []).push(p); return g; }

/** ضغط الصور قبل التخزين */
export async function resizeImage(file: File, maxW = 900, quality = 0.82): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, maxW / img.width); const c = document.createElement("canvas"); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", quality);
  } finally { URL.revokeObjectURL(url); }
}
