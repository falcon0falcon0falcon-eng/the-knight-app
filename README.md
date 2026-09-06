# الفارس الفارغ — Me vs Me

تطبيق **Next.js 16 + React 19 + TypeScript + Tailwind v4**، يعمل **local-first**:
البيانات مصدرها IndexedDB على جهازك، والمزامنة السحابية اختيارية عبر **Firebase Firestore**
(لا PostgreSQL ولا `DATABASE_URL`).

## 1) التشغيل المحلي (بدون أي إعداد)

```bash
npm install
npm run dev        # http://localhost:3000
```

التطبيق يشتغل بالكامل من غير Firebase؛ قسم «الإعدادات › السحابة» يعرض **السحابة غير مُفعّلة**
وكل شيء يُحفظ محليًا. لتفعيل المزامنة بين الأجهزة اتبع الخطوة التالية.

## 2) تفعيل المزامنة السحابية (Firebase)

1. [Firebase Console](https://console.firebase.google.com) → **Add project**.
2. **Build → Firestore Database → Create database** (اختر Production mode وأي منطقة).
3. **⚙ Project settings → Service accounts → Generate new private key** (ينزّل ملف JSON).
4. جهّز ملف البيئة — **أسرع طريقة** (تحوّل ملف الـJSON تلقائيًا إلى `.env.local` بصلاحيات 600):

```bash
npm run cloud:init -- ~/Downloads/my-project-firebase-adminsdk-xxxxx.json   # من ملف
cat service-account.json | npm run cloud:init -- -                          # أو من stdin (لصق ثم Ctrl+D)
npm run cloud:init -- file.json --print                                     # يطبع المتغير للاستضافة بلا كتابة ملف
```

> السكربت يصلّح تلقائيًا الـJSON المنسوخ من محادثات (روابط Markdown مثل `[email](mailto:email)` تفسد الملف).

أو يدويًا: `cp .env.example .env.local` ثم املأ من ملف الـJSON:

```env
FIREBASE_PROJECT_ID=my-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@my-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

> `FIREBASE_PRIVATE_KEY` لازم يكون **بين علامتي اقتباس** و`\n` تُكتب كما هي.
> بديل أسهل للاستضافة: ضع الـJSON كله في `FIREBASE_SERVICE_ACCOUNT` (سطر واحد أو base64).

5. تأكد أن الاتصال شغّال:

```bash
npm run cloud:check      # يكتب مستندًا تجريبيًا ويقرأه ويحذفه
```

النتيجة المتوقعة: `✓ الحذف نجح — Cloud Sync جاهز 🎉`
وبعد `npm run dev` يصبح `GET /api/health` →
`{"ok":true,"cloud":{"provider":"firestore","configured":true,"reachable":true}}`

6. انشر قواعد الأمان (تمنع أي وصول مباشر من المتصفح؛ كل شيء عبر الخادم):

```bash
npx firebase-tools deploy --only firestore:rules
```

## 3) تجربة الربط بين جهازين

1. افتح التطبيق → **الإعدادات › السحابة** → انسخ **رمز الحساب**.
2. افتح التطبيق على جهاز/متصفح آخر → نفس القسم → الصق الرمز → **ربط**.
3. عدّل بيانات على جهاز، اضغط **مزامنة الآن** على الآخر — البيانات تظهر بلا حذف للأقدم
   (last-write-wins لكل مفتاح، والمحلي له الأولوية عند وجود تغييرات معلّقة).

الصور الكبيرة (`photos`, `bookCovers`, `profileCardPhoto`) وملفات PDF **لا تُرفع** — تبقى محلية وتُصدَّر في النسخة الاحتياطية فقط.

## 4) أوامر مفيدة

| الأمر | الوظيفة |
|---|---|
| `npm run dev` | خادم التطوير |
| `npm run build` / `npm start` | بناء وتشغيل الإنتاج |
| `npm test` | 84 اختبارًا (حسابات، مزامنة، ترحيلات، حسابات XP) |
| `npm run typecheck` | فحص TypeScript |
| `npm run lint` | ESLint |
| `npm run cloud:init -- <file.json>` | تحويل ملف حساب الخدمة إلى `.env.local` (يدعم `-` للـstdin و`--print`) |
| `npm run cloud:check` | فحص اتصال Firestore (مهلة 20 ثانية) |

> 🔐 **أمان المفاتيح:** ملف حساب الخدمة سرّ كامل الصلاحية على مشروعك. لا ترفعه إلى Git ولا ترسله في محادثات،
> واحتفظ به خارج مجلد المستودع. لو تسرّب: Firebase Console → Service accounts → احذف المفتاح وأنشئ غيره.

### متغيرات اختيارية

| المتغير | الافتراضي | الوظيفة |
|---|---|---|
| `FIRESTORE_TIMEOUT_MS` | `15000` | مهلة كل عملية Firestore (يمنع تعليق `/api/sync` عند انقطاع الشبكة) |
| `HEALTH_TIMEOUT_MS` | `5000` | مهلة فحص `/api/health` |
| `FIREBASE_DATABASE_ID` | `(default)` | قاعدة Firestore غير الافتراضية |
| `OPENAI_API_KEY` | — | تفعيل مساعد الـAI (بدونه يعمل المدرّب المحلي) |

## 4.5) لو ظهرت شاشة «تعذّر فتح الصفحة» بعد نشر جديد

سببها الشائع نسخة قديمة مخزّنة في الـService Worker. الحلول (بالترتيب):

1. من داخل التطبيق: اضغط **«إصلاح وإعادة تحميل»** في شاشة الخطأ.
2. أو افتح **`/fix.html`** — صفحة إنقاذ مستقلة تلغي الـService Worker وتمسح الكاش (بياناتك المحلية والسحابية لا تتأثر).
3. أو من الكونسول:
   ```js
   navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister()));
   caches.keys().then(k => k.forEach(c => caches.delete(c)));
   location.reload();
   ```

من هذا الإصدار صار كاش الـSW مرتبطًا بنسخة النشر (`NEXT_PUBLIC_BUILD_VERSION` / `VERCEL_GIT_COMMIT_SHA`)،
والصفحات تُجلب **من الشبكة أولًا**، وأي فشل في تحميل chunk يُصلَح تلقائيًا مرة واحدة.

## 5) النشر

على Vercel (أو أي استضافة Node): أضف نفس متغيرات البيئة في إعدادات المشروع
(`FIREBASE_SERVICE_ACCOUNT` أو الثلاثة المنفصلة)، واختياريًا `OPENAI_API_KEY` لتفعيل مساعد الـAI.
لا حاجة لأي قاعدة بيانات أو `DATABASE_URL`.

## توثيق أعمق

- `docs/CLOUD_SYNC_FIREBASE.md` — بنية Firestore، عقد الـAPI، دلالات المزامنة.
- `docs/PRODUCT_ARCHITECTURE.md` · `docs/DATA_MODEL.md` · `docs/UX_ARCHITECTURE.md` · `docs/LEGACY_*`.
