// ─────────────────────────────────────────────────────────────────────────────
// AppData — كل الـentities. المفاتيح مطابقة لأسماء legacy storage keys عمدًا
// حتى يكون الاستيراد/التصدير/المزامنة generic بلا تحويل مدمّر.
// ─────────────────────────────────────────────────────────────────────────────

export type AreaId = "physical" | "mental" | "deen" | "academic" | "career" | "creativity";
export const AREAS: { id: AreaId; label: string; color: string; emoji: string }[] = [
  { id: "physical", label: "الجسد", color: "#f97316", emoji: "🏋️" },
  { id: "mental", label: "العقل", color: "#8b5cf6", emoji: "🧠" },
  { id: "deen", label: "الدين", color: "#10b981", emoji: "🕌" },
  { id: "academic", label: "الدراسة", color: "#3b82f6", emoji: "📚" },
  { id: "career", label: "المهنة", color: "#eab308", emoji: "💼" },
  { id: "creativity", label: "الإبداع", color: "#ec4899", emoji: "🎨" },
];

export type TaskSource = "custom" | "weekly" | "recovery" | "quran" | "carried" | "brain-dump" | "ai";
export interface Task {
  id: string;
  title: string;
  area: AreaId;
  difficulty: 1 | 2 | 3 | 4 | 5;
  xp: number;
  metrics: string[];
  done: boolean;
  doneAt?: string;
  source: TaskSource;
  carriedFrom?: string;
  planId?: string;
  recoveryTaskId?: string;
  createdAt: string;
}
export interface MealLog { id: string; name: string; kcal: number; protein: number; carbs: number; fat: number }
export interface SinLog { id: string; name: string; lesson: string; at: string }
export interface IdeaWork { ideaId: string; minutes: number; at: string }

export interface DayEntry {
  date: string;
  habits: Record<string, boolean>;
  tasks: Task[];
  gym: boolean;
  runKm: number;
  caloriesBurned: number | null;
  caloriesEaten: number;
  protein: number;
  carbs: number;
  fat: number;
  meals: MealLog[];
  quranMemPages: number;
  quranReadPages: number;
  shariaLessons: number;
  dhikr: Record<string, number>;
  sins: SinLog[];
  ideaWork: IdeaWork[];
  note: string;
  closed: boolean;
  closedAt?: string;
  shutdownStep: number;
  xpAwarded: Record<string, number>;
  score?: number;
}

export interface Habit {
  id: string;
  name: string;
  area: AreaId;
  days: number[]; // 0=Sun .. 6=Sat (أيام الاستحقاق)
  optionalDays: number[];
  enabled: boolean;
  metric?: string;
  quranMode?: "new" | "review";
  custom: boolean;
  xp: number;
  emoji?: string;
}

export interface MealLibraryItem { id: string; name: string; kcal: number; protein: number; carbs: number; fat: number }
export interface DhikrItem { id: string; text: string; target: number; xp: number }
export interface SinLibraryItem { id: string; name: string }
export interface ProjectIdea { id: string; title: string; area: AreaId; createdAt: string; history: { date: string; minutes: number }[] }
export interface ReviewQuestion { id: string; text: string }
export interface Review { periodKey: string; answers: Record<string, string>; score?: number; at: string }
export interface Reflection { id: string; date: string; text: string }
export interface BonusQuest { id: string; title: string; xp: number; area: AreaId; enabled: boolean }
export interface HabitMiss { id: string; date: string; habitId: string; penalty: number }

