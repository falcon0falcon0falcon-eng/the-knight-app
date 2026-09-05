"use client";
import { useApp } from "./app-store";
import { AreaId, Annotation, Book, BrainDump, Challenge, Course, CravingEvent, DayEntry, Goal, GoalTemplate, Habit, IdentityPrinciple, LostThing, PlannedTask, RecoveryEntry, RecoveryTask, RelapseEvent, Task, TrainingSession } from "@/types/app-data";
import { emptyEntry, habitStreak, habitDueState } from "@/calculations/daily";
import { streakBonusXp, taskXp } from "@/calculations/gamification";
import { cravingXp, recoveryIndex, computeRisk } from "@/calculations/recovery";
import { trainingSessionXp } from "@/calculations/training";
import { resolveChallengeStatus } from "@/calculations/challenges";
import { nowISO, todayISO, uid, weekKey } from "@/core/date";

const S = () => useApp.getState();
export const updateEntry = (date: string, fn: (e: DayEntry) => DayEntry) => S().update("entries", (all) => ({ ...all, [date]: fn(all[date] ?? emptyEntry(date)) }));

// ─── Day ─────────────────────────────────────────────────────────────────────
export const dayActions = {
  toggleHabit(date: string, h: Habit) {
    const st = S(); const cur = !!st.data.entries[date]?.habits?.[h.id]; const next = !cur;
    updateEntry(date, (e) => ({ ...e, habits: { ...e.habits, [h.id]: next } }));
    const ref = `${date}:habit:${h.id}`;
    if (next) { st.awardXp(ref, h.xp, h.name, "habit", h.area, date); const streak = habitStreak(useApp.getState().data, h, date); const bonus = streakBonusXp(streak, st.data.streakSettings.bonusEveryDays, st.data.streakSettings.bonusXp); if (bonus) st.awardXp(`${ref}:streak${streak}`, bonus, `سلسلة ${streak} يوم · ${h.name}`, "streak", h.area, date); }
    else { st.revokeXp(ref); useApp.getState().update("xpLog", (l) => l.filter((e) => !e.ref?.startsWith(`${ref}:streak`))); }
    // إزالة أي miss مسجل
    if (next) st.update("habitMisses", (m) => m.filter((x) => !(x.date === date && x.habitId === h.id)));
  },
  addTask(date: string, t: { title: string; area: AreaId; difficulty: 1 | 2 | 3 | 4 | 5; metrics?: string[]; source?: Task["source"] }) {
    const task: Task = { id: uid("task"), title: t.title, area: t.area, difficulty: t.difficulty, xp: taskXp(t.difficulty), metrics: t.metrics ?? [], done: false, source: t.source ?? "custom", createdAt: nowISO() };
    updateEntry(date, (e) => ({ ...e, tasks: [...e.tasks, task] })); return task;
  },
  /** يُجسّد مهمة مشتقة (weekly/carried/recovery/quran) في اليوم إن لم تكن مخزنة */
  materialize(date: string, t: Task) { updateEntry(date, (e) => (e.tasks.some((x) => x.id === t.id) ? e : { ...e, tasks: [...e.tasks, t] })); },
  toggleTask(date: string, t: Task) {
    const st = S(); const done = !t.done; dayActions.materialize(date, t);
    updateEntry(date, (e) => ({ ...e, tasks: e.tasks.map((x) => (x.id === t.id ? { ...x, done, doneAt: done ? nowISO() : undefined } : x)) }));
    if (t.recoveryTaskId) st.update("recoveryTasks", (r) => r.map((x) => (x.id === t.recoveryTaskId ? { ...x, done, doneAt: done ? nowISO() : undefined } : x)));
    const xp = t.xp || taskXp(t.difficulty); const ref = `${date}:task:${t.carriedFrom ?? t.planId ?? t.id}`;
    if (done) st.awardXp(ref, xp, t.title, t.source === "recovery" ? "recovery-task" : "task", t.area, date); else st.revokeXp(ref);
  },
  deleteTask(date: string, id: string) { updateEntry(date, (e) => ({ ...e, tasks: e.tasks.filter((x) => x.id !== id) })); S().revokeXp(`${S().selectedDate}:task:${id}`); },
  setField<K extends keyof DayEntry>(date: string, key: K, value: DayEntry[K]) { updateEntry(date, (e) => ({ ...e, [key]: value })); },
  toggleGym(date: string) { const st = S(); const cur = !!st.data.entries[date]?.gym; updateEntry(date, (e) => ({ ...e, gym: !cur })); if (!cur) st.awardXp(`${date}:gym`, 15, "جلسة جيم", "physical", "physical", date); else st.revokeXp(`${date}:gym`); },
  addMeal(date: string, m: { name: string; kcal: number; protein: number; carbs: number; fat: number }) { updateEntry(date, (e) => ({ ...e, meals: [...e.meals, { id: uid("meal"), ...m }], caloriesEaten: e.caloriesEaten + m.kcal, protein: e.protein + m.protein, carbs: e.carbs + m.carbs, fat: e.fat + m.fat })); },
  removeMeal(date: string, id: string) { updateEntry(date, (e) => { const m = e.meals.find((x) => x.id === id); if (!m) return e; return { ...e, meals: e.meals.filter((x) => x.id !== id), caloriesEaten: Math.max(0, e.caloriesEaten - m.kcal), protein: Math.max(0, e.protein - m.protein), carbs: Math.max(0, e.carbs - m.carbs), fat: Math.max(0, e.fat - m.fat) }; }); },
  incDhikr(date: string, id: string, by: number) {
    const st = S(); const item = st.data.dhikrLibrary.find((d) => d.id === id); if (!item) return;
    const before = st.data.entries[date]?.dhikr?.[id] ?? 0; const after = Math.max(0, before + by);
    updateEntry(date, (e) => ({ ...e, dhikr: { ...e.dhikr, [id]: after } }));
    if (before < item.target && after >= item.target) st.awardXp(`${date}:dhikr:${id}`, item.xp, item.text, "dhikr", "deen", date); if (after < item.target) st.revokeXp(`${date}:dhikr:${id}`);
  },
  setQuran(date: string, field: "quranMemPages" | "quranReadPages" | "shariaLessons", value: number) {
    const st = S(); updateEntry(date, (e) => ({ ...e, [field]: value })); const ref = `${date}:${field}`; st.revokeXp(ref);
    const xp = field === "quranMemPages" ? value * 20 : field === "quranReadPages" ? value * 3 : value * 10; if (xp > 0) st.awardXp(ref, xp, { quranMemPages: "حفظ قرآن", quranReadPages: "قراءة قرآن", shariaLessons: "درس شرعي" }[field], "deen", "deen", date);
  },
  addSin(date: string, name: string, lesson: string) { updateEntry(date, (e) => ({ ...e, sins: [...e.sins, { id: uid("sin"), name, lesson, at: nowISO() }] })); S().awardXp(`${date}:sin:${Date.now()}`, 3, "درس من زلة (وعي)", "deen", "deen", date); },
  addIdeaMinutes(date: string, ideaId: string, minutes: number) {
    const st = S(); updateEntry(date, (e) => ({ ...e, ideaWork: [...e.ideaWork, { ideaId, minutes, at: nowISO() }] }));
    st.update("projectIdeas", (xs) => xs.map((i) => (i.id === ideaId ? { ...i, history: [...i.history, { date, minutes }] } : i)));
    st.awardXp(`${date}:idea:${ideaId}:${Date.now()}`, Math.max(2, Math.round(minutes / 10)), "عمل على فكرة", "creativity", "creativity", date);
  },
  addIdea(title: string, area: AreaId = "creativity") { S().update("projectIdeas", (xs) => [...xs, { id: uid("idea"), title, area, createdAt: nowISO(), history: [] }]); },
  saveDailyReview(date: string, answers: Record<string, string>) { S().update("dailyReviews", (r) => [...r.filter((x) => x.periodKey !== date), { periodKey: date, answers, at: nowISO() }]); },
  closeDay(date: string, score: number) {
    const st = S(); updateEntry(date, (e) => ({ ...e, closed: true, closedAt: nowISO(), score, shutdownStep: 5 }));
    st.awardXp(`${date}:close`, 10 + Math.round(score / 10), `إغلاق اليوم (${score}%)`, "shutdown", undefined, date);
    // عقوبات العادات المطلوبة الفائتة
    const data = useApp.getState().data; const misses = data.habits.filter((h) => h.enabled && habitDueState(h, date) === "required" && !data.entries[date]?.habits?.[h.id]);
    if (misses.length) { st.update("habitMisses", (m) => [...m.filter((x) => x.date !== date), ...misses.map((h) => ({ id: `miss_${date}_${h.id}`, date, habitId: h.id, penalty: data.streakSettings.missPenalty }))]); st.awardXp(`${date}:misses`, -data.streakSettings.missPenalty * misses.length, `عادات فائتة (${misses.length})`, "penalty", undefined, date); }
    // snapshot مؤشر التعافي
    if (data.sobrietyStartAt) { const idx = recoveryIndex(data, date); const risk = computeRisk(data, date); st.update("recoveryIndices", (r) => [...r.filter((x) => x.date !== date), { date, value: idx.value, risk: risk.score }]); }
    // تحديث حالة التحديات تلقائيًا
    challengeActions.refreshStatuses();
  },
  reopenDay(date: string) { updateEntry(date, (e) => ({ ...e, closed: false, shutdownStep: 0 })); },
};

