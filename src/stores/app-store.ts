"use client";
import { useMemo } from "react";
import { create } from "zustand";
import { AppData, AppDataKey, AreaId, XpEvent, defaultAppData } from "@/types/app-data";
import { CloudRepository, LocalRepository, SyncEngine, SyncStatus } from "@/core/storage";
import { CURRENT_SCHEMA_VERSION, detectLegacyLocalStorage, mergeAppData, migrateToLatest } from "@/migrations";
import { levelFromXp, celebrationsFor, totalXp } from "@/calculations/gamification";
import { nowISO, todayISO, uid } from "@/core/date";

export interface Toast { id: string; text: string; kind: "info" | "xp" | "ok" | "warn" | "error" }
export interface Celebration { level: number; rankUp: boolean }
interface AppState {
  data: AppData;
  updatedAt: Record<string, number>;
  ready: boolean;
  selectedDate: string;
  sync: SyncStatus;
  account: { id: string; code: string };
  toasts: Toast[];
  celebration: Celebration | null;
  legacyFound: Record<string, unknown> | null;
  online: boolean;
  // core
  init: () => Promise<void>;
  update: <K extends AppDataKey>(key: K, fn: (v: AppData[K]) => AppData[K]) => void;
  patch: (p: Partial<AppData>) => void;
  setSelectedDate: (d: string) => void;
  toast: (text: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: string) => void;
  clearCelebration: () => void;
  // gamification
  awardXp: (ref: string, amount: number, label: string, source: string, area?: AreaId, date?: string) => void;
  revokeXp: (ref: string) => void;
  // data ops
  importLegacy: (raw: Record<string, unknown>, mode: "merge" | "replace") => { counts: Record<string, number>; unknownKeys: string[] };
  dismissLegacy: () => void;
  exportAll: () => string;
  restoreFrom: (json: string, mode: "merge" | "replace") => Promise<{ ok: boolean; message: string; counts?: Record<string, number> }>;
  resetAll: () => Promise<void>;
  syncNow: () => Promise<void>;
  linkAccount: (code: string) => Promise<boolean>;
}

const local = new LocalRepository();
let engine: SyncEngine | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let dirty = new Set<string>();

function schedulePersist(get: () => AppState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const keys = Array.from(dirty); dirty = new Set();
    if (!keys.length) return;
    const { data, updatedAt } = get(); const patch: Partial<AppData> = {};
    for (const k of keys) (patch as Record<string, unknown>)[k] = data[k as AppDataKey];
    try { await local.saveKeys(patch, updatedAt); await local.enqueue(keys, updatedAt); engine?.schedule(); } catch (e) { console.error("persist failed", e); }
  }, 400);
}
export function flushPersist(): Promise<void> { return new Promise((r) => { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; } const keys = Array.from(dirty); dirty = new Set(); if (!keys.length) return r(); const { data, updatedAt } = useApp.getState(); const patch: Partial<AppData> = {}; for (const k of keys) (patch as Record<string, unknown>)[k] = data[k as AppDataKey]; local.saveKeys(patch, updatedAt).then(() => local.enqueue(keys, updatedAt)).then(() => r(), () => r()); }); }

