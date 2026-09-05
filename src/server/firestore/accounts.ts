import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getDb } from "@/server/firebase";
import { withDeadline } from "./deadline";
import { COLLECTIONS, isValidAccountCode, isValidAccountId, normalizeAccountCode } from "./codec";

export interface AccountRecord {
  id: string;
  code: string;
  createdAt: number;
}

interface AccountDoc {
  code: string;
  createdAt?: number;
  updatedAt?: number;
}

function accountRef(db: Firestore, id: string) {
  return db.collection(COLLECTIONS.accounts).doc(id);
}

function codeRef(db: Firestore, code: string) {
  return db.collection(COLLECTIONS.accountCodes).doc(normalizeAccountCode(code));
}

export async function getAccount(id: string): Promise<AccountRecord | null> {
  if (!isValidAccountId(id)) return null;
  const snap = await withDeadline(accountRef(getDb(), id).get(), "account:get");
  if (!snap.exists) return null;
  const d = snap.data() as AccountDoc;
  return { id: snap.id, code: d.code, createdAt: d.createdAt ?? 0 };
}

/**
 * يتحقق من الحساب أو ينشئه (أول ظهور للجهاز) داخل transaction واحدة.
 * الرمز فريد عبر مستند فهرس accountCodes/{CODE} (Firestore لا يملك unique constraints).
 * يعيد null عند عدم تطابق الرمز أو كون الرمز مملوكًا لحساب آخر.
 */
export async function ensureAccount(id: string, code: string): Promise<AccountRecord | null> {
  if (!isValidAccountId(id) || !isValidAccountCode(code)) return null;
  const db = getDb();
  const normalized = normalizeAccountCode(code);
  const aRef = accountRef(db, id);
  const cRef = codeRef(db, normalized);

  return withDeadline(db.runTransaction(async (tx) => {
    const [accountSnap, codeSnap] = await Promise.all([tx.get(aRef), tx.get(cRef)]);

    if (accountSnap.exists) {
      const d = accountSnap.data() as AccountDoc;
      if (normalizeAccountCode(d.code) !== normalized) return null;
      // ترميم فهرس الرموز إن ضاع
      if (!codeSnap.exists) tx.set(cRef, { accountId: id, createdAt: Date.now() });
      return { id, code: d.code, createdAt: d.createdAt ?? 0 } satisfies AccountRecord;
    }

    if (codeSnap.exists && (codeSnap.data() as { accountId?: string }).accountId !== id) return null;

    const createdAt = Date.now();
    tx.set(aRef, { code: normalized, createdAt, updatedAt: createdAt } satisfies AccountDoc);
    tx.set(cRef, { accountId: id, createdAt });
    return { id, code: normalized, createdAt } satisfies AccountRecord;
  }), "account:ensure");
}

/** بحث برمز الحساب لربط جهاز جديد — قراءة مباشرة بمعرّف المستند (بلا فهرس مركّب) */
export async function findAccountByCode(code: string): Promise<AccountRecord | null> {
  if (!isValidAccountCode(code)) return null;
  const db = getDb();
  const normalized = normalizeAccountCode(code);
  const snap = await withDeadline(codeRef(db, normalized).get(), "code:get");
  if (snap.exists) {
    const accountId = (snap.data() as { accountId?: string }).accountId;
    if (accountId) {
      const acc = await getAccount(accountId);
      if (acc) return acc;
    }
  }
  // احتياط: حسابات أُنشئت قبل وجود فهرس الرموز
  const q = await withDeadline(db.collection(COLLECTIONS.accounts).where("code", "==", normalized).limit(1).get(), "code:query");
  if (q.empty) return null;
  const doc = q.docs[0];
  const d = doc.data() as AccountDoc;
  await codeRef(db, normalized)
    .set({ accountId: doc.id, createdAt: d.createdAt ?? Date.now() }, { merge: true })
    .catch(() => {});
  return { id: doc.id, code: d.code, createdAt: d.createdAt ?? 0 };
}

/** يُحدّث ختم آخر نشاط للحساب (best-effort، لا يفشل الطلب) */
export async function touchAccount(id: string): Promise<void> {
  try {
    await accountRef(getDb(), id).set({ updatedAt: Date.now(), lastSeenAt: FieldValue.serverTimestamp() }, { merge: true });
  } catch {
    // تجاهل
  }
}
