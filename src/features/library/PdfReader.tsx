"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useApp } from "@/stores/app-store";
import { libraryActions } from "@/stores/actions";
import { Annotation, AnnotationType, Book } from "@/types/app-data";
import { pdfStore } from "@/core/storage";
import { driveDownload } from "@/integrations/drive";
import { Button, Chip, Drawer, ErrorState, Input, LoadingState, Modal, Textarea, cx, useConfirm } from "@/components/ui";

type Pdfjs = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<Pdfjs> | null = null;
const loadPdfjs = () => (pdfjsPromise ??= import("pdfjs-dist").then((m) => { m.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"; return m; }));

const COLORS = ["#fde047", "#86efac", "#93c5fd", "#f9a8d4", "#fca5a5", "#c4b5fd"];
type Tool = "select" | "highlight" | "underline" | "strike" | "draw" | "note";

export default function PdfReader({ book, onClose }: { book: Book; onClose: () => void }) {
  const update = useApp((s) => s.update); const prefs = useApp((s) => s.data.uiPrefs.reader); const allAnnotations = useApp((s) => s.data.bookAnnotations); const annotations = useMemo(() => allAnnotations.filter((a) => a.bookId === book.id), [allAnnotations, book.id]);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null); const [error, setError] = useState<string | null>(null); const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(book.currentPage || 1); const [tool, setTool] = useState<Tool>("select"); const [color, setColor] = useState(COLORS[0]); const [brush, setBrush] = useState(3);
  const [panel, setPanel] = useState<"none" | "thumbs" | "outline" | "annotations" | "search">("none"); const [query, setQuery] = useState(""); const [hits, setHits] = useState<{ page: number; snippet: string }[]>([]); const [hitIdx, setHitIdx] = useState(0); const [searching, setSearching] = useState(false);
  const [outline, setOutline] = useState<{ title: string; page: number; level: number }[]>([]); const [noteFor, setNoteFor] = useState<number | null>(null); const [noteText, setNoteText] = useState("");
  const [containerW, setContainerW] = useState(800); const containerRef = useRef<HTMLDivElement>(null); const startRef = useRef({ page: book.currentPage || 1, at: Date.now() }); const { confirm, dialog } = useConfirm();
  const setPrefs = useCallback((p: Partial<typeof prefs>) => update("uiPrefs", (u) => ({ ...u, reader: { ...u.reader, ...p } })), [update]);

  // تحميل الملف: IndexedDB أولًا ثم Drive
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const lib = await loadPdfjs(); let blob = await pdfStore.get(book.id);
        if (!blob && book.driveFileId) { blob = await driveDownload(book.driveFileId); if (blob) await pdfStore.put(book.id, blob, book.title); }
        if (!blob) throw new Error("ملف PDF غير موجود محليًا ولا على Drive. أعد رفعه.");
        const doc = await lib.getDocument({ data: await blob.arrayBuffer() }).promise; if (cancelled) return;
        setPdf(doc); setNumPages(doc.numPages); if (!book.pages || book.pages !== doc.numPages) libraryActions.updateBook(book.id, { pages: doc.numPages });
        const ol = await doc.getOutline().catch(() => null); if (ol) { const out: typeof outline = []; const walk = async (items: typeof ol, level: number) => { for (const it of items) { let p = 1; try { const dest = typeof it.dest === "string" ? await doc.getDestination(it.dest) : it.dest; if (dest && dest[0]) p = (await doc.getPageIndex(dest[0])) + 1; } catch { /* ignore */ } out.push({ title: it.title, page: p, level }); if (it.items?.length) await walk(it.items, level + 1); } }; await walk(ol, 0); if (!cancelled) setOutline(out); }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "تعذر فتح الملف"); }
    })();
    return () => { cancelled = true; };
  }, [book.id, book.driveFileId, book.title, book.pages]);
  useEffect(() => { const el = containerRef.current; if (!el) return; const ro = new ResizeObserver(() => setContainerW(el.clientWidth - 32)); ro.observe(el); setContainerW(el.clientWidth - 32); return () => ro.disconnect(); }, [pdf]);
  // حفظ التقدم + جلسة القراءة عند الإغلاق
  useEffect(() => { libraryActions.updateBook(book.id, { currentPage: page }); }, [page, book.id]);
  const close = () => { const mins = Math.round((Date.now() - startRef.current.at) / 60000); const from = startRef.current.page; if (page > from || mins >= 3) libraryActions.logSession(book.id, from, Math.max(from, page), Math.max(1, mins)); onClose(); };
  const goTo = (p: number) => { const el = document.getElementById(`pdf-page-${p}`); el?.scrollIntoView({ block: "start", behavior: "smooth" }); setPage(p); };
  // مراقبة الصفحة الحالية
  useEffect(() => { const root = containerRef.current; if (!root || !numPages) return; const io = new IntersectionObserver((es) => { const vis = es.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]; if (vis) setPage(Number((vis.target as HTMLElement).dataset.page)); }, { root, threshold: [0.3, 0.6] }); root.querySelectorAll("[data-page]").forEach((n) => io.observe(n)); return () => io.disconnect(); }, [numPages, prefs.zoom, prefs.fit, containerW]);
  // بحث
  const runSearch = async () => { if (!pdf || !query.trim()) return; setSearching(true); const q = query.trim().toLowerCase(); const out: typeof hits = []; for (let i = 1; i <= pdf.numPages; i++) { const tc = await pdf.getPage(i).then((p) => p.getTextContent()); const text = tc.items.map((it) => ("str" in it ? it.str : "")).join(" "); let idx = text.toLowerCase().indexOf(q); let n = 0; while (idx >= 0 && n < 5) { out.push({ page: i, snippet: text.slice(Math.max(0, idx - 40), idx + q.length + 40) }); idx = text.toLowerCase().indexOf(q, idx + 1); n++; } } setHits(out); setHitIdx(0); setSearching(false); if (out.length) goTo(out[0].page); };
  const nextHit = (d: 1 | -1) => { if (!hits.length) return; const i = (hitIdx + d + hits.length) % hits.length; setHitIdx(i); goTo(hits[i].page); };
  useEffect(() => { const h = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA/)) return; if (e.key === "ArrowLeft") goTo(Math.min(numPages, page + 1)); if (e.key === "ArrowRight") goTo(Math.max(1, page - 1)); if (e.key === "+" || e.key === "=") setPrefs({ zoom: Math.min(3, prefs.zoom + 0.1), fit: "none" }); if (e.key === "-") setPrefs({ zoom: Math.max(0.4, prefs.zoom - 0.1), fit: "none" }); if (e.key === "f") document.getElementById("pdf-root")?.requestFullscreen?.(); if (e.key === "b") toggleBookmark(page); if (e.key === "/") { e.preventDefault(); setPanel("search"); } }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleBookmark = (p: number) => { const ex = annotations.find((a) => a.type === "bookmark" && a.page === p); if (ex) libraryActions.removeAnnotation(ex.id); else libraryActions.addAnnotation({ bookId: book.id, page: p, type: "bookmark", color: "#e6c04a" }); };
  const exportJson = () => download(`${book.title}-annotations.json`, JSON.stringify({ book: book.title, exportedAt: new Date().toISOString(), annotations }, null, 2), "application/json");
  const exportMd = () => { const byPage = [...annotations].sort((a, b) => a.page - b.page); const md = [`# ${book.title}`, book.author ? `_${book.author}_` : "", "", ...byPage.map((a) => `- **ص${a.page}** · ${{ highlight: "تظليل", underline: "تسطير", strike: "شطب", note: "ملاحظة", bookmark: "علامة", drawing: "رسم" }[a.type]}${a.text ? `: ${a.text}` : ""}`)].join("\n"); download(`${book.title}-notes.md`, md, "text/markdown"); };
  const pages = useMemo(() => Array.from({ length: numPages }, (_, i) => i + 1), [numPages]);
  const modeCls = { light: "", dark: "reader-dark", sepia: "reader-sepia", paper: "reader-paper" }[prefs.mode]; const bg = { light: "#e5e7eb", dark: "#0b0b14", sepia: "#efe4cf", paper: "#f3f1ea" }[prefs.mode];
  return (<div id="pdf-root" className="fixed inset-0 z-[70] flex flex-col bg-bg" role="dialog" aria-label={`قارئ: ${book.title}`}>
    <header className="flex flex-wrap items-center gap-1 border-b glass px-2 py-1.5 text-xs">
      <Button size="sm" onClick={close} aria-label="إغلاق القارئ">✕</Button><div className="me-2 max-w-[30vw] truncate font-bold">{book.title}</div>
      <div className="flex items-center gap-1"><Button size="sm" onClick={() => goTo(Math.max(1, page - 1))} aria-label="السابقة">›</Button><input aria-label="رقم الصفحة" className="w-12 rounded-lg border bg-surface-2 px-1 py-1 text-center" value={page} onChange={(e) => { const v = Number(e.target.value); if (v >= 1 && v <= numPages) goTo(v); }} /><span className="text-muted">/ {numPages}</span><Button size="sm" onClick={() => goTo(Math.min(numPages, page + 1))} aria-label="التالية">‹</Button></div>
      <div className="mx-1 flex items-center gap-1"><Button size="sm" onClick={() => setPrefs({ zoom: Math.max(0.4, prefs.zoom - 0.1), fit: "none" })} aria-label="تصغير">−</Button><span className="w-10 text-center tabular-nums">{Math.round(prefs.zoom * 100)}%</span><Button size="sm" onClick={() => setPrefs({ zoom: Math.min(3, prefs.zoom + 0.1), fit: "none" })} aria-label="تكبير">+</Button><Button size="sm" variant={prefs.fit === "width" ? "primary" : "soft"} onClick={() => setPrefs({ fit: "width" })}>عرض</Button><Button size="sm" variant={prefs.fit === "page" ? "primary" : "soft"} onClick={() => setPrefs({ fit: "page" })}>صفحة</Button></div>
      <div className="flex items-center gap-1">{(["light", "dark", "sepia", "paper"] as const).map((m) => <Chip key={m} active={prefs.mode === m} onClick={() => setPrefs({ mode: m })}>{{ light: "☀️", dark: "🌙", sepia: "📜", paper: "📄" }[m]}</Chip>)}</div>
      <div className="ms-auto flex items-center gap-1"><Button size="sm" variant={panel === "search" ? "primary" : "soft"} onClick={() => setPanel(panel === "search" ? "none" : "search")}>🔍</Button><Button size="sm" variant={panel === "thumbs" ? "primary" : "soft"} onClick={() => setPanel(panel === "thumbs" ? "none" : "thumbs")}>🖼</Button><Button size="sm" variant={panel === "outline" ? "primary" : "soft"} onClick={() => setPanel(panel === "outline" ? "none" : "outline")} disabled={!outline.length}>☰</Button><Button size="sm" variant={panel === "annotations" ? "primary" : "soft"} onClick={() => setPanel(panel === "annotations" ? "none" : "annotations")}>📝 {annotations.length}</Button><Button size="sm" onClick={() => toggleBookmark(page)} aria-label="علامة">{annotations.some((a) => a.type === "bookmark" && a.page === page) ? "🔖" : "📑"}</Button><Button size="sm" onClick={() => document.getElementById("pdf-root")?.requestFullscreen?.()} aria-label="ملء الشاشة">⛶</Button></div>
    </header>
    <div className="flex items-center gap-1 overflow-x-auto border-b px-2 py-1 text-xs no-scrollbar">{([["select", "↖ تحديد"], ["highlight", "🖍 تظليل"], ["underline", "⎁ تسطير"], ["strike", "S̶ شطب"], ["draw", "✏️ رسم"], ["note", "🗒 ملاحظة"]] as [Tool, string][]).map(([t, l]) => <Chip key={t} active={tool === t} onClick={() => setTool(t)}>{l}</Chip>)}<span className="mx-1 text-muted">|</span>{COLORS.map((c) => <button key={c} type="button" aria-label={`لون ${c}`} onClick={() => setColor(c)} className={cx("h-7 w-7 rounded-full border-2", color === c ? "border-ink" : "border-transparent")} style={{ background: c }} />)}{tool === "draw" && <><span className="mx-1 text-muted">|</span><input type="range" aria-label="سمك الفرشاة" min={1} max={12} value={brush} onChange={(e) => setBrush(Number(e.target.value))} /><span>{brush}px</span></>}<span className="ms-auto hidden text-muted md:inline">← → تنقل · +/- تكبير · f ملء الشاشة · b علامة · / بحث</span></div>
    <div className="flex min-h-0 flex-1">
      {panel !== "none" && <aside className="w-64 shrink-0 overflow-y-auto border-e bg-surface p-2 text-xs md:w-72">
        {panel === "search" && <div className="space-y-2"><div className="flex gap-1"><Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runSearch()} placeholder="ابحث في الكتاب…" /><Button size="sm" onClick={runSearch} disabled={searching}>{searching ? "…" : "بحث"}</Button></div>{hits.length > 0 && <div className="flex items-center justify-between"><span>{hitIdx + 1}/{hits.length}</span><span className="flex gap-1"><Button size="sm" onClick={() => nextHit(-1)}>▲</Button><Button size="sm" onClick={() => nextHit(1)}>▼</Button></span></div>}{hits.map((h, i) => <button key={i} type="button" onClick={() => { setHitIdx(i); goTo(h.page); }} className={cx("block w-full rounded-lg border p-2 text-start hover:bg-surface-2", i === hitIdx && "border-accent")}><b>ص{h.page}</b> …{h.snippet}…</button>)}</div>}
        {panel === "thumbs" && pdf && <div className="grid grid-cols-2 gap-2">{pages.map((p) => <Thumb key={p} pdf={pdf} page={p} active={p === page} onClick={() => goTo(p)} />)}</div>}
        {panel === "outline" && <ul className="space-y-0.5">{outline.map((o, i) => <li key={i}><button type="button" onClick={() => goTo(o.page)} className="block w-full rounded-lg px-2 py-1.5 text-start hover:bg-surface-2" style={{ paddingInlineStart: 8 + o.level * 12 }}>{o.title} <span className="text-muted">· {o.page}</span></button></li>)}</ul>}
        {panel === "annotations" && <div className="space-y-2"><div className="flex gap-1"><Button size="sm" onClick={exportJson}>JSON</Button><Button size="sm" onClick={exportMd}>Markdown</Button></div>{[...annotations].sort((a, b) => a.page - b.page).map((a) => <div key={a.id} className="flex items-start justify-between gap-1 rounded-lg border p-2"><button type="button" className="flex-1 text-start" onClick={() => goTo(a.page)}><span className="inline-block h-2 w-2 rounded-full" style={{ background: a.color }} /> <b>ص{a.page}</b> · {{ highlight: "تظليل", underline: "تسطير", strike: "شطب", note: "ملاحظة", bookmark: "علامة", drawing: "رسم" }[a.type]}{a.text && <div className="mt-0.5 line-clamp-3 text-muted">{a.text}</div>}</button><button type="button" aria-label="حذف" onClick={() => confirm("حذف التعليق؟", () => libraryActions.removeAnnotation(a.id))}>🗑</button></div>)}{!annotations.length && <p className="text-muted">لا تعليقات بعد. ظلّل نصًا أو ارسم أو أضف ملاحظة.</p>}</div>}
      </aside>}
      <div ref={containerRef} className={cx("flex-1 overflow-auto p-4", modeCls)} style={{ background: bg }} dir="ltr">
        {error && <ErrorState title="تعذر فتح الكتاب" message={error} onRetry={() => location.reload()} />}
        {!pdf && !error && <LoadingState text="جارٍ تحميل الكتاب…" />}
        {pdf && pages.map((p) => <PdfPage key={p} pdf={pdf} page={p} containerW={containerW} containerH={(containerRef.current?.clientHeight ?? 800) - 32} zoom={prefs.zoom} fit={prefs.fit} tool={tool} color={color} brush={brush} annotations={annotations.filter((a) => a.page === p)} bookId={book.id} onNote={() => { setNoteFor(p); setNoteText(""); }} />)}
      </div>
    </div>
    <Modal open={noteFor != null} onClose={() => setNoteFor(null)} title={`ملاحظة · صفحة ${noteFor}`} size="sm" footer={<Button variant="primary" onClick={() => { if (noteFor && noteText.trim()) libraryActions.addAnnotation({ bookId: book.id, page: noteFor, type: "note", color, text: noteText.trim() }); setNoteFor(null); }}>حفظ</Button>}><Textarea autoFocus value={noteText} onChange={(e) => setNoteText(e.target.value)} /></Modal>
    {dialog}
  </div>);
}

