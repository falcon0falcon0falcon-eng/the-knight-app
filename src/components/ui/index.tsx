"use client";
import React, { useEffect, useId, useRef, useState } from "react";
import { AREAS, AreaId } from "@/types/app-data";
import { Rank, RANK_COLOR, RANK_LABEL } from "@/calculations/gamification";
import { formatArabic, isFutureDate, addDays, todayISO } from "@/core/date";

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");
export const areaOf = (id: AreaId) => AREAS.find((a) => a.id === id) ?? AREAS[0];

// ─── Layout ──────────────────────────────────────────────────────────────────
export function Card({ children, className, title, subtitle, action, tone }: { children?: React.ReactNode; className?: string; title?: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; tone?: "gold" | "accent" | "danger" }) {
  return (
    <section className={cx("card p-4 md:p-5", tone === "gold" && "border-gold/40", tone === "accent" && "border-accent/40", tone === "danger" && "border-danger/40", className)}>
      {(title || action) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>{title && <h3 className="text-base font-bold leading-tight">{title}</h3>}{subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}</div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
export function Section({ title, subtitle, children, action, className }: { title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (<section className={cx("space-y-3", className)}><div className="flex items-end justify-between gap-2"><div><h2 className="text-lg font-extrabold tracking-tight">{title}</h2>{subtitle && <p className="text-xs text-muted">{subtitle}</p>}</div>{action}</div>{children}</section>);
}
export function CollapsibleSection({ title, subtitle, children, defaultOpen = true, badge }: { title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; badge?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen); const id = useId();
  return (<section className="card overflow-hidden"><button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className="touch flex w-full items-center justify-between gap-3 px-4 py-3 text-start"><div className="flex items-center gap-2"><span className="text-base font-bold">{title}</span>{badge}</div><div className="flex items-center gap-2">{subtitle && <span className="text-xs text-muted">{subtitle}</span>}<span aria-hidden className={cx("transition-transform", open && "rotate-180")}>⌄</span></div></button>{open && <div id={id} className="border-t px-4 pb-4 pt-3">{children}</div>}</section>);
}
export function StatCard({ label, value, hint, icon, tone, className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; tone?: "gold" | "accent" | "ok" | "danger" | "warn"; className?: string }) {
  const c = { gold: "text-gold", accent: "text-accent", ok: "text-ok", danger: "text-danger", warn: "text-warn" } as const;
  return (<div className={cx("card flex items-center gap-3 p-3", className)}>{icon && <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-lg" aria-hidden>{icon}</div>}<div className="min-w-0"><div className="text-[11px] text-muted">{label}</div><div className={cx("truncate text-xl font-extrabold tabular-nums", tone && c[tone])}>{value}</div>{hint && <div className="text-[11px] text-muted">{hint}</div>}</div></div>);
}
export function Grid({ children, cols = 2, className }: { children: React.ReactNode; cols?: 2 | 3 | 4; className?: string }) { return <div className={cx("grid gap-3", cols === 2 && "grid-cols-2", cols === 3 && "grid-cols-2 md:grid-cols-3", cols === 4 && "grid-cols-2 md:grid-cols-4", className)}>{children}</div>; }

// ─── Progress ────────────────────────────────────────────────────────────────
export function ProgressRing({ value, size = 84, stroke = 8, color = "var(--accent)", label, children }: { value: number; size?: number; stroke?: number; color?: string; label?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r; const v = Math.max(0, Math.min(100, value));
  return (<div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}><svg width={size} height={size} className="-rotate-90"><circle cx={size / 2} cy={size / 2} r={r} stroke="var(--border)" strokeWidth={stroke} fill="none" /><circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (v / 100) * c} style={{ transition: "stroke-dashoffset .5s ease" }} /></svg><div className="absolute inset-0 grid place-items-center text-center">{children ?? <span className="text-lg font-extrabold tabular-nums">{Math.round(v)}%</span>}</div></div>);
}
export function ProgressBar({ value, color = "var(--accent)", label, className, height = 8 }: { value: number; color?: string; label?: string; className?: string; height?: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (<div className={cx("w-full overflow-hidden rounded-full bg-surface-2", className)} style={{ height }} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}><div className="h-full rounded-full" style={{ width: `${v}%`, background: color, transition: "width .4s ease" }} /></div>);
}
export function XPBadge({ xp, small }: { xp: number; small?: boolean }) { return <span className={cx("inline-flex items-center gap-1 rounded-full bg-gold-soft font-bold text-gold tabular-nums", small ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs")}>⚡ {xp > 0 ? `+${xp}` : xp}</span>; }
export function RankBadge({ rank, level, size = "md" }: { rank: Rank; level: number; size?: "sm" | "md" | "lg" }) {
  const s = { sm: "h-8 w-8 text-sm", md: "h-12 w-12 text-xl", lg: "h-20 w-20 text-4xl" }[size];
  return (<div className="flex items-center gap-2"><div className={cx("grid place-items-center rounded-2xl font-black text-black shadow-lg", s)} style={{ background: `linear-gradient(135deg, ${RANK_COLOR[rank]}, #fff 160%)` }} aria-label={`الرتبة ${rank}`}>{rank}</div>{size !== "sm" && <div><div className="text-xs text-muted">{RANK_LABEL[rank]}</div><div className="text-sm font-bold">المستوى {level}</div></div>}</div>);
}
export function AreaChip({ id, small }: { id: AreaId; small?: boolean }) { const a = areaOf(id); return <span className={cx("inline-flex items-center gap-1 rounded-full font-semibold", small ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs")} style={{ background: `${a.color}22`, color: a.color }}>{a.emoji} {a.label}</span>; }
export function Chip({ children, active, onClick, color, className }: { children: React.ReactNode; active?: boolean; onClick?: () => void; color?: string; className?: string }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={cx("touch inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition", active ? "border-transparent bg-accent text-white" : "bg-surface-2 hover:border-accent/50", className)} style={active && color ? { background: color } : undefined}>{children}</button>;
}

// ─── Controls ────────────────────────────────────────────────────────────────
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "gold" | "danger" | "soft"; size?: "sm" | "md" | "lg"; block?: boolean };
export function Button({ variant = "soft", size = "md", block, className, ...p }: BtnProps) {
  const v = { primary: "bg-accent text-white hover:brightness-110", ghost: "bg-transparent hover:bg-surface-2", gold: "bg-gold text-black hover:brightness-110", danger: "bg-danger/15 text-danger hover:bg-danger/25", soft: "bg-surface-2 hover:bg-line" }[variant];
  const s = { sm: "px-2.5 py-1.5 text-xs min-h-[36px]", md: "px-4 py-2 text-sm min-h-[44px]", lg: "px-5 py-3 text-base min-h-[52px]" }[size];
  return <button type="button" {...p} className={cx("inline-flex items-center justify-center gap-2 rounded-xl font-bold transition disabled:cursor-not-allowed disabled:opacity-45", v, s, block && "w-full", className)} />;
}
export function Field({ label, hint, children, className }: { label?: string; hint?: string; children: React.ReactNode; className?: string }) { return <label className={cx("block", className)}>{label && <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>}{children}{hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}</label>; }
const inputCls = "touch w-full rounded-xl border px-3 py-2 text-sm outline-none transition focus:border-accent";
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) { return <input ref={ref} {...p} className={cx(inputCls, className)} />; });
export function Textarea({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...p} className={cx(inputCls, "min-h-[88px] resize-y", className)} />; }
export function Select({ className, children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) { return <select {...p} className={cx(inputCls, className)}>{children}</select>; }
export function NumberInput({ value, onChange, min = 0, max = 99999, step = 1, suffix, className, ariaLabel }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string; className?: string; ariaLabel?: string }) {
  return (<div className={cx("flex items-stretch overflow-hidden rounded-xl border", className)}><button type="button" className="touch px-3 text-lg hover:bg-surface-2" aria-label="نقص" onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}>−</button><div className="flex flex-1 items-center justify-center gap-1"><input aria-label={ariaLabel} type="number" inputMode="decimal" value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step} onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value))))} className="w-full bg-transparent text-center text-sm font-bold tabular-nums outline-none" />{suffix && <span className="text-xs text-muted">{suffix}</span>}</div><button type="button" className="touch px-3 text-lg hover:bg-surface-2" aria-label="زيادة" onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))}>+</button></div>);
}
export function Slider({ value, onChange, min = 0, max = 10, step = 1, label, marks }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; label: string; marks?: [string, string] }) {
  return (<div><div className="mb-1 flex items-center justify-between text-xs"><span className="font-semibold text-muted">{label}</span><span className="font-bold tabular-nums">{value}</span></div><input type="range" aria-label={label} aria-valuetext={String(value)} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="touch w-full" />{marks && <div className="flex justify-between text-[10px] text-muted"><span>{marks[0]}</span><span>{marks[1]}</span></div>}</div>);
}
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (<button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cx("relative h-7 w-12 shrink-0 rounded-full transition", checked ? "bg-accent" : "bg-line")}><span className={cx("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all", checked ? "start-[calc(100%-1.6rem)]" : "start-0.5")} /></button>);
}
export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: React.ReactNode; badge?: React.ReactNode }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (<div role="tablist" className={cx("no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-surface-2 p-1", className)}>{tabs.map((t) => (<button key={t.id} role="tab" type="button" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={cx("touch flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-sm font-bold transition", value === t.id ? "bg-surface shadow" : "text-muted hover:text-ink")}>{t.label}{t.badge}</button>))}</div>);
}
export const SegmentedControl = Tabs;
export function DateNavigator({ date, onChange, allowFuture = false }: { date: string; onChange: (d: string) => void; allowFuture?: boolean }) {
  const nextDisabled = !allowFuture && isFutureDate(addDays(date, 1)); const isToday = date === todayISO();
  return (<div className="flex items-center justify-between gap-2"><Button size="sm" aria-label="اليوم السابق" onClick={() => onChange(addDays(date, -1))}>‹</Button><div className="text-center"><div className="text-sm font-extrabold">{formatArabic(date)}</div>{!isToday && <button type="button" className="text-[11px] text-accent underline" onClick={() => onChange(todayISO())}>العودة لليوم</button>}{isToday && <div className="text-[11px] text-muted">اليوم</div>}</div><Button size="sm" aria-label="اليوم التالي" disabled={nextDisabled} onClick={() => onChange(addDays(date, 1))}>›</Button></div>);
}

