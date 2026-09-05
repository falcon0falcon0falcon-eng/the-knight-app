import { getDb } from "@/server/firebase";
import { COLLECTIONS, encodePayload } from "./codec";

export interface AiAuditEntry {
  id: string;
  accountId: string;
  mode: string;
  actionType: string;
  payload: unknown;
  result: string;
}

/**
 * سجل تدقيق لإجراءات AI المؤكدة من المستخدم (best-effort، idempotent عبر المعرّف).
 * الحمولة تُحفظ كنص JSON لتفادي قيود Firestore على المصفوفات المتداخلة.
 */
export async function recordAiAudit(entry: AiAuditEntry): Promise<boolean> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.aiAuditLog).doc(entry.id);
  const { json, bytes } = encodePayload(entry.payload ?? {});
  try {
    await ref.create({
      accountId: entry.accountId,
      mode: entry.mode,
      actionType: entry.actionType,
      payloadJson: json,
      payloadBytes: bytes,
      result: entry.result,
      createdAt: Date.now(),
    });
    return true;
  } catch (e) {
    // ALREADY_EXISTS (code 6) => onConflictDoNothing
    if (typeof e === "object" && e !== null && (e as { code?: number }).code === 6) return false;
    throw e;
  }
}
