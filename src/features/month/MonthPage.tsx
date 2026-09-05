"use client";
import React, { useMemo, useState } from "react";
import { useApp } from "@/stores/app-store";
import { monthRange, periodReport, prevRange } from "@/calculations/goals";
import { addMonths, MONTH_AR, parseISO, todayISO } from "@/core/date";
import { Button, Card, Grid, StatCard, Tabs } from "@/components/ui";
import { BarSeries } from "@/components/charts";
import { Heatmap } from "@/components/charts";
import { PeriodGoals, PeriodReview } from "@/features/week/WeekPage";

export default function MonthPage() {
  const data = useApp((s) => s.data); const [anchor, setAnchor] = useState(todayISO()); const [tab, setTab] = useState<"report" | "goals" | "review">("report");
  const r = monthRange(anchor); const d = parseISO(anchor);
  const rep = useMemo(() => periodReport(data, r), [data, r]); const prev = useMemo(() => periodReport(data, prevRange(r)), [data, r]);
  const colorOf = (v: number) => (v <= 0 ? "var(--surface-2)" : `color-mix(in srgb, var(--accent) ${Math.max(15, v)}%, var(--surface-2))`);
  return (<div className="space-y-4 anim-fade-up">
    <Card><div className="flex items-center justify-between"><Button size="sm" onClick={() => setAnchor(addMonths(anchor, -1))} aria-label="الشهر السابق">‹</Button><div className="text-center"><div className="text-sm font-extrabold">{MONTH_AR[d.getMonth()]} {d.getFullYear()}</div><div className="text-[11px] text-muted">{rep.range.from} → {rep.range.to}</div></div><Button size="sm" onClick={() => setAnchor(addMonths(anchor, 1))} aria-label="الشهر التالي">›</Button></div></Card>
    <Tabs value={tab} onChange={setTab} tabs={[{ id: "report", label: "التقرير" }, { id: "goals", label: "الأهداف" }, { id: "review", label: "المراجعة" }]} />
    {tab === "report" && <div className="space-y-3">
      <Grid cols={4}><StatCard label="XP الشهر" value={rep.xp} hint={`الشهر السابق ${prev.xp}`} tone="gold" icon="⚡" /><StatCard label="متوسط الإنجاز" value={`${rep.avgScore}%`} hint={`السابق ${prev.avgScore}%`} tone="accent" icon="📊" /><StatCard label="أيام مسجلة" value={rep.scoredDays} hint={`${rep.closedDays} مغلقة`} icon="📅" /><StatCard label="أفضل يوم" value={rep.bestDay ? rep.bestDay.slice(8) : "—"} hint={rep.bestDay ? `${rep.days.find((x) => x.date === rep.bestDay)?.score}%` : ""} icon="🏆" /></Grid>
      <Card title="خريطة الشهر" subtitle="لون أقوى = إنجاز أعلى"><Heatmap title="إنجاز أيام الشهر" cells={rep.days.map((x) => ({ key: x.date, label: x.date, value: x.score ?? 0 }))} colorOf={colorOf} /></Card>
      <BarSeries title="XP يوميًا" data={rep.days.map((x) => ({ d: x.date.slice(8), xp: x.xp, score: x.score ?? 0 }))} x="d" series={[{ key: "xp", color: "var(--gold)", name: "XP" }, { key: "score", color: "var(--accent)", name: "إنجاز %" }]} />
      {rep.misses.length > 0 && <StatCard label="عقوبات العادات هذا الشهر" value={`-${rep.habitMissPenalty} XP`} hint={`${rep.misses.length} فوات`} tone="danger" />}
    </div>}
    {tab === "goals" && <PeriodGoals r={r} />}
    {tab === "review" && <PeriodReview key={r.key} r={r} questions={data.monthlyReviewQuestions} reviews={data.monthlyReviews} />}
  </div>);
}
