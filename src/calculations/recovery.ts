import { AppData, CravingEvent, RecoveryEntry, RelapseEvent } from "@/types/app-data";
import { addDays, avg, clamp, diffDays, rangeDates, todayISO } from "@/core/date";
import { activeHabits, habitStreak } from "./daily";

// ⚠️ كل ما في هذا الملف heuristic داعم للوعي الذاتي — ليس تشخيصًا ولا احتمالًا طبيًا.
export const RECOVERY_DISCLAIMER = "هذه المؤشرات إرشادية داعمة فقط، وليست تشخيصًا طبيًا أو نفسيًا.";

export const SOBRIETY_MILESTONES = [1, 3, 7, 14, 21, 30, 45, 60, 90, 120, 180, 270, 365, 730];
export interface SobrietyStats { startAt: string | null; currentDays: number; currentMs: number; longestDays: number; nextMilestone: number | null; lastRelapseAt: string | null; milestonesReached: number[] }
export function sobrietyStats(data: AppData, now = new Date()): SobrietyStats {
  const relapses = [...data.relapseLog].sort((a, b) => a.at.localeCompare(b.at));
  const last = relapses[relapses.length - 1]; const startAt = last ? last.at : data.sobrietyStartAt;
  const currentMs = startAt ? Math.max(0, now.getTime() - new Date(startAt).getTime()) : 0; const currentDays = Math.floor(currentMs / 86400000);
  let longest = currentDays; let prev = data.sobrietyStartAt ? new Date(data.sobrietyStartAt).getTime() : null;
  for (const r of relapses) { const t = new Date(r.at).getTime(); if (prev != null) longest = Math.max(longest, Math.floor((t - prev) / 86400000)); prev = t; }
  const reached = SOBRIETY_MILESTONES.filter((m) => currentDays >= m);
  return { startAt, currentDays, currentMs, longestDays: longest, nextMilestone: SOBRIETY_MILESTONES.find((m) => m > currentDays) ?? null, lastRelapseAt: last?.at ?? null, milestonesReached: reached };
}
export type PhaseId = "start" | "early" | "rebuild" | "maintain";
export const PHASES: { id: PhaseId; label: string; range: string; minDays: number; focus: string; guidance: string[]; warning: string }[] = [
  { id: "start", label: "البداية", range: "0–7 أيام", minDays: 0, focus: "النجاة يومًا بيوم", guidance: ["الهدف الوحيد: لا تنتكس اليوم. لا تفكر في الأسبوع.", "امسح كل المحفزات من متناول اليد (تطبيقات، حسابات، أماكن).", "نم مبكرًا؛ السهر هو أخطر نافذة.", "استخدم زر SOS عند أول شرارة، لا تنتظر.", "الأعراض الانسحابية (توتر، قلق، أرق) طبيعية ومؤقتة."], warning: "أعلى نسبة انتكاس تحدث في هذه الأيام. الأمر ليس ضعف إرادة بل كيمياء دماغ تتغير." },
  { id: "early", label: "التعافي المبكر", range: "8–30 يوم", minDays: 8, focus: "بناء الروتين والوعي بالمحفزات", guidance: ["سجّل قراءة يومية للمزاج والرغبة — الأنماط تظهر بعد أسبوعين.", "ابدأ بطقس صباحي ومسائي ثابت.", "احذر «الثقة الزائدة»: أغلب انتكاسات هذه المرحلة تبدأ بـ«أنا أقوى الآن».", "املأ أوقات الفراغ المعروفة مسبقًا بمهام تعافٍ.", "الرغبة موجة: تصعد 15–20 دقيقة ثم تهبط. اركبها ولا تحاربها."], warning: "مرحلة «الجدار»: قد يعود الشعور بالفراغ والملل بقوة. هذا مؤقت." },
  { id: "rebuild", label: "إعادة البناء", range: "31–90 يوم", minDays: 31, focus: "استرداد ما فقدته وبناء الهوية", guidance: ["ابدأ العمل على قائمة «ما فقدته» جزءًا جزءًا.", "اربط تعافيك بمبادئ هويتك — من أنت بدون هذه العادة؟", "زد التحدي: تدريب، مشروع، علاقة صحية.", "راجع محفزاتك المتكررة وغيّر البيئة لا النية فقط.", "توقّع «الشوق الحنيني»: الذاكرة تجمّل الماضي. لا تصدقها."], warning: "الانتكاس هنا غالبًا بسبب إهمال الروتين لا بسبب رغبة قوية." },
  { id: "maintain", label: "الاستدامة", range: "90+ يوم", minDays: 91, focus: "حماية المكتسبات والنمو", guidance: ["استمر بالقراءات الدورية حتى لو شعرت أنك بخير.", "ساعد غيرك — التدريس أقوى وسيلة للتثبيت.", "احذر الفترات الانتقالية (سفر، إجازة، ضغط عمل).", "حدّث خطة الإنقاذ ورسالتك لنفسك كل شهر.", "احتفل بالمعالم بدون مكافآت تعيدك للنمط القديم."], warning: "الخطر هنا: «مرة واحدة لن تضر». الذاكرة الجسدية تعود أسرع مما تظن." },
];
export function recoveryPhase(days: number) { return [...PHASES].reverse().find((p) => days >= p.minDays) ?? PHASES[0]; }

