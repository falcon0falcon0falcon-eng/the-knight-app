"use client";
import React, { useMemo, useState } from "react";
import { useApp, useLevel } from "@/stores/app-store";
import { dayActions, dumpActions } from "@/stores/actions";
import { AREAS, AreaId, Task } from "@/types/app-data";
import { allDayTasks, computeDayProgress, getEntry, habitDone, habitDueState, habitStreak } from "@/calculations/daily";
import { effectiveBurn, expectedWeightChange, latestWeight, netCalories } from "@/calculations/body";
import { xpBetween, rankForLevel } from "@/calculations/gamification";
import { METRICS } from "@/calculations/metrics";
import { isFutureDate, weekKey, formatShort, todayISO } from "@/core/date";
import { Button, Card, Chip, CollapsibleSection, DateNavigator, EmptyState, Field, HabitRow, Input, Modal, NumberInput, ProgressBar, ProgressRing, RankBadge, Select, TaskRow, Textarea, Toggle, XPBadge, areaOf, cx, useConfirm, AreaChip } from "@/components/ui";

export default function DayPage() {
  const data = useApp((s) => s.data); const date = useApp((s) => s.selectedDate); const setDate = useApp((s) => s.setSelectedDate);
  const entry = getEntry(data, date); const wk = weekKey(date); const future = isFutureDate(date); const locked = future || entry.closed;
  const progress = useMemo(() => computeDayProgress(data, date, wk), [data, date, wk]);
  const tasks = useMemo(() => allDayTasks(data, date, wk), [data, date, wk]);
  const xpToday = xpBetween(data.xpLog, date, date); const lvl = useLevel();
  const [shutdown, setShutdown] = useState(false);
  const msg = data.dayMessages.find((m) => m.date === date);
  return (
    <div className="space-y-4 anim-fade-up">
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -end-10 -top-10 h-40 w-40 rounded-full bg-accent-soft blur-3xl" aria-hidden />
        <DateNavigator date={date} onChange={setDate} />
        <div className="mt-4 flex items-center gap-4">
          <ProgressRing value={progress.percent} size={96} color={entry.closed ? "var(--gold)" : "var(--accent)"} label="إنجاز اليوم" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><RankBadge rank={rankForLevel(lvl.level)} level={lvl.level} size="sm" /><span className="text-sm font-bold">Lv {lvl.level}</span><XPBadge xp={xpToday} />{entry.closed && <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-bold text-gold">يوم مُغلق · {entry.score}%</span>}{future && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">يوم مستقبلي — للاطلاع فقط</span>}</div>
            <ProgressBar value={lvl.progress * 100} color="var(--gold)" className="mt-2" label="تقدم المستوى" /><div className="mt-1 text-[11px] text-muted">{lvl.current}/{lvl.needed} XP للمستوى التالي</div>
            <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[11px]"><div className="rounded-lg bg-surface-2 py-1"><b>{progress.requiredDone}/{progress.requiredTotal}</b><div className="text-muted">عادات</div></div><div className="rounded-lg bg-surface-2 py-1"><b>{progress.questsDone}/{progress.questsTotal}</b><div className="text-muted">مهام</div></div><div className="rounded-lg bg-surface-2 py-1"><b>{progress.optionalDone}</b><div className="text-muted">اختياري</div></div></div>
          </div>
        </div>
        {msg ? <p className="mt-3 rounded-xl bg-gold-soft px-3 py-2 text-sm">💬 {msg.text}</p> : null}
      </Card>
      <HabitsSection date={date} locked={locked} />
      <TasksSection date={date} tasks={tasks} locked={locked} />
      <PhysicalSection date={date} locked={locked} />
      <DeenSection date={date} locked={locked} />
      <CreativitySection date={date} locked={locked} />
      <Card title="ملاحظة اليوم"><Textarea value={entry.note} disabled={locked} onChange={(e) => dayActions.setField(date, "note", e.target.value)} placeholder="ما الذي يدور في ذهنك اليوم؟" /></Card>
      <div className="sticky bottom-20 z-20 md:static">{entry.closed ? <Button block variant="soft" onClick={() => dayActions.reopenDay(date)}>إعادة فتح اليوم للتعديل</Button> : <Button block size="lg" variant="gold" disabled={future} onClick={() => setShutdown(true)} className="shadow-xl">🌙 إغلاق اليوم (Shutdown)</Button>}</div>
      {shutdown && <ShutdownFlow date={date} onClose={() => setShutdown(false)} />}
    </div>
  );
}

