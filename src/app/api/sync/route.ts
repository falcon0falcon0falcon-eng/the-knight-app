import { NextResponse, type NextRequest } from "next/server";
import { authenticateAccount, cloudErrorResponse } from "@/server/auth";
import { pullDocuments, pushDocuments } from "@/server/firestore/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pull: كل المستندات المتغيرة منذ `since` (server time) من Firestore */
export async function GET(req: NextRequest) {
  const auth = await authenticateAccount(req);
  if (!auth.ok) return auth.response;
  const since = Number(req.nextUrl.searchParams.get("since") ?? 0) || 0;
  try {
    const { docs, serverTime, hasMore } = await pullDocuments(auth.account.id, since);
    return NextResponse.json({ docs, serverTime, hasMore });
  } catch (e) {
    return cloudErrorResponse(e);
  }
}

/** Push: last-write-wins لكل مفتاح — لا يُستبدل مستند أحدث بمستند أقدم (no destructive overwrite) */
export async function POST(req: NextRequest) {
  const auth = await authenticateAccount(req);
  if (!auth.ok) return auth.response;
  const body = (await req.json().catch(() => null)) as { docs?: unknown } | null;
  if (!body || !Array.isArray(body.docs)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    const { accepted, rejected, serverTime } = await pushDocuments(auth.account.id, body.docs);
    return NextResponse.json({ accepted, rejected, serverTime });
  } catch (e) {
    return cloudErrorResponse(e);
  }
}
