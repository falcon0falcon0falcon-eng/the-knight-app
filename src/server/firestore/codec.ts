/**
 * ترميز/تحقق نقي (بدون أي اعتماد على firebase-admin) — قابل للاختبار وحده.
 * يُستخدم من طبقة Firestore في الخادم.
 */

export const COLLECTIONS = {
  /** حسابات مجهولة: accounts/{accountId} */
  accounts: process.env.FIRESTORE_ACCOUNTS_COLLECTION?.trim() || "accounts",
  /** فهرس فريد للرموز: accountCodes/{CODE} -> { accountId } */
  accountCodes: process.env.FIRESTORE_ACCOUNT_CODES_COLLECTION?.trim() || "accountCodes",
  /** مستندات المزامنة (subcollection): accounts/{accountId}/documents/{docId} */
  documents: "documents",
  /** سجل تدقيق إجراءات الـAI: aiAuditLog/{id} */
  aiAuditLog: process.env.FIRESTORE_AI_AUDIT_COLLECTION?.trim() || "aiAuditLog",
} as const;

/** أقصى عدد مستندات في دفعة push واحدة */
export const MAX_PUSH_DOCS = 200;
/** أقصى عدد مستندات في استجابة pull واحدة (مع hasMore للاستكمال) */
export const MAX_PULL_DOCS = 300;
/** حد Firestore الفعلي ~1MiB للمستند؛ نترك هامشًا للحقول الوصفية */
export const MAX_DOC_BYTES = 900_000;
export const MAX_KEY_LENGTH = 64;

const ACCOUNT_ID_RE = /^[A-Za-z0-9_.:@-]{8,128}$/;
const ACCOUNT_CODE_RE = /^[A-Za-z0-9_-]{6,64}$/;
const SAFE_DOC_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidAccountId(id: unknown): id is string {
  return typeof id === "string" && ACCOUNT_ID_RE.test(id);
}

export function isValidAccountCode(code: unknown): code is string {
  return typeof code === "string" && ACCOUNT_CODE_RE.test(code);
}

/** توحيد رمز الحساب (يُستخدم كمعرّف مستند في accountCodes) */
export function normalizeAccountCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * تحويل مفتاح AppData إلى معرّف مستند Firestore صالح.
 * معرّفات Firestore لا تقبل "/" ولا "."/".." ولا البادئة "__".
 */
export function encodeDocId(key: string): string {
  if (SAFE_DOC_ID_RE.test(key) && !key.startsWith("__")) return key;
  const b64 = Buffer.from(key, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `b64_${b64}`;
}

export function decodeDocId(docId: string): string {
  if (!docId.startsWith("b64_")) return docId;
  const b64 = docId.slice(4).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf8");
}

export type DocumentEncoding = "json";

/** شكل مستند المزامنة داخل Firestore */
export interface StoredSyncDocument {
  key: string;
  /** الحمولة مُسلسلة JSON: يحفظ الأنواع كما هي (مصفوفات متداخلة/مفاتيح حرة) بلا قيود Firestore */
  json?: string;
  /** توافق خلفي: مستندات قديمة خُزّنت كخريطة/قيمة أصلية */
  data?: unknown;
  encoding?: DocumentEncoding;
  updatedAt: number;
  serverAt: number;
  bytes?: number;
}

export interface EncodedPayload {
  json: string;
  encoding: DocumentEncoding;
  bytes: number;
}

/** يُسلسل حمولة المستند ويقيس حجمها (يرمي عند تجاوز حد Firestore) */
export function encodePayload(data: unknown): EncodedPayload {
  const json = JSON.stringify(data ?? null) ?? "null";
  const bytes = Buffer.byteLength(json, "utf8");
  return { json, encoding: "json", bytes };
}

export function decodePayload(stored: Pick<StoredSyncDocument, "json" | "data" | "encoding">): unknown {
  if (typeof stored.json === "string") {
    try {
      return JSON.parse(stored.json);
    } catch {
      return null;
    }
  }
  return stored.data ?? null;
}

export interface IncomingDoc {
  key: string;
  data: unknown;
  updatedAt: number;
}

export type RejectReason = "invalid" | "too_large" | "stale";

export interface ValidatedDoc extends IncomingDoc {
  docId: string;
  payload: EncodedPayload;
}

export interface ValidationResult {
  valid: ValidatedDoc[];
  rejected: { key: string; reason: RejectReason; serverUpdatedAt: number }[];
}

/** تحقق + ترميز دفعة push قبل لمس Firestore */
export function validateIncomingDocs(docs: unknown): ValidationResult {
  const valid: ValidatedDoc[] = [];
  const rejected: ValidationResult["rejected"] = [];
  if (!Array.isArray(docs)) return { valid, rejected };
  for (const raw of docs.slice(0, MAX_PUSH_DOCS)) {
    const d = raw as Partial<IncomingDoc> | null;
    const key = d?.key;
    if (typeof key !== "string" || !key.length || key.length > MAX_KEY_LENGTH) continue;
    const updatedAt = typeof d?.updatedAt === "number" && Number.isFinite(d.updatedAt) ? Math.floor(d.updatedAt) : NaN;
    if (!Number.isFinite(updatedAt) || updatedAt < 0) {
      rejected.push({ key, reason: "invalid", serverUpdatedAt: 0 });
      continue;
    }
    let payload: EncodedPayload;
    try {
      payload = encodePayload(d?.data);
    } catch {
      rejected.push({ key, reason: "invalid", serverUpdatedAt: 0 });
      continue;
    }
    if (payload.bytes > MAX_DOC_BYTES) {
      rejected.push({ key, reason: "too_large", serverUpdatedAt: 0 });
      continue;
    }
    valid.push({ key, data: d?.data, updatedAt, docId: encodeDocId(key), payload });
  }
  return { valid, rejected };
}

/** Last-write-wins: لا يُستبدل مستند أحدث على الخادم بمستند أقدم من العميل */
export function shouldAcceptIncoming(serverUpdatedAt: number | undefined, incomingUpdatedAt: number): boolean {
  if (serverUpdatedAt === undefined) return true;
  return incomingUpdatedAt >= serverUpdatedAt;
}

/** طابع زمني للخادم مضمون التزايد داخل نفس المللي ثانية */
export function nextServerAt(now: number, lastServerAt: number | undefined): number {
  if (lastServerAt !== undefined && now <= lastServerAt) return lastServerAt + 1;
  return now;
}