function HabitsSection({ date, locked }: { date: string; locked: boolean }) {
  const data = useApp((s) => s.data); const [showOff, setShowOff] = useState(false);
  const rows = data.habits.filter((h) => h.enabled).map((h) => ({ h, state: habitDueState(h, date), done: habitDone(data, h, date), streak: habitStreak(data, h, date) }));
  const visible = rows.filter((r) => r.state !== "off" || showOff);
  const order = { required: 0, optional: 1, off: 2 };
  return (<CollapsibleSection title="العادات" badge={<span className="text-xs text-muted">{rows.filter((r) => r.state === "required" && r.done).length}/{rows.filter((r) => r.state === "required").length}</span>}>
    <div className="space-y-2">{visible.sort((a, b) => order[a.state] - order[b.state]).map(({ h, state, done, streak }) => <HabitRow key={h.id} name={h.name} emoji={h.emoji} area={h.area} done={done} state={state} streak={streak} xp={h.xp} disabled={locked || state === "off"} onToggle={() => dayActions.toggleHabit(date, h)} trailing={h.quranMode && <span className="text-[10px] text-muted">{h.quranMode === "new" ? "حفظ جديد" : "مراجعة"}</span>} />)}
      <button type="button" className="text-xs text-muted underline" onClick={() => setShowOff(!showOff)}>{showOff ? "إخفاء" : "إظهار"} عادات غير مستحقة اليوم ({rows.filter((r) => r.state === "off").length})</button></div>
  </CollapsibleSection>);
}

function TasksSection({ date, tasks, locked }: { date: string; tasks: Task[]; locked: boolean }) {
  const data = useApp((s) => s.data); const [open, setOpen] = useState(false); const { confirm, dialog } = useConfirm();
  const [title, setTitle] = useState(""); const [area, setArea] = useState<AreaId>("mental"); const [diff, setDiff] = useState<1 | 2 | 3 | 4 | 5>(2); const [metrics, setMetrics] = useState<string[]>([]);
  const add = () => { if (!title.trim()) return; dayActions.addTask(date, { title: title.trim(), area, difficulty: diff, metrics }); setTitle(""); setMetrics([]); setOpen(false); };
  const bonus = data.bonusQuests.filter((b) => b.enabled); const entry = data.entries[date];
  return (<CollapsibleSection title="المهام" badge={<span className="text-xs text-muted">{tasks.filter((t) => t.done).length}/{tasks.length}</span>}>
    <div className="space-y-2">
      {tasks.length === 0 && <EmptyState icon="🗡️" title="لا مهام اليوم" description="أضف مهمة أو خطط أسبوعك — المهام المخططة تظهر هنا تلقائيًا." />}
      {tasks.map((t) => <TaskRow key={t.id} title={t.title} area={t.area} difficulty={t.difficulty} xp={t.xp || [0, 5, 10, 15, 25, 40][t.difficulty]} done={t.done} source={t.source} disabled={locked} onToggle={() => dayActions.toggleTask(date, t)} onDelete={t.source === "custom" || t.source === "brain-dump" || t.source === "ai" ? () => confirm("حذف المهمة؟", () => dayActions.deleteTask(date, t.id)) : undefined} />)}
      {bonus.length > 0 && <div className="pt-1"><div className="mb-1 text-xs font-bold text-muted">مهام بونص</div><div className="flex flex-wrap gap-2">{bonus.map((b) => { const on = !!entry?.habits?.[`bonus:${b.id}`]; return <Chip key={b.id} active={on} onClick={() => { if (locked) return; dayActions.toggleHabit(date, { id: `bonus:${b.id}`, name: b.title, area: b.area, xp: b.xp, days: [0, 1, 2, 3, 4, 5, 6], optionalDays: [], enabled: true, custom: true }); }}>{on ? "✓ " : ""}{b.title} <XPBadge xp={b.xp} small /></Chip>; })}</div></div>}
      <Button variant="primary" block disabled={locked} onClick={() => setOpen(true)}>+ مهمة جديدة</Button>
    </div>
    <Modal open={open} onClose={() => setOpen(false)} title="مهمة جديدة" footer={<><Button onClick={() => setOpen(false)}>إلغاء</Button><Button variant="primary" onClick={add}>إضافة</Button></>}>
      <div className="space-y-3"><Field label="العنوان"><Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} /></Field>
        <Field label="المحور"><div className="flex flex-wrap gap-1.5">{AREAS.map((a) => <Chip key={a.id} active={area === a.id} color={a.color} onClick={() => setArea(a.id)}>{a.emoji} {a.label}</Chip>)}</div></Field>
        <Field label={`الصعوبة (${diff}) — ${[0, 5, 10, 15, 25, 40][diff]} XP`}><div className="flex gap-1.5">{([1, 2, 3, 4, 5] as const).map((d) => <Chip key={d} active={diff === d} onClick={() => setDiff(d)}>{"★".repeat(d)}</Chip>)}</div></Field>
        <Field label="ربط بمقاييس (اختياري)"><div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">{METRICS.map((m) => <Chip key={m.id} active={metrics.includes(m.id)} onClick={() => setMetrics(metrics.includes(m.id) ? metrics.filter((x) => x !== m.id) : [...metrics, m.id])}>{m.label}</Chip>)}</div></Field></div>
    </Modal>{dialog}
  </CollapsibleSection>);
}