// ─── Overlays ────────────────────────────────────────────────────────────────
function useFocusTrap(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return; const prev = document.activeElement as HTMLElement | null; const el = ref.current;
    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])') ?? []).filter((x) => !x.hasAttribute("disabled"));
    setTimeout(() => (focusables()[0] ?? el)?.focus(), 10);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } if (e.key === "Tab") { const f = focusables(); if (!f.length) return; const i = f.indexOf(document.activeElement as HTMLElement); if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } } };
    document.addEventListener("keydown", onKey); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; prev?.focus?.(); };
  }, [open, onClose]);
  return ref;
}
export function Modal({ open, onClose, title, children, footer, size = "md", sheetOnMobile = true }: { open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; size?: "sm" | "md" | "lg" | "xl" | "full"; sheetOnMobile?: boolean }) {
  const ref = useFocusTrap(open, onClose); const id = useId(); if (!open) return null;
  const w = { sm: "md:max-w-sm", md: "md:max-w-lg", lg: "md:max-w-2xl", xl: "md:max-w-4xl", full: "md:max-w-[96vw] md:h-[94vh]" }[size];
  return (<div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-0 md:items-center md:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div ref={ref} role="dialog" aria-modal="true" aria-labelledby={title ? id : undefined} tabIndex={-1} className={cx("card flex max-h-[92vh] w-full flex-col overflow-hidden outline-none", sheetOnMobile ? "rounded-b-none rounded-t-3xl anim-sheet md:rounded-2xl" : "rounded-2xl", w)}>{sheetOnMobile && <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-line md:hidden" aria-hidden />}{title && <header className="flex items-center justify-between gap-3 border-b px-4 py-3"><h2 id={id} className="text-base font-extrabold">{title}</h2><button type="button" onClick={onClose} aria-label="إغلاق" className="touch grid place-items-center rounded-xl hover:bg-surface-2">✕</button></header>}<div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>{footer && <footer className="flex flex-wrap justify-end gap-2 border-t px-4 py-3">{footer}</footer>}</div></div>);
}
export const BottomSheet = Modal;
export function Drawer({ open, onClose, title, children, side = "end" }: { open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode; side?: "start" | "end" }) {
  const ref = useFocusTrap(open, onClose); if (!open) return null;
  return (<div className="fixed inset-0 z-[80] bg-black/55" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div ref={ref} role="dialog" aria-modal="true" tabIndex={-1} className={cx("card absolute top-0 h-full w-[88vw] max-w-sm overflow-y-auto rounded-none outline-none", side === "end" ? "end-0" : "start-0")}><header className="flex items-center justify-between border-b px-4 py-3"><h2 className="font-extrabold">{title}</h2><button type="button" onClick={onClose} aria-label="إغلاق" className="touch rounded-xl hover:bg-surface-2">✕</button></header><div className="p-4">{children}</div></div></div>);
}
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = "تأكيد", danger }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; message?: React.ReactNode; confirmLabel?: string; danger?: boolean }) {
  return (<Modal open={open} onClose={onClose} title={title} size="sm" footer={<><Button onClick={onClose}>إلغاء</Button><Button variant={danger ? "danger" : "primary"} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button></>}><p className="text-sm text-muted">{message}</p></Modal>);
}
export function useConfirm() {
  const [state, setState] = useState<{ title: string; message?: React.ReactNode; onConfirm: () => void; danger?: boolean } | null>(null);
  const confirm = (title: string, onConfirm: () => void, message?: React.ReactNode, danger = true) => setState({ title, message, onConfirm, danger });
  const dialog = <ConfirmDialog open={!!state} onClose={() => setState(null)} onConfirm={() => state?.onConfirm()} title={state?.title ?? ""} message={state?.message} danger={state?.danger} />;
  return { confirm, dialog };
}

