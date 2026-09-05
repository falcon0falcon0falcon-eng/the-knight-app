import { AppData, AppDataKey, defaultAppData, FIXED_HABITS, Habit, LEGACY_KEYS, XpEvent } from "@/types/app-data";

export const CURRENT_SCHEMA_VERSION = 7;

export interface Envelope { schemaVersion: number; exportedAt?: string; data: Partial<AppData> & Record<string, unknown> }
type Migration = { from: number; to: number; run: (d: Record<string, unknown>) => Record<string, unknown> };

const parseMaybeJson = (v: unknown) => { if (typeof v === "string") { const t = v.trim(); if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) { try { return JSON.parse(t); } catch { return v; } } } return v; };
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export const migrations: Migration[] = [
  { from: 0, to: 1, run: (d) => { const out: Record<string, unknown> = {}; for (const [k, v] of Object.entries(d)) out[k] = parseMaybeJson(v); return out; } },
  { from: 1, to: 2, run: (d) => {
      if (Array.isArray(d.habits) && (d.habits as Habit[]).length) return d;
      const settings = obj(d.streakSettings); const fixed = obj(settings.fixedHabits);
      const edits = obj(d.streakHabitEdits) as Record<string, Partial<Habit>>;
      const custom = arr<Habit>(d.customStreakHabits).map((h) => ({ ...h, custom: true, days: h.days ?? [0, 1, 2, 3, 4, 5, 6], optionalDays: h.optionalDays ?? [], enabled: h.enabled ?? true, xp: h.xp ?? 8, area: h.area ?? "mental" }));
      const base: Habit[] = FIXED_HABITS.map((h) => { const f = fixed[h.id] as { enabled?: boolean; days?: number[] } | undefined; return { ...h, ...(f ? { enabled: f.enabled ?? h.enabled, days: f.days ?? h.days } : {}), ...(edits[h.id] ?? {}) }; });
      const all = [...base, ...custom.map((h) => ({ ...h, ...(edits[h.id] ?? {}) }))];
      const order = arr<string>(d.streakHabitOrder);
      if (order.length) all.sort((a, b) => { const ia = order.indexOf(a.id), ib = order.indexOf(b.id); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib); });
      return { ...d, habits: all };
    } },
  { from: 2, to: 3, run: (d) => {
      const weights = arr<{ date: string; weight: number }>(d.weights); if (!weights.length) return d;
      const entries = arr<{ id: string; date: string; weight?: number }>(d.bodyEntries).slice();
      for (const w of weights) { const ex = entries.find((e) => e.date === w.date); if (ex) { if (ex.weight == null) ex.weight = w.weight; } else entries.push({ id: `w_${w.date}`, date: w.date, weight: w.weight }); }
      entries.sort((a, b) => a.date.localeCompare(b.date)); return { ...d, bodyEntries: entries };
    } },
  { from: 3, to: 4, run: (d) => {
      const ann = arr<{ id: string; type?: string }>(d.bookAnnotations).slice(); const ids = new Set(ann.map((a) => a.id));
      for (const h of arr<{ id: string; type?: string }>(d.bookHighlights)) if (!ids.has(h.id)) { ann.push({ ...h, type: h.type ?? "highlight" }); ids.add(h.id); }
      for (const dr of arr<{ id: string; type?: string }>(d.bookDrawings)) if (!ids.has(dr.id)) { ann.push({ ...dr, type: "drawing" }); ids.add(dr.id); }
      return { ...d, bookAnnotations: ann };
    } },
  { from: 4, to: 5, run: (d) => {
      const byMode = obj(d.aiChatsByMode) as Record<string, unknown[]>; const memByMode = obj(d.aiMemoriesByMode) as Record<string, unknown[]>;
      const legacyChat = arr(d.aiChatHistory); const legacyMem = arr(d.aiMemory);
      const nextChats = { ...byMode }; if (legacyChat.length && !arr(nextChats.game).length) nextChats.game = legacyChat;
      const nextMem = { ...memByMode }; if (legacyMem.length && !arr(nextMem.global).length) nextMem.global = legacyMem;
      return { ...d, aiChatsByMode: nextChats, aiMemoriesByMode: nextMem };
    } },
  { from: 5, to: 6, run: (d) => {
      const entries = obj(d.entries) as Record<string, Record<string, unknown>>; const next: Record<string, unknown> = {};
      for (const [date, e] of Object.entries(entries)) { const tasks = arr<Record<string, unknown>>(e.tasks).map((t) => ({ source: "custom", metrics: [], difficulty: 2, done: false, ...t })); next[date] = { date, xpAwarded: {}, shutdownStep: 0, habits: {}, meals: [], dhikr: {}, sins: [], ideaWork: [], ...e, tasks }; }
      return { ...d, entries: next };
    } },
  { from: 6, to: 7, run: (d) => {
      const log = arr<XpEvent>(d.xpLog); const entries = obj(d.entries) as Record<string, Record<string, unknown>>;
      if (log.length || !Object.keys(entries).length) return d;
      const rebuilt: XpEvent[] = [];
      for (const [date, e] of Object.entries(entries)) { const awarded = obj(e.xpAwarded) as Record<string, number>; for (const [ref, amount] of Object.entries(awarded)) rebuilt.push({ id: `rb_${date}_${ref}`, at: `${date}T12:00:00.000Z`, date, amount, source: "rebuilt", label: ref, ref: `${date}:${ref}` }); }
      return { ...d, xpLog: rebuilt };
    } },
];