function PhysicalSection({ date, locked }: { date: string; locked: boolean }) {
  const data = useApp((s) => s.data); const entry = getEntry(data, date); const w = latestWeight(data.bodyEntries); const gs = data.goalSettings;
  const burn = effectiveBurn(entry, data.bodyProfile, w); const net = netCalories(entry, data.bodyProfile, w); const [mealOpen, setMealOpen] = useState(false);
  const [custom, setCustom] = useState({ name: "", kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const ring = (label: string, v: number, t: number, color: string) => <div className="flex flex-col items-center gap-1"><ProgressRing value={t ? (v / t) * 100 : 0} size={64} stroke={6} color={color} label={label}><span className="text-[11px] font-bold tabular-nums">{Math.round(v)}</span></ProgressRing><span className="text-[10px] text-muted">{label} / {t}</span></div>;
  return (<CollapsibleSection title="🏋️ الجسد" subtitle={`صافي ${net > 0 ? "+" : ""}${net} kcal`}>
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl border p-3"><div><div className="text-sm font-bold">جلسة جيم اليوم</div><div className="text-[11px] text-muted">+15 XP</div></div><Toggle checked={entry.gym} onChange={() => !locked && dayActions.toggleGym(date)} label="جيم" /></div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><Field label="جري (كم)"><NumberInput value={entry.runKm} step={0.5} onChange={(v) => !locked && dayActions.setField(date, "runKm", v)} /></Field><Field label="سعرات محروقة" hint={burn.fromBmr ? `فارغ → BMR×نشاط = ${burn.burn}` : undefined}><NumberInput value={entry.caloriesBurned ?? 0} step={50} onChange={(v) => !locked && dayActions.setField(date, "caloriesBurned", v || null)} /></Field><Field label="سعرات مأكولة"><NumberInput value={entry.caloriesEaten} step={50} onChange={(v) => !locked && dayActions.setField(date, "caloriesEaten", v)} /></Field></div>
      <div className="grid grid-cols-4 gap-2 rounded-2xl border p-3">{ring("سعرات", entry.caloriesEaten, gs.calorieTarget, "var(--accent)")}{ring("بروتين", entry.protein, gs.proteinTarget, "#10b981")}{ring("كارب", entry.carbs, gs.carbTarget, "#f59e0b")}{ring("دهون", entry.fat, gs.fatTarget, "#ec4899")}</div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-xl bg-surface-2 p-2"><div className="text-muted">حرق فعلي</div><b>{burn.burn}</b></div><div className="rounded-xl bg-surface-2 p-2"><div className="text-muted">صافي</div><b className={net > 0 ? "text-warn" : "text-ok"}>{net}</b></div><div className="rounded-xl bg-surface-2 p-2"><div className="text-muted">تغير متوقع</div><b>{expectedWeightChange(net) > 0 ? "+" : ""}{expectedWeightChange(net)} كجم</b></div></div>
      <div><div className="mb-1 flex items-center justify-between"><span className="text-xs font-bold text-muted">وجبات اليوم</span><Button size="sm" disabled={locked} onClick={() => setMealOpen(true)}>+ وجبة</Button></div>{entry.meals.length ? <ul className="space-y-1">{entry.meals.map((m) => <li key={m.id} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-sm"><span>{m.name}</span><span className="flex items-center gap-2 text-xs text-muted">{m.kcal} kcal · P{m.protein} C{m.carbs} F{m.fat}{!locked && <button type="button" aria-label="حذف" onClick={() => dayActions.removeMeal(date, m.id)}>✕</button>}</span></li>)}</ul> : <p className="text-xs text-muted">لم تُسجل وجبات.</p>}</div>
    </div>
    <Modal open={mealOpen} onClose={() => setMealOpen(false)} title="إضافة وجبة">
      <div className="space-y-3"><div className="text-xs font-bold text-muted">من المكتبة</div><div className="grid gap-1">{data.mealLibrary.map((m) => <button key={m.id} type="button" className="touch flex items-center justify-between rounded-xl border px-3 py-2 text-start text-sm hover:bg-surface-2" onClick={() => { dayActions.addMeal(date, m); setMealOpen(false); }}><span>{m.name}</span><span className="text-xs text-muted">{m.kcal} kcal</span></button>)}</div>
        <div className="text-xs font-bold text-muted">وجبة مخصصة</div><Input placeholder="الاسم" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} /><div className="grid grid-cols-4 gap-2">{(["kcal", "protein", "carbs", "fat"] as const).map((k) => <Field key={k} label={{ kcal: "سعرات", protein: "بروتين", carbs: "كارب", fat: "دهون" }[k]}><Input type="number" inputMode="numeric" value={custom[k] || ""} onChange={(e) => setCustom({ ...custom, [k]: Number(e.target.value) })} /></Field>)}</div><Button variant="primary" block onClick={() => { if (!custom.name) return; dayActions.addMeal(date, custom); setCustom({ name: "", kcal: 0, protein: 0, carbs: 0, fat: 0 }); setMealOpen(false); }}>إضافة</Button></div>
    </Modal>
  </CollapsibleSection>);
}

function DeenSection({ date, locked }: { date: string; locked: boolean }) {
  const data = useApp((s) => s.data); const entry = getEntry(data, date); const [sin, setSin] = useState({ name: "", lesson: "" });
  return (<CollapsibleSection title="🕌 الدين">
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><Field label="حفظ قرآن (صفحات)" hint="+20 XP/صفحة"><NumberInput value={entry.quranMemPages} step={0.5} onChange={(v) => !locked && dayActions.setQuran(date, "quranMemPages", v)} /></Field><Field label="قراءة قرآن (صفحات)" hint="+3 XP/صفحة"><NumberInput value={entry.quranReadPages} onChange={(v) => !locked && dayActions.setQuran(date, "quranReadPages", v)} /></Field><Field label="دروس شرعية" hint="+10 XP/درس"><NumberInput value={entry.shariaLessons} onChange={(v) => !locked && dayActions.setQuran(date, "shariaLessons", v)} /></Field></div>
      <div><div className="mb-1 text-xs font-bold text-muted">عداد الأذكار</div><div className="grid gap-2 sm:grid-cols-2">{data.dhikrLibrary.map((d) => { const v = entry.dhikr[d.id] ?? 0; const done = v >= d.target; return <div key={d.id} className={cx("rounded-2xl border p-2.5", done && "border-ok/50 bg-ok/5")}><div className="flex items-center justify-between text-sm"><span className="font-bold">{d.text}</span><span className="tabular-nums text-xs text-muted">{v}/{d.target}</span></div><ProgressBar value={(v / d.target) * 100} color="var(--ok)" className="my-2" label={d.text} /><div className="flex gap-1"><Button size="sm" disabled={locked} onClick={() => dayActions.incDhikr(date, d.id, 1)}>+1</Button><Button size="sm" disabled={locked} onClick={() => dayActions.incDhikr(date, d.id, 10)}>+10</Button><Button size="sm" disabled={locked} onClick={() => dayActions.incDhikr(date, d.id, 33)}>+33</Button><Button size="sm" disabled={locked} onClick={() => dayActions.incDhikr(date, d.id, -1)}>−1</Button></div></div>; })}</div></div>
      <div><div className="mb-1 text-xs font-bold text-muted">سجل التعلم من الزلات (وعي لا جلد)</div>{entry.sins.map((s) => <div key={s.id} className="mb-1 rounded-xl bg-surface-2 px-3 py-2 text-xs"><b>{s.name}</b> — {s.lesson}</div>)}<div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_2fr_auto]"><Select value={sin.name} onChange={(e) => setSin({ ...sin, name: e.target.value })}><option value="">اختر</option>{data.sinLibrary.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}</Select><Input placeholder="ما الدرس؟" value={sin.lesson} onChange={(e) => setSin({ ...sin, lesson: e.target.value })} /><Button disabled={locked || !sin.name} onClick={() => { dayActions.addSin(date, sin.name, sin.lesson); setSin({ name: "", lesson: "" }); }}>تسجيل</Button></div></div>
    </div>
  </CollapsibleSection>);
}

function CreativitySection({ date, locked }: { date: string; locked: boolean }) {
  const data = useApp((s) => s.data); const entry = getEntry(data, date); const [title, setTitle] = useState(""); const [mins, setMins] = useState<Record<string, number>>({});
  return (<CollapsibleSection title="🎨 الإبداع · بنك الأفكار" defaultOpen={false}>
    <div className="space-y-2">
      {data.projectIdeas.length === 0 && <EmptyState icon="💡" title="بنك الأفكار فارغ" description="أضف فكرة مشروع وسجّل دقائق العمل عليها." />}
      {data.projectIdeas.map((i) => { const total = i.history.reduce((a, h) => a + h.minutes, 0); const today = entry.ideaWork.filter((w) => w.ideaId === i.id).reduce((a, w) => a + w.minutes, 0); return <div key={i.id} className="rounded-2xl border p-3"><div className="flex items-center justify-between"><div><div className="text-sm font-bold">{i.title}</div><div className="text-[11px] text-muted">إجمالي {total} د · اليوم {today} د · {i.history.length} جلسة</div></div><AreaChip id={i.area} small /></div><div className="mt-2 flex gap-2"><NumberInput value={mins[i.id] ?? 25} step={5} onChange={(v) => setMins({ ...mins, [i.id]: v })} suffix="د" className="flex-1" /><Button disabled={locked} onClick={() => dayActions.addIdeaMinutes(date, i.id, mins[i.id] ?? 25)}>تسجيل</Button></div>{i.history.length > 0 && <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-muted">{i.history.slice(-8).map((h, k) => <span key={k} className="rounded bg-surface-2 px-1.5">{formatShort(h.date)}: {h.minutes}د</span>)}</div>}</div>; })}
      <div className="flex gap-2"><Input placeholder="فكرة جديدة…" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) { dayActions.addIdea(title.trim()); setTitle(""); } }} /><Button onClick={() => { if (title.trim()) { dayActions.addIdea(title.trim()); setTitle(""); } }}>+ فكرة</Button></div>
    </div>
  </CollapsibleSection>);
}

/** Shutdown 5 خطوات: الفحص → المراجعة → تفريغ العقل → النتيجة → رسالة الإغلاق. الحالة تُحفظ في entry.shutdownStep */
function ShutdownFlow({ date, onClose }: { date: string; onClose: () => void }) {
  const data = useApp((s) => s.data); const entry = getEntry(data, date); const wk = weekKey(date);
  const [step, setStep] = useState(Math.min(4, entry.shutdownStep || 0));
  const progress = useMemo(() => computeDayProgress(data, date, wk), [data, date, wk]);
  const existing = data.dailyReviews.find((r) => r.periodKey === date)?.answers ?? {};
  const [answers, setAnswers] = useState<Record<string, string>>(existing); const [dump, setDump] = useState(""); const [msg, setMsg] = useState(data.dayMessages.find((m) => m.date === date)?.text ?? "");
  const go = (n: number) => { setStep(n); dayActions.setField(date, "shutdownStep", n); };
  const xpToday = xpBetween(data.xpLog, date, date);
  const steps = ["الفحص", "المراجعة", "تفريغ العقل", "النتيجة", "الإغلاق"];
  const finish = () => { if (msg.trim()) useApp.getState().update("dayMessages", (m) => [...m.filter((x) => x.date !== date), { date, text: msg.trim() }]); dayActions.closeDay(date, progress.percent); onClose(); };
  return (<Modal open onClose={onClose} title={<span>🌙 إغلاق اليوم · <span className="text-muted">{steps[step]}</span></span>} size="lg" footer={<><Button onClick={onClose}>حفظ وإغلاق لاحقًا</Button>{step > 0 && <Button onClick={() => go(step - 1)}>السابق</Button>}{step < 4 ? <Button variant="primary" onClick={() => { if (step === 1) dayActions.saveDailyReview(date, answers); if (step === 2 && dump.trim()) { dumpActions.add(dump.trim(), date); setDump(""); } go(step + 1); }}>التالي</Button> : <Button variant="gold" onClick={finish}>إغلاق اليوم ✨</Button>}</>}>
    <ol className="mb-4 flex items-center gap-1" aria-label="التقدم">{steps.map((s, i) => <li key={s} className={cx("h-1.5 flex-1 rounded-full", i <= step ? "bg-gold" : "bg-surface-2")} aria-current={i === step ? "step" : undefined} />)}</ol>
    {step === 0 && <div className="space-y-2"><p className="text-sm text-muted">قبل الإغلاق — هذه العناصر لم تكتمل. أكملها الآن أو تجاوزها بوعي.</p>{progress.missing.length === 0 ? <EmptyState icon="🏆" title="كل شيء مكتمل!" /> : progress.missing.map((m) => <div key={m.id} className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm"><span>{m.kind === "habit" ? "🔁" : m.kind === "recovery" ? "🌱" : "🗡️"} {m.title}</span>{m.kind === "habit" && <Button size="sm" onClick={() => { const h = data.habits.find((x) => x.id === m.id); if (h) dayActions.toggleHabit(date, h); }}>تم ✓</Button>}{m.kind !== "habit" && <Button size="sm" onClick={() => { const t = allDayTasks(data, date, wk).find((x) => x.id === m.id); if (t) dayActions.toggleTask(date, t); }}>تم ✓</Button>}</div>)}</div>}
    {step === 1 && <div className="space-y-3">{data.dailyReviewQuestions.map((q) => <Field key={q.id} label={q.text}><Textarea value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} /></Field>)}</div>}
    {step === 2 && <div className="space-y-2"><p className="text-sm text-muted">أفرغ كل ما في رأسك — بلا ترتيب. ستفرزه لاحقًا في صفحة تفريغ العقل.</p><Textarea autoFocus className="min-h-[180px]" value={dump} onChange={(e) => setDump(e.target.value)} placeholder="أفكار، قلق، مهام، أي شيء…" /></div>}
    {step === 3 && <div className="grid place-items-center gap-3 py-2 text-center"><ProgressRing value={progress.percent} size={140} stroke={12} color="var(--gold)" /><div className="grid w-full grid-cols-3 gap-2 text-xs"><div className="rounded-xl bg-surface-2 p-2"><b className="text-lg">{xpToday}</b><div className="text-muted">XP اليوم</div></div><div className="rounded-xl bg-surface-2 p-2"><b className="text-lg">{progress.requiredDone}/{progress.requiredTotal}</b><div className="text-muted">عادات</div></div><div className="rounded-xl bg-surface-2 p-2"><b className="text-lg">{progress.questsDone + progress.recoveryDone}</b><div className="text-muted">مهام</div></div></div>{progress.missing.filter((m) => m.kind === "habit").length > 0 && <p className="text-xs text-warn">سيتم خصم {data.streakSettings.missPenalty} XP لكل عادة مطلوبة فائتة ({progress.missing.filter((m) => m.kind === "habit").length}).</p>}<p className="text-sm text-muted">{progress.percent >= 80 ? "يوم فارس. نم مطمئنًا." : progress.percent >= 50 ? "يوم مقبول — الاستمرار أهم من الكمال." : "يوم صعب. الصدق في التسجيل هو الانتصار الحقيقي."}</p></div>}
    {step === 4 && <div className="space-y-3"><p className="text-sm">رسالة لنفسك تظهر صباح غد:</p><Textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="غدًا أبدأ بـ…" /><p className="text-xs text-muted">بعد الإغلاق يمكنك إعادة فتح اليوم من الصفحة إذا احتجت تعديلًا.</p></div>}
  </Modal>);
}
export { todayISO, areaOf };