export function entriesInRange<T extends { date: string }>(xs: T[], from: string, to: string): T[] { return xs.filter((x) => x.date >= from && x.date <= to); }
export function relapseGaps(log: RelapseEvent[]): number[] { const s = [...log].sort((a, b) => a.at.localeCompare(b.at)); const out: number[] = []; for (let i = 1; i < s.length; i++) out.push((new Date(s[i].at).getTime() - new Date(s[i - 1].at).getTime()) / 3600000); return out; }
/** مؤشر الإدمان 0–100 (heuristic): تكرار الانتكاس آخر 30 يوم + متوسط الرغبة + تعدد الأحداث في اليوم */
export function addictionIndex(data: AppData, today = todayISO()): number {
  const from = addDays(today, -29); const rel = entriesInRange(data.relapseLog, from, today); const cr = entriesInRange(data.cravingEvents, from, today); const re = entriesInRange(data.recoveryEntries, from, today);
  const freq = clamp(rel.length * 8, 0, 50); const multi = clamp((rel.length - new Set(rel.map((r) => r.date)).size) * 6, 0, 15);
  const urge = clamp(avg([...re.map((x) => x.urge), ...cr.map((x) => x.urge)]) * 2.5, 0, 25); const resistedRatio = cr.length ? cr.filter((c) => c.outcome === "resisted").length / cr.length : 1;
  return Math.round(clamp(freq + multi + urge + (1 - resistedRatio) * 10, 0, 100));
}
export interface RiskResult { score: number; label: string; level: "low" | "moderate" | "high" | "critical"; factors: { label: string; weight: number }[]; protections: { label: string; weight: number }[]; plan: string[] }
/** محرك الخطر 0–100 — heuristic */
export function computeRisk(data: AppData, today = todayISO()): RiskResult {
  const factors: RiskResult["factors"] = []; const protections: RiskResult["protections"] = [];
  const last7 = addDays(today, -6); const last3 = addDays(today, -2);
  const rel7 = entriesInRange(data.relapseLog, last7, today); if (rel7.length) factors.push({ label: `انتكاس خلال 7 أيام (${rel7.length})`, weight: Math.min(35, 15 + rel7.length * 10) });
  const cr3 = entriesInRange(data.cravingEvents, last3, today); if (cr3.length) factors.push({ label: `رغبات خلال 3 أيام (${cr3.length})`, weight: Math.min(20, cr3.length * 7) });
  const re3 = entriesInRange(data.recoveryEntries, last3, today); const urge = avg(re3.map((r) => r.urge)); if (urge >= 6) factors.push({ label: `متوسط رغبة مرتفع (${urge.toFixed(1)})`, weight: 15 });
  const mood = avg(re3.map((r) => r.mood)); if (re3.length && mood <= 4) factors.push({ label: `مزاج منخفض (${mood.toFixed(1)})`, weight: 12 });
  const spiritual = avg(re3.map((r) => r.spiritual)); if (re3.length && spiritual <= 4) factors.push({ label: "حالة روحية منخفضة", weight: 8 });
  if (!re3.length) factors.push({ label: "لا قراءات خلال 3 أيام", weight: 10 });
  const triggerCounts: Record<string, number> = {}; for (const c of entriesInRange(data.cravingEvents, addDays(today, -13), today)) for (const t of c.triggers) triggerCounts[t] = (triggerCounts[t] ?? 0) + 1;
  const repeated = Object.entries(triggerCounts).filter(([, n]) => n >= 3); if (repeated.length) factors.push({ label: `محفز متكرر: ${repeated.map(([t]) => t).join("، ")}`, weight: 8 });
  const stats = sobrietyStats(data); if (stats.currentDays < 7 && stats.startAt) factors.push({ label: "الأسبوع الأول (حساس)", weight: 10 });
  const hour = new Date().getHours(); if (hour >= 23 || hour < 4) factors.push({ label: "وقت السهر", weight: 6 });
  // protections
  const streaks = activeHabits(data).map((h) => habitStreak(data, h, today)); const bestStreak = Math.max(0, ...streaks); if (bestStreak >= 3) protections.push({ label: `عادات مستمرة (${bestStreak} يوم)`, weight: Math.min(15, bestStreak) });
  const resisted7 = entriesInRange(data.cravingEvents, last7, today).filter((c) => c.outcome === "resisted").length; if (resisted7) protections.push({ label: `رغبات مقاومة (${resisted7})`, weight: Math.min(15, resisted7 * 5) });
  if (re3.length) protections.push({ label: "قراءات منتظمة", weight: 8 });
  const ritualsDone = re3.reduce((a, r) => a + r.ritualsDone.length, 0); if (ritualsDone) protections.push({ label: `طقوس منفذة (${ritualsDone})`, weight: Math.min(10, ritualsDone * 3) });
  const tasksDone = data.recoveryTasks.filter((t) => t.done && t.date >= last7).length; if (tasksDone) protections.push({ label: `مهام تعافٍ (${tasksDone})`, weight: Math.min(10, tasksDone * 3) });
  if (stats.currentDays >= 30) protections.push({ label: `${stats.currentDays} يوم نظيف`, weight: Math.min(20, Math.floor(stats.currentDays / 10)) });
  if (data.recoveryLetter.text) protections.push({ label: "رسالة شخصية جاهزة", weight: 3 });
  const score = Math.round(clamp(20 + factors.reduce((a, f) => a + f.weight, 0) - protections.reduce((a, p) => a + p.weight, 0), 0, 100));
  const level = score >= 75 ? "critical" : score >= 50 ? "high" : score >= 30 ? "moderate" : "low";
  const label = { low: "منخفض", moderate: "متوسط", high: "مرتفع", critical: "حرج" }[level];
  const plan = level === "low" ? ["حافظ على الروتين", "سجّل قراءة مسائية", "خطط ليوم الغد الآن"] : level === "moderate" ? ["نفّذ طقس الصباح/المساء كاملًا", "حدد أوقات الفراغ اليوم واملأها", "تجنب المحفز المتكرر عمدًا", "نم قبل 11"] : level === "high" ? ["فعّل بروتوكول الإنقاذ مبكرًا", "أخبر شخص الدعم أن اليوم صعب", "لا تبقَ وحدك مع الجوال", "اقرأ رسالتك لنفسك الآن", "أضف مهمتي تعافٍ صغيرتين"] : ["افتح SOS الآن", "غيّر مكانك فورًا", "اتصل بشخص الدعم", "تنفّس 4-7-8 ثلاث دورات", "اقرأ أسبابك ورسالتك", "ابقَ في مكان عام حتى تمر الموجة"];
  return { score, label, level, factors, protections, plan };
}
/** مؤشر التعافي 0–100 = أيام نظيفة(30) + رغبات مقاومة(20) + عكس مؤشر الإدمان(20) + streak عادات(15) + مزاج(15) */
export function recoveryIndex(data: AppData, today = todayISO()): { value: number; parts: { label: string; value: number; max: number }[] } {
  const s = sobrietyStats(data); const clean = clamp((s.currentDays / 90) * 30, 0, 30);
  const from = addDays(today, -29); const cr = entriesInRange(data.cravingEvents, from, today); const resisted = cr.length ? (cr.filter((c) => c.outcome === "resisted").length / cr.length) * 20 : 10;
  const add = (100 - addictionIndex(data, today)) / 5;
  const best = Math.max(0, ...activeHabits(data).map((h) => habitStreak(data, h, today))); const streak = clamp((best / 21) * 15, 0, 15);
  const re = entriesInRange(data.recoveryEntries, addDays(today, -6), today); const mood = re.length ? (avg(re.map((r) => r.mood)) / 10) * 15 : 7;
  const parts = [{ label: "أيام نظيفة", value: Math.round(clean), max: 30 }, { label: "رغبات مقاومة", value: Math.round(resisted), max: 20 }, { label: "انخفاض مؤشر الإدمان", value: Math.round(add), max: 20 }, { label: "استمرارية العادات", value: Math.round(streak), max: 15 }, { label: "المزاج", value: Math.round(mood), max: 15 }];
  return { value: Math.round(clamp(clean + resisted + add + streak + mood, 0, 100)), parts };
}
/** XP الرغبة المقاومة مع عقوبة المحفز المتكرر — LEGACY_CONSTANT */
export function cravingXp(ev: Omit<CravingEvent, "xp" | "id">, history: CravingEvent[]): number {
  if (ev.outcome !== "resisted") return -10;
  let xp = 10 + Math.round(ev.urge); const recent = history.filter((c) => diffDays(c.date, ev.date) <= 7);
  for (const t of ev.triggers) { const n = recent.filter((c) => c.triggers.includes(t)).length; if (n >= 2) xp -= 3; }
  return Math.max(3, xp);
}
/** عقوبة إهمال مهام التعافي خلال أول 30 يوم — LEGACY_CONSTANT */
export function recoveryTaskPenalty(data: AppData, date: string): number {
  const s = sobrietyStats(data); if (!s.startAt || s.currentDays > 30) return 0;
  const missed = data.recoveryTasks.filter((t) => t.date === date && !t.done).length; return missed * -3;
}
export interface RecoveryAnalytics { avgMood: number; avgUrge: number; avgSpiritual: number; checkIns: number; relapses: number; cravings: number; resisted: number; ritualCompletion: number; curve: { date: string; mood: number | null; urge: number | null; index: number }[]; triggers: { name: string; count: number }[]; hardDays: { date: string; urge: number }[]; calendar: Record<string, "clean" | "relapse" | "craving" | "none"> }
export function recoveryAnalytics(data: AppData, today = todayISO(), days = 30): RecoveryAnalytics {
  const from = addDays(today, -(days - 1)); const dates = rangeDates(from, today);
  const re = entriesInRange(data.recoveryEntries, from, today); const cr = entriesInRange(data.cravingEvents, from, today); const rel = entriesInRange(data.relapseLog, from, today);
  const totalRituals = data.recoveryRituals.length * re.length; const doneRituals = re.reduce((a, r) => a + r.ritualsDone.length, 0);
  const tc: Record<string, number> = {}; for (const c of cr) for (const t of c.triggers) tc[t] = (tc[t] ?? 0) + 1;
  const curve = dates.map((date) => { const d = re.filter((r) => r.date === date); const snap = data.recoveryIndices.find((s) => s.date === date); return { date, mood: d.length ? avg(d.map((x) => x.mood)) : null, urge: d.length ? avg(d.map((x) => x.urge)) : null, index: snap?.value ?? 0 }; });
  const calendar: RecoveryAnalytics["calendar"] = {}; for (const date of dates) calendar[date] = rel.some((r) => r.date === date) ? "relapse" : cr.some((c) => c.date === date) ? "craving" : data.sobrietyStartAt && date >= data.sobrietyStartAt.slice(0, 10) ? "clean" : "none";
  const byDay: Record<string, number[]> = {}; for (const r of re) (byDay[r.date] ??= []).push(r.urge); for (const c of cr) (byDay[c.date] ??= []).push(c.urge);
  const hardDays = Object.entries(byDay).map(([date, u]) => ({ date, urge: Math.max(...u) })).filter((x) => x.urge >= 7).sort((a, b) => b.urge - a.urge).slice(0, 5);
  return { avgMood: avg(re.map((r) => r.mood)), avgUrge: avg([...re.map((r) => r.urge), ...cr.map((c) => c.urge)]), avgSpiritual: avg(re.map((r) => r.spiritual)), checkIns: re.length, relapses: rel.length, cravings: cr.length, resisted: cr.filter((c) => c.outcome === "resisted").length, ritualCompletion: totalRituals ? Math.round((doneRituals / totalRituals) * 100) : 0, curve, triggers: Object.entries(tc).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count), hardDays, calendar };
}
export function checkInsForDay(data: AppData, date: string): RecoveryEntry[] { return data.recoveryEntries.filter((r) => r.date === date).sort((a, b) => a.at.localeCompare(b.at)); }