/** يقبل نسخة قديمة مسطحة أو envelope جديد ويعيد AppData كاملة بآخر schema */
export function migrateToLatest(input: unknown): { data: AppData; report: { fromVersion: number; unknownKeys: string[]; counts: Record<string, number> } } {
  let raw = parseMaybeJson(input) as Record<string, unknown>;
  let version = 0;
  if (raw && typeof raw === "object" && "schemaVersion" in raw && "data" in raw) { const env = raw as unknown as Envelope; version = Number(env.schemaVersion) || 0; raw = obj(env.data); }
  else if (raw && typeof raw === "object" && typeof raw.__schemaVersion === "number") { version = raw.__schemaVersion as number; }
  const fromVersion = version;
  let d = { ...obj(raw) };
  for (const m of migrations) if (m.from >= version && m.to <= CURRENT_SCHEMA_VERSION && m.from === version) { d = m.run(d); version = m.to; }
  const base = defaultAppData();
  const known = new Set<string>(Object.keys(base));
  const unknownKeys: string[] = []; const counts: Record<string, number> = {};
  const out = { ...base } as AppData & Record<string, unknown>;
  for (const [k, v] of Object.entries(d)) {
    if (k === "legacy") { out.legacy = { ...(out.legacy ?? {}), ...obj(v) }; continue; }
    if (!known.has(k)) { unknownKeys.push(k); out.legacy[k] = v; continue; }
    if (v === undefined || v === null) continue;
    const dv = base[k as AppDataKey];
    if (Array.isArray(dv)) { (out as Record<string, unknown>)[k] = Array.isArray(v) ? v : dv; counts[k] = Array.isArray(v) ? v.length : 0; }
    else if (dv && typeof dv === "object") { (out as Record<string, unknown>)[k] = { ...(dv as object), ...obj(v) }; counts[k] = Object.keys(obj(v)).length; }
    else { (out as Record<string, unknown>)[k] = v; counts[k] = 1; }
  }
  // احتفظ بالمفاتيح القديمة المدمجة كما هي (لا حذف)
  for (const k of ["weights", "bookHighlights", "bookDrawings", "aiChatHistory", "aiMemory"] as const) if (d[k] !== undefined) (out as Record<string, unknown>)[k] = d[k];
  return { data: out, report: { fromVersion, unknownKeys, counts } };
}

/** يكتشف بيانات legacy في localStorage الحالي */
export function detectLegacyLocalStorage(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  const found: Record<string, unknown> = {};
  for (const k of LEGACY_KEYS) { const v = window.localStorage.getItem(k) ?? window.localStorage.getItem(`mevsme:${k}`); if (v != null) found[k] = parseMaybeJson(v); }
  return Object.keys(found).length ? found : null;
}

/** دمج غير مدمّر: يحتفظ بالمعرّفات الموجودة ويضيف الجديدة */
export function mergeAppData(local: AppData, incoming: AppData): AppData {
  const out: Record<string, unknown> = { ...local };
  for (const k of Object.keys(incoming) as AppDataKey[]) {
    const a = local[k] as unknown, b = incoming[k] as unknown;
    if (Array.isArray(a) && Array.isArray(b)) {
      const idOf = (x: unknown) => { const o = x as Record<string, unknown>; return String(o?.id ?? o?.date ?? JSON.stringify(x)); };
      const map = new Map<string, unknown>(); for (const x of a) map.set(idOf(x), x); for (const x of b) if (!map.has(idOf(x))) map.set(idOf(x), x);
      out[k] = Array.from(map.values());
    } else if (a && b && typeof a === "object" && typeof b === "object") { out[k] = { ...(b as object), ...(a as object) }; if (k === "entries") out[k] = { ...(b as object), ...(a as object) }; }
    else if (a === null || a === "" || a === undefined) out[k] = b;
  }
  return out as unknown as AppData;
}
