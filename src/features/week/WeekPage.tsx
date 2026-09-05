"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "@/stores/app-store";
import { goalActions } from "@/stores/actions";
import { AREAS, AreaId, GoalKind } from "@/types/app-data";
import { goalProgress, lifetimeAverages, materializeGoals, periodReport, PeriodRange, prevRange, trendSeries, weekRange } from "@/calculations/goals";
import { METRICS } from "@/calculations/metrics";
import { addDays, formatShort, isFutureDate, todayISO, uid, WEEKDAY_AR, weekday, weekKey } from "@/core/date";
import { Button, Card, Chip, EmptyState, Field, GoalCard, Grid, Input, Modal, Select, StatCard, Tabs, Textarea, cx, useConfirm, AreaChip } from "@/components/ui";
import { BarSeries, LineSeries } from "@/components/charts";

export default function WeekPage() {
  const data = useApp((s) => s.data); const [anchor, setAnchor] = useState(todayISO()); const [tab, setTab] = useState<"plan" | "goals" | "report" | "review">("plan");
  const r = weekRange(anchor);
  return (<div className="space-y-4 anim-fade-up">
    <Card><div className="flex items-center justify-between"><Button size="sm" onClick={() => setAnchor(addDays(anchor, -7))} aria-label="الأسبوع السابق">‹</Button><div className="text-center"><div className="text-sm font-extrabold">أسبوع {formatShort(r.from)} → {formatShort(r.to)}</div><div className="text-[11px] text-muted">يبدأ السبت · {r.key === weekKey(todayISO()) ? "الأسبوع الحالي" : r.from > todayISO() ? "تخطيط مستقبلي" : "أسبوع سابق"}</div></div><Button size="sm" onClick={() => setAnchor(addDays(anchor, 7))} aria-label="الأسبوع التالي">›</Button></div></Card>
    <Tabs value={tab} onChange={setTab} tabs={[{ id: "plan", label: "الخطة" }, { id: "goals", label: "الأهداف" }, { id: "report", label: "التقرير" }, { id: "review", label: "المراجعة" }]} />
    {tab === "plan" && <Planner r={r} />}
    {tab === "goals" && <PeriodGoals r={r} />}
    {tab === "report" && <WeekReport r={r} />}
    {tab === "review" && <PeriodReview key={r.key} r={r} questions={data.weeklyReviewQuestions} reviews={data.weeklyReviews} />}
  </div>);
}

function Planner({ r }: { r: PeriodRange }) {
  const data = useApp((s) => s.data); const plans = data.weeklyPlans[r.key] ?? {}; const [target, setTarget] = useState<string | null>(null); const [title, setTitle] = useState(""); const [area, setArea] = useState<AreaId>("mental"); const [diff, setDiff] = useState<1 | 2 | 3 | 4 | 5>(2);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(r.from, i));
  const add = () => { if (!target || !title.trim()) return; goalActions.planTask(r.key, target, { title: title.trim(), area, difficulty: diff, metrics: [] }); setTitle(""); setTarget(null); };
  return (<div className="space-y-3"><p className="text-xs text-muted">المهام المخططة هنا تظهر تلقائيًا في «يومي» في تاريخها وتُكسب XP عند إنجازها.</p>
    <div className="grid gap-2 md:grid-cols-7">{dates.map((d) => { const list = plans[d] ?? []; const doneIds = new Set((data.entries[d]?.tasks ?? []).filter((t) => t.done).map((t) => t.planId)); const isToday = d === todayISO(); return <div key={d} className={cx("card p-2.5", isToday && "border-accent")}><div className="mb-1 flex items-center justify-between"><span className="text-xs font-extrabold">{WEEKDAY_AR[weekday(d)]}</span><span className="text-[10px] text-muted">{formatShort(d)}</span></div><ul className="space-y-1">{list.map((p) => <li key={p.id} className={cx("flex items-center justify-between rounded-lg bg-surface-2 px-2 py-1 text-xs", doneIds.has(p.id) && "line-through opacity-60")}><span className="truncate">{p.title}</span><button type="button" aria-label="إزالة" className="text-muted" onClick={() => goalActions.unplanTask(r.key, d, p.id)}>✕</button></li>)}</ul><button type="button" className="touch mt-1 w-full rounded-lg border border-dashed text-xs text-muted hover:bg-surface-2" onClick={() => setTarget(d)}>+ مهمة</button></div>; })}</div>
    <Modal open={!!target} onClose={() => setTarget(null)} title={`تخطيط مهمة · ${target ? WEEKDAY_AR[weekday(target)] : ""}`} footer={<Button variant="primary" onClick={add}>إضافة</Button>}><div className="space-y-3"><Field label="المهمة"><Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} /></Field><Field label="المحور"><div className="flex flex-wrap gap-1.5">{AREAS.map((a) => <Chip key={a.id} active={area === a.id} color={a.color} onClick={() => setArea(a.id)}>{a.emoji} {a.label}</Chip>)}</div></Field><Field label="الصعوبة"><div className="flex gap-1.5">{([1, 2, 3, 4, 5] as const).map((d) => <Chip key={d} active={diff === d} onClick={() => setDiff(d)}>{"★".repeat(d)}</Chip>)}</div></Field></div></Modal>
  </div>);
}