function Thumb({ pdf, page, active, onClick }: { pdf: PDFDocumentProxy; page: number; active: boolean; onClick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { let c = false; pdf.getPage(page).then(async (p) => { if (c || !ref.current) return; const vp = p.getViewport({ scale: 0.2 }); const cv = ref.current; cv.width = vp.width; cv.height = vp.height; await p.render({ canvasContext: cv.getContext("2d")!, viewport: vp, canvas: cv }).promise; }); return () => { c = true; }; }, [pdf, page]);
  return <button type="button" onClick={onClick} className={cx("rounded-lg border p-1", active && "border-accent")}><canvas ref={ref} className="w-full" /><div className="text-center">{page}</div></button>;
}

function PdfPage({ pdf, page, containerW, containerH, zoom, fit, tool, color, brush, annotations, bookId, onNote }: { pdf: PDFDocumentProxy; page: number; containerW: number; containerH: number; zoom: number; fit: "width" | "page" | "none"; tool: Tool; color: string; brush: number; annotations: Annotation[]; bookId: string; onNote: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null); const canvasRef = useRef<HTMLCanvasElement>(null); const textRef = useRef<HTMLDivElement>(null); const drawRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null); const [visible, setVisible] = useState(page <= 2); const drawing = useRef<{ x: number; y: number }[] | null>(null);
  useEffect(() => { const el = wrapRef.current; if (!el) return; const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setVisible(true)), { rootMargin: "600px" }); io.observe(el); return () => io.disconnect(); }, []);
  useEffect(() => {
    let cancelled = false; let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;
    pdf.getPage(page).then(async (p) => {
      const base = p.getViewport({ scale: 1 }); const scale = fit === "width" ? containerW / base.width : fit === "page" ? Math.min(containerW / base.width, containerH / base.height) : zoom; const vp = p.getViewport({ scale: Math.max(0.2, scale) });
      if (cancelled) return; setSize({ w: vp.width, h: vp.height }); if (!visible || !canvasRef.current) return;
      const cv = canvasRef.current; const dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = vp.width * dpr; cv.height = vp.height * dpr; cv.style.width = `${vp.width}px`; cv.style.height = `${vp.height}px`;
      const ctx = cv.getContext("2d")!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderTask = p.render({ canvasContext: ctx, viewport: vp, canvas: cv }); try { await renderTask.promise; } catch { return; }
      if (cancelled || !textRef.current) return; textRef.current.innerHTML = ""; const lib = await loadPdfjs(); const tl = new lib.TextLayer({ textContentSource: p.streamTextContent(), container: textRef.current, viewport: vp }); await tl.render().catch(() => {});
    });
    return () => { cancelled = true; renderTask?.cancel(); };
  }, [pdf, page, containerW, containerH, zoom, fit, visible]);
  // إعادة رسم الرسومات
  useEffect(() => { const cv = drawRef.current; if (!cv || !size) return; cv.width = size.w; cv.height = size.h; const ctx = cv.getContext("2d")!; ctx.clearRect(0, 0, size.w, size.h); for (const a of annotations.filter((x) => x.type === "drawing")) { ctx.strokeStyle = a.color; ctx.lineWidth = (a.width ?? 3) * (size.w / 800); ctx.lineCap = "round"; ctx.lineJoin = "round"; for (const path of a.paths ?? []) { ctx.beginPath(); path.forEach((pt, i) => (i ? ctx.lineTo(pt.x * size.w, pt.y * size.h) : ctx.moveTo(pt.x * size.w, pt.y * size.h))); ctx.stroke(); } } }, [annotations, size]);
  const onMouseUp = () => {
    if (!["highlight", "underline", "strike"].includes(tool) || !size) return; const sel = window.getSelection(); if (!sel || sel.isCollapsed || !wrapRef.current) return; const range = sel.getRangeAt(0); if (!wrapRef.current.contains(range.commonAncestorContainer)) return;
    const pr = wrapRef.current.getBoundingClientRect(); const rects = Array.from(range.getClientRects()).map((r) => ({ x: (r.left - pr.left) / size.w, y: (r.top - pr.top) / size.h, w: r.width / size.w, h: r.height / size.h })).filter((r) => r.w > 0.002 && r.h > 0.002);
    if (!rects.length) return; libraryActions.addAnnotation({ bookId, page, type: tool as AnnotationType, color, text: sel.toString().slice(0, 500), rects }); sel.removeAllRanges();
  };
  const pt = (e: React.PointerEvent) => { const r = drawRef.current!.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
  const onDown = (e: React.PointerEvent) => { if (tool !== "draw") return; drawing.current = [pt(e)]; (e.target as HTMLElement).setPointerCapture(e.pointerId); };
  const onMove = (e: React.PointerEvent) => { if (tool !== "draw" || !drawing.current || !size) return; const p = pt(e); drawing.current.push(p); const ctx = drawRef.current!.getContext("2d")!; const prev = drawing.current[drawing.current.length - 2]; ctx.strokeStyle = color; ctx.lineWidth = brush * (size.w / 800); ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(prev.x * size.w, prev.y * size.h); ctx.lineTo(p.x * size.w, p.y * size.h); ctx.stroke(); };
  const onUp = () => { if (tool !== "draw" || !drawing.current) return; if (drawing.current.length > 1) libraryActions.addAnnotation({ bookId, page, type: "drawing", color, width: brush, paths: [drawing.current] }); drawing.current = null; };
  return (<div ref={wrapRef} id={`pdf-page-${page}`} data-page={page} className="pdf-page bg-white" style={{ width: size?.w ?? containerW, height: size?.h ?? containerW * 1.4 }} onMouseUp={onMouseUp} onClick={() => tool === "note" && onNote()}>
    {visible && <canvas ref={canvasRef} />}
    <div ref={textRef} className="textLayer" style={{ pointerEvents: tool === "draw" ? "none" : "auto" }} />
    <div className="pointer-events-none absolute inset-0">{annotations.filter((a) => a.rects).map((a) => a.rects!.map((r, i) => <div key={a.id + i} className="absolute" style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%`, ...(a.type === "highlight" ? { background: a.color, opacity: 0.4, mixBlendMode: "multiply" as const } : a.type === "underline" ? { borderBottom: `2px solid ${a.color}` } : { background: `linear-gradient(transparent 45%, ${a.color} 45%, ${a.color} 58%, transparent 58%)` }) }} />))}{annotations.filter((a) => a.type === "note").map((a, i) => <div key={a.id} title={a.text} className="pointer-events-auto absolute end-2 rounded-lg bg-gold px-1.5 text-[10px] font-bold text-black shadow" style={{ top: 8 + i * 22 }}>🗒 {a.text?.slice(0, 18)}</div>)}{annotations.some((a) => a.type === "bookmark") && <div className="absolute start-3 top-0 text-xl">🔖</div>}</div>
    <canvas ref={drawRef} className="absolute inset-0" style={{ pointerEvents: tool === "draw" ? "auto" : "none", touchAction: tool === "draw" ? "none" : "auto" }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
    <div className="absolute -bottom-5 left-0 right-0 text-center text-[10px] text-gray-500">{page}</div>
  </div>);
}
function download(name: string, content: string, type: string) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
