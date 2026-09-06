import type { NextConfig } from "next";

// نسخة النشر: تُستخدم لتسمية كاش الـService Worker حتى لا تُقدَّم ملفات نشر قديم بعد التحديث
const buildVersion =
  process.env.NEXT_PUBLIC_BUILD_VERSION ??
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
  process.env.VERCEL_DEPLOYMENT_ID ??
  String(Date.now());

const nextConfig: NextConfig = {
  // firebase-admin (gRPC/بروتوبف) يجب أن يبقى خارج bundle الخادم
  serverExternalPackages: ["firebase-admin", "google-gax", "@google-cloud/firestore"],
  env: { NEXT_PUBLIC_BUILD_VERSION: buildVersion },
  async headers() {
    return [
      // لا تُخزَّن نسخة الـservice worker في كاش المتصفح
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
};

export default nextConfig;
