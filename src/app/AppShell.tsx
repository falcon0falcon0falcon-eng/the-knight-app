"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ROUTES, resolveRoute } from "./routes";
import { useApp, useLevel } from "@/stores/app-store";
import { Button, Modal, RankBadge, ToastHost, cx, Input, Field, LoadingState } from "@/components/ui";
import { rankForLevel, totalXp } from "@/calculations/gamification";
import { levelFromXp } from "@/calculations/gamification";

function useTheme() {
  const theme = useApp((s) => s.data.uiPrefs.theme);
  useEffect(() => {
    const apply = () => { const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches); document.documentElement.dataset.theme = dark ? "dark" : "light"; };
    apply(); const mq = window.matchMedia("(prefers-color-scheme: dark)"); mq.addEventListener("change", apply); return () => mq.removeEventListener("change", apply);
  }, [theme]);
}
function usePwa() {
  const [prompt, setPrompt] = useState<(Event & { prompt: () => Promise<void> }) | null>(null);
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => {});
    const h = (e: Event) => { e.preventDefault(); setPrompt(e as Event & { prompt: () => Promise<void> }); (window as unknown as { __pwaPrompt?: Event }).__pwaPrompt = e; };
    window.addEventListener("beforeinstallprompt", h); return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  return prompt;
}

