import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin (gRPC/بروتوبف) يجب أن يبقى خارج bundle الخادم
  serverExternalPackages: ["firebase-admin", "google-gax", "@google-cloud/firestore"],
};

export default nextConfig;
