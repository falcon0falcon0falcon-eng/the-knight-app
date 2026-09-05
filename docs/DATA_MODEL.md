# DATA MODEL — Me vs Me

## المبدأ
الـlegacy كان يخزّن كل شيء كـ **مفاتيح مستقلة** (`entries`, `photos`, ...). النسخة الجديدة تحتفظ **بنفس المفاتيح كـcollections منطقية** (Document-per-key) لضمان:
- استيراد مباشر بلا تحويل مدمّر.
- Sync عام (generic) لكل مفتاح.
- Backup/Restore متوافق للخلف.

الحاوية الكلية: `AppData` (انظر `src/types/app-data.ts`) + `meta` (schemaVersion, updatedAt لكل مفتاح, accountId).

## Entities

### Identity / Account
- `Account { id, code, createdAt }` — حساب مجهول محلي، يُربط بأجهزة أخرى عبر `code`.

### Daily
- `DayEntry { date, habits: Record<habitId, boolean>, tasks: Task[], gym, runKm, caloriesBurned?, caloriesEaten, protein, carbs, fat, meals: MealLog[], quranMemPages, quranReadPages, shariaLessons, dhikr: Record<dhikrId, number>, sins: SinLog[], ideaWork: IdeaWork[], note, closed, shutdownStep, xpAwarded: Record<string, number> }`
- `Task { id, title, area, difficulty(1–5), xp, metrics: string[], done, doneAt, source: 'custom'|'weekly'|'recovery'|'quran'|'carried', carriedFrom?, planId? }`
- `Habit { id, name, area, days: number[](0–6), optionalDays: number[], enabled, metric?, quranMode?: 'new'|'review', custom: boolean, xp }` — مشتقة من `streakSettings + customStreakHabits + streakHabitOrder + streakHabitEdits`.
- `MealLibraryItem { id, name, kcal, protein, carbs, fat }`, `DhikrItem { id, text, target }`
- `ProjectIdea { id, title, area, createdAt, history: {date, minutes}[] }`
- `DailyReviewQuestion { id, text }`, `DailyReview { date, answers: Record<qid, string> }`
- `DayMessage { date, text }`

### Weekly / Monthly (Goal engine مشترك)
- `Goal { id, title, kind: 'recurring'|'manual'|'milestone'|'percentage', metric?, target, unit, area, period: 'week'|'month', periodKey, carried: boolean, done, doneAt, templateId?, xp }`
- `GoalTemplate { id, ...Goal بدون periodKey }`
- `GoalProgress { periodKey: { goalId: { value, done } } }` — cache للـmanual progress.
- `WeeklyPlan { weekKey: { date: PlannedTask[] } }`
- `ReviewQuestion`, `Review { periodKey, answers, score }`, `Reflection { date, text }`

### Body
- `BodyEntry { id, date, weight?, waist?, chest?, arm?, thigh?, neck?, vo2max?, rhr?, lifts?: Record<LiftId, {weight, reps}> }`
- `BodyProfile { heightCm, sex, birthYear, activity }`
- `Photo { id, date, angle: 'front'|'side'|'back', category, group, dataUrl }`

### Goals / Finance
- `GoalSettings { weightGoal, waistGoal, ..., quranMemGoalPages, quranReadGoalPages, incomeGoal, savingsGoal, calorieTarget, proteinTarget, carbTarget, fatTarget, areaWeights, rewards: Record<goalKey, Record<25|50|75|100, string>> }`
- `FinanceEntry { id, date, type: 'income'|'expense', amount, category, note }`
- `SavingsEntry { id, date, amount, note }`

### Recovery
- `RecoveryEntry { id, date, at, mood(1–10), spiritual(1–10), urge(0–10), note, timing: 'morning'|'evening'|'other' }`
- `RelapseEvent { id, date, at, durationMin, acts: string[], answers: Record<qid,string> }`
- `CravingEvent { id, at, date, urge, triggers: string[], note, outcome: 'resisted'|'relapse' }`
- `RecoveryTask { id, title, date, done, xp }`
- `Trigger { id, name }`, `Ritual { id, name, when }`, `RescueProtocol { steps: string[] }`, `Reason { id, text }`, `Letter { text, updatedAt }`
- `LostThing { id, title, plan, parts: {id, title, xp, status:'todo'|'working'|'recovered'}[] }`
- `RecoveryIndexSnapshot { date, value }`
- `MorningQuestion`, `MorningReview`

### Quran
- `QuranMemorization { pages: Record<page, { memorizedAt, lastReviewAt, reviews: number }> }`
- `QuranTadabur { id, date, ref, text }`

### Books / Courses
- `Book { id, title, author, pages, currentPage, storage: 'idb'|'drive', driveFileId?, sessions: {date, from, to, minutes}[], addedAt }`
- `Annotation { id, bookId, page, type: 'highlight'|'underline'|'strike'|'note'|'bookmark'|'drawing', color, text?, rects?, paths?, width?, createdAt }` (تُخزن في `bookAnnotations`؛ `bookHighlights`/`bookDrawings` القديمة تُدمج فيها مع الاحتفاظ بالأصل)
- IndexedDB store منفصل `pdfFiles { bookId, blob }` — **لا يُزامن سحابيًا**.
- `Course { id, title, platform, lessons: {id, title, durationMin, videoUrl, done, doneAt}[], addedAt }`

### Challenges / Training
- `Challenge { id, title, type: 'daily'|'weekly'|'boss', source: 'manual'|metric, target, durationDays, startDate, dailyReward, successReward, failurePenalty, progress: Record<date, number>, status: 'active'|'success'|'failed' }`
- `TrainingArea { id, name, color, lifeArea, custom }`, `TrainingSession { id, date, areaId, minutes, note }`

### Brain dump / Identity / Profile
- `BrainDump { id, at, text, kind: 'idea'|'problem'|'task'|'uncategorized', area?, minutes?, processed, convertedTo? }`
- `IdentityPrinciple { id, title, statement, recoveryFocus, lostItemIds, rules: string[], practices: {id, title, xp, log: string[]}[] }`
- `profileAvatar: string`, `profileCardPhoto: string`

### AI
- `AiChat { mode, messages: {id, role, content, at, actions?}[] }`
- `AiMemory { id, mode|'global', text, createdAt }`, `AiSkill { id, name, prompt }`, `AiModeSettings`

### Gamification
- `XpEvent { id, at, date, amount, source, label, ref? }`
- `CelebrationState { lastLevelCelebrated, milestonesSeen: string[] }`

## العلاقات
- DayEntry.tasks ↔ WeeklyPlan (planId) ↔ RecoveryTask ↔ Quran due reviews
- Goal.metric ↔ Metrics registry (`calculations/metrics.ts`) ↔ Challenge.source
- LostThing ↔ IdentityPrinciple.lostItemIds
- Book ↔ Annotation (bookId) ↔ pdfFiles (bookId)
- Everything → XpEvent

## Storage layout
| طبقة | تقنية | المحتوى |
|---|---|---|
| Local | IndexedDB (Dexie) `mevsme` | `docs(key → value, updatedAt)`, `pdfFiles`, `outbox` |
| Cloud | Firebase Firestore `accounts/{accountId}/documents/{key}` → `{ key, json, encoding, updatedAt, serverAt }` | كل المفاتيح ما عدا PDF bytes والصور الكبيرة (اختياري) |
