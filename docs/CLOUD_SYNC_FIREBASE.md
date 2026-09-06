# Cloud Sync على Firebase Firestore

المزامنة السحابية تعتمد **كليًا على Firebase Firestore**. لا يوجد PostgreSQL ولا Prisma/Drizzle ولا `DATABASE_URL` في المشروع.

- الجهاز يبقى **local-first**: IndexedDB (Dexie) هي مصدر الحقيقة، والسحابة طبقة نسخ/مزامنة فقط.
- كل وصول إلى Firestore يتم **على الخادم** داخل Next.js route handlers عبر `firebase-admin`.
  المتصفح لا يحمل أي اعتمادات Firebase ولا يتصل بـFirestore مباشرة (`firestore.rules` يمنع ذلك).

## 1) الإعداد

Firebase Console → Project settings → Service accounts → **Generate new private key**، ثم انسخ `.env.example` إلى `.env.local`:

```bash
cp .env.example .env.local
```

أي واحد من هذه الخيارات يكفي:

| الخيار | المتغيرات | متى |
|---|---|---|
| JSON كامل | `FIREBASE_SERVICE_ACCOUNT` (JSON أو base64) | Vercel/الاستضافة (سطر واحد) |
| متغيرات منفصلة | `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` | التطوير المحلي |
| ADC | `GOOGLE_APPLICATION_CREDENTIALS` أو بيئة Google | Cloud Run / GCE |
| محاكي | `FIRESTORE_EMULATOR_HOST` + `FIREBASE_PROJECT_ID` | `firebase emulators:start --only firestore` |

اختياري: `FIREBASE_DATABASE_ID` لقاعدة Firestore غير الافتراضية، و`FIRESTORE_*_COLLECTION` لتغيير أسماء المجموعات.

> إن لم تُضبط أي اعتمادات، التطبيق **لا يفشل**: نقاط المزامنة تُعيد `503 {"error":"cloud_disabled"}`،
> ويعرض قسم الإعدادات «السحابة غير مُفعّلة»، ويستمر كل شيء محليًا.

نشر القواعد: `firebase deploy --only firestore:rules`.

## 2) شكل البيانات في Firestore

```
accounts/{accountId}
  ├─ code: "A1B2C3-D4E5"      // رمز الربط (uppercase)
  ├─ createdAt / updatedAt: ms
  └─ documents/{docId}         // subcollection: مستند لكل مفتاح AppData
       ├─ key:       "entries"        // المفتاح الأصلي كما في legacy
       ├─ json:      "{…}"            // الحمولة مُسلسلة JSON
       ├─ encoding:  "json"
       ├─ updatedAt: 1757000000000    // ساعة العميل (LWW)
       ├─ serverAt:  1757000000123    // ساعة الخادم (مؤشر الـpull)
       └─ bytes:     1234

accountCodes/{CODE}  → { accountId }   // فهرس فرادة الرمز + ربط سريع بلا فهرس مركّب
aiAuditLog/{id}      → { accountId, mode, actionType, payloadJson, result, createdAt }
```

قرارات مقصودة:

- **الحمولة كنص JSON**: Firestore يرفض المصفوفات المتداخلة مباشرة (`[[1,2]]`) ويتعامل بحساسية مع `undefined`
  ومفاتيح الخرائط الحرة. التسلسل يضمن رحلة ذهاب/إياب بلا فقد لأي شكل من أشكال `AppData`.
  القراءة تدعم أيضًا المستندات القديمة المخزّنة كحقل `data` منظّم.
- **`serverAt` رقمي وتصاعدي** داخل الدفعة الواحدة، ليعمل مؤشر `since` بدقة (`where serverAt > since`).
- **معرّف المستند** = المفتاح نفسه إن كان آمنًا، وإلا `b64_…` (المفاتيح التي تحوي `/` أو `.` أو تبدأ بـ`__`).
- **حد الحجم**: أي مستند يتجاوز ~900KB يُرفض بـ`too_large` (حد Firestore ~1MiB). صور base64 وملفات PDF لا تُرفع أصلًا.
- **لا فهارس مركّبة مطلوبة**: كل الاستعلامات أحادية الحقل (فهرسة تلقائية).

## 3) عقد الـAPI

كل المسارات `runtime = "nodejs"` و`dynamic = "force-dynamic"`.
الهوية عبر ترويستين (حساب مجهول، بلا تسجيل دخول): `x-account-id` و`x-account-code`.