// ─── Habits settings ─────────────────────────────────────────────────────────
export const habitActions = {
  add(h: Omit<Habit, "id" | "custom">) { S().update("habits", (xs) => [...xs, { ...h, id: uid("habit"), custom: true }]); },
  edit(id: string, p: Partial<Habit>) { S().update("habits", (xs) => xs.map((h) => (h.id === id ? { ...h, ...p } : h))); S().update("streakHabitEdits", (e) => ({ ...e, [id]: { ...(e[id] ?? {}), ...p } })); },
  remove(id: string) { S().update("habits", (xs) => xs.filter((h) => h.id !== id || !h.custom)); },
  move(id: string, dir: -1 | 1) { S().update("habits", (xs) => { const i = xs.findIndex((h) => h.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= xs.length) return xs; const c = [...xs]; [c[i], c[j]] = [c[j], c[i]]; return c; }); S().update("streakHabitOrder", () => useApp.getState().data.habits.map((h) => h.id)); },
};

// ─── Goals (week/month) ──────────────────────────────────────────────────────
export const goalActions = {
  key: (p: "week" | "month"): "weeklyGoals" | "monthlyGoals" => (p === "week" ? "weeklyGoals" : "monthlyGoals"),
  tkey: (p: "week" | "month"): "weeklyGoalTemplates" | "monthlyGoalTemplates" => (p === "week" ? "weeklyGoalTemplates" : "monthlyGoalTemplates"),
  add(g: Omit<Goal, "id" | "done" | "carried">) { S().update(goalActions.key(g.period), (xs) => [...xs, { ...g, id: uid("goal"), done: false, carried: false }]); },
  setAll(period: "week" | "month", goals: Goal[]) { S().update(goalActions.key(period), (xs) => { const others = xs.filter((g) => !goals.some((n) => n.periodKey === g.periodKey)); return [...others, ...goals]; }); },
  toggleManual(g: Goal) { const st = S(); const done = !g.done; st.update(goalActions.key(g.period), (xs) => xs.map((x) => (x.id === g.id ? { ...x, done, doneAt: done ? nowISO() : undefined } : x))); if (done) st.awardXp(`goal:${g.id}`, g.xp || 20, g.title, "goal", g.area); else st.revokeXp(`goal:${g.id}`); },
  setManualValue(g: Goal, v: number) { S().update(goalActions.key(g.period), (xs) => xs.map((x) => (x.id === g.id ? { ...x, manualValue: v } : x))); },
  remove(g: Goal) { S().update(goalActions.key(g.period), (xs) => xs.filter((x) => x.id !== g.id)); },
  addTemplate(t: Omit<GoalTemplate, "id">) { S().update(goalActions.tkey(t.period), (xs) => [...xs, { ...t, id: uid("tpl") }]); },
  removeTemplate(period: "week" | "month", id: string) { S().update(goalActions.tkey(period), (xs) => xs.filter((x) => x.id !== id)); },
  markAchieved(g: Goal) { const st = S(); if (st.data.xpLog.some((e) => e.ref === `goal:${g.id}`)) return; st.awardXp(`goal:${g.id}`, g.xp || 20, `هدف: ${g.title}`, "goal", g.area); },
  planTask(weekKeyStr: string, date: string, t: Omit<PlannedTask, "id">) { S().update("weeklyPlans", (p) => ({ ...p, [weekKeyStr]: { ...(p[weekKeyStr] ?? {}), [date]: [...(p[weekKeyStr]?.[date] ?? []), { ...t, id: uid("plan") }] } })); },
  unplanTask(weekKeyStr: string, date: string, id: string) { S().update("weeklyPlans", (p) => ({ ...p, [weekKeyStr]: { ...(p[weekKeyStr] ?? {}), [date]: (p[weekKeyStr]?.[date] ?? []).filter((x) => x.id !== id) } })); },
  saveReview(period: "week" | "month", key: string, answers: Record<string, string>) { const st = S(); st.update(period === "week" ? "weeklyReviews" : "monthlyReviews", (r) => [...r.filter((x) => x.periodKey !== key), { periodKey: key, answers, at: nowISO() }]); st.awardXp(`review:${period}:${key}`, period === "week" ? 25 : 60, period === "week" ? "مراجعة أسبوعية" : "مراجعة شهرية", "review", "mental"); },
  addReflection(date: string, text: string) { S().update("reflections", (r) => [...r, { id: uid("ref"), date, text }]); },
};

