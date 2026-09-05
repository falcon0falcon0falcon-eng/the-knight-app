#!/usr/bin/env node
/**
 * تحويل ملف حساب الخدمة (Firebase service account JSON) إلى .env.local بأمان.
 *
 *   npm run cloud:init -- ~/Downloads/my-project-firebase-adminsdk-xxxxx.json
 *   npm run cloud:init                 # يبحث تلقائيًا في المجلد الحالي و ~/Downloads
 *
 * لا يطبع المفتاح الخاص أبدًا، ويتأكد أن .env.local متجاهَل في Git.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const ok = (m) => console.log(`\x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => console.log(`\x1b[31m✗\x1b[0m ${m}`);
const warn = (m) => console.log(`\x1b[33m!\x1b[0m ${m}`);
const info = (m) => console.log(`  ${m}`);

function findCandidate() {
  const dirs = [process.cwd(), path.join(homedir(), "Downloads"), path.join(homedir(), "downloads"), "/home/user/uploads"];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const hit = readdirSync(dir)
      .filter((f) => f.endsWith(".json") && (f.includes("firebase-adminsdk") || f.includes("serviceAccount")))
      .sort()
      .pop();
    if (hit) return path.join(dir, hit);
  }
  return null;
}

const target = process.argv[2] ?? findCandidate();
if (!target) {
  bad("لم أجد ملف حساب الخدمة.");
  info("الاستخدام: npm run cloud:init -- /path/to/xxx-firebase-adminsdk-yyy.json");
  info("تحميله: Firebase Console → ⚙ Project settings → Service accounts → Generate new private key");
  process.exit(1);
}
if (!existsSync(target)) {
  bad(`الملف غير موجود: ${target}`);
  process.exit(1);
}

let sa;
try {
  sa = JSON.parse(readFileSync(target, "utf8"));
} catch (e) {
  bad(`الملف ليس JSON صالحًا: ${e.message}`);
  process.exit(1);
}

const missing = ["project_id", "client_email", "private_key"].filter((k) => !sa[k]);
if (missing.length) {
  bad(`الملف ينقصه: ${missing.join(", ")} — تأكد أنه ملف service account وليس ملف إعدادات الويب (firebaseConfig).`);
  process.exit(1);
}
if (sa.type !== "service_account") warn(`نوع الملف "${sa.type}" غير متوقع — المتوقع service_account`);

// سطر واحد: JSON.stringify يحوّل أسطر المفتاح إلى \n تلقائيًا
const oneLine = JSON.stringify({
  type: "service_account",
  project_id: sa.project_id,
  private_key_id: sa.private_key_id,
  private_key: sa.private_key,
  client_email: sa.client_email,
  client_id: sa.client_id,
  token_uri: sa.token_uri ?? "https://oauth2.googleapis.com/token",
});

const envPath = path.join(process.cwd(), ".env.local");
const previous = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const kept = previous
  .split("\n")
  .filter((l) => !/^\s*(FIREBASE_SERVICE_ACCOUNT|FIREBASE_SERVICE_ACCOUNT_JSON|FIREBASE_PROJECT_ID|FIREBASE_CLIENT_EMAIL|FIREBASE_PRIVATE_KEY)\s*=/.test(l))
  .join("\n")
  .trim();

const body = [
  kept,
  kept ? "" : null,
  "# Firebase Firestore — Cloud Sync (لا تشارك هذا الملف ولا ترفعه إلى Git)",
  `FIREBASE_PROJECT_ID=${sa.project_id}`,
  `FIREBASE_SERVICE_ACCOUNT=${oneLine}`,
  "",
]
  .filter((l) => l !== null)
  .join("\n");

writeFileSync(envPath, body, { mode: 0o600 });
try {
  chmodSync(envPath, 0o600);
} catch {}

ok(`تمت كتابة .env.local (صلاحيات 600)`);
info(`المشروع: ${sa.project_id}`);
info(`حساب الخدمة: ${sa.client_email}`);

const gitignore = existsSync(".gitignore") ? readFileSync(".gitignore", "utf8") : "";
if (/^\.env\.\*$/m.test(gitignore) || /^\.env\.local$/m.test(gitignore)) ok(".env.local متجاهَل في Git");
else warn("أضف .env.local إلى .gitignore قبل أي commit!");

if (path.resolve(target).startsWith(process.cwd() + path.sep)) {
  warn(`ملف حساب الخدمة موجود داخل المستودع (${path.relative(process.cwd(), target)}) — انقله خارجه أو احذفه بعد الإعداد.`);
}

console.log("");
info("الخطوة التالية:  npm run cloud:check  ثم  npm run dev");
