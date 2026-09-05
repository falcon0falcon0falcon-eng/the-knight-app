import { NextResponse, type NextRequest } from "next/server";
import { cloudDisabledResponse, cloudErrorResponse } from "@/server/auth";
import { isCloudConfigured } from "@/server/firebase";
import { recordAiAudit } from "@/server/firestore/ai-audit";
import { isValidAccountId } from "@/server/firestore/codec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** سجل تدقيق لإجراءات AI المؤكدة من المستخدم (Firestore، best-effort) */
export async function POST(req: NextRequest) {
  if (!isCloudConfigured()) return cloudDisabledResponse();
  const accountId = req.headers.get("x-account-id")?.trim();
  if (!accountId || !isValidAccountId(accountId)) return NextResponse.json({ ok: false }, { status: 401 });
  const b = (await req.json().catch(() => null)) as
    | { id?: string; mode?: string; actionType?: string; payload?: unknown; result?: string }
    | null;
  if (!b?.id || typeof b.id !== "string") return NextResponse.json({ ok: false }, { status: 400 });
  try {
    const created = await recordAiAudit({
      id: b.id,
      accountId,
      mode: String(b.mode ?? ""),
      actionType: String(b.actionType ?? ""),
      payload: b.payload ?? {},
      result: String(b.result ?? ""),
    });
    return NextResponse.json({ ok: true, created });
  } catch (e) {
    return cloudErrorResponse(e);
  }
}