export type GoalKind = "recurring" | "manual" | "milestone" | "percentage";
export interface Goal {
  id: string;
  title: string;
  kind: GoalKind;
  metric?: string;
  goalRef?: string; // percentage-of-goal: مفتاح داخل goalSettings
  target: number;
  unit: string;
  area: AreaId;
  period: "week" | "month";
  periodKey: string;
  carried: boolean;
  carriedFrom?: string;
  done: boolean;
  doneAt?: string;
  templateId?: string;
  xp: number;
  manualValue?: number;
}
export type GoalTemplate = Omit<Goal, "periodKey" | "carried" | "done" | "doneAt" | "manualValue">;
export interface PlannedTask { id: string; title: string; area: AreaId; difficulty: 1 | 2 | 3 | 4 | 5; metrics: string[] }
export type WeeklyPlans = Record<string, Record<string, PlannedTask[]>>; // weekKey → date → tasks

export type LiftId = "bench" | "latPulldown" | "preacherCurl" | "tricepPushdown" | "frontRaise" | "lateralRaise" | "rearDeltFly";
export const LIFTS: { id: LiftId; label: string }[] = [
  { id: "bench", label: "Bench Press" },
  { id: "latPulldown", label: "Lat Pulldown" },
  { id: "preacherCurl", label: "Preacher Curl" },
  { id: "tricepPushdown", label: "Tricep Pushdown" },
  { id: "frontRaise", label: "Front Delt Raise" },
  { id: "lateralRaise", label: "Lateral Delt Raise" },
  { id: "rearDeltFly", label: "Rear Delt Fly" },
];
export interface BodyEntry {
  id: string; date: string;
  weight?: number; waist?: number; chest?: number; arm?: number; thigh?: number; neck?: number; vo2max?: number; rhr?: number;
  lifts?: Partial<Record<LiftId, { weight: number; reps: number }>>;
}
export interface WeightEntry { date: string; weight: number }
export interface BodyProfile { heightCm: number; sex: "male" | "female"; birthYear: number; activity: number; name?: string }
export interface Photo { id: string; date: string; angle: "front" | "side" | "back"; category: string; group: string; dataUrl: string }

export interface GoalSettings {
  weightGoal?: number; waistGoal?: number; chestGoal?: number; armGoal?: number; thighGoal?: number; bodyFatGoal?: number; vo2maxGoal?: number; rhrGoal?: number;
  quranMemGoalPages: number; quranReadGoalPages: number;
  incomeGoal: number; savingsGoal: number;
  calorieTarget: number; proteinTarget: number; carbTarget: number; fatTarget: number;
  areaWeights: Record<AreaId, number>;
  rewards: Record<string, Partial<Record<"25" | "50" | "75" | "100", string>>>;
  rewardsClaimed: string[];
}
export interface FinanceEntry { id: string; date: string; type: "income" | "expense"; amount: number; category: string; note: string }
export interface SavingsEntry { id: string; date: string; amount: number; note: string }

export interface RecoveryEntry { id: string; date: string; at: string; mood: number; spiritual: number; urge: number; note: string; timing: "morning" | "evening" | "other"; ritualsDone: string[] }
export interface RelapseEvent { id: string; date: string; at: string; durationMin: number; acts: string[]; answers: Record<string, string> }
export interface CravingEvent { id: string; date: string; at: string; urge: number; triggers: string[]; note: string; outcome: "resisted" | "relapse"; xp: number }
export interface RecoveryTask { id: string; title: string; date: string; done: boolean; doneAt?: string; xp: number }
export interface Trigger { id: string; name: string }
export interface Ritual { id: string; name: string; when: "morning" | "evening" | "any" }
export interface RescueProtocol { steps: string[]; supportContact: string; updatedAt?: string }
export interface Reason { id: string; text: string }
export interface Letter { text: string; updatedAt: string }
export interface LostPart { id: string; title: string; xp: number; status: "todo" | "working" | "recovered" }
export interface LostThing { id: string; title: string; plan: string; parts: LostPart[]; createdAt: string }
export interface RecoveryIndexSnapshot { date: string; value: number; risk: number }
export interface RecoveryCoachSettings { tone: "gentle" | "firm"; dailyReminder: boolean; showRisk: boolean }

