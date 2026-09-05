"use client";
import React from "react";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, AreaChart, Area } from "recharts";
import { Card, EmptyState } from "@/components/ui";

const axis = { fontSize: 10, fill: "var(--muted)" } as const;
const tip = { contentStyle: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12, color: "var(--text)" }, labelStyle: { color: "var(--muted)" } };

export function ChartCard({ title, subtitle, children, height = 220, empty, action }: { title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; height?: number; empty?: boolean; action?: React.ReactNode }) {
  return (<Card title={title} subtitle={subtitle} action={action}>{empty ? <EmptyState icon="📈" title="لا بيانات بعد" description="ستظهر الرسوم عندما تُسجّل بيانات كافية." /> : <div style={{ height, direction: "ltr" }}>{children}</div>}</Card>);
}
export function LineSeries({ data, x, series, height = 220, title, subtitle, unit, area }: { data: Record<string, unknown>[]; x: string; series: { key: string; color: string; name?: string }[]; height?: number; title: React.ReactNode; subtitle?: React.ReactNode; unit?: string; area?: boolean }) {
  const C = area ? AreaChart : LineChart;
  return (<ChartCard title={title} subtitle={subtitle} height={height} empty={!data.length}><ResponsiveContainer><C data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey={x} tick={axis} /><YAxis tick={axis} unit={unit} /><Tooltip {...tip} />{series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}{series.map((s) => area ? <Area key={s.key} type="monotone" dataKey={s.key} name={s.name ?? s.key} stroke={s.color} fill={s.color} fillOpacity={0.15} strokeWidth={2} connectNulls /> : <Line key={s.key} type="monotone" dataKey={s.key} name={s.name ?? s.key} stroke={s.color} strokeWidth={2} dot={{ r: 2 }} connectNulls />)}</C></ResponsiveContainer></ChartCard>);
}
export function BarSeries({ data, x, series, height = 220, title, subtitle, stacked }: { data: Record<string, unknown>[]; x: string; series: { key: string; color: string; name?: string }[]; height?: number; title: React.ReactNode; subtitle?: React.ReactNode; stacked?: boolean }) {
  return (<ChartCard title={title} subtitle={subtitle} height={height} empty={!data.length}><ResponsiveContainer><BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey={x} tick={axis} /><YAxis tick={axis} /><Tooltip {...tip} cursor={{ fill: "var(--accent-soft)" }} />{series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}{series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.name ?? s.key} fill={s.color} radius={[6, 6, 0, 0]} stackId={stacked ? "a" : undefined} />)}</BarChart></ResponsiveContainer></ChartCard>);
}
export function RadarSeries({ data, series, height = 260, title, subtitle }: { data: { axis: string; [k: string]: number | string }[]; series: { key: string; color: string; name?: string }[]; height?: number; title: React.ReactNode; subtitle?: React.ReactNode }) {
  return (<ChartCard title={title} subtitle={subtitle} height={height} empty={!data.length}><ResponsiveContainer><RadarChart data={data} outerRadius="72%"><PolarGrid stroke="var(--border)" /><PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "var(--text)" }} /><PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />{series.map((s) => <Radar key={s.key} dataKey={s.key} name={s.name ?? s.key} stroke={s.color} fill={s.color} fillOpacity={0.25} />)}{series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}<Tooltip {...tip} /></RadarChart></ResponsiveContainer></ChartCard>);
}
/** خريطة حرارية بسيطة (SVG) للأيام */
export function Heatmap({ cells, colorOf, title }: { cells: { key: string; label: string; value: number }[]; colorOf: (v: number) => string; title?: string }) {
  return (<div role="img" aria-label={title} className="flex flex-wrap gap-1">{cells.map((c) => <div key={c.key} title={`${c.label}: ${c.value}`} className="h-4 w-4 rounded-[4px] border" style={{ background: colorOf(c.value) }} />)}</div>);
}