// ─── Recovery ────────────────────────────────────────────────────────────────
export const recoveryActions = {
  setSobrietyStart(iso: string | null) { S().update("sobrietyStartAt", () => iso); },
  checkIn(e: Omit<RecoveryEntry, "id" | "at" | "date">, date = todayISO()) { const st = S(); const entry: RecoveryEntry = { ...e, id: uid("rc"), at: nowISO(), date }; st.update("recoveryEntries", (xs) => [...xs, entry]); st.awardXp(`recovery:checkin:${entry.id}`, 5 + e.ritualsDone.length * 2, "قراءة تعافٍ", "recovery", "mental", date); },
  craving(e: Omit<CravingEvent, "id" | "at" | "date" | "xp">, date = todayISO()) { const st = S(); const xp = cravingXp({ ...e, date, at: nowISO() }, st.data.cravingEvents); const ev: CravingEvent = { ...e, id: uid("cv"), at: nowISO(), date, xp }; st.update("cravingEvents", (xs) => [...xs, ev]); st.awardXp(`craving:${ev.id}`, xp, e.outcome === "resisted" ? "رغبة مقاومة 💪" : "رغبة → انتكاس", "recovery", "mental", date); return ev; },
  relapse(e: Omit<RelapseEvent, "id" | "at" | "date">, at = nowISO()) { const st = S(); const ev: RelapseEvent = { ...e, id: uid("rl"), at, date: at.slice(0, 10) }; st.update("relapseLog", (xs) => [...xs, ev]); st.awardXp(`relapse:${ev.id}`, -20, "انتكاس مسجّل (الصدق نصف التعافي)", "recovery", "mental", ev.date); return ev; },
  removeRelapse(id: string) { S().update("relapseLog", (xs) => xs.filter((x) => x.id !== id)); S().revokeXp(`relapse:${id}`); },
  addTask(title: string, date: string, xp = 8) { S().update("recoveryTasks", (xs) => [...xs, { id: uid("rt"), title, date, done: false, xp }]); },
  toggleTask(t: RecoveryTask) { const st = S(); const done = !t.done; st.update("recoveryTasks", (xs) => xs.map((x) => (x.id === t.id ? { ...x, done, doneAt: done ? nowISO() : undefined } : x))); updateEntry(t.date, (e) => ({ ...e, tasks: e.tasks.map((x) => (x.recoveryTaskId === t.id ? { ...x, done } : x)) })); if (done) st.awardXp(`${t.date}:task:rec_${t.id}`, t.xp, t.title, "recovery-task", "mental", t.date); else st.revokeXp(`${t.date}:task:rec_${t.id}`); },
  removeTask(id: string) { S().update("recoveryTasks", (xs) => xs.filter((x) => x.id !== id)); },
  addLost(title: string, plan: string, parts: string[]) { S().update("lostThings", (xs) => [...xs, { id: uid("lost"), title, plan, createdAt: nowISO(), parts: parts.map((p) => ({ id: uid("part"), title: p, xp: 15, status: "todo" as const })) }]); },
  setPartStatus(lost: LostThing, partId: string, status: "todo" | "working" | "recovered") { const st = S(); st.update("lostThings", (xs) => xs.map((l) => (l.id === lost.id ? { ...l, parts: l.parts.map((p) => (p.id === partId ? { ...p, status } : p)) } : l))); const part = lost.parts.find((p) => p.id === partId); if (part) { if (status === "recovered") st.awardXp(`lost:${partId}`, part.xp, `استرددت: ${part.title}`, "recovery", "mental"); else st.revokeXp(`lost:${partId}`); } },
  removeLost(id: string) { S().update("lostThings", (xs) => xs.filter((x) => x.id !== id)); },
  saveMorning(date: string, answers: Record<string, string>) { S().update("morningReviews", (r) => [...r.filter((x) => x.periodKey !== date), { periodKey: date, answers, at: nowISO() }]); S().awardXp(`morning:${date}`, 8, "مراجعة الصباح", "recovery", "mental", date); },
};