export interface QuranPageState { memorizedAt: string; lastReviewAt: string; reviews: number }
export interface QuranMemorization { pages: Record<string, QuranPageState>; reviewIntervalDays: number }
export interface QuranTadabur { id: string; date: string; ref: string; text: string }

export interface ReadingSession { id: string; date: string; from: number; to: number; minutes: number }
export interface Book { id: string; title: string; author: string; pages: number; currentPage: number; storage: "idb" | "drive" | "none"; driveFileId?: string; sessions: ReadingSession[]; addedAt: string; finishedAt?: string }
export type AnnotationType = "highlight" | "underline" | "strike" | "note" | "bookmark" | "drawing";
export interface Annotation { id: string; bookId: string; page: number; type: AnnotationType; color: string; text?: string; rects?: { x: number; y: number; w: number; h: number }[]; paths?: { x: number; y: number }[][]; width?: number; createdAt: string }
export interface Lesson { id: string; title: string; durationMin: number; videoUrl: string; done: boolean; doneAt?: string }
export interface Course { id: string; title: string; platform: string; lessons: Lesson[]; addedAt: string; area: AreaId }

export type ChallengeType = "daily" | "weekly" | "boss";
export interface Challenge {
  id: string; title: string; type: ChallengeType; source: string; // 'manual' | metricId | 'course:<id>'
  target: number; durationDays: number; startDate: string;
  dailyReward: number; successReward: number; failurePenalty: number;
  progress: Record<string, number>; status: "active" | "success" | "failed"; finishedAt?: string; area: AreaId;
}
export interface ChallengeSettings { autoProgress: boolean; notify: boolean }

export interface TrainingArea { id: string; name: string; color: string; lifeArea: AreaId; custom: boolean }
export interface TrainingSession { id: string; date: string; areaId: string; minutes: number; note: string; xp: number }
export interface TrainingLog { areas: TrainingArea[]; sessions: TrainingSession[] }

export type DumpKind = "idea" | "problem" | "task" | "uncategorized";
export interface BrainDump { id: string; at: string; date: string; text: string; kind: DumpKind; area?: AreaId; minutes?: number; processed: boolean; convertedTo?: string }

export interface Practice { id: string; title: string; xp: number; log: string[] }
export interface IdentityPrinciple { id: string; title: string; statement: string; recoveryFocus: string; lostItemIds: string[]; rules: string[]; practices: Practice[] }
export interface StartupPlan { steps: { id: string; text: string; done: boolean }[]; updatedAt: string }

export type AiMode = "game" | "doctor" | "fitness" | "productivity" | "business" | "sheikh";
export interface AiAction { id: string; type: string; label: string; payload: Record<string, unknown>; status: "proposed" | "confirmed" | "rejected" | "executed" | "failed"; result?: string }
export interface AiMessage { id: string; role: "user" | "assistant"; content: string; at: string; actions?: AiAction[] }
export interface AiMemory { id: string; text: string; createdAt: string; source: "taught" | "learned" }
export interface AiSkill { id: string; name: string; prompt: string; modes: AiMode[] }
export interface AiModeSetting { enabled: boolean; scopes: string[]; customPersona?: string }
export interface AiAssistantSettings { provider: "auto" | "local"; model: string; temperature: number }

export interface XpEvent { id: string; at: string; date: string; amount: number; source: string; label: string; ref?: string; area?: AreaId }
export interface CelebrationState { lastLevelCelebrated: number; milestonesSeen: string[] }
export interface UiPrefs { theme: "dark" | "light" | "system"; bodyView: string; compact: boolean; onboarded: boolean; lastRoute?: string; notifications: boolean; libraryTab?: string; reader: { mode: "light" | "dark" | "sepia" | "paper"; zoom: number; fit: "width" | "page" | "none" } }
export interface PomodoroSettings { work: number; short: number; long: number; rounds: number }
export interface DayMessage { date: string; text: string }
export interface StreakSettings { bonusEveryDays: number; bonusXp: number; missPenalty: number; fixedHabits: Record<string, { enabled: boolean; days: number[] }> }

