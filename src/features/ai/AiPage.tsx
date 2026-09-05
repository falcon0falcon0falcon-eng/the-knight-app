"use client";
import React, { useEffect, useRef, useState } from "react";
import { useApp } from "@/stores/app-store";
import { challengeActions, dayActions, goalActions, quranActions, recoveryActions } from "@/stores/actions";
import { AI_MODES, AiAction, AiMessage, AiMode, AreaId } from "@/types/app-data";
import { ACTION_LABELS, buildContext, extractActions, localCoach, parseForgetPhrase, parseTeachingPhrase, PERSONAS, Scope, SCOPES, toAiActions } from "@/domain/ai";
import { nowISO, todayISO, uid, weekKey } from "@/core/date";
import { Button, Card, Chip, Drawer, EmptyState, Input, Modal, Textarea, cx, useConfirm } from "@/components/ui";

export default function AiPage() {
  const data = useApp((s) => s.data); const update = useApp((s) => s.update); const toast = useApp((s) => s.toast); const account = useApp((s) => s.account);
  const mode = data.aiActiveMode; const setMode = (m: AiMode) => update("aiActiveMode", () => m); const persona = PERSONAS[mode]; const msgs = data.aiChatsByMode[mode] ?? [];
  const [input, setInput] = useState(""); const [busy, setBusy] = useState(false); const [provider, setProvider] = useState<"openai" | "none" | "unknown">("unknown"); const [memOpen, setMemOpen] = useState(false); const [pending, setPending] = useState<{ msgId: string; action: AiAction } | null>(null); const endRef = useRef<HTMLDivElement>(null); const { confirm, dialog } = useConfirm();
  useEffect(() => { fetch("/api/ai").then((r) => r.json()).then((j) => setProvider(j.provider)).catch(() => setProvider("none")); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length, busy]);
  const settings = data.aiModeSettings[mode]; const scopes = settings.scopes as Scope[];
  const pushMsg = (m: AiMessage) => update("aiChatsByMode", (c) => ({ ...c, [mode]: [...(c[mode] ?? []), m] }));
  const send = async (text: string) => {
    const t = text.trim(); if (!t || busy) return; setInput("");
    const taught = parseTeachingPhrase(t); const forget = parseForgetPhrase(t);
    pushMsg({ id: uid("m"), role: "user", content: t, at: nowISO() });
    if (forget) { update("aiMemoriesByMode", (m) => ({ ...m, [mode]: (m[mode] ?? []).filter((x) => !x.text.includes(forget)), global: (m.global ?? []).filter((x) => !x.text.includes(forget)) })); pushMsg({ id: uid("m"), role: "assistant", content: `تم حذف ما يطابق «${forget}» من الذاكرة.`, at: nowISO() }); return; }
    if (taught) { update("aiMemoriesByMode", (m) => ({ ...m, [mode]: [...(m[mode] ?? []), { id: uid("mem"), text: taught, createdAt: nowISO(), source: "taught" }] })); pushMsg({ id: uid("m"), role: "assistant", content: `حفظت في ذاكرة «${persona.label}»: **${taught}**`, at: nowISO() }); return; }
    setBusy(true);
    try {
      const memories = [...(data.aiMemoriesByMode.global ?? []), ...(data.aiMemoriesByMode[mode] ?? [])].map((m) => `- ${m.text}`).join("\n");
      const skills = data.aiSkills.filter((s) => s.modes.includes(mode)).map((s) => `## ${s.name}\n${s.prompt}`).join("\n");
      const system = `${settings.customPersona || persona.persona}\nنطاقك: ${persona.scope}. أجب بالعربية بإيجاز عملي (≤ 180 كلمة) مع أرقام من السياق.\n\n[الذاكرة]\n${memories || "—"}\n\n${skills}\n\n[بيانات المستخدم الحية]\n${buildContext(data, scopes)}\n\nإن اقترحت إجراءً على البيانات، أضف في نهاية الرد كتلة:\n\`\`\`actions\n[{"type":"addTask","payload":{"title":"...","area":"mental","difficulty":2}}]\n\`\`\`\nالأنواع المسموحة لهذا الوضع: ${persona.actions.join(", ")}. لا تنفذ شيئًا بنفسك — المستخدم يؤكد.`;
      let text = ""; let actions = [] as ReturnType<typeof extractActions>["actions"];
      if (provider === "openai" && data.aiAssistantSettings.provider !== "local") {
        const r = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ system, messages: [...msgs.slice(-10), { role: "user", content: t }].map((m) => ({ role: m.role, content: m.content })), model: data.aiAssistantSettings.model, temperature: data.aiAssistantSettings.temperature }) });
        const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error ?? "فشل الاتصال بالمزود"); if (j.provider === "none") { const lc = localCoach(mode, t, data); text = lc.text; actions = lc.actions; } else { const ex = extractActions(j.text ?? ""); text = ex.clean; actions = ex.actions; }
      } else { const lc = localCoach(mode, t, data); text = lc.text; actions = lc.actions; }
      pushMsg({ id: uid("m"), role: "assistant", content: text, at: nowISO(), actions: toAiActions(actions) });
    } catch (e) { const lc = localCoach(mode, t, data); pushMsg({ id: uid("m"), role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : "خطأ"} — رد المدرّب المحلي:\n\n${lc.text}`, at: nowISO(), actions: toAiActions(lc.actions) }); } finally { setBusy(false); }
  };
  const setActionStatus = (msgId: string, actionId: string, status: AiAction["status"], result?: string) => update("aiChatsByMode", (c) => ({ ...c, [mode]: (c[mode] ?? []).map((m) => (m.id === msgId ? { ...m, actions: m.actions?.map((a) => (a.id === actionId ? { ...a, status, result } : a)) } : m)) }));
  /** التنفيذ بعد التأكيد فقط */
  const execute = (msgId: string, a: AiAction) => {
    const p = a.payload as Record<string, unknown>; const today = todayISO(); let result = "تم";
    try {
      switch (a.type) {
        case "addTask": dayActions.addTask(today, { title: String(p.title ?? "مهمة من AI"), area: (p.area as AreaId) ?? "mental", difficulty: (Math.min(5, Math.max(1, Number(p.difficulty ?? 2))) as 1), source: "ai" }); break;
        case "addRecoveryTask": recoveryActions.addTask(String(p.title ?? "مهمة تعافٍ"), String(p.date ?? today)); break;
        case "addChallenge": challengeActions.add({ title: String(p.title ?? "تحدٍ"), type: (p.type as "daily") ?? "daily", source: String(p.source ?? "manual"), target: Number(p.target ?? 1), durationDays: Number(p.durationDays ?? 30), startDate: today, dailyReward: Number(p.dailyReward ?? 5), successReward: Number(p.successReward ?? 100), failurePenalty: Number(p.failurePenalty ?? 30), area: (p.area as AreaId) ?? "mental" }); break;
        case "addBonusQuest": update("bonusQuests", (b) => [...b, { id: uid("bq"), title: String(p.title), xp: Number(p.xp ?? 5), area: (p.area as AreaId) ?? "mental", enabled: true }]); break;
        case "addTrigger": update("recoveryTriggers", (t) => [...t, { id: uid("t"), name: String(p.name ?? p.title) }]); break;
        case "addRitual": update("recoveryRituals", (r) => [...r, { id: uid("r"), name: String(p.name ?? p.title), when: (p.when as "any") ?? "any" }]); break;
        case "setCalorieTarget": update("goalSettings", (g) => ({ ...g, calorieTarget: Number(p.value ?? p.calorieTarget ?? g.calorieTarget) })); break;
        case "addMeal": dayActions.addMeal(today, { name: String(p.name ?? "وجبة"), kcal: Number(p.kcal ?? 0), protein: Number(p.protein ?? 0), carbs: Number(p.carbs ?? 0), fat: Number(p.fat ?? 0) }); break;
        case "planWeekTask": goalActions.planTask(weekKey(String(p.date ?? today)), String(p.date ?? today), { title: String(p.title), area: (p.area as AreaId) ?? "mental", difficulty: 2, metrics: [] }); break;
        case "addWeeklyGoal": goalActions.add({ title: String(p.title), kind: "manual", target: 1, unit: "", area: (p.area as AreaId) ?? "mental", period: "week", periodKey: weekKey(today), xp: 20 }); break;
        case "addIdea": dayActions.addIdea(String(p.title), (p.area as AreaId) ?? "creativity"); break;
        case "addSavingsGoal": update("goalSettings", (g) => ({ ...g, savingsGoal: Number(p.value ?? g.savingsGoal) })); break;
        case "addDhikr": update("dhikrLibrary", (d) => [...d, { id: uid("d"), text: String(p.text ?? p.title), target: Number(p.target ?? 100), xp: 5 }]); break;
        case "addTadabur": quranActions.addTadabur(String(p.ref ?? ""), String(p.text ?? "")); break;
        case "addMemory": update("aiMemoriesByMode", (m) => ({ ...m, global: [...(m.global ?? []), { id: uid("mem"), text: String(p.text), createdAt: nowISO(), source: "learned" }] })); break;
        default: result = "نوع غير مدعوم";
      }
      setActionStatus(msgId, a.id, result === "تم" ? "executed" : "failed", result); toast(`✅ ${a.label}`, "ok");
      fetch("/api/ai/audit", { method: "POST", headers: { "content-type": "application/json", "x-account-id": account.id }, body: JSON.stringify({ id: a.id, mode, actionType: a.type, payload: a.payload, result }) }).catch(() => {});
    } catch (e) { setActionStatus(msgId, a.id, "failed", e instanceof Error ? e.message : "فشل"); }
  };
  return (<div className="flex h-[calc(100dvh-140px)] flex-col gap-3 md:h-[calc(100vh-80px)]">
    <div className="no-scrollbar flex gap-1 overflow-x-auto">{AI_MODES.filter((m) => data.aiModeSettings[m].enabled).map((m) => <Chip key={m} active={mode === m} onClick={() => setMode(m)}>{PERSONAS[m].icon} {PERSONAS[m].label}</Chip>)}</div>
    <Card className="flex min-h-0 flex-1 flex-col p-0"><header className="flex items-center justify-between border-b px-4 py-2"><div><div className="text-sm font-black">{persona.icon} {persona.label}</div><div className="text-[11px] text-muted">{persona.scope} · {provider === "openai" && data.aiAssistantSettings.provider !== "local" ? "نموذج سحابي" : "المدرّب المحلي"}</div></div><div className="flex gap-1"><Button size="sm" onClick={() => setMemOpen(true)}>🧠 الذاكرة ({(data.aiMemoriesByMode[mode] ?? []).length + (data.aiMemoriesByMode.global ?? []).length})</Button><Button size="sm" variant="ghost" onClick={() => confirm("مسح المحادثة؟", () => update("aiChatsByMode", (c) => ({ ...c, [mode]: [] })))}>🗑</Button></div></header>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3" role="log" aria-live="polite">{msgs.length === 0 && <EmptyState icon={persona.icon} title={`مرحبًا، أنا ${persona.label}`} description={persona.persona.slice(0, 140) + "…"} />}{msgs.map((m) => <div key={m.id} className={cx("flex", m.role === "user" ? "justify-start" : "justify-end")}><div className={cx("max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 whitespace-pre-wrap", m.role === "user" ? "bg-accent text-white" : "bg-surface-2")}>{m.content}{m.actions && m.actions.length > 0 && <div className="mt-2 space-y-1 border-t pt-2">{m.actions.map((a) => <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl border bg-surface px-2 py-1.5 text-xs"><div><div className="font-bold">⚙️ {a.label}</div><div className="text-muted">{JSON.stringify(a.payload).slice(0, 90)}</div></div>{a.status === "proposed" ? <div className="flex gap-1"><Button size="sm" variant="primary" onClick={() => setPending({ msgId: m.id, action: a })}>تأكيد</Button><Button size="sm" variant="ghost" onClick={() => setActionStatus(m.id, a.id, "rejected")}>رفض</Button></div> : <span className={cx("rounded-full px-2 py-0.5 font-bold", a.status === "executed" ? "bg-ok/15 text-ok" : a.status === "rejected" ? "bg-surface-2 text-muted" : "bg-danger/15 text-danger")}>{{ executed: "نُفّذ", rejected: "مرفوض", failed: "فشل", confirmed: "…", proposed: "" }[a.status]}{a.result && a.status === "failed" ? `: ${a.result}` : ""}</span>}</div>)}</div>}</div></div>)}{busy && <div className="flex justify-end"><div className="rounded-2xl bg-surface-2 px-3 py-2 text-sm text-muted">يفكر…</div></div>}<div ref={endRef} /></div>
      <div className="border-t p-2"><div className="no-scrollbar mb-2 flex gap-1 overflow-x-auto">{persona.suggestions.map((s) => <Chip key={s} onClick={() => send(s)}>{s}</Chip>)}</div><div className="flex gap-2"><Textarea className="min-h-[44px] flex-1" rows={1} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} placeholder={`اسأل ${persona.label}… أو: «احفظ في ذاكرتك أني…»`} aria-label="رسالتك" /><Button variant="primary" disabled={busy || !input.trim()} onClick={() => send(input)}>إرسال</Button></div></div></Card>
    <Drawer open={memOpen} onClose={() => setMemOpen(false)} title="الذاكرة والسياق"><MemoryPanel mode={mode} /></Drawer>
    <Modal open={!!pending} onClose={() => setPending(null)} title="تأكيد الإجراء" size="sm" footer={<><Button onClick={() => setPending(null)}>إلغاء</Button><Button variant="primary" onClick={() => { if (pending) execute(pending.msgId, pending.action); setPending(null); }}>نفّذ</Button></>}>{pending && <div className="text-sm"><p className="font-bold">{pending.action.label}</p><pre className="mt-2 overflow-x-auto rounded-xl bg-surface-2 p-2 text-xs" dir="ltr">{JSON.stringify(pending.action.payload, null, 2)}</pre><p className="mt-2 text-xs text-muted">AI يقترح ← أنت تؤكد ← يُنفَّذ ← يُسجَّل. لا شيء يُنفذ تلقائيًا.</p></div>}</Modal>{dialog}
  </div>);
}
function MemoryPanel({ mode }: { mode: AiMode }) {
  const data = useApp((s) => s.data); const update = useApp((s) => s.update); const [txt, setTxt] = useState(""); const [scope, setScope] = useState<AiMode | "global">(mode); const s = data.aiModeSettings[mode];
  return (<div className="space-y-4 text-sm">
    <div><div className="mb-1 text-xs font-bold text-muted">نطاقات البيانات لهذا الوضع</div><div className="flex flex-wrap gap-1">{SCOPES.map((sc) => <Chip key={sc.id} active={s.scopes.includes(sc.id)} onClick={() => update("aiModeSettings", (m) => ({ ...m, [mode]: { ...m[mode], scopes: m[mode].scopes.includes(sc.id) ? m[mode].scopes.filter((x) => x !== sc.id) : [...m[mode].scopes, sc.id] } }))}>{sc.label}</Chip>)}</div></div>
    <div><div className="mb-1 text-xs font-bold text-muted">الذاكرة العامة</div>{(data.aiMemoriesByMode.global ?? []).map((m) => <div key={m.id} className="mb-1 flex justify-between rounded-lg bg-surface-2 px-2 py-1 text-xs"><span>{m.text}</span><button type="button" onClick={() => update("aiMemoriesByMode", (x) => ({ ...x, global: x.global.filter((y) => y.id !== m.id) }))}>✕</button></div>)}</div>
    <div><div className="mb-1 text-xs font-bold text-muted">ذاكرة {PERSONAS[mode].label}</div>{(data.aiMemoriesByMode[mode] ?? []).map((m) => <div key={m.id} className="mb-1 flex justify-between rounded-lg bg-surface-2 px-2 py-1 text-xs"><span>{m.text} <span className="text-muted">({m.source === "taught" ? "علّمته" : "تعلّمه"})</span></span><button type="button" onClick={() => update("aiMemoriesByMode", (x) => ({ ...x, [mode]: x[mode].filter((y) => y.id !== m.id) }))}>✕</button></div>)}</div>
    <div className="flex gap-1"><select className="rounded-xl border bg-surface-2 px-2 text-xs" value={scope} onChange={(e) => setScope(e.target.value as AiMode)} aria-label="النطاق"><option value="global">عام</option>{AI_MODES.map((m) => <option key={m} value={m}>{PERSONAS[m].label}</option>)}</select><Input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="حقيقة عني…" /><Button size="sm" onClick={() => { if (txt.trim()) { update("aiMemoriesByMode", (x) => ({ ...x, [scope]: [...(x[scope] ?? []), { id: uid("mem"), text: txt.trim(), createdAt: nowISO(), source: "taught" }] })); setTxt(""); } }}>+</Button></div>
    <div><div className="mb-1 text-xs font-bold text-muted">المهارات ({data.aiSkills.filter((k) => k.modes.includes(mode)).length})</div><SkillEditor mode={mode} /></div>
    <div><div className="mb-1 text-xs font-bold text-muted">شخصية مخصصة (اختياري)</div><Textarea value={s.customPersona ?? ""} onChange={(e) => update("aiModeSettings", (m) => ({ ...m, [mode]: { ...m[mode], customPersona: e.target.value } }))} placeholder={PERSONAS[mode].persona} /></div>
    <div className="text-[11px] text-muted">الإجراءات الممكنة: {PERSONAS[mode].actions.map((a) => ACTION_LABELS[a]).join(" · ")}</div>
  </div>);
}
function SkillEditor({ mode }: { mode: AiMode }) {
  const data = useApp((s) => s.data); const update = useApp((s) => s.update); const [f, setF] = useState({ name: "", prompt: "" });
  return (<div className="space-y-1">{data.aiSkills.filter((k) => k.modes.includes(mode)).map((k) => <div key={k.id} className="flex justify-between rounded-lg bg-surface-2 px-2 py-1 text-xs"><span title={k.prompt}>{k.name}</span><button type="button" onClick={() => update("aiSkills", (x) => x.filter((y) => y.id !== k.id))}>✕</button></div>)}<Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="اسم المهارة" /><Textarea value={f.prompt} onChange={(e) => setF({ ...f, prompt: e.target.value })} placeholder="تعليمات المهارة…" /><Button size="sm" onClick={() => { if (f.name.trim()) { update("aiSkills", (x) => [...x, { id: uid("sk"), name: f.name.trim(), prompt: f.prompt, modes: [mode] }]); setF({ name: "", prompt: "" }); } }}>+ مهارة</Button></div>);
}
