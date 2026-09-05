"use client";
import Dexie, { Table } from "dexie";
import { AppData, AppDataKey, defaultAppData } from "@/types/app-data";
import { CURRENT_SCHEMA_VERSION, migrateToLatest } from "@/migrations";
import { uid } from "./date";

// ─── IndexedDB (Local-first source of truth) ────────────────────────────────
interface DocRow { key: string; value: unknown; updatedAt: number }
interface OutboxRow { key: string; updatedAt: number }
interface PdfRow { bookId: string; blob: Blob; name: string; size: number }
interface SnapshotRow { id: string; at: number; label: string; payload: string }
interface MetaRow { id: string; value: unknown }

class MeVsMeDB extends Dexie {
  docs!: Table<DocRow, string>;
  outbox!: Table<OutboxRow, string>;
  pdfFiles!: Table<PdfRow, string>;
  snapshots!: Table<SnapshotRow, string>;
  meta!: Table<MetaRow, string>;
  constructor() {
    super("mevsme");
    this.version(1).stores({ docs: "key", outbox: "key", pdfFiles: "bookId", snapshots: "id, at", meta: "id" });
  }
}
let _db: MeVsMeDB | null = null;
export const idb = () => { if (!_db) _db = new MeVsMeDB(); return _db; };
export const hasIDB = () => typeof indexedDB !== "undefined";

export interface StorageRepository {
  loadAll(): Promise<{ data: AppData; updatedAt: Record<string, number>; fresh: boolean }>;
  saveKeys(patch: Partial<AppData>, updatedAt: Record<string, number>): Promise<void>;
  enqueue(keys: string[], updatedAt: Record<string, number>): Promise<void>;
  pendingKeys(): Promise<string[]>;
  clearPending(keys: string[]): Promise<void>;
  clearAll(): Promise<void>;
}

export class LocalRepository implements StorageRepository {
  async loadAll() {
    if (!hasIDB()) return { data: defaultAppData(), updatedAt: {}, fresh: true };
    const rows = await idb().docs.toArray();
    if (!rows.length) return { data: defaultAppData(), updatedAt: {}, fresh: true };
    const raw: Record<string, unknown> = {}; const updatedAt: Record<string, number> = {};
    for (const r of rows) { raw[r.key] = r.value; updatedAt[r.key] = r.updatedAt; }
    const metaV = await idb().meta.get("schemaVersion");
    const { data } = migrateToLatest({ schemaVersion: Number(metaV?.value ?? CURRENT_SCHEMA_VERSION), data: raw });
    await idb().meta.put({ id: "schemaVersion", value: CURRENT_SCHEMA_VERSION });
    return { data, updatedAt, fresh: false };
  }
  async saveKeys(patch: Partial<AppData>, updatedAt: Record<string, number>) {
    if (!hasIDB()) return;
    const rows: DocRow[] = Object.entries(patch).map(([key, value]) => ({ key, value, updatedAt: updatedAt[key] ?? Date.now() }));
    await idb().docs.bulkPut(rows);
    await idb().meta.put({ id: "schemaVersion", value: CURRENT_SCHEMA_VERSION });
  }
  async enqueue(keys: string[], updatedAt: Record<string, number>) { if (!hasIDB()) return; await idb().outbox.bulkPut(keys.map((key) => ({ key, updatedAt: updatedAt[key] ?? Date.now() }))); }
  async pendingKeys() { if (!hasIDB()) return []; return (await idb().outbox.toArray()).map((r) => r.key); }
  async clearPending(keys: string[]) { if (!hasIDB()) return; await idb().outbox.bulkDelete(keys); }
  async clearAll() { if (!hasIDB()) return; await Promise.all([idb().docs.clear(), idb().outbox.clear(), idb().snapshots.clear()]); }
  async snapshot(label: string, data: AppData) { if (!hasIDB()) return; await idb().snapshots.put({ id: uid("snap"), at: Date.now(), label, payload: JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, data }) }); const all = await idb().snapshots.orderBy("at").toArray(); if (all.length > 10) await idb().snapshots.bulkDelete(all.slice(0, all.length - 10).map((s) => s.id)); }
  async listSnapshots() { if (!hasIDB()) return []; return (await idb().snapshots.orderBy("at").reverse().toArray()).map((s) => ({ id: s.id, at: s.at, label: s.label })); }
  async getSnapshot(id: string) { const s = await idb().snapshots.get(id); return s ? JSON.parse(s.payload) : null; }
  async getMeta<T>(id: string): Promise<T | undefined> { if (!hasIDB()) return undefined; return (await idb().meta.get(id))?.value as T | undefined; }
  async setMeta(id: string, value: unknown) { if (!hasIDB()) return; await idb().meta.put({ id, value }); }
}