export interface AppMeta { schemaVersion: number; updatedAt: Record<string, number>; accountId: string; accountCode: string; lastSyncAt?: number; deviceId: string }

export interface AppData {
  entries: Record<string, DayEntry>;
  photos: Photo[];
  weights: WeightEntry[];
  reflections: Reflection[];
  bodyEntries: BodyEntry[];
  financeEntries: FinanceEntry[];
  savingsEntries: SavingsEntry[];
  goalSettings: GoalSettings;
  projectIdeas: ProjectIdea[];
  profileAvatar: string;
  profileCardPhoto: string;
  bonusQuests: BonusQuest[];
  habitMisses: HabitMiss[];
  mealLibrary: MealLibraryItem[];
  dhikrLibrary: DhikrItem[];
  sinLibrary: SinLibraryItem[];
  recoveryEntries: RecoveryEntry[];
  recoveryTriggers: Trigger[];
  recoveryRituals: Ritual[];
  rescueProtocol: RescueProtocol;
  streakSettings: StreakSettings;
  customStreakHabits: Habit[];
  streakHabitOrder: string[];
  streakHabitEdits: Record<string, Partial<Habit>>;
  habits: Habit[]; // unified (v2)
  recoveryReasons: Reason[];
  recoveryLetter: Letter;
  cravingEvents: CravingEvent[];
  recoveryTasks: RecoveryTask[];
  sobrietyStartAt: string | null;
  recoveryCoachSettings: RecoveryCoachSettings;
  weeklyGoalTemplates: GoalTemplate[];
  weeklyGoals: Goal[];
  weeklyGoalProgress: Record<string, Record<string, { value: number; done: boolean }>>;
  weeklyReviewQuestions: ReviewQuestion[];
  weeklyReviews: Review[];
  pomodoroSettings: PomodoroSettings;
  dailyReviewQuestions: ReviewQuestion[];
  dailyReviews: Review[];
  books: Book[];
  courses: Course[];
  bookCovers: Record<string, string>;
  monthlyGoals: Goal[];
  monthlyReviewQuestions: ReviewQuestion[];
  monthlyReviews: Review[];
  brainDumps: BrainDump[];
  morningRecoveryQuestions: ReviewQuestion[];
  morningReviews: Review[];
  xpLog: XpEvent[];
  bookHighlights: Annotation[];
  bookDrawings: Annotation[];
  bookAnnotations: Annotation[];
  identityPrinciples: IdentityPrinciple[];
  quranMemorization: QuranMemorization;
  quranTadabur: QuranTadabur[];
  monthlyGoalTemplates: GoalTemplate[];
  monthlyGoalProgress: Record<string, Record<string, { value: number; done: boolean }>>;
  trainingLog: TrainingLog;
  uiPrefs: UiPrefs;
  dayMessages: DayMessage[];
  lostThings: LostThing[];
  bodyProfile: BodyProfile;
  aiMemory: AiMemory[];
  aiChatHistory: AiMessage[];
  aiAssistantSettings: AiAssistantSettings;
  aiChatsByMode: Record<AiMode, AiMessage[]>;
  aiMemoriesByMode: Record<AiMode | "global", AiMemory[]>;
  aiSkills: AiSkill[];
  aiModeSettings: Record<AiMode, AiModeSetting>;
  aiActiveMode: AiMode;
  celebrationState: CelebrationState;
  startupPlan: StartupPlan;
  relapseLog: RelapseEvent[];
  relapseQuestions: ReviewQuestion[];
  recoveryIndices: RecoveryIndexSnapshot[];
  weeklyPlans: WeeklyPlans;
  challenges: Challenge[];
  challengeSettings: ChallengeSettings;
  legacy: Record<string, unknown>;
}
export type AppDataKey = keyof AppData;

export const AI_MODES: AiMode[] = ["game", "doctor", "fitness", "productivity", "business", "sheikh"];

