# LEGACY MIGRATION PLAN

## الهدف
استيراد كل بيانات النسخة القديمة (localStorage / نسخة JSON احتياطية / Firestore export) **بدون فقد**، مع ترقية تدريجية عبر `schemaVersion`.

## مصادر الاستيراد المدعومة
1. **localStorage القديم** — عند أول تشغيل على نفس الـorigin يفحص `MigrationEngine` وجود أي مفتاح legacy ويعرض شاشة "وجدنا بيانات قديمة → استيراد".
2. **ملف JSON backup** — من Settings › Data & Backup › استعادة. يقبل:
   - النسخة القديمة: كائن مسطح `{ entries: ..., photos: ..., ... }` بلا `schemaVersion` (تُعامل كـ v0).
   - النسخة الجديدة: `{ schemaVersion, exportedAt, data }`.
3. **Firestore export** — نفس الشكل المسطح.

## سياسة الأمان
- **لا حذف**: المفاتيح القديمة التي دُمجت (`weights`, `bookHighlights`, `bookDrawings`, `aiChatHistory`, `aiMemory`) تبقى محفوظة كما هي داخل `AppData` تحت `legacy.<key>`.
- **Merge لا Overwrite**: الاستعادة تدمج المجموعات بالـid/التاريخ؛ الأحدث (`updatedAt`) يفوز داخل المفتاح، ولا يُحذف أي id موجود محليًا.
- **Snapshot قبل الاستعادة**: يُحفظ snapshot تلقائي `backup:before-restore:<ts>` في IndexedDB يمكن التراجع إليه.
- **Validation**: كل مفتاح يمر بـZod schema متساهل (`.passthrough()`) — الحقول المجهولة تُحفظ لا تُرفض.

## سلسلة الترقيات (`src/migrations/index.ts`)
| من → إلى | ماذا تفعل |
|---|---|
| v0 → v1 | تغليف الكائن المسطح، إضافة `meta.schemaVersion=1`، تحويل أي قيم string JSON إلى objects |
| v1 → v2 | توحيد العادات: `streakSettings + customStreakHabits + streakHabitOrder + streakHabitEdits` → `habits[]` (مع الاحتفاظ بالأصل) |
| v2 → v3 | دمج `weights[]` داخل `bodyEntries[]` (weight فقط) عند غياب نفس التاريخ |
| v3 → v4 | دمج `bookHighlights` + `bookDrawings` داخل `bookAnnotations` بنوع `highlight`/`drawing` |
| v4 → v5 | نقل `aiChatHistory` → `aiChatsByMode.game` و `aiMemory` → `aiMemoriesByMode.global` إذا كانت الأخيرة فارغة |
| v5 → v6 | تطبيع `entries[date].tasks[].source` (افتراضي `custom`) و إضافة `xpAwarded` |
| v6 → v7 | إعادة بناء `xpLog` من entries إذا كان فارغًا مع وجود entries (idempotent عبر `ref`) |

كل migration:
- pure function `(data) => data`
- idempotent
- مغطاة بـunit test (`src/migrations/migrations.test.ts`)

## Metrics في الاستيراد
بعد الاستيراد يُعرض تقرير: عدد السجلات لكل مفتاح، المفاتيح المجهولة (تُحفظ تحت `legacy.unknown`), والأخطاء إن وجدت.

## Rollback
Settings › Data & Backup › "النسخ التلقائية" يعرض snapshots ويسمح بالرجوع.