// ─── Quran ───────────────────────────────────────────────────────────────────
export const quranActions = {
  memorize(page: number, date = todayISO()) { const st = S(); const key = String(page); if (st.data.quranMemorization.pages[key]) return; st.update("quranMemorization", (q) => ({ ...q, pages: { ...q.pages, [key]: { memorizedAt: date, lastReviewAt: date, reviews: 0 } } })); st.awardXp(`quran:mem:${page}`, 20, `حفظ صفحة ${page}`, "quran", "deen", date); },
  unmemorize(page: number) { const st = S(); st.update("quranMemorization", (q) => { const p = { ...q.pages }; delete p[String(page)]; return { ...q, pages: p }; }); st.revokeXp(`quran:mem:${page}`); },
  review(page: number, date = todayISO()) { const st = S(); st.update("quranMemorization", (q) => { const p = q.pages[String(page)]; if (!p) return q; return { ...q, pages: { ...q.pages, [String(page)]: { ...p, lastReviewAt: date, reviews: p.reviews + 1 } } }; }); st.awardXp(`quran:rev:${page}:${date}`, 4, `مراجعة صفحة ${page}`, "quran", "deen", date); },
  reviewAll(pages: number[], date = todayISO()) { for (const p of pages) quranActions.review(p, date); },
  addTadabur(ref: string, text: string, date = todayISO()) { S().update("quranTadabur", (xs) => [...xs, { id: uid("td"), date, ref, text }]); S().awardXp(`tadabur:${Date.now()}`, 8, "تدبر", "quran", "deen", date); },
};