const q = (id: string, text: string): ReviewQuestion => ({ id, text });

export const FIXED_HABITS: Habit[] = [
  { id: "fajr", name: "صلاة الفجر في وقتها", area: "deen", days: [0, 1, 2, 3, 4, 5, 6], optionalDays: [], enabled: true, custom: false, xp: 10, emoji: "🌅" },
  { id: "quran", name: "ورد القرآن", area: "deen", days: [0, 1, 2, 3, 4, 5, 6], optionalDays: [], enabled: true, custom: false, xp: 10, metric: "quranMemPages", quranMode: "new", emoji: "📖" },
  { id: "dhikr", name: "أذكار الصباح والمساء", area: "deen", days: [0, 1, 2, 3, 4, 5, 6], optionalDays: [], enabled: true, custom: false, xp: 5, metric: "dhikrCount", emoji: "📿" },
  { id: "gym", name: "تمرين", area: "physical", days: [6, 1, 3], optionalDays: [0, 2, 4], enabled: true, custom: false, xp: 15, metric: "gymSessions", emoji: "🏋️" },
  { id: "run", name: "جري", area: "physical", days: [0, 2, 4], optionalDays: [6, 1, 3], enabled: true, custom: false, xp: 10, metric: "runKm", emoji: "🏃" },
  { id: "read", name: "قراءة 20 دقيقة", area: "mental", days: [0, 1, 2, 3, 4, 5, 6], optionalDays: [], enabled: true, custom: false, xp: 8, metric: "readingMinutes", emoji: "📚" },
  { id: "study", name: "مذاكرة/دراسة", area: "academic", days: [6, 0, 1, 2, 3], optionalDays: [4, 5], enabled: true, custom: false, xp: 10, metric: "courseLessons", emoji: "🎓" },
  { id: "deepwork", name: "عمل عميق 90 دقيقة", area: "career", days: [6, 0, 1, 2, 3], optionalDays: [4, 5], enabled: true, custom: false, xp: 12, metric: "trainingMinutes", emoji: "💼" },
  { id: "create", name: "إبداع/مشروع", area: "creativity", days: [1, 3, 5], optionalDays: [6, 0, 2, 4], enabled: true, custom: false, xp: 8, metric: "ideaMinutes", emoji: "🎨" },
  { id: "sleep", name: "نوم قبل 12", area: "physical", days: [0, 1, 2, 3, 4, 5, 6], optionalDays: [], enabled: true, custom: false, xp: 5, emoji: "😴" },
  { id: "noscreen", name: "بلا شاشات قبل النوم", area: "mental", days: [0, 1, 2, 3, 4, 5, 6], optionalDays: [], enabled: true, custom: false, xp: 5, emoji: "📵" },
];

