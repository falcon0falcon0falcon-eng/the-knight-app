import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { accounts, documents } from "@/db/schema";

export const dynamic = "force-dynamic";

async function ensureAccount(req: NextRequest) {
  const id = req.headers.get("x-account-id");
  const code = req.headers.get("x-account-code");
  if (!id || !code || id.length < 8 || code.length < 6) return null;
  const [existing] = await db.select().from(accounts).where(eq(accounts.id, id));
  if (existing) return existing.code === code ? existing : null;
  const [created] = await db.insert(accounts).values({ id, code }).onConflictDoNothing().returning();
  return created ?? null;
}

/** Pull: كل المستندات المتغيرة منذ `since` (server time) */
export async function GET(req: NextRequest) {
  const account = await ensureAccount(req);
  if (!account) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const since = Number(req.nextUrl.searchParams.get("since") ?? 0) || 0;
  const rows = await db.select().from(documents).where(and(eq(documents.accountId, account.id), gt(documents.serverAt, since)));
  return NextResponse.json({ docs: rows.map((r) => ({ key: r.key, data: r.data, updatedAt: r.updatedAt })), serverTime: Date.now() });
}

/** Push: last-write-wins لكل مفتاح — لا يُستبدل مستند أحدث بمستند أقدم (no destructive overwrite) */
export async function POST(req: NextRequest) {
  const account = await ensureAccount(req);
  if (!account) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { docs?: { key: string; data: unknown; updatedAt: number }[] } | null;
  if (!body?.docs || !Array.isArray(body.docs)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const accepted: string[] = []; const rejected: { key: string; serverUpdatedAt: number }[] = [];
  const now = Date.now();
  for (const d of body.docs.slice(0, 200)) {
    if (typeof d.key !== "string" || d.key.length > 64) continue;
    const [existing] = await db.select({ updatedAt: documents.updatedAt }).from(documents).where(and(eq(documents.accountId, account.id), eq(documents.key, d.key)));
    if (existing && existing.updatedAt > d.updatedAt) { rejected.push({ key: d.key, serverUpdatedAt: existing.updatedAt }); continue; }
    await db.insert(documents).values({ accountId: account.id, key: d.key, data: d.data as object, updatedAt: d.updatedAt, serverAt: now })
      .onConflictDoUpdate({ target: [documents.accountId, documents.key], set: { data: d.data as object, updatedAt: d.updatedAt, serverAt: now } });
    accepted.push(d.key);
  }
  return NextResponse.json({ accepted, rejected, serverTime: now });
}