// ─── Training ────────────────────────────────────────────────────────────────
export const trainingActions = {
  addSession(s: Omit<TrainingSession, "id" | "xp">) { const st = S(); const xp = trainingSessionXp(s.minutes); const sess: TrainingSession = { ...s, id: uid("ts"), xp }; st.update("trainingLog", (l) => ({ ...l, sessions: [...l.sessions, sess] })); const area = st.data.trainingLog.areas.find((a) => a.id === s.areaId); st.awardXp(`training:${sess.id}`, xp, `تدريب ${area?.name ?? ""} ${s.minutes} د`, "training", area?.lifeArea ?? "career", s.date); },
  removeSession(id: string) { S().update("trainingLog", (l) => ({ ...l, sessions: l.sessions.filter((s) => s.id !== id) })); S().revokeXp(`training:${id}`); },
  addArea(name: string, color: string, lifeArea: AreaId) { S().update("trainingLog", (l) => ({ ...l, areas: [...l.areas, { id: uid("ta"), name, color, lifeArea, custom: true }] })); },
  removeArea(id: string) { S().update("trainingLog", (l) => ({ ...l, areas: l.areas.filter((a) => a.id !== id) })); },
};

// ─── Challenges ──────────────────────────────────────────────────────────────
export const challengeActions = {
  add(c: Omit<Challenge, "id" | "progress" | "status">) { S().update("challenges", (xs) => [...xs, { ...c, id: uid("ch"), progress: {}, status: "active" }]); },
  logProgress(id: string, date: string, value: number) { S().update("challenges", (xs) => xs.map((c) => (c.id === id ? { ...c, progress: { ...c.progress, [date]: value } } : c))); challengeActions.refreshStatuses(); },
  restart(id: string) { S().update("challenges", (xs) => xs.map((c) => (c.id === id ? { ...c, startDate: todayISO(), progress: {}, status: "active", finishedAt: undefined } : c))); },
  remove(id: string) { S().update("challenges", (xs) => xs.filter((c) => c.id !== id)); },
  refreshStatuses() {
    const st = S(); const data = st.data; let changed = false; const today = todayISO();
    const next = data.challenges.map((c) => { const status = resolveChallengeStatus(c, data, today); if (status !== c.status) { changed = true; if (status === "success") st.awardXp(`challenge:${c.id}:success`, c.successReward, `تحدي مكتمل: ${c.title}`, "challenge", c.area); if (status === "failed") st.awardXp(`challenge:${c.id}:fail`, -Math.abs(c.failurePenalty), `تحدي فشل: ${c.title}`, "challenge", c.area); return { ...c, status, finishedAt: nowISO() }; } return c; });
    // مكافأة يومية للتحديات اليومية
    for (const c of data.challenges) if (c.status === "active" && c.type === "daily") { const v = c.source === "manual" ? c.progress[today] ?? 0 : undefined; if (v != null && v >= c.target) st.awardXp(`challenge:${c.id}:${today}`, c.dailyReward, `يوم تحدٍ: ${c.title}`, "challenge", c.area, today); }
    if (changed) st.update("challenges", () => next);
  },
};

