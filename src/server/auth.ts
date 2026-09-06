import { NextResponse, type NextRequest } from "next/server";
import { isCloudConfigured, isCloudDisabledError } from "@/server/firebase";
import { ensureAccount, type AccountRecord } from "@/server/firestore/accounts";
import { isFirestoreTimeoutError } from "@/server/firestore/deadline";

/** 503 موحّد عندما لا تكون اعتمادات Firebase مضبوطة — العميل يعمل local-first بلا أخطاء مزعجة */
export function cloudDisabledResponse() {
  return NextResponse.json(
    { error: "cloud_disabled", message: "Firebase Firestore غير مُهيّأ على الخادم (راجع .env.example)" },
    { status: 503 },
  );
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export function cloudErrorResponse(e: unknown) {
  if (isCloudDisabledError(e)) return cloudDisabledResponse();
  if (isFirestoreTimeoutError(e)) {
    // 504: عطل مؤقت — العميل يحتفظ بالتغييرات في الطابور ويعيد المحاولة
    return NextResponse.json({ error: "firestore_timeout", message: "Firestore لم يستجب في الوقت المحدد" }, { status: 504 });
  }
  const message = e instanceof Error ? e.message : "firestore error";
  return NextResponse.json({ error: "firestore_error", message }, { status: 502 });
}

export type AccountAuth =
  | { ok: true; account: AccountRecord }
  | { ok: false; response: NextResponse };

/**
 * ترويسات الهوية: x-account-id + x-account-code (حساب مجهول بلا تسجيل دخول).
 * يُنشئ الحساب في Firestore عند أول ظهور، ويرفض عدم تطابق الرمز.
 */
export async function authenticateAccount(req: NextRequest): Promise<AccountAuth> {
  if (!isCloudConfigured()) return { ok: false, response: cloudDisabledResponse() };
  const id = req.headers.get("x-account-id")?.trim();
  const code = req.headers.get("x-account-code")?.trim();
  if (!id || !code) return { ok: false, response: unauthorizedResponse() };
  try {
    const account = await ensureAccount(id, code);
    if (!account) return { ok: false, response: unauthorizedResponse() };
    return { ok: true, account };
  } catch (e) {
    return { ok: false, response: cloudErrorResponse(e) };
  }
}
