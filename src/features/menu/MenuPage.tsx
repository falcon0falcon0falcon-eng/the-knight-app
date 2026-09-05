"use client";
import React, { useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/app/routes";
import { useApp, useLevel } from "@/stores/app-store";
import { rankForLevel, totalXp } from "@/calculations/gamification";
import { computeDayProgress } from "@/calculations/daily";
import { sobrietyStats, computeRisk } from "@/calculations/recovery";
import { dueReviewPages } from "@/calculations/quran";
import { todayISO, weekKey, uid, nowISO } from "@/core/date";
import { Button, Card, Grid, Input, ProgressBar, RankBadge, StatCard, cx } from "@/components/ui";

export default function MenuPage() {
  const data = useApp((s) => s.data); const update = useApp((s) => s.update); const lvl = useLevel(); const today = todayISO();
  const prog = computeDayProgress(data, today, weekKey(today)); const sob = sobrietyStats(data); const risk = computeRisk(data); const due = dueReviewPages(data.quranMemorization, today).length;
  const [step, setStep] = useState(""); const plan = data.startupPlan;
  return (<div className="space-y-4 anim-fade-up">
    <Card className="flex items-center gap-4"><RankBadge rank={rankForLevel(lvl.level)} level={lvl.level} size="lg" /><div className="flex-1"><div className="text-xl font-black">{data.bodyProfile.name || "الفارس الفارغ"}</div><div className="text-xs text-muted">{totalXp(data.xpLog)} XP إجمالي</div><ProgressBar value={lvl.progress * 100} color="var(--gold)" className="mt-2" label="تقدم المستوى" /></div></Card>
    <Grid cols={4}><StatCard label="إنجاز اليوم" value={`${prog.percent}%`} tone="accent" icon="☀️" /><StatCard label="أيام نظيفة" value={sob.startAt ? sob.currentDays : "—"} hint={sob.startAt ? `الخطر: ${risk.label}` : "لم تبدأ"} tone="ok" icon="🌱" /><StatCard label="مراجعات قرآن" value={due} tone={due > 0 ? "warn" : undefined} icon="📖" /><StatCard label="تحديات نشطة" value={data.challenges.filter((c) => c.status === "active").length} icon="⚔️" /></Grid>
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{ROUTES.filter((r) => r.id !== "menu").map((r) => <Link key={r.id} href={r.path} className={cx("card touch flex items-center gap-3 p-3 transition hover:border-accent/50")}><span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-xl" aria-hidden>{r.icon}</span><span className="text-sm font-bold">{r.label}</span></Link>)}</div>
    <Card title="خطة الانطلاق" subtitle="خطوات البدء الأولى — تُحفظ كما هي"><ul className="mb-2 space-y-1">{plan.steps.map((s) => <li key={s.id} className="flex items-center gap-2 text-sm"><button type="button" role="checkbox" aria-checked={s.done} aria-label={s.text} onClick={() => update("startupPlan", (p) => ({ steps: p.steps.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)), updatedAt: nowISO() }))} className={cx("touch grid h-9 w-9 place-items-center rounded-lg border-2", s.done && "border-transparent bg-ok text-white")}>{s.done ? "✓" : ""}</button><span className={cx("flex-1", s.done && "line-through opacity-60")}>{s.text}</span><button type="button" aria-label="حذف" onClick={() => update("startupPlan", (p) => ({ steps: p.steps.filter((x) => x.id !== s.id), updatedAt: nowISO() }))}>✕</button></li>)}</ul><div className="flex gap-2"><Input value={step} onChange={(e) => setStep(e.target.value)} placeholder="خطوة…" onKeyDown={(e) => { if (e.key === "Enter" && step.trim()) { update("startupPlan", (p) => ({ steps: [...p.steps, { id: uid("sp"), text: step.trim(), done: false }], updatedAt: nowISO() })); setStep(""); } }} /><Button onClick={() => { if (step.trim()) { update("startupPlan", (p) => ({ steps: [...p.steps, { id: uid("sp"), text: step.trim(), done: false }], updatedAt: nowISO() })); setStep(""); } }}>إضافة</Button></div></Card>
  </div>);
}