// ─── Books / Courses ─────────────────────────────────────────────────────────
export const libraryActions = {
  addBook(b: Omit<Book, "id" | "sessions" | "addedAt" | "currentPage">) { const book: Book = { ...b, id: uid("book"), sessions: [], addedAt: nowISO(), currentPage: 1 }; S().update("books", (xs) => [...xs, book]); return book; },
  updateBook(id: string, p: Partial<Book>) { S().update("books", (xs) => xs.map((b) => (b.id === id ? { ...b, ...p } : b))); },
  removeBook(id: string) { S().update("books", (xs) => xs.filter((b) => b.id !== id)); S().update("bookAnnotations", (xs) => xs.filter((a) => a.bookId !== id)); },
  logSession(id: string, from: number, to: number, minutes: number, date = todayISO()) { const st = S(); const sid = uid("rs"); st.update("books", (xs) => xs.map((b) => (b.id === id ? { ...b, currentPage: Math.max(b.currentPage, to), sessions: [...b.sessions, { id: sid, date, from, to, minutes }], finishedAt: to >= b.pages && b.pages > 0 ? nowISO() : b.finishedAt } : b))); st.awardXp(`read:${sid}`, Math.max(3, Math.round(Math.max(0, to - from) / 2) + Math.round(minutes / 10)), "جلسة قراءة", "reading", "mental", date); },
  addAnnotation(a: Omit<Annotation, "id" | "createdAt">) { const ann: Annotation = { ...a, id: uid("ann"), createdAt: nowISO() }; S().update("bookAnnotations", (xs) => [...xs, ann]); return ann; },
  removeAnnotation(id: string) { S().update("bookAnnotations", (xs) => xs.filter((a) => a.id !== id)); },
  addCourse(c: Omit<Course, "id" | "addedAt">) { S().update("courses", (xs) => [...xs, { ...c, id: uid("course"), addedAt: nowISO() }]); },
  removeCourse(id: string) { S().update("courses", (xs) => xs.filter((c) => c.id !== id)); },
  toggleLesson(courseId: string, lessonId: string) { const st = S(); const c = st.data.courses.find((x) => x.id === courseId); const l = c?.lessons.find((x) => x.id === lessonId); if (!c || !l) return; const done = !l.done; st.update("courses", (xs) => xs.map((x) => (x.id === courseId ? { ...x, lessons: x.lessons.map((y) => (y.id === lessonId ? { ...y, done, doneAt: done ? nowISO() : undefined } : y)) } : x))); if (done) st.awardXp(`lesson:${lessonId}`, Math.max(4, Math.round(l.durationMin / 5)), `درس: ${l.title}`, "course", c.area); else st.revokeXp(`lesson:${lessonId}`); challengeActions.refreshStatuses(); },
};