export function defaultAppData(): AppData {
  const areaWeights: Record<AreaId, number> = { physical: 1, mental: 1, deen: 1, academic: 1, career: 1, creativity: 1 };
  const emptyModes = <T,>(v: () => T) => ({ game: v(), doctor: v(), fitness: v(), productivity: v(), business: v(), sheikh: v() });
  return {
    entries: {},
    photos: [],
    weights: [],
    reflections: [],
    bodyEntries: [],
    financeEntries: [],
    savingsEntries: [],
    goalSettings: { quranMemGoalPages: 604, quranReadGoalPages: 604, incomeGoal: 0, savingsGoal: 0, calorieTarget: 2200, proteinTarget: 150, carbTarget: 250, fatTarget: 70, areaWeights, rewards: {}, rewardsClaimed: [] },
    projectIdeas: [],
    profileAvatar: "",
    profileCardPhoto: "",
    bonusQuests: [
      { id: "bq1", title: "مساعدة شخص اليوم", xp: 10, area: "deen", enabled: true },
      { id: "bq2", title: "10 دقائق تأمل/تنفس", xp: 5, area: "mental", enabled: true },
    ],
    habitMisses: [],
    mealLibrary: [
      { id: "m1", name: "بيض (3) + خبز", kcal: 420, protein: 24, carbs: 30, fat: 22 },
      { id: "m2", name: "صدر دجاج + أرز", kcal: 650, protein: 45, carbs: 70, fat: 14 },
      { id: "m3", name: "شوفان + حليب", kcal: 380, protein: 16, carbs: 55, fat: 9 },
    ],
    dhikrLibrary: [
      { id: "d1", text: "سبحان الله وبحمده", target: 100, xp: 5 },
      { id: "d2", text: "أستغفر الله", target: 100, xp: 5 },
      { id: "d3", text: "لا إله إلا الله", target: 100, xp: 5 },
      { id: "d4", text: "الصلاة على النبي ﷺ", target: 100, xp: 5 },
    ],
    sinLibrary: [{ id: "s1", name: "غيبة" }, { id: "s2", name: "تأخير صلاة" }, { id: "s3", name: "نظر محرم" }, { id: "s4", name: "كذب" }],
    recoveryEntries: [],
    recoveryTriggers: [{ id: "t1", name: "الوحدة" }, { id: "t2", name: "الملل" }, { id: "t3", name: "السهر" }, { id: "t4", name: "التوتر" }, { id: "t5", name: "الجوال في السرير" }],
    recoveryRituals: [{ id: "r1", name: "أذكار الصباح", when: "morning" }, { id: "r2", name: "مراجعة الأسباب", when: "morning" }, { id: "r3", name: "إغلاق الجوال قبل النوم", when: "evening" }],
    rescueProtocol: { steps: ["قم من مكانك فورًا", "توضأ", "اتصل/راسل شخص الدعم", "اخرج من الغرفة 10 دقائق", "اقرأ رسالتك لنفسك"], supportContact: "" },
    streakSettings: { bonusEveryDays: 7, bonusXp: 15, missPenalty: 5, fixedHabits: {} },
    customStreakHabits: [],
    streakHabitOrder: [],
    streakHabitEdits: {},
    habits: FIXED_HABITS.map((h) => ({ ...h })),
    recoveryReasons: [],
    recoveryLetter: { text: "", updatedAt: "" },
    cravingEvents: [],
    recoveryTasks: [],
    sobrietyStartAt: null,
    recoveryCoachSettings: { tone: "gentle", dailyReminder: true, showRisk: true },
    weeklyGoalTemplates: [],
    weeklyGoals: [],
    weeklyGoalProgress: {},
    weeklyReviewQuestions: [q("w1", "ما أكبر انتصار هذا الأسبوع؟"), q("w2", "ما الذي عطّلني؟"), q("w3", "ما الشيء الواحد الذي سأغيره الأسبوع القادم؟")],
    weeklyReviews: [],
    pomodoroSettings: { work: 25, short: 5, long: 15, rounds: 4 },
    dailyReviewQuestions: [q("d1", "ما أفضل شيء فعلته اليوم؟"), q("d2", "أين ضعفت؟ ولماذا؟"), q("d3", "ما الشيء الواحد الأهم غدًا؟")],
    dailyReviews: [],
    books: [],
    courses: [],
    bookCovers: {},
    monthlyGoals: [],
    monthlyReviewQuestions: [q("m1", "ما الذي أفخر به هذا الشهر؟"), q("m2", "ما النمط المتكرر الذي لاحظته؟"), q("m3", "ما هدف الشهر القادم الأهم؟")],
    monthlyReviews: [],
    brainDumps: [],
    morningRecoveryQuestions: [q("mr1", "كيف حال قلبي هذا الصباح؟"), q("mr2", "ما الموقف الذي قد يعرّضني للخطر اليوم؟"), q("mr3", "ما خطتي لو جاءت الرغبة؟")],
    morningReviews: [],
    xpLog: [],
    bookHighlights: [],
    bookDrawings: [],
    bookAnnotations: [],
    identityPrinciples: [],
    quranMemorization: { pages: {}, reviewIntervalDays: 7 },
    quranTadabur: [],
    monthlyGoalTemplates: [],
    monthlyGoalProgress: {},
    trainingLog: {
      areas: [
        { id: "ta1", name: "برمجة", color: "#3b82f6", lifeArea: "career", custom: false },
        { id: "ta2", name: "لغة", color: "#10b981", lifeArea: "academic", custom: false },
        { id: "ta3", name: "كتابة", color: "#ec4899", lifeArea: "creativity", custom: false },
      ],
      sessions: [],
    },
    uiPrefs: { theme: "system", bodyView: "summary", compact: false, onboarded: false, notifications: false, reader: { mode: "dark", zoom: 1, fit: "width" } },
    dayMessages: [],
    lostThings: [],
    bodyProfile: { heightCm: 175, sex: "male", birthYear: 2000, activity: 1.4 },
    aiMemory: [],
    aiChatHistory: [],
    aiAssistantSettings: { provider: "auto", model: "gpt-4o-mini", temperature: 0.6 },
    aiChatsByMode: emptyModes<AiMessage[]>(() => []),
    aiMemoriesByMode: { ...emptyModes<AiMemory[]>(() => []), global: [] },
    aiSkills: [],
    aiModeSettings: {
      game: { enabled: true, scopes: ["daily", "weekly"] },
      doctor: { enabled: true, scopes: ["recovery", "body"] },
      fitness: { enabled: true, scopes: ["body", "daily"] },
      productivity: { enabled: true, scopes: ["daily", "weekly", "books"] },
      business: { enabled: true, scopes: ["finance", "weekly"] },
      sheikh: { enabled: true, scopes: ["faith", "recovery"] },
    },
    aiActiveMode: "game",
    celebrationState: { lastLevelCelebrated: 1, milestonesSeen: [] },
    startupPlan: { steps: [], updatedAt: "" },
    relapseLog: [],
    relapseQuestions: [q("r1", "ماذا حدث قبلها بساعة؟"), q("r2", "ما الشعور الذي كنت أهرب منه؟"), q("r3", "ما الذي كان سيمنعها؟")],
    recoveryIndices: [],
    weeklyPlans: {},
    challenges: [],
    challengeSettings: { autoProgress: true, notify: false },
    legacy: {},
  };
}