export default function AppShell() {
  const pathname = usePathname(); const router = useRouter(); const search = useSearchParams();
  const { route, redirectTo } = useMemo(() => resolveRoute(pathname ?? "/"), [pathname]);
  const ready = useApp((s) => s.ready); const init = useApp((s) => s.init);
  const toasts = useApp((s) => s.toasts); const dismissToast = useApp((s) => s.dismissToast);
  const celebration = useApp((s) => s.celebration); const clearCelebration = useApp((s) => s.clearCelebration);
  const legacyFound = useApp((s) => s.legacyFound); const importLegacy = useApp((s) => s.importLegacy); const dismissLegacy = useApp((s) => s.dismissLegacy);
  const sync = useApp((s) => s.sync); const online = useApp((s) => s.online);
  const onboarded = useApp((s) => s.data.uiPrefs.onboarded);
  const [moreOpen, setMoreOpen] = useState(false);
  useTheme(); usePwa();
  useEffect(() => { void init(); }, [init]);
  useEffect(() => { if (redirectTo) router.replace(redirectTo + (search?.toString() && !redirectTo.includes("?") ? `?${search}` : "")); }, [redirectTo, router, search]);
  useEffect(() => { if (ready) useApp.getState().update("uiPrefs", (u) => (u.lastRoute === pathname ? u : { ...u, lastRoute: pathname ?? "/day" })); }, [pathname, ready]);
  // keyboard shortcuts (desktop)
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA|SELECT/) || e.metaKey || e.ctrlKey || e.altKey) return; const map: Record<string, string> = { "1": "/day", "2": "/week", "3": "/month", g: "/goals", h: "/healing", q: "/quran", l: "/library", m: "/me", a: "/ai", ",": "/settings" }; if (map[e.key]) router.push(map[e.key]); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [router]);

  const Page = route.component;
  const primary = ROUTES.filter((r) => r.group !== "more"); const more = ROUTES.filter((r) => r.group === "more");
  if (!ready) return <div className="grid min-h-screen place-items-center"><LoadingState text="الفارس الفارغ يستيقظ…" /></div>;
  if (!onboarded) return <Onboarding />;
  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e glass md:flex" aria-label="التنقل الرئيسي">
        <Brand />
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          <NavGroup title="الأساسية" items={ROUTES.filter((r) => r.group === "primary")} current={route.id} />
          <NavGroup title="التقدم" items={ROUTES.filter((r) => r.group === "secondary")} current={route.id} />
          <NavGroup title="المزيد" items={more} current={route.id} />
        </nav>
        <SyncPill sync={sync} online={online} className="m-3" />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b glass px-3 py-2 md:hidden"><Brand compact /><SyncPill sync={sync} online={online} /></header>
        {!online && <div className="bg-warn/15 px-3 py-1.5 text-center text-xs font-bold text-warn" role="status">غير متصل — التغييرات محفوظة محليًا وستُزامن تلقائيًا</div>}
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-3 pb-24 pt-3 md:px-6 md:pb-8 md:pt-6"><Page /></main>
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t glass md:hidden" aria-label="التنقل السفلي"><div className="grid grid-cols-7">{primary.map((r) => <BottomItem key={r.id} href={r.path} icon={r.icon} label={r.label} active={route.id === r.id} />)}<button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" className={cx("touch flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold", route.group === "more" ? "text-accent" : "text-muted")}><span className="text-lg" aria-hidden>☰</span>المزيد</button></div></nav>
      </div>
      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="المزيد"><div className="grid grid-cols-3 gap-2">{more.map((r) => <Link key={r.id} href={r.path} onClick={() => setMoreOpen(false)} className={cx("touch flex flex-col items-center gap-1 rounded-2xl border p-3 text-xs font-bold hover:bg-surface-2", route.id === r.id && "border-accent bg-accent-soft")}><span className="text-2xl" aria-hidden>{r.icon}</span>{r.label}</Link>)}</div></Modal>
      <ToastHost toasts={toasts} onDismiss={dismissToast} />
      {celebration && <Modal open onClose={clearCelebration} size="sm" sheetOnMobile={false}><div className="grid place-items-center gap-3 py-4 text-center"><div className="anim-gold rounded-full p-3 text-5xl">🏆</div><h2 className="text-2xl font-black">المستوى {celebration.level}!</h2>{celebration.rankUp && <p className="text-gold font-bold">رتبة جديدة: {rankForLevel(celebration.level)}</p>}<p className="text-sm text-muted">الفارس الفارغ يمتلئ… خطوة خطوة.</p><Button variant="gold" onClick={clearCelebration}>استمر</Button></div></Modal>}
      {legacyFound && <LegacyImportDialog raw={legacyFound} onImport={importLegacy} onDismiss={dismissLegacy} />}
    </div>
  );
}
function Brand({ compact }: { compact?: boolean }) {
  const lvl = useLevel(); const rank = rankForLevel(lvl.level);
  return (<Link href="/me" className={cx("flex items-center gap-3", compact ? "" : "px-5 py-5")}><RankBadge rank={rank} level={lvl.level} size="sm" /><div className="leading-tight"><div className="text-sm font-black tracking-tight">Me vs Me</div><div className="text-[11px] text-muted">الفارس الفارغ · Lv {lvl.level}</div></div></Link>);
}
function NavGroup({ title, items, current }: { title: string; items: typeof ROUTES; current: string }) {
  return (<div className="py-2"><div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted">{title}</div>{items.map((r) => <Link key={r.id} href={r.path} aria-current={current === r.id ? "page" : undefined} className={cx("touch flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold transition", current === r.id ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-ink")}><span aria-hidden>{r.icon}</span>{r.label}</Link>)}</div>);
}
function BottomItem({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) { return <Link href={href} aria-current={active ? "page" : undefined} className={cx("touch flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold", active ? "text-accent" : "text-muted")}><span className="text-lg" aria-hidden>{icon}</span>{label}</Link>; }
function SyncPill({ sync, online, className }: { sync: { state: string; pending: number }; online: boolean; className?: string }) {
  const txt = !online ? "غير متصل" : sync.state === "syncing" ? "مزامنة…" : sync.state === "error" ? "خطأ مزامنة" : sync.pending ? `${sync.pending} معلّق` : "متزامن";
  const c = !online ? "text-warn" : sync.state === "error" ? "text-danger" : sync.state === "syncing" ? "text-accent" : "text-ok";
  return <Link href="/settings?section=cloud" className={cx("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold", c, className)} aria-label={`حالة المزامنة: ${txt}`}><span className={cx("h-2 w-2 rounded-full", !online ? "bg-warn" : sync.state === "error" ? "bg-danger" : sync.state === "syncing" ? "animate-pulse bg-accent" : "bg-ok")} />{txt}</Link>;
}
function LegacyImportDialog({ raw, onImport, onDismiss }: { raw: Record<string, unknown>; onImport: (r: Record<string, unknown>, m: "merge" | "replace") => { counts: Record<string, number> }; onDismiss: () => void }) {
  const [result, setResult] = useState<Record<string, number> | null>(null);
  return (<Modal open onClose={onDismiss} title="وجدنا بيانات النسخة القديمة" size="md" footer={result ? <Button variant="primary" onClick={onDismiss}>تم</Button> : <><Button onClick={onDismiss}>لاحقًا</Button><Button variant="primary" onClick={() => setResult(onImport(raw, "merge").counts)}>استيراد (دمج آمن)</Button></>}>{result ? <div className="text-sm"><p className="mb-2 font-bold text-ok">تم الاستيراد بنجاح. ملخص:</p><ul className="grid grid-cols-2 gap-1 text-xs text-muted">{Object.entries(result).map(([k, v]) => <li key={k}>{k}: <b>{v}</b></li>)}</ul></div> : <p className="text-sm text-muted">تم العثور على {Object.keys(raw).length} مفتاحًا من التطبيق القديم في هذا المتصفح. سيتم ترقيتها إلى الهيكل الجديد ودمجها بدون حذف أي شيء (تُحفظ نسخة تلقائية قبل الاستيراد).</p>}</Modal>);
}
function Onboarding() {
  const update = useApp((s) => s.update); const [name, setName] = useState(""); const [sob, setSob] = useState(""); const [step, setStep] = useState(0);
  const finish = () => { update("bodyProfile", (b) => ({ ...b, name: name || b.name })); if (sob) update("sobrietyStartAt", () => new Date(sob).toISOString()); update("uiPrefs", (u) => ({ ...u, onboarded: true })); };
  return (<div className="grid min-h-screen place-items-center p-4"><div className="card w-full max-w-md p-6 anim-fade-up"><div className="mb-4 text-center"><div className="text-4xl">🛡️</div><h1 className="mt-2 text-2xl font-black">الفارس الفارغ</h1><p className="text-sm text-muted">Me vs Me — نظام تشغيلك الشخصي. الخصم الوحيد: نسختك القديمة.</p></div>{step === 0 && <div className="space-y-3"><Field label="اسم اللاعب (اختياري)"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="الفارس" /></Field><Field label="بداية رحلة التعافي (اختياري)" hint="يمكنك ضبطها لاحقًا من صفحة التعافي"><Input type="date" value={sob} onChange={(e) => setSob(e.target.value)} /></Field><Button variant="primary" block onClick={() => setStep(1)}>التالي</Button></div>}{step === 1 && <div className="space-y-3 text-sm"><p>ستبدأ بـ<b>11 عادة أساسية</b> موزعة على المحاور الستة، ويمكنك تعديلها من الإعدادات.</p><ul className="grid grid-cols-2 gap-1 text-xs text-muted"><li>🏋️ الجسد</li><li>🧠 العقل</li><li>🕌 الدين</li><li>📚 الدراسة</li><li>💼 المهنة</li><li>🎨 الإبداع</li></ul><p className="text-xs text-muted">بياناتك محلية أولًا (تعمل بلا إنترنت) وتُزامن سحابيًا تلقائيًا.</p><Button variant="gold" block onClick={finish}>ابدأ اليوم الأول</Button></div>}</div></div>);
}
export { levelFromXp, totalXp };