export const useApp = create<AppState>((set, get) => ({
  data: defaultAppData(), updatedAt: {}, ready: false, selectedDate: todayISO(), sync: { state: "idle", pending: 0 }, account: { id: "", code: "" }, toasts: [], celebration: null, legacyFound: null, online: true,

  init: async () => {
    if (get().ready) return;
    const { data, updatedAt } = await local.loadAll();
    let id = await local.getMeta<string>("accountId"); let code = await local.getMeta<string>("accountCode");
    if (!id) { id = uid("acc") + uid(); await local.setMeta("accountId", id); }
    if (!code) { code = Math.random().toString(36).slice(2, 8).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase(); await local.setMeta("accountCode", code); }
    const legacy = Object.keys(data.entries).length === 0 ? detectLegacyLocalStorage() : null;
    set({ data, updatedAt, ready: true, account: { id, code }, legacyFound: legacy, online: typeof navigator === "undefined" ? true : navigator.onLine });
    const cloud = new CloudRepository(id, code);
    engine = new SyncEngine(local, cloud, () => ({ data: get().data, updatedAt: get().updatedAt }), (patch, at) => set((s) => ({ data: { ...s.data, ...patch }, updatedAt: { ...s.updatedAt, ...at } })), (sync) => set({ sync }));
    engine.schedule(800);
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => { set({ online: true }); engine?.schedule(200); });
      window.addEventListener("offline", () => set({ online: false, sync: { ...get().sync, state: "offline" } }));
      window.addEventListener("beforeunload", () => { void flushPersist(); });
      setInterval(() => engine?.schedule(0), 60_000);
    }
  },
  update: (key, fn) => { set((s) => { const next = fn(s.data[key]); dirty.add(key); return { data: { ...s.data, [key]: next }, updatedAt: { ...s.updatedAt, [key]: Date.now() } }; }); schedulePersist(get); },
  patch: (p) => { set((s) => { const at = { ...s.updatedAt }; for (const k of Object.keys(p)) { dirty.add(k); at[k] = Date.now(); } return { data: { ...s.data, ...p }, updatedAt: at }; }); schedulePersist(get); },
  setSelectedDate: (d) => set({ selectedDate: d }),
  toast: (text, kind = "info") => { const id = uid("t"); set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, kind }] })); setTimeout(() => get().dismissToast(id), 3200); },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clearCelebration: () => set({ celebration: null }),

  awardXp: (ref, amount, label, source, area, date) => {
    if (!amount) return; const s = get(); if (s.data.xpLog.some((e) => e.ref === ref)) return;
    const before = levelFromXp(totalXp(s.data.xpLog)).level;
    const ev: XpEvent = { id: uid("xp"), at: nowISO(), date: date ?? s.selectedDate, amount, source, label, ref, area };
    s.update("xpLog", (l) => [...l, ev]);
    const after = levelFromXp(totalXp(get().data.xpLog)).level;
    s.toast(`${amount > 0 ? "+" : ""}${amount} XP · ${label}`, amount > 0 ? "xp" : "warn");
    if (after > before) { const cel = celebrationsFor(before, after); const last = cel[cel.length - 1]; if (last.level > get().data.celebrationState.lastLevelCelebrated) { set({ celebration: last }); s.update("celebrationState", (c) => ({ ...c, lastLevelCelebrated: last.level })); } }
  },
  revokeXp: (ref) => { const s = get(); if (!s.data.xpLog.some((e) => e.ref === ref)) return; s.update("xpLog", (l) => l.filter((e) => e.ref !== ref)); },

  importLegacy: (raw, mode) => {
    const { data: incoming, report } = migrateToLatest(raw); const s = get();
    void local.snapshot("before-legacy-import", s.data);
    const next = mode === "replace" ? incoming : mergeAppData(s.data, incoming);
    s.patch(next); set({ legacyFound: null }); s.toast("تم استيراد البيانات القديمة", "ok");
    return { counts: report.counts, unknownKeys: report.unknownKeys };
  },
  dismissLegacy: () => set({ legacyFound: null }),
  exportAll: () => JSON.stringify({ app: "Me vs Me", schemaVersion: CURRENT_SCHEMA_VERSION, exportedAt: nowISO(), data: get().data }, null, 2),
  restoreFrom: async (json, mode) => {
    try {
      const parsed = JSON.parse(json); const { data: incoming, report } = migrateToLatest(parsed); const s = get();
      const total = Object.values(report.counts).reduce((a, b) => a + b, 0); if (!total) return { ok: false, message: "الملف لا يحتوي بيانات معروفة" };
      await local.snapshot("before-restore", s.data);
      s.patch(mode === "replace" ? incoming : mergeAppData(s.data, incoming));
      return { ok: true, message: `تمت الاستعادة (schema v${report.fromVersion} → v${CURRENT_SCHEMA_VERSION})`, counts: report.counts };
    } catch (e) { return { ok: false, message: e instanceof Error ? e.message : "ملف غير صالح" }; }
  },
  resetAll: async () => { await local.snapshot("before-reset", get().data); const fresh = defaultAppData(); get().patch(fresh); get().toast("تمت إعادة التعيين (توجد نسخة تلقائية)", "warn"); },
  syncNow: async () => { await flushPersist(); await engine?.sync(); },
  linkAccount: async (code) => { const cloud = new CloudRepository(get().account.id, get().account.code); const r = await cloud.link(code); if (!r) return false; await local.setMeta("accountId", r.accountId); await local.setMeta("accountCode", r.accountCode); await local.setMeta("lastSyncAt", 0); set({ account: { id: r.accountId, code: r.accountCode } }); engine = new SyncEngine(local, new CloudRepository(r.accountId, r.accountCode), () => ({ data: get().data, updatedAt: get().updatedAt }), (patch, at) => set((s) => ({ data: { ...s.data, ...patch }, updatedAt: { ...s.updatedAt, ...at } })), (sync) => set({ sync })); await engine.sync(); return true; },
}));

export const localRepo = local;
// selectors
export const useData = () => useApp((s) => s.data);
export const useLevel = () => { const log = useApp((s) => s.data.xpLog); return useMemo(() => levelFromXp(totalXp(log)), [log]); };