export const APP_DATA_KEYS = Object.keys(defaultAppData()) as AppDataKey[];
export const LEGACY_KEYS = [
  "entries","photos","weights","reflections","bodyEntries","financeEntries","savingsEntries","goalSettings","projectIdeas","profileAvatar","profileCardPhoto","bonusQuests","habitMisses","mealLibrary","dhikrLibrary","recoveryEntries","recoveryTriggers","recoveryRituals","rescueProtocol","streakSettings","customStreakHabits","streakHabitOrder","streakHabitEdits","recoveryReasons","recoveryLetter","cravingEvents","recoveryTasks","sobrietyStartAt","recoveryCoachSettings","weeklyGoalTemplates","weeklyGoals","weeklyGoalProgress","weeklyReviewQuestions","weeklyReviews","pomodoroSettings","dailyReviewQuestions","dailyReviews","books","courses","bookCovers","monthlyGoals","monthlyReviewQuestions","monthlyReviews","brainDumps","morningRecoveryQuestions","morningReviews","xpLog","bookHighlights","bookDrawings","bookAnnotations","identityPrinciples","quranMemorization","quranTadabur","monthlyGoalTemplates","monthlyGoalProgress","trainingLog","uiPrefs","dayMessages","lostThings","bodyProfile","aiMemory","aiChatHistory","aiAssistantSettings","aiChatsByMode","aiMemoriesByMode","aiSkills","aiModeSettings","aiActiveMode","celebrationState","startupPlan","relapseLog","relapseQuestions","recoveryIndices","weeklyPlans","challenges","challengeSettings",
] as const;