| المسار | الوصف |
|---|---|
| `GET /api/sync?since=<ms>` | Pull: `{ docs: [{key,data,updatedAt}], serverTime, hasMore }` — مُصفّح (300 مستند/طلب)؛ عند `hasMore` يكون `serverTime` مؤشر الاستكمال ويعيد العميل الطلب فورًا |
| `POST /api/sync` | Push: `{ docs: [{key,data,updatedAt}] }` (حد 200) → `{ accepted, rejected: [{key,reason,serverUpdatedAt}], serverTime }` |
| `POST /api/sync/link` | ربط جهاز عبر `{ code }` → `{ accountId, accountCode }` |
| `POST /api/ai/audit` | سجل تدقيق لإجراء AI مؤكد (idempotent عبر `id`) |
| `GET /api/health` | `{ ok, cloud: { provider:"firestore", configured, reachable } }` |

الرموز: `401` هوية ناقصة/رمز غير مطابق · `400` طلب غير صالح · `404` رمز ربط غير موجود ·
`503 cloud_disabled` السحابة غير مُهيّأة · `504 firestore_timeout` تجاوز المهلة · `502 firestore_error` عطل في Firestore.

**مهلة زمنية على كل عملية Firestore** (`FIRESTORE_TIMEOUT_MS`، افتراضي 15000): بدونها يعيد gRPC
المحاولة لدقائق عند انقطاع الشبكة فتُعلَّق طلبات المزامنة وتُستهلك اتصالات الخادم. مع المهلة يعود `504`
سريعًا، ويحتفظ العميل بالتغييرات في الطابور ويعيد المحاولة. و`/api/health` له مهلته الخاصة
(`HEALTH_TIMEOUT_MS`، افتراضي 5000) فلا يعلّق أبدًا.

## 4) دلالات المزامنة (كما كانت، بلا تراجع)

1. الكتابة محليًا أولًا → طابور `outbox`.
2. Push: **last-write-wins لكل مفتاح**، ولا يُستبدل مستند أحدث على الخادم بمستند أقدم (`reason:"stale"` مع `serverUpdatedAt`).
3. Pull: المستندات التي `serverAt > lastSyncAt` فقط.
4. الدمج غير مدمّر: المفاتيح التي لا تزال في الطابور المحلي لا تُدهس بنسخة السحابة.
5. `photos` و`bookCovers` و`profileCardPhoto` وملفات PDF لا تُرفع أبدًا (تُصدَّر في الـbackup فقط).

كتابة الـpush تتم في `WriteBatch` واحدة بعد قراءة الحالة الحالية بـ`getAll` (قراءة واحدة + كتابة واحدة لكل دفعة)،
وإنشاء الحساب/حجز الرمز داخل `runTransaction` لضمان الفرادة.

## 5) الكود

```
src/server/firebase.ts             تهيئة firebase-admin + كشف الاعتمادات + CloudDisabledError
src/server/auth.ts                 مصادقة ترويسات الحساب + استجابات 503/401/502 الموحّدة
src/server/firestore/codec.ts      ترميز/تحقق نقي (بلا firebase) — مُختبَر وحدويًا
src/server/firestore/deadline.ts   مهلة زمنية لكل عملية Firestore (FirestoreTimeoutError)
src/server/firestore/accounts.ts   إنشاء/جلب الحساب + فهرس الرموز + الربط
src/server/firestore/documents.ts  push/pull/delete لمستندات المزامنة
src/server/firestore/ai-audit.ts   سجل تدقيق AI
src/core/storage.ts                العميل: CloudRepository + SyncEngine (+ حالة "disabled")
```

## 6) الاختبارات

```bash
npm test
```

- `api-routes.test.ts` — نقاط `/api/sync`, `/api/sync/link`, `/api/ai/audit`, `/api/health` نفسها (رموز الحالة، الهوية، العزل بين الحسابات).
- `firestore-codec.test.ts` — الترميز، الحدود، LWW، صلاحية المعرّفات، المهل الزمنية.
- `firestore-sync.test.ts` — push/pull/link/audit فوق **Firestore مزيّف في الذاكرة** (لا يحتاج Java/محاكي).
- `firebase-config.test.ts` — كشف الاعتمادات لكل الخيارات الأربعة.
