import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { aiAuditLog } from "@/db/schema";
export const dynamic = "force-dynamic";
/** سجل تدقيق لإجراءات AI المؤكدة من المستخدم (best-effort) */
export async function POST(req: NextRequest) {
  const accountId = req.headers.get("x-account-id"); if (!accountId) return NextResponse.json({ ok: false }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { id: string; mode: string; actionType: string; payload: unknown; result: string } | null; if (!b?.id) return NextResponse.json({ ok: false }, { status: 400 });
  await db.insert(aiAuditLog).values({ id: b.id, accountId, mode: b.mode, actionType: b.actionType, payload: (b.payload ?? {}) as object, result: b.result }).onConflictDoNothing();
  return NextResponse.json({ ok: true });
}
