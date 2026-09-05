import { cert, getApp, getApps, initializeApp, applicationDefault, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Firebase Admin (server-only) — مصدر السحابة الوحيد للتطبيق.
 * لا PostgreSQL ولا DATABASE_URL بعد الآن: كل بيانات Cloud Sync في Firestore.
 *
 * الاعتمادات (أول مصدر متاح يُستخدم):
 *  1) FIREBASE_SERVICE_ACCOUNT            — JSON كامل (أو base64 لنفس الـJSON)
 *  2) FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 *  3) GOOGLE_APPLICATION_CREDENTIALS / ADC (Cloud Run, GCE, gcloud auth…)
 *  4) FIRESTORE_EMULATOR_HOST             — محاكي محلي (يكفي معه FIREBASE_PROJECT_ID)
 *
 * اختياري: FIREBASE_DATABASE_ID لاستخدام قاعدة Firestore غير الافتراضية.
 */

const APP_NAME = "the-knight-app";

export class CloudDisabledError extends Error {
  readonly code = "cloud_disabled";
  constructor(message = "Firebase Firestore is not configured on this server") {
    super(message);
    this.name = "CloudDisabledError";
  }
}

interface ServiceAccountCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

function normalizePrivateKey(key: string): string {
  const unquoted = key.trim().replace(/^"([\s\S]*)"$/, "$1");
  return unquoted.includes("\\n") ? unquoted.replace(/\\n/g, "\n") : unquoted;
}

function parseServiceAccountJson(raw: string): ServiceAccountCredentials | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let text = trimmed;
  if (!text.startsWith("{")) {
    try {
      text = Buffer.from(text, "base64").toString("utf8");
    } catch {
      return null;
    }
  }
  try {
    const parsed = JSON.parse(text) as Record<string, string | undefined>;
    const projectId = parsed.project_id ?? parsed.projectId;
    const clientEmail = parsed.client_email ?? parsed.clientEmail;
    const privateKey = parsed.private_key ?? parsed.privateKey;
    if (!projectId || !clientEmail || !privateKey) return null;
    return { projectId, clientEmail, privateKey: normalizePrivateKey(privateKey) };
  } catch {
    return null;
  }
}

function readServiceAccount(): ServiceAccountCredentials | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT ?? process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    const parsed = parseServiceAccountJson(raw);
    if (parsed) return parsed;
  }
  const projectId = resolveProjectId();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey: normalizePrivateKey(privateKey) };
  }
  return null;
}

function resolveProjectId(): string | undefined {
  return (
    process.env.FIREBASE_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.GCLOUD_PROJECT ??
    undefined
  );
}

function usingEmulator(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

function usingApplicationDefault(): boolean {
  return Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

/** هل السحابة مفعّلة على هذا الخادم؟ (بدون رمي استثناء) */
export function isCloudConfigured(): boolean {
  if (readServiceAccount()) return true;
  if (usingApplicationDefault()) return true;
  if (usingEmulator() && resolveProjectId()) return true;
  return false;
}

function initApp(): App {
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;

  const serviceAccount = readServiceAccount();
  if (serviceAccount) {
    return initializeApp(
      {
        credential: cert({
          projectId: serviceAccount.projectId,
          clientEmail: serviceAccount.clientEmail,
          privateKey: serviceAccount.privateKey,
        }),
        projectId: serviceAccount.projectId,
      },
      APP_NAME,
    );
  }

  const projectId = resolveProjectId();
  if (usingEmulator()) {
    // المحاكي لا يحتاج اعتمادات حقيقية
    return initializeApp({ projectId: projectId ?? "demo-the-knight-app" }, APP_NAME);
  }
  if (usingApplicationDefault()) {
    return initializeApp({ credential: applicationDefault(), projectId }, APP_NAME);
  }
  throw new CloudDisabledError();
}

const globalForFirestore = globalThis as typeof globalThis & {
  __theKnightAppFirestore?: Firestore;
};

/** Firestore instance (singleton عبر hot-reload). يرمي CloudDisabledError إن لم تُضبط الاعتمادات. */
export function getDb(): Firestore {
  if (globalForFirestore.__theKnightAppFirestore) return globalForFirestore.__theKnightAppFirestore;
  const app = initApp();
  const databaseId = process.env.FIREBASE_DATABASE_ID?.trim();
  const db = databaseId && databaseId !== "(default)" ? getFirestore(app, databaseId) : getFirestore(app);
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // settings() تُرمى إن سبق استخدام الـinstance — غير مؤثر
  }
  globalForFirestore.__theKnightAppFirestore = db;
  return db;
}

/** يعيد null بدل الرمي عندما تكون السحابة غير مضبوطة (للمسارات التي تتدهور بلطف). */
export function tryGetDb(): Firestore | null {
  if (!isCloudConfigured()) return null;
  try {
    return getDb();
  } catch {
    return null;
  }
}

/** لأغراض الاختبار/إعادة التهيئة بعد تغيير متغيرات البيئة. */
export function resetDbCache(): void {
  globalForFirestore.__theKnightAppFirestore = undefined;
}

export function isCloudDisabledError(e: unknown): e is CloudDisabledError {
  return e instanceof CloudDisabledError || (typeof e === "object" && e !== null && (e as { code?: string }).code === "cloud_disabled");
}
