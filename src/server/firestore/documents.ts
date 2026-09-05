import type { Firestore } from "firebase-admin/firestore";
import { getDb } from "@/server/firebase";
import { withDeadline } from "./deadline";
import {
  COLLECTIONS,
  MAX_PULL_DOCS,
  decodePayload,
  nextServerAt,
  shouldAcceptIncoming,
  validateIncomingDocs,
  type IncomingDoc,
  type RejectReason,
  type StoredSyncDocument,
} from "./codec";

export interface CloudDoc {
  key: string;
  data: unknown;
  updatedAt: number;
}

export interface PullResult {
  docs: CloudDoc[];
  serverTime: number;
  hasMore: boolean;
}

export interface PushResult {
  accepted: string[];
  rejected: { key: string; reason: RejectReason; serverUpdatedAt: number }[];
  serverTime: number;
}

function documentsRef(db: Firestore, accountId: string) {
  return db.collection(COLLECTIONS.accounts).doc(accountId).collection(COLLECTIONS.documents);
}

/**
 * Pull: كل المستندات التي تغيّرت بعد `since` (زمن الخادم) مرتبة تصاعديًا.
 * مُصفّحة: عند بلوغ الحد يعود hasMore=true و serverTime = آخر serverAt ليكمل العميل من هناك.
 */
export async function pullDocuments(accountId: string, since: number, limit = MAX_PULL_DOCS): Promise<PullResult> {
  const db = getDb();
  const safeSince = Number.isFinite(since) && since > 0 ? Math.floor(since) : 0;
  const snap = await withDeadline(
    documentsRef(db, accountId).where("serverAt", ">", safeSince).orderBy("serverAt", "asc").limit(limit).get(),
    "pull",
  );

  const docs: CloudDoc[] = [];
  let lastServerAt = safeSince;
  for (const d of snap.docs) {
    const row = d.data() as StoredSyncDocument;
    lastServerAt = Math.max(lastServerAt, row.serverAt ?? 0);
    docs.push({ key: row.key, data: decodePayload(row), updatedAt: row.updatedAt ?? 0 });
  }

  const hasMore = snap.size === limit;
  return { docs, serverTime: hasMore ? lastServerAt : Date.now(), hasMore };
}

/**
 * Push: last-write-wins لكل مفتاح — لا يُستبدل مستند أحدث بمستند أقدم (no destructive overwrite).
 * نقرأ الحالة الحالية دفعة واحدة (getAll) ثم نكتب في WriteBatch واحدة (حد Firestore 500 عملية).
 */
export async function pushDocuments(accountId: string, incoming: unknown): Promise<PushResult> {
  const db = getDb();
  const { valid, rejected } = validateIncomingDocs(incoming);
  const now = Date.now();
  if (!valid.length) return { accepted: [], rejected, serverTime: now };

  const col = documentsRef(db, accountId);
  const refs = valid.map((d) => col.doc(d.docId));
  const existing = await withDeadline(db.getAll(...refs, { fieldMask: ["updatedAt", "serverAt"] }), "push:getAll");

  const batch = db.batch();
  const accepted: string[] = [];
  let writes = 0;
  let lastServerAt: number | undefined;

  valid.forEach((doc, i) => {
    const snap = existing[i];
    const current = snap.exists ? (snap.data() as Pick<StoredSyncDocument, "updatedAt" | "serverAt">) : undefined;
    if (!shouldAcceptIncoming(current?.updatedAt, doc.updatedAt)) {
      rejected.push({ key: doc.key, reason: "stale", serverUpdatedAt: current?.updatedAt ?? 0 });
      return;
    }
    const serverAt = nextServerAt(now, lastServerAt);
    lastServerAt = serverAt;
    const row: StoredSyncDocument = {
      key: doc.key,
      json: doc.payload.json,
      encoding: doc.payload.encoding,
      updatedAt: doc.updatedAt,
      serverAt,
      bytes: doc.payload.bytes,
    };
    // set بلا merge: يزيل حقل data القديم (توافق خلفي) ويكتب النسخة المرمّزة
    batch.set(refs[i], row);
    accepted.push(doc.key);
    writes += 1;
  });

  if (writes) await withDeadline(batch.commit(), "push:commit");
  return { accepted, rejected, serverTime: now };
}

/** حذف كل مستندات حساب (لأدوات الصيانة/طلب المستخدم) — دفعات 400 */
export async function deleteAccountDocuments(accountId: string): Promise<number> {
  const db = getDb();
  const col = documentsRef(db, accountId);
  let deleted = 0;
  for (;;) {
    const snap = await withDeadline(col.limit(400).get(), "delete:scan");
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await withDeadline(batch.commit(), "delete:commit");
    deleted += snap.size;
    if (snap.size < 400) break;
  }
  return deleted;
}

export type { IncomingDoc };