// ─── States ──────────────────────────────────────────────────────────────────
export function EmptyState({ icon = "✨", title, description, action }: { icon?: string; title: string; description?: string; action?: React.ReactNode }) { return <div className="grid place-items-center gap-2 rounded-2xl border border-dashed p-6 text-center"><div className="text-3xl" aria-hidden>{icon}</div><div className="font-bold">{title}</div>{description && <p className="max-w-sm text-xs text-muted">{description}</p>}{action}</div>; }
export function LoadingState({ text = "جارٍ التحميل…" }: { text?: string }) { return <div className="flex items-center justify-center gap-3 p-8 text-sm text-muted" role="status" aria-live="polite"><span className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />{text}</div>; }
export function ErrorState({ title = "حدث خطأ", message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) { return <div role="alert" className="rounded-2xl border border-danger/40 bg-danger/5 p-4 text-sm"><div className="font-bold text-danger">{title}</div>{message && <p className="mt-1 text-muted">{message}</p>}{onRetry && <Button size="sm" className="mt-2" onClick={onRetry}>إعادة المحاولة</Button>}</div>; }

// ─── Domain rows ─────────────────────────────────────────────────────────────
export function HabitRow({ name, emoji, area, done, state, streak, xp, onToggle, disabled, trailing }: { name: string; emoji?: string; area: AreaId; done: boolean; state: "required" | "optional" | "off"; streak: number; xp: number; onToggle: () => void; disabled?: boolean; trailing?: React.ReactNode }) {
  const a = areaOf(area);
  return (<div className={cx("flex items-center gap-3 rounded-2xl border p-2.5 transition", done && "bg-accent-soft/60", state === "optional" && !done && "opacity-80")}><button type="button" role="checkbox" aria-checked={done} aria-label={name} disabled={disabled} onClick={onToggle} className={cx("touch grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 text-lg transition", done ? "border-transparent text-white" : "border-line bg-surface-2")} style={done ? { background: a.color } : undefined}>{done ? "✓" : emoji ?? a.emoji}</button><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className={cx("truncate text-sm font-bold", done && "line-through opacity-70")}>{name}</span>{state === "optional" && <span className="rounded-full bg-surface-2 px-1.5 text-[10px] text-muted">اختياري</span>}</div><div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted"><span style={{ color: a.color }}>{a.label}</span>{streak > 0 && <span>🔥 {streak}</span>}<XPBadge xp={xp} small /></div></div>{trailing}</div>);
}
export function TaskRow({ title, area, difficulty, xp, done, source, onToggle, onDelete, disabled }: { title: string; area: AreaId; difficulty: number; xp: number; done: boolean; source: string; onToggle: () => void; onDelete?: () => void; disabled?: boolean }) {
  const a = areaOf(area); const src: Record<string, string> = { weekly: "من الأسبوع", recovery: "تعافٍ", quran: "قرآن", carried: "مرحّلة", "brain-dump": "تفريغ", ai: "AI" };
  return (<div className={cx("flex items-center gap-3 rounded-2xl border p-2.5", done && "bg-ok/10")}><button type="button" role="checkbox" aria-checked={done} aria-label={title} disabled={disabled} onClick={onToggle} className={cx("touch grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 text-lg", done ? "border-transparent bg-ok text-white" : "border-line bg-surface-2")}>{done ? "✓" : ""}</button><div className="min-w-0 flex-1"><div className={cx("truncate text-sm font-bold", done && "line-through opacity-70")}>{title}</div><div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted"><span style={{ color: a.color }}>{a.emoji} {a.label}</span><span aria-label={`الصعوبة ${difficulty}`}>{"★".repeat(difficulty)}<span className="opacity-30">{"★".repeat(5 - difficulty)}</span></span><XPBadge xp={xp} small />{src[source] && <span className="rounded-full bg-surface-2 px-1.5">{src[source]}</span>}</div></div>{onDelete && <button type="button" aria-label="حذف المهمة" onClick={onDelete} className="touch rounded-xl text-muted hover:bg-danger/10 hover:text-danger">🗑</button>}</div>);
}
export function GoalCard({ title, percent, value, target, unit, kind, area, carried, done, children }: { title: string; percent: number; value: number; target: number; unit: string; kind: string; area: AreaId; carried?: boolean; done?: boolean; children?: React.ReactNode }) {
  const a = areaOf(area); const k: Record<string, string> = { recurring: "متكرر", manual: "يدوي", milestone: "معلم", percentage: "نسبة" };
  return (<div className={cx("card p-3", done && "border-ok/50")}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-sm font-bold">{done ? "✅ " : ""}{title}</div><div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-muted"><span style={{ color: a.color }}>{a.emoji} {a.label}</span><span className="rounded-full bg-surface-2 px-1.5">{k[kind]}</span>{carried && <span className="rounded-full bg-gold-soft px-1.5 text-gold">مرحّل</span>}</div></div><div className="text-sm font-extrabold tabular-nums" style={{ color: a.color }}>{kind === "manual" ? (done ? "تم" : "—") : `${value}/${target} ${unit}`}</div></div><ProgressBar value={percent} color={a.color} className="mt-2" label={title} />{children && <div className="mt-2 flex flex-wrap gap-2">{children}</div>}</div>);
}
export function ToastHost({ toasts, onDismiss }: { toasts: { id: string; text: string; kind: string }[]; onDismiss: (id: string) => void }) {
  return (<div className="pointer-events-none fixed inset-x-0 bottom-20 z-[90] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite" role="status">{toasts.map((t) => (<button key={t.id} type="button" onClick={() => onDismiss(t.id)} className={cx("pointer-events-auto anim-fade-up rounded-2xl border px-4 py-2 text-sm font-bold shadow-xl glass", t.kind === "xp" && "border-gold/50 text-gold", t.kind === "ok" && "border-ok/50 text-ok", t.kind === "warn" && "border-warn/50 text-warn", t.kind === "error" && "border-danger/50 text-danger")}>{t.text}</button>))}</div>);
}
export function Kbd({ children }: { children: React.ReactNode }) { return <kbd className="rounded-md border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px]">{children}</kbd>; }
export function Disclaimer({ children }: { children: React.ReactNode }) { return <p className="rounded-xl border border-warn/30 bg-warn/5 px-3 py-2 text-[11px] text-muted">⚠️ {children}</p>; }
