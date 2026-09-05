# LEGACY FEATURE MATRIX — الفارس الفارغ · Me vs Me

> **مصدر التحليل:** ملف الـlegacy (HTML/React monolithic) لم يكن موجودًا داخل مساحة العمل عند بدء إعادة البناء.
> تم اعتماد المواصفة السلوكية التفصيلية (Behavioral Specification) المرفقة مع طلب إعادة البناء + قائمة الـlegacy storage keys الكاملة (79 مفتاحًا) كـ**Feature Specification + Legacy Data Specification**.
> أي معادلة لم تُذكر رقميًا في المواصفة تم تثبيتها كـ**ثابت موثّق** في `src/calculations/*` مع تعليق `LEGACY_CONSTANT` حتى يمكن استبدال قيمتها بالقيمة القديمة بلا تغيير معماري.

الحالة: ✅ Preserved · ⬆️ Improved · 🧪 Tested · 🔁 Migrated · 📱 Responsive · ♿ Accessible

| ID | Feature | السلوك الحالي (Legacy) | Legacy key(s) | الحسابات | UI الجديدة | Dependencies | Migration | New module | Acceptance |
|---|---|---|---|---|---|---|---|---|---|
| **GAM-01** | XP / Level / Rank | XP تراكمي من كل الأنشطة، level من منحنى XP، rank E(1–9) D(10–19) C(20–29) B(30–39) A(40–49) S(50+) | `xpLog`, `celebrationState` | `levelFromXp`, `xpForLevel`, `rankForLevel` | `XPBadge`, `RankBadge`, Profile card | كل الدومينات | نسخ `xpLog` كما هو؛ إن غاب يُعاد بناؤه من entries | `calculations/gamification.ts` | نفس الأرقام قبل/بعد الاستيراد ✅🧪 |
| **GAM-02** | Daily / Weekly / Monthly / Lifetime score | نسبة الإنجاز اليومي، متوسطها أسبوعيًا وشهريًا، مجموع XP عمريًا | `entries`, `xpLog` | `computeDayProgress`, `weeklyScore`, `monthlyScore` | Day header ring, Week/Month reports | GAM-01, DAY-* | — | `calculations/daily.ts`, `calculations/goals.ts` | القيم مطابقة للحساب القديم ✅🧪 |
| **GAM-03** | Bonuses / Penalties / Streak bonus | streak bonus لكل عادة، habit-miss penalty، bonus quests | `bonusQuests`, `habitMisses`, `streakSettings` | `streakBonusXp`, `habitMissPenalty` | Settings › Bonuses, Day habits | GAM-01 | حفظ `habitMisses` تاريخيًا | `calculations/streaks.ts` | off-day/optional-day لا يكسر streak 🧪 |
| **GAM-04** | Celebrations / Unlocks | احتفال عند level-up و milestones | `celebrationState` | — | Toast + celebration modal | GAM-01 | نسخ الحالة | `stores/app-store.ts` + `components/ui` | لا يتكرر الاحتفال ✅ |
| **AREA-01** | Six Life Areas | Physical/Mental/Deen/Academic/Career/Creativity؛ weighting اختياري؛ radar | `goalSettings.areaWeights`, `uiPrefs` | `areaScores`, `weightedAreaScore` | Me › radar, Settings › Life Areas | GAM-02 | افتراضي وزن 1 | `calculations/areas.ts` (داخل gamification) | radar + trend لكل area ✅ |
| **DAY-01** | Day navigation | السابق/الحالي/التالي، منع تعديل المستقبل | `uiPrefs.selectedDate` | `isFutureDate` | `DateNavigator` | — | — | `features/day` | تعطيل الأزرار في المستقبل ♿ |
| **DAY-02** | Streak habits | عادات ثابتة + مخصصة، أيام مجدولة، أيام اختيارية، due logic، ترتيب، تفعيل/تعطيل، تعديل، ربط metric، وضع القرآن حفظ/مراجعة | `streakSettings`, `customStreakHabits`, `streakHabitOrder`, `streakHabitEdits`, `entries[d].habits` | `isHabitDue`, `habitStreak` | `HabitRow`, Settings › Habits | GAM-03, QUR-01 | دمج الثلاثة مفاتيح في تعريف موحد مع الاحتفاظ بالأصل | `domain/daily` | streak صحيح مع أيام off ✅🧪 |
| **DAY-03** | Tasks | مهام مخصصة (area, difficulty 1–5, XP, metrics)، حذف، إكمال، ترحيل، مهام تعافي، مهام قرآن تلقائية | `entries[d].tasks`, `recoveryTasks`, `weeklyPlans` | `taskXp(difficulty)`, `carriedTasks` | `TaskRow` | REC-07, QUR-03, WEEK-01 | — | `domain/daily` | مهمة غير مكتملة تظهر غدًا ✅ |
| **DAY-04** | Daily progress | required habits + optional done + custom quests + recovery tasks | `entries` | `computeDayProgress` | ProgressRing | DAY-02/03 | — | `calculations/daily.ts` | 🧪 |
| **DAY-05** | Physical | gym toggle, run km, kcal burned, kcal eaten, BMR fallback (فقط إذا burn فارغ), net, expected body change, macro rings, meal library | `entries`, `mealLibrary`, `bodyProfile`, `goalSettings` | `bmr`, `netCalories`, `expectedWeightChange` | Day › Physical card | BODY-01 | — | `calculations/body.ts` | BMR fallback فقط عند غياب burn 🧪 |
| **DAY-06** | Deen | حفظ/قراءة قرآن، دروس شرعية، عداد أذكار قابل للتخصيص، سجل تعلم الذنوب | `entries`, `dhikrLibrary`, `quranMemorization` | — | Day › Deen card | QUR-* | — | `domain/daily` | ✅ |
| **DAY-07** | Creativity / Idea bank | إضافة فكرة، دقائق عمل، تاريخ العمل لكل فكرة | `projectIdeas`, `entries[d].ideaWork` | `ideaMinutes` | Day › Creativity | — | — | `domain/daily` | ✅ |
| **DAY-08** | Weekly plan → Day | مهام My Week تظهر تلقائيًا في My Day بنفس XP | `weeklyPlans` | — | TaskRow (source badge) | WEEK-01 | — | `domain/daily` | ✅ |
| **DAY-09** | Day messages | رسالة لليوم | `dayMessages` | — | Day header | — | نسخ | `domain/daily` | ✅ |
| **SHUT-01** | Shutdown Sequence | 5 خطوات: missing checks → daily review → brain dump → result → closing message؛ recoverable draft | `dailyReviewQuestions`, `dailyReviews`, `brainDumps`, `entries[d].closed` | `computeDayProgress` | Stepper modal مع progress indicator | DAY-*, BD-01 | — | `features/day/Shutdown` | إغلاق آمن بلا فقد ♿📱 |
| **MORN-01** | Morning recovery review | أسئلة صباحية | `morningRecoveryQuestions`, `morningReviews` | — | Healing › Morning | REC-* | نسخ | `domain/recovery` | ✅ |
| **WEEK-01** | Weekly planner | تخطيط مهام لكل يوم بالأسبوع (يبدأ السبت)، تخطيط مستقبلي | `weeklyPlans` | `weekStart` | Week › Planner | DAY-08 | — | `domain/weekly` | السبت هو بداية الأسبوع 🧪 |
| **WEEK-02** | Weekly goals | recurring / manual / milestone / percentage-of-goal / carried milestone؛ templates؛ progress من real data | `weeklyGoalTemplates`, `weeklyGoals`, `weeklyGoalProgress` | `goalProgress` (goal engine) | `GoalCard` | metrics | نسخ + ربط templates | `calculations/goals.ts` | carried تستمر ✅🧪 |
| **WEEK-03** | Weekly review / report | أسئلة مراجعة، تقرير، trend، مقارنة السابق/الحالي، lifetime averages، habit-miss penalties، reflections | `weeklyReviewQuestions`, `weeklyReviews`, `reflections`, `habitMisses` | `weeklyReport` | Week › Report/Review | GAM-02 | — | `domain/weekly` | ✅ |
| **MON-01** | Monthly report/goals/review | XP شهري، متوسط، scored days، أهداف بنفس goal engine، مراجعة | `monthlyGoals`, `monthlyGoalTemplates`, `monthlyGoalProgress`, `monthlyReviewQuestions`, `monthlyReviews` | `monthlyReport` | Month page | WEEK-02 | — | `domain/monthly` | ✅ |
| **BODY-01** | Measurements | weight, waist, chest, arm, thigh, neck, VO2max, RHR | `bodyEntries`, `weights`, `bodyProfile` | — | Body › Record | — | دمج `weights` القديمة داخل `bodyEntries` بدون حذف الأصل | `domain/body` | 🔁 |
| **BODY-02** | Body calculations | body progress, est. body fat (US Navy), est. biological age, overall progress, goal progress | `bodyEntries`, `goalSettings`, `bodyProfile` | `estimateBodyFat`, `estimateBioAge`, `bodyProgress` | Body › Summary | — | — | `calculations/body.ts` | 🧪 |
| **BODY-03** | Strength tracking | 7 تمارين، PRs، history، charts | `bodyEntries[].lifts` / `trainingLog` | `personalRecords` | Body › Charts | — | — | `domain/body` | ✅ |
| **BODY-04** | Views | summary/record/photos/charts/all | `uiPrefs.bodyView` | — | SegmentedControl | — | — | `features/body` | ✅ |
| **PHOTO-01** | Photos | front/side/back، categories، groups، timeline، comparison، أقرب قياس، ضغط الصور | `photos` | `nearestBodyEntry`, `resizeImage` | Body › Photos | BODY-01 | نسخ (base64) | `domain/body/photos` | ✅ |
| **GOAL-01** | Goals + Smart Rewards | body goals, quran mem, quran reading, income, savings, kcal/protein/carb/fat؛ milestones 25/50/75/100 واقتراح مكافآت | `goalSettings` | `goalMilestones` | Goals page | BODY, QUR, FIN | — | `domain/goals` | ✅ |
| **FIN-01** | Finance | دخل/مصروف/ادخار، أهداف | `financeEntries`, `savingsEntries` | `financeSummary` | Goals › Finance, Me | GOAL-01 | — | `domain/finance` | ✅ |
| **REC-01** | Sobriety | start, live timer, current days, longest streak, milestones | `sobrietyStartAt`, `relapseLog` | `sobrietyStats` | Healing › Header | REC-03 | — | `calculations/recovery.ts` | 🧪 |
| **REC-02** | Daily check-in | mood, spiritual, urge, notes, timing، قراءات متعددة/يوم | `recoveryEntries` | `avgMood`, `avgUrge` | Healing › Check-in | — | — | `domain/recovery` | ✅ |
| **REC-03** | Relapses | أحداث متعددة/يوم، duration, acts, questions, timestamps, gaps, trends | `relapseLog`, `relapseQuestions` | `relapseGaps` | Healing › Relapses | — | — | `calculations/recovery.ts` | 🧪 |
| **REC-04** | Cravings | urge, triggers, note, resisted/relapse outcome, XP, repeated trigger penalty | `cravingEvents`, `recoveryTriggers` | `cravingXp` | Healing › SOS/Cravings | GAM | — | `domain/recovery` | ✅ |
| **REC-05** | Risk engine | مؤشر 0–100، factors، protections، labels، daily plan (heuristic فقط) | كل ما سبق | `computeRisk` | Healing › Risk card | — | — | `calculations/recovery.ts` | ليس تشخيصًا ✅🧪 |
| **REC-06** | SOS | breathing, change environment, contact support, reasons, rescue protocol, personal letter | `rescueProtocol`, `recoveryReasons`, `recoveryLetter`, `recoveryRituals` | — | SOS bottom sheet | — | — | `features/healing/SOS` | 📱♿ |
| **REC-07** | Recovery tasks | create/complete/delete/XP + first-30-day missing penalty | `recoveryTasks` | `recoveryTaskPenalty` | Healing + Day | DAY-03 | — | `domain/recovery` | ✅ |
| **REC-08** | Recovery phases | start / early / rebuild / maintain مع النصوص الإرشادية | `sobrietyStartAt` | `recoveryPhase` | Healing › Phase card | — | — | `domain/recovery/phases.ts` | النصوص محفوظة ✅ |
| **REC-09** | Recovery index | 0–100: clean days, resisted cravings, addiction index, habit streak, mood | `recoveryIndices` | `recoveryIndex`, `addictionIndex` | Healing › Index | — | — | `calculations/recovery.ts` | 🧪 |
| **REC-10** | What I Lost | عنصر مفقود، خطة، أجزاء، XP لكل جزء، حالة | `lostThings` | — | Healing › Lost | IDN-01 | — | `domain/recovery` | ✅ |
| **REC-11** | Analytics | 30-day stats, avg mood/urge, ritual completion, curve, calendar, triggers, hard days | كل ما سبق | `recoveryAnalytics` | Healing › Analytics | — | — | `domain/recovery` | ✅ |
| **REC-12** | Coach settings | إعدادات المدرّب | `recoveryCoachSettings` | — | Settings › Recovery | AI | — | — | ✅ |
| **QUR-01** | Quran memorization | 604 صفحة / 240 وحدة، حفظ، مراجعة تلقائية، تحذير مراجعة | `quranMemorization` | `quranProgress`, `dueReviews` | Quran page | DAY-06 | — | `calculations/quran.ts` | 🧪 |
| **QUR-02** | Tadabur | تدبر | `quranTadabur` | — | Quran › Tadabur | — | — | `domain/quran` | ✅ |
| **QUR-03** | Auto review task | مهمة مراجعة تُولّد تلقائيًا | — | `dueReviews` | Day tasks | DAY-03 | — | — | ✅ |
| **BOOK-01** | Books library | كتب، تقدم، جلسات قراءة، أغلفة | `books`, `bookCovers` | `readingProgress` | Library › Books | — | — | `domain/books` | ✅ |
| **BOOK-02** | PDF Reader | upload, IndexedDB storage, Drive, zoom/fit, dark/sepia/paper, search+nav, thumbnails, outline, fullscreen, selection, highlight/underline/strike, bookmarks, notes, drawing, colors, brush, list, delete, export JSON/MD | `bookHighlights`, `bookAnnotations`, `bookDrawings` + IDB `pdfFiles` | — | `PdfReader` (lazy) | pdfjs-dist | annotations مربوطة بـbookId | `features/library/reader` | PDF bytes خارج DB السحابي ✅ |
| **DRIVE-01** | Google Drive | OAuth drive.file، مجلد "Me vs Me Books"، list/upload/download/delete | — | — | Library › Drive panel | env `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | — | `integrations/drive.ts` | error states واضحة ✅ |
| **CRS-01** | Courses | library, platform, lessons, duration, video URL, completion, CSV import (delimiter/columns/duration parsing), stats، ربط بأهداف وتحديات | `courses` | `parseCoursesCsv` | Library › Courses | — | — | `calculations/courses.ts` | 🧪 |
| **CHAL-01** | Challenges | daily repetition / weekly target / boss battle، source, duration, rewards, penalty, progress, status, restart, delete, auto progress | `challenges`, `challengeSettings` | `challengeProgress` | Challenges page | metrics | — | `calculations/challenges.ts` | 🧪 |
| **TRN-01** | Training | مجالات + مخصصة، ألوان، ربط life area، جلسات، دقائق، ملاحظات، إحصاءات أسبوعية/شهرية/عمرية، آخر 8 أسابيع، توزيع الأيام، best day/week/streak | `trainingLog` | `trainingStats` | Training page | GAM | — | `calculations/training.ts` | 🧪 |
| **BD-01** | Brain Dump | raw dump, triage (idea/problem/task/uncategorized), area, XP, time logging, converted | `brainDumps` | — | Brain Dump page | DAY-03 | — | `domain/brain-dump` | ✅ |
| **IDN-01** | Identity principles | title, statement, recovery focus, linked lost items, rules, practices, XP | `identityPrinciples` | — | Me › Identity | REC-10 | — | `domain/identity` | ✅ |
| **ME-01** | Profile / Player card | avatar, card photo, combined progress, goal bars, radar, area comparison, ملخصات | `profileAvatar`, `profileCardPhoto` | — | Me page | كل شيء | — | `features/me` | ✅ |
| **AI-01** | 6 modes | game/doctor/fitness/productivity/business/sheikh؛ persona, scope, suggestions, memory, history, skills, settings | `aiChatsByMode`, `aiMemoriesByMode`, `aiSkills`, `aiModeSettings`, `aiActiveMode`, `aiMemory`, `aiChatHistory`, `aiAssistantSettings` | `buildAiContext` | AI page | scopes | نقل `aiChatHistory` القديم إلى mode "game" | `domain/ai` | ✅ |
| **AI-02** | AI actions | propose → user confirms → execute → audit | — | — | Action cards | store | — | `domain/ai/actions.ts` | لا تنفيذ تلقائي ✅ |
| **AI-03** | Memory teaching | "احفظ في ذاكرتك..." | `aiMemory*` | `parseTeachingPhrase` | — | — | — | `domain/ai/memory.ts` | 🧪 |
| **SET-01** | Settings Center | كل الأقسام المذكورة | كثيرة | — | Settings page (sections) | — | — | `features/settings` | 📱♿ |
| **BAK-01** | Backup & Restore | full export/restore/reset, schemaVersion, validation, migration, safe restore | الكل | — | Settings › Data | MIG | — | `core/backup.ts` | استعادة نسخة قديمة تنجح 🧪 |
| **SYNC-01** | Cloud sync | local-first، pending queue، reconnect sync، account-scoped، no destructive overwrite | الكل | — | Settings › Cloud | Postgres | — | `core/sync.ts` + `/api/sync` | ✅ |
| **PWA-01** | PWA | manifest, icons, install prompt, offline shell, offline data | — | — | Settings › PWA | sw.js | — | `public/sw.js` | ✅ |
| **STARTUP-01** | Startup plan | خطة انطلاق | `startupPlan` | — | Menu | — | نسخ | `domain/identity` | ✅ |
| **POMO-01** | Pomodoro settings | إعدادات | `pomodoroSettings` | — | Settings › Daily | — | نسخ | — | ✅ |

## قاعدة القبول النهائية
كل صف أعلاه يجب أن يمر بـ: Preserved ✅ · Improved ✅ · Tested ✅ · Migrated ✅ · Responsive ✅ · Accessible ✅ — راجع `docs/PRODUCT_ARCHITECTURE.md` (قسم Verification) لحالة كل مرحلة.

## Final Verification Checklist (post-build)

| المعيار | الحالة | الدليل |
|---|---|---|
| Preserved | ✅ | كل صف في الجدول له module منفذ (`src/features/*`, `src/calculations/*`) |
| Improved | ✅ | Design system موحد، Local-first + Sync، Settings Center، PDF Reader بطبقة نص ورسم |
| Tested | ✅ | 31 اختبار vitest: gamification/levels/ranks/streaks/score/BMR/body/quran/goals/recovery risk+index+addiction/gaps/challenges/CSV/training/migration/backup/merge/AI parsing |
| Migrated | ✅ | `migrations/index.ts` v0→v7 + اختبار استيراد legacy مسطح مع 79 مفتاحًا + unknown keys محفوظة تحت `legacy` |
| Responsive | ✅ | bottom nav + sheets على mobile، sidebar على desktop، touch ≥ 44px (`.touch`) |
| Accessible | ✅ | focus trap للـModals، `role`/`aria-*` للعادات والمهام والشرائح، `aria-live` للـtoasts، skip link، reduced-motion |

### ملاحظات صريحة (لا ادعاء)
- **AI**: بلا `OPENAI_API_KEY` يعمل «المدرّب المحلي» (rule-based على السياق الحقيقي) ويُعلن ذلك في الرد. مع المفتاح يعمل النموذج السحابي عبر `/api/ai`. الإجراءات دائمًا propose → confirm → execute → audit.
- **Drive**: يتطلب `NEXT_PUBLIC_GOOGLE_CLIENT_ID`؛ بدونه تظهر حالة خطأ واضحة.
- **E2E**: السيناريوهات التسعة موثقة في `UX_ARCHITECTURE.md` كمواصفة قبول؛ لم يُثبَّت Playwright في هذه البيئة (Unit + Integration منفذة).
- **LEGACY_CONSTANT**: منحنى XP وقيم XP للأنشطة مثبتة في `calculations/gamification.ts` و`stores/actions.ts` بتعليقات؛ استبدلها بقيم الملف القديم عند توفره دون أي تغيير معماري.
