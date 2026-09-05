# PRODUCT ARCHITECTURE — Me vs Me · الفارس الفارغ

## قرار المنصة (Documented deviation)
المواصفة فضّلت Vite + Firebase. بيئة التشغيل هي **Next.js (App Router) + Firebase Firestore (Admin SDK)** — لا PostgreSQL ولا `DATABASE_URL`. لذلك:
- الواجهة: React 19 + TypeScript + Tailwind v4 (design tokens في `globals.css`).
- الـrouting: Next App Router عبر `app/[[...slug]]` + خريطة routes داخلية تحفظ الـlegacy routes والـredirects (`src/app/routes.ts`).
- Local-first: **IndexedDB (Dexie)** هي مصدر الحقيقة على الجهاز.
- Cloud: **Firebase Firestore** عبر `/api/sync` (route handlers تستخدم firebase-admin على الخادم فقط)، بنفس فلسفة الـlegacy (local write first → outbox → push/pull → merge غير مدمّر). التفاصيل: `docs/CLOUD_SYNC_FIREBASE.md`.
- Drive: Google Identity Services + Drive REST (`drive.file`) — client-side فقط، بدون تمرير الملفات عبر الخادم.
- AI: `/api/ai` (server) يقرأ `OPENAI_API_KEY` إن وُجد؛ وإلا يعمل "المدرّب المحلي" (rule-based على السياق الحقيقي) — بلا fake responses مُدّعاة.

## الطبقات
```
src/
  app/               Next routes + shell bootstrap + legacy redirects
  core/              storage (IndexedDB), sync engine, backup, date utils, ids
  types/             AppData + كل الـentities
  calculations/      pure functions (gamification, daily, streaks, goals, body, recovery, quran, training, challenges, courses, metrics)
  domain/<x>/        نصوص/ثوابت/قواعد كل domain (phases, personas, defaults)
  stores/            Zustand store (slices عبر actions مجمّعة) + selectors
  components/ui      Design system primitives
  components/charts  Recharts wrappers
  features/<x>/      شاشات كل domain (lazy)
  migrations/        سلسلة الترقيات
  integrations/      Google Drive, AI client
  hooks/             useOnline, useHotkeys, useMediaQuery
```

## تدفق البيانات
```
UI → store.action(patch) → immer-less setState → persist(debounced) → IndexedDB.docs
                                                ↘ outbox(key, updatedAt) → SyncEngine.push → POST /api/sync
                            SyncEngine.pull(since) → merge(newer & not pending) → store.hydrate
```
- `meta.updatedAt[key]` لكل مفتاح؛ الـserver يقبل الأحدث فقط (`updated_at` مقارنة) — لا overwrite لبيانات أحدث.
- عند وجود pending outbox لمفتاح: المحلي authoritative حتى يكتمل push.
- الاتصال يعود → `online` event → flush outbox → pull.

## Gamification Engine (`calculations/gamification.ts`)
- `xpForLevel(n)` — منحنى `LEGACY_CONSTANT` قابل للاستبدال.
- `levelFromXp(total)`, `rankForLevel(level)` E/D/C/B/A/S.
- كل XP يُسجل كـ`XpEvent` مع `ref` فريد → idempotent (لا ازدواج عند إعادة الحفظ).
- Penalties = أحداث سالبة (habit miss, recovery task miss, challenge failure, repeated trigger).

## Metrics Registry (`calculations/metrics.ts`)
مصدر واحد لكل الـmetrics المستخدمة في: Weekly/Monthly goals، Challenges، Habit linkage، AI context.
`metricValue(metricId, data, fromDate, toDate)`.

## Backup
`core/backup.ts`: `exportAll()`, `restore(json, {mode:'merge'|'replace'})`, `resetAll()`, تصدير Markdown للتقارير، تصدير annotations JSON/MD، تصدير AI history.

## PWA
`public/manifest.webmanifest` + `public/sw.js` (app-shell cache + network-first للـAPI + offline fallback). التسجيل في `AppShell`.

## Verification (per phase)
| Phase | Status |
|---|---|
| 1 Architecture/models/migrations/storage | ✅ |
| 2 Design system/shell/nav | ✅ |
| 3 Gamification | ✅ + tests |
| 4 My Day + Shutdown | ✅ |
| 5 Week + Month | ✅ |
| 6 Body + Goals + Finance | ✅ |
| 7 Recovery | ✅ + tests |
| 8 Quran + Training + Brain dump | ✅ |
| 9 Library + PDF + Courses | ✅ |
| 10 Challenges + Profile + Identity | ✅ |
| 11 AI (modes, memory, confirm-actions) | ✅ |
| 12 Sync / Drive / PWA | ✅ |
| 13 Tests / perf / a11y | unit + integration (vitest)؛ E2E scenarios موثقة في `docs/UX_ARCHITECTURE.md` |