// ─── Brain dump / Identity / Finance / Body ──────────────────────────────────
export const dumpActions = {
  add(text: string, date = todayISO()) { const st = S(); const d: BrainDump = { id: uid("bd"), at: nowISO(), date, text, kind: "uncategorized", processed: false }; st.update("brainDumps", (xs) => [d, ...xs]); st.awardXp(`dump:${d.id}`, 2, "تفريغ عقل", "brain-dump", "mental", date); return d; },
  triage(id: string, kind: BrainDump["kind"], area?: AreaId) { S().update("brainDumps", (xs) => xs.map((d) => (d.id === id ? { ...d, kind, area } : d))); },
  logMinutes(id: string, minutes: number) { S().update("brainDumps", (xs) => xs.map((d) => (d.id === id ? { ...d, minutes: (d.minutes ?? 0) + minutes } : d))); S().awardXp(`dump:${id}:m${Date.now()}`, Math.max(1, Math.round(minutes / 15)), "وقت على تفريغ", "brain-dump", "mental"); },
  convertToTask(d: BrainDump, date: string) { const t = dayActions.addTask(date, { title: d.text.slice(0, 80), area: d.area ?? "mental", difficulty: 2, source: "brain-dump" }); S().update("brainDumps", (xs) => xs.map((x) => (x.id === d.id ? { ...x, processed: true, convertedTo: `task:${t.id}` } : x))); },
  convertToIdea(d: BrainDump) { dayActions.addIdea(d.text.slice(0, 80), d.area ?? "creativity"); S().update("brainDumps", (xs) => xs.map((x) => (x.id === d.id ? { ...x, processed: true, convertedTo: "idea" } : x))); },
  markProcessed(id: string, v = true) { S().update("brainDumps", (xs) => xs.map((x) => (x.id === id ? { ...x, processed: v } : x))); },
  remove(id: string) { S().update("brainDumps", (xs) => xs.filter((x) => x.id !== id)); },
};
export const identityActions = {
  add(p: Omit<IdentityPrinciple, "id">) { S().update("identityPrinciples", (xs) => [...xs, { ...p, id: uid("ip") }]); },
  update(id: string, p: Partial<IdentityPrinciple>) { S().update("identityPrinciples", (xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x))); },
  remove(id: string) { S().update("identityPrinciples", (xs) => xs.filter((x) => x.id !== id)); },
  logPractice(pid: string, practiceId: string, date = todayISO()) { const st = S(); const p = st.data.identityPrinciples.find((x) => x.id === pid); const pr = p?.practices.find((x) => x.id === practiceId); if (!p || !pr || pr.log.includes(date)) return; st.update("identityPrinciples", (xs) => xs.map((x) => (x.id === pid ? { ...x, practices: x.practices.map((y) => (y.id === practiceId ? { ...y, log: [...y.log, date] } : y)) } : x))); st.awardXp(`practice:${practiceId}:${date}`, pr.xp, `ممارسة: ${pr.title}`, "identity", "mental", date); },
};
export const financeActions = {
  add(e: { date: string; type: "income" | "expense"; amount: number; category: string; note: string }) { S().update("financeEntries", (xs) => [...xs, { id: uid("fin"), ...e }]); },
  remove(id: string) { S().update("financeEntries", (xs) => xs.filter((x) => x.id !== id)); },
  addSavings(date: string, amount: number, note: string) { S().update("savingsEntries", (xs) => [...xs, { id: uid("sv"), date, amount, note }]); S().awardXp(`savings:${Date.now()}`, 5, "ادخار", "finance", "career", date); },
  removeSavings(id: string) { S().update("savingsEntries", (xs) => xs.filter((x) => x.id !== id)); },
};
export const bodyActions = {
  record(e: Omit<import("@/types/app-data").BodyEntry, "id">) { const st = S(); st.update("bodyEntries", (xs) => { const ex = xs.find((x) => x.date === e.date); return ex ? xs.map((x) => (x.date === e.date ? { ...x, ...e, lifts: { ...(x.lifts ?? {}), ...(e.lifts ?? {}) } } : x)) : [...xs, { ...e, id: uid("be") }]; }); if (e.weight) st.update("weights", (w) => [...w.filter((x) => x.date !== e.date), { date: e.date, weight: e.weight! }]); st.awardXp(`body:${e.date}`, 5, "تسجيل قياسات", "body", "physical", e.date); },
  remove(id: string) { S().update("bodyEntries", (xs) => xs.filter((x) => x.id !== id)); },
  addPhoto(p: Omit<import("@/types/app-data").Photo, "id">) { S().update("photos", (xs) => [...xs, { ...p, id: uid("ph") }]); },
  removePhoto(id: string) { S().update("photos", (xs) => xs.filter((x) => x.id !== id)); },
};
export const currentWeekKey = () => weekKey(useApp.getState().selectedDate);
