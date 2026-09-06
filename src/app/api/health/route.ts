import { COLLECTIONS } from "@/server/firestore/codec";
import { isCloudConfigured, tryGetDb } from "@/server/firebase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEALTH_TIMEOUT_MS = Number(process.env.HEALTH_TIMEOUT_MS ?? 5000);

/** فحص صحة: التطبيق يعمل دائمًا (local-first)؛ حقل cloud يعكس اتصال Firestore */
export async function GET() {
  if (!isCloudConfigured()) {
    return Response.json({ ok: true, cloud: { provider: "firestore", configured: false, reachable: false } });
  }
  const db = tryGetDb();
  if (!db) {
    return Response.json({ ok: true, cloud: { provider: "firestore", configured: false, reachable: false } });
  }
  try {
    // مهلة قصيرة: الفحص يجب ألا يعلّق لو Firestore غير متاح (شبكة محجوبة/مفتاح مرفوض)
    await Promise.race([
      db.collection(COLLECTIONS.accounts).limit(1).get(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("firestore timeout")), HEALTH_TIMEOUT_MS)),
    ]);
    return Response.json({ ok: true, cloud: { provider: "firestore", configured: true, reachable: true } });
  } catch (e) {
    return Response.json(
      {
        ok: false,
        cloud: { provider: "firestore", configured: true, reachable: false, error: e instanceof Error ? e.message : "unreachable" },
      },
      { status: 503 },
    );
  }
}