// PDF bytes — محلية فقط، لا تُزامَن سحابيًا أبدًا
export const pdfStore = {
  async put(bookId: string, blob: Blob, name: string) { await idb().pdfFiles.put({ bookId, blob, name, size: blob.size }); },
  async get(bookId: string) { return (await idb().pdfFiles.get(bookId))?.blob ?? null; },
  async remove(bookId: string) { await idb().pdfFiles.delete(bookId); },
  async has(bookId: string) { return !!(await idb().pdfFiles.get(bookId)); },
};

// ─── Cloud repository (PostgreSQL via /api/sync) ────────────────────────────
export interface CloudDoc { key: string; data: unknown; updatedAt: number }
// المفاتيح الثقيلة/الحساسة لا تُرفع سحابيًا افتراضيًا (base64 صور) — تُصدَّر في الـbackup فقط
export const CLOUD_EXCLUDED_KEYS: AppDataKey[] = ["photos", "bookCovers", "profileCardPhoto"];

export class CloudRepository {
  constructor(private accountId: string, private accountCode: string) {}
  private headers() { return { "content-type": "application/json", "x-account-id": this.accountId, "x-account-code": this.accountCode }; }
  async push(docs: CloudDoc[]): Promise<{ accepted: string[]; rejected: { key: string; serverUpdatedAt: number }[] }> {
    const res = await fetch("/api/sync", { method: "POST", headers: this.headers(), body: JSON.stringify({ docs }) });
    if (!res.ok) throw new Error(`sync push failed: ${res.status}`);
    return res.json();
  }
  async pull(since: number): Promise<{ docs: CloudDoc[]; serverTime: number }> {
    const res = await fetch(`/api/sync?since=${since}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`sync pull failed: ${res.status}`);
    return res.json();
  }
  async link(code: string): Promise<{ accountId: string; accountCode: string } | null> {
    const res = await fetch("/api/sync/link", { method: "POST", headers: this.headers(), body: JSON.stringify({ code }) });
    if (!res.ok) return null; return res.json();
  }
}

// ─── Sync Engine ─────────────────────────────────────────────────────────────
export type SyncStatus = { state: "idle" | "syncing" | "offline" | "error"; pending: number; lastSyncAt?: number; error?: string };
export class SyncEngine {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  status: SyncStatus = { state: "idle", pending: 0 };
  constructor(
    private local: LocalRepository,
    private cloud: CloudRepository,
    private getData: () => { data: AppData; updatedAt: Record<string, number> },
    private applyRemote: (patch: Partial<AppData>, updatedAt: Record<string, number>) => void,
    private onStatus: (s: SyncStatus) => void,
  ) {}
  private set(s: Partial<SyncStatus>) { this.status = { ...this.status, ...s }; this.onStatus(this.status); }
  schedule(delay = 1500) { if (this.timer) clearTimeout(this.timer); this.timer = setTimeout(() => void this.sync(), delay); }
  async sync(): Promise<void> {
    if (this.running) { this.schedule(3000); return; }
    if (typeof navigator !== "undefined" && !navigator.onLine) { this.set({ state: "offline", pending: (await this.local.pendingKeys()).length }); return; }
    this.running = true; this.set({ state: "syncing" });
    try {
      const pending = await this.local.pendingKeys();
      const { data, updatedAt } = this.getData();
      const docs: CloudDoc[] = pending.filter((k) => !CLOUD_EXCLUDED_KEYS.includes(k as AppDataKey)).map((key) => ({ key, data: data[key as AppDataKey], updatedAt: updatedAt[key] ?? Date.now() }));
      if (docs.length) { const r = await this.cloud.push(docs); await this.local.clearPending([...r.accepted, ...r.rejected.map((x) => x.key)]); }
      else if (pending.length) await this.local.clearPending(pending);
      const since = (await this.local.getMeta<number>("lastSyncAt")) ?? 0;
      const { docs: remote, serverTime } = await this.cloud.pull(since);
      const stillPending = new Set(await this.local.pendingKeys());
      const patch: Partial<AppData> = {}; const patchAt: Record<string, number> = {};
      for (const d of remote) { if (stillPending.has(d.key)) continue; /* المحلي authoritative عند وجود pending */ const localAt = updatedAt[d.key] ?? 0; if (d.updatedAt > localAt) { (patch as Record<string, unknown>)[d.key] = d.data; patchAt[d.key] = d.updatedAt; } }
      if (Object.keys(patch).length) { this.applyRemote(patch, patchAt); await this.local.saveKeys(patch, patchAt); }
      await this.local.setMeta("lastSyncAt", serverTime);
      this.set({ state: "idle", pending: (await this.local.pendingKeys()).length, lastSyncAt: serverTime, error: undefined });
    } catch (e) {
      this.set({ state: "error", error: e instanceof Error ? e.message : String(e), pending: (await this.local.pendingKeys()).length });
    } finally { this.running = false; }
  }
}
