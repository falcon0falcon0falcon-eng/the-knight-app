#!/usr/bin/env node
/**
 * فحص اتصال Firebase Firestore (بدون تشغيل التطبيق).
 *   npm run cloud:check
 *
 * يقرأ نفس متغيرات البيئة التي يقرأها الخادم (.env.local ثم .env)،
 * ثم ينفّذ دورة كاملة: كتابة مستند تجريبي → قراءته → حذفه.
 */
import { readFileSync, existsSync } from "node:fs";
import { cert, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ── تحميل .env.local / .env يدويًا (بلا تبعيات) ─────────────────────────────
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    if (process.env[key] !== undefined) continue;
    let value = rawValue.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const ok = (m) => console.log(`\x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => console.log(`\x1b[31m✗\x1b[0m ${m}`);
const info = (m) => console.log(`  ${m}`);

const normalizeKey = (k) => (k.includes("\\n") ? k.replace(/\\n/g, "\n") : k);
const projectId =
  process.env.FIREBASE_PROJECT_ID ??
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
  process.env.GOOGLE_CLOUD_PROJECT ??
  process.env.GCLOUD_PROJECT;

function resolveCredentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT ?? process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    const text = raw.trim().startsWith("{") ? raw.trim() : Buffer.from(raw.trim(), "base64").toString("utf8");
    const sa = JSON.parse(text);
    if (sa.project_id && sa.client_email && sa.private_key) {
      return { source: "FIREBASE_SERVICE_ACCOUNT", projectId: sa.project_id, clientEmail: sa.client_email, privateKey: normalizeKey(sa.private_key) };
    }
  }
  if (projectId && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      source: "FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY",
      projectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: normalizeKey(process.env.FIREBASE_PRIVATE_KEY),
    };
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return { source: "GOOGLE_APPLICATION_CREDENTIALS (ADC)", adc: true, projectId };
  if (process.env.FIRESTORE_EMULATOR_HOST && projectId) return { source: `محاكي Firestore (${process.env.FIRESTORE_EMULATOR_HOST})`, emulator: true, projectId };
  return null;
}

const creds = resolveCredentials();
if (!creds) {
  bad("لا توجد اعتمادات Firebase. السحابة معطّلة والتطبيق سيعمل محليًا فقط.");
  info("انسخ .env.example إلى .env.local واملأ FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY");
  process.exit(1);
}

ok(`مصدر الاعتمادات: ${creds.source}`);
info(`المشروع: ${creds.projectId ?? "(من ملف الاعتمادات)"}`);

let app;
try {
  app = creds.adc
    ? initializeApp({ credential: applicationDefault(), projectId: creds.projectId }, "cloud-check")
    : creds.emulator
      ? initializeApp({ projectId: creds.projectId }, "cloud-check")
      : initializeApp({ credential: cert({ projectId: creds.projectId, clientEmail: creds.clientEmail, privateKey: creds.privateKey }), projectId: creds.projectId }, "cloud-check");
} catch (e) {
  bad(`الاعتمادات غير صالحة: ${e?.message ?? e}`);
  info('المفتاح الخاص يجب أن يكون بين علامتي اقتباس ويحتوي \\n مثل: FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIIE...\\n-----END PRIVATE KEY-----\\n"');
  process.exit(1);
}

const databaseId = process.env.FIREBASE_DATABASE_ID?.trim();
const db = databaseId && databaseId !== "(default)" ? getFirestore(app, databaseId) : getFirestore(app);

const ref = db.collection("_cloudCheck").doc(`probe_${Date.now()}`);
try {
  await ref.set({ hello: "the-knight-app", at: Date.now() });
  ok("الكتابة في Firestore نجحت");
  const snap = await ref.get();
  if (!snap.exists || snap.data().hello !== "the-knight-app") throw new Error("القراءة لم تُطابق ما كُتب");
  ok("القراءة نجحت");
  await ref.delete();
  ok("الحذف نجح — Cloud Sync جاهز 🎉");
  process.exit(0);
} catch (e) {
  bad(`فشل الاتصال بـFirestore: ${e?.message ?? e}`);
  if (String(e?.message).includes("NOT_FOUND")) info("تأكد من إنشاء قاعدة Firestore من Firebase Console → Build → Firestore Database → Create database");
  if (String(e?.message).includes("PERMISSION_DENIED")) info("تأكد أن حساب الخدمة يملك دور Cloud Datastore User أو Editor");
  if (String(e?.message).includes("DECODER") || String(e?.message).includes("PEM")) info("المفتاح الخاص غير صحيح — ضعه بين علامتي اقتباس مع \\n كما في .env.example");
  process.exit(1);
}
