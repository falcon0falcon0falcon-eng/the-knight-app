import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";

export const dynamic = "force-dynamic";

/** ربط هذا الجهاز بحساب موجود عبر رمز الحساب (account code) */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { code?: string } | null;
  const code = body?.code?.trim();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });
  const [acc] = await db.select().from(accounts).where(eq(accounts.code, code));
  if (!acc) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ accountId: acc.id, accountCode: acc.code });
}