/** محرك الأهداف المشترك للأسبوع والشهر */
export function PeriodGoals({ r }: { r: PeriodRange }) {
  const data = useApp((s) => s.data); const period = r.period; const goals = period === "week" ? data.weeklyGoals : data.monthlyGoals; const templates = period === "week" ? data.weeklyGoalTemplates : data.monthlyGoalTemplates;
  const { confirm, dialog } = useConfirm(); const [open, setOpen] = useState(false); const [asTemplate, setAsTemplate] = useState(false);
  const [form, setForm] = useState<{ title: string; kind: GoalKind; metric: string; goalRef: string; target: number; unit: string; area: AreaId; xp: number }>({ title: "", kind: "recurring", metric: "gymSessions", goalRef: "quranMem", target: 3, unit: "", area: "physical", xp: 20 });
  // materialize من القوالب + ترحيل milestones
  useEffect(() => { const m = materializeGoals(goals, templates, data, r, () => uid("goal")); const mine = goals.filter((g) => g.periodKey === r.key); if (m.length !== mine.length) goalActions.setAll(period, m); }, [r.key, templates.length]); // eslint-disable-line react-hooks/exhaustive-deps -- materialize once per period
  const mine = goals.filter((g) => g.periodKey === r.key);
  useEffect(() => { for (const g of mine) { if (g.kind === "manual") continue; const p = goalProgress(g, data, r); if (p.done && !data.xpLog.some((e) => e.ref === `goal:${g.id}`)) goalActions.markAchieved(g); } }, [data, mine, r]);
  const submit = () => { if (!form.title.trim()) return; const m = METRICS.find((x) => x.id === form.metric); const base = { title: form.title.trim(), kind: form.kind, metric: form.kind === "recurring" || form.kind === "milestone" ? form.metric : undefined, goalRef: form.kind === "percentage" ? form.goalRef : undefined, target: form.kind === "manual" ? 1 : form.target, unit: form.kind === "percentage" ? "%" : form.unit || m?.unit || "", area: form.area, period, xp: form.xp }; if (asTemplate) goalActions.addTemplate(base); else goalActions.add({ ...base, periodKey: r.key }); setOpen(false); setForm({ ...form, title: "" }); };
  return (<div className="space-y-3">
    {mine.length === 0 && <EmptyState icon="🎯" title={`لا أهداف لهذا ${period === "week" ? "الأسبوع" : "الشهر"}`} description="أهداف متكررة تُحسب من بياناتك الحقيقية، يدوية، معالم تُرحّل تلقائيًا، أو نسبة من هدف طويل." />}
    <div className="grid gap-2 md:grid-cols-2">{mine.map((g) => { const p = goalProgress(g, data, r); return <GoalCard key={g.id} title={g.title} percent={p.percent} value={p.value} target={p.target} unit={g.unit} kind={g.kind} area={g.area} carried={g.carried} done={p.done}>{g.kind === "manual" && <Button size="sm" variant={g.done ? "soft" : "primary"} onClick={() => goalActions.toggleManual(g)}>{g.done ? "إلغاء" : "تم ✓"}</Button>}{(g.kind === "milestone" || (g.kind === "recurring" && !g.metric) || (g.kind === "percentage" && !["quranMem", "savings", "income", "weight"].includes(g.goalRef ?? ""))) && <div className="flex items-center gap-1"><Button size="sm" onClick={() => goalActions.setManualValue(g, (g.manualValue ?? 0) + 1)}>+1</Button><Button size="sm" onClick={() => goalActions.setManualValue(g, Math.max(0, (g.manualValue ?? 0) - 1))}>−1</Button></div>}<Button size="sm" variant="ghost" onClick={() => confirm("حذف الهدف؟", () => goalActions.remove(g))}>حذف</Button></GoalCard>; })}</div>
    <div className="flex flex-wrap gap-2"><Button variant="primary" onClick={() => { setAsTemplate(false); setOpen(true); }}>+ هدف</Button><Button onClick={() => { setAsTemplate(true); setOpen(true); }}>+ هدف متكرر (قالب)</Button></div>
    {templates.length > 0 && <Card title="القوالب المتكررة" subtitle="تُنشأ تلقائيًا كل فترة"><ul className="space-y-1 text-sm">{templates.map((t) => <li key={t.id} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2"><span>{t.title} <AreaChip id={t.area} small /></span><button type="button" className="text-xs text-muted" onClick={() => goalActions.removeTemplate(period, t.id)}>إزالة</button></li>)}</ul></Card>}
    <Modal open={open} onClose={() => setOpen(false)} title={asTemplate ? "قالب هدف متكرر" : "هدف جديد"} footer={<Button variant="primary" onClick={submit}>حفظ</Button>}>
      <div className="space-y-3"><Field label="العنوان"><Input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="النوع"><div className="flex flex-wrap gap-1.5">{([["recurring", "متكرر (من البيانات)"], ["manual", "يدوي"], ["milestone", "معلم (يُرحّل)"], ["percentage", "نسبة من هدف"]] as const).map(([k, l]) => <Chip key={k} active={form.kind === k} onClick={() => setForm({ ...form, kind: k })}>{l}</Chip>)}</div></Field>
        {(form.kind === "recurring" || form.kind === "milestone") && <Field label="المقياس"><Select value={form.metric} onChange={(e) => { const m = METRICS.find((x) => x.id === e.target.value); setForm({ ...form, metric: e.target.value, area: m?.area ?? form.area, unit: m?.unit ?? "" }); }}>{METRICS.map((m) => <option key={m.id} value={m.id}>{m.label} ({m.unit})</option>)}</Select></Field>}
        {form.kind === "percentage" && <Field label="مرتبط بـ"><Select value={form.goalRef} onChange={(e) => setForm({ ...form, goalRef: e.target.value })}><option value="quranMem">هدف حفظ القرآن</option><option value="savings">هدف الادخار</option><option value="income">هدف الدخل</option><option value="weight">هدف الوزن</option><option value="manual">يدوي (%)</option></Select></Field>}
        {form.kind !== "manual" && <Grid><Field label={form.kind === "percentage" ? "النسبة المستهدفة %" : "الهدف"}><Input type="number" inputMode="decimal" value={form.target} onChange={(e) => setForm({ ...form, target: Number(e.target.value) })} /></Field><Field label="XP عند التحقيق"><Input type="number" value={form.xp} onChange={(e) => setForm({ ...form, xp: Number(e.target.value) })} /></Field></Grid>}
        <Field label="المحور"><div className="flex flex-wrap gap-1.5">{AREAS.map((a) => <Chip key={a.id} active={form.area === a.id} color={a.color} onClick={() => setForm({ ...form, area: a.id })}>{a.emoji} {a.label}</Chip>)}</div></Field></div>
    </Modal>{dialog}
  </div>);
}

function WeekReport({ r }: { r: PeriodRange }) {
  const data = useApp((s) => s.data); const rep = useMemo(() => periodReport(data, r), [data, r]); const prev = useMemo(() => periodReport(data, prevRange(r)), [data, r]); const life = useMemo(() => lifetimeAverages(data), [data]); const trend = useMemo(() => trendSeries(data, 8, r.to), [data, r]);
  const [refl, setRefl] = useState(""); const delta = (a: number, b: number) => (a - b > 0 ? `▲ ${a - b}` : a - b < 0 ? `▼ ${b - a}` : "=");
  const misses = rep.misses.reduce<Record<string, number>>((m, x) => { m[x.habitId] = (m[x.habitId] ?? 0) + 1; return m; }, {});
  return (<div className="space-y-3">
    <Grid cols={4}><StatCard label="XP الأسبوع" value={rep.xp} hint={`السابق ${prev.xp} · ${delta(rep.xp, prev.xp)}`} tone="gold" icon="⚡" /><StatCard label="متوسط الإنجاز" value={`${rep.avgScore}%`} hint={`السابق ${prev.avgScore}% · ${delta(rep.avgScore, prev.avgScore)}`} tone="accent" icon="📊" /><StatCard label="أيام مسجلة" value={`${rep.scoredDays}/7`} hint={`${rep.closedDays} مغلقة`} icon="📅" /><StatCard label="عقوبات العادات" value={`-${rep.habitMissPenalty}`} hint={`${rep.misses.length} فوات`} tone="danger" icon="⚠️" /></Grid>
    <BarSeries title="أيام الأسبوع" data={rep.days.map((d) => ({ day: WEEKDAY_AR[weekday(d.date)].slice(0, 3), score: d.score ?? 0, xp: d.xp }))} x="day" series={[{ key: "score", color: "var(--accent)", name: "الإنجاز %" }, { key: "xp", color: "var(--gold)", name: "XP" }]} />
    <LineSeries title="اتجاه 8 أسابيع" data={trend} x="label" series={[{ key: "score", color: "var(--accent)", name: "متوسط الإنجاز" }, { key: "xp", color: "var(--gold)", name: "XP" }]} area />
    <Grid><StatCard label="متوسط XP الأسبوعي (عمري)" value={life.avgWeeklyXp} hint={`${life.weeks} أسبوع`} /><StatCard label="متوسط الإنجاز (عمري)" value={`${life.avgScore}%`} hint={`${life.totalDays} يوم`} /></Grid>
    {Object.keys(misses).length > 0 && <Card title="عادات فاتت هذا الأسبوع"><ul className="grid gap-1 text-sm sm:grid-cols-2">{Object.entries(misses).map(([id, n]) => <li key={id} className="flex justify-between rounded-xl bg-surface-2 px-3 py-1.5"><span>{data.habits.find((h) => h.id === id)?.name ?? id}</span><span className="text-danger">×{n}</span></li>)}</ul></Card>}
    <Card title="تأملات الأسبوع"><ul className="mb-2 space-y-1 text-sm">{data.reflections.filter((x) => x.date >= r.from && x.date <= r.to).map((x) => <li key={x.id} className="rounded-xl bg-surface-2 px-3 py-2"><span className="text-[10px] text-muted">{formatShort(x.date)}</span> — {x.text}</li>)}</ul><div className="flex gap-2"><Input placeholder="تأمل سريع…" value={refl} onChange={(e) => setRefl(e.target.value)} /><Button disabled={!refl.trim() || isFutureDate(r.from)} onClick={() => { goalActions.addReflection(todayISO() <= r.to && todayISO() >= r.from ? todayISO() : r.to, refl.trim()); setRefl(""); }}>حفظ</Button></div></Card>
  </div>);
}

export function PeriodReview({ r, questions, reviews }: { r: PeriodRange; questions: { id: string; text: string }[]; reviews: { periodKey: string; answers: Record<string, string> }[] }) {
  const existing = reviews.find((x) => x.periodKey === r.key); const [answers, setAnswers] = useState<Record<string, string>>(existing?.answers ?? {});
  return (<Card title={r.period === "week" ? "المراجعة الأسبوعية" : "المراجعة الشهرية"} subtitle={existing ? "محفوظة — يمكنك التعديل" : `+${r.period === "week" ? 25 : 60} XP عند الحفظ`}><div className="space-y-3">{questions.map((q) => <Field key={q.id} label={q.text}><Textarea value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} /></Field>)}<Button variant="primary" onClick={() => goalActions.saveReview(r.period, r.key, answers)}>حفظ المراجعة</Button></div></Card>);
}

