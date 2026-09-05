import { NextResponse, type NextRequest } from "next/server";
import { cloudDisabledResponse, cloudErrorResponse } from "@/server/auth";
import { isCloudConfigured } from "@/server/firebase";
import { findAccountByCode } from "@/server/firestore/accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ربط هذا الجهاز بحساب موجود في Firestore عبر رمز الحساب (account code) */
export async function POST(req: NextRequest) {
  if (!isCloudConfigured()) return cloudDisabledResponse();
  const body = (await req.json().catch(() => null)) as { code?: string } | null;
  const code = body?.code?.trim();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });
  try {
    const account = await findAccountByCode(code);
    if (!account) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ accountId: account.id, accountCode: account.code });
  } catch (e) {
    return cloudErrorResponse(e);
  }
}
