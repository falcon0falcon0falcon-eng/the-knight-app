import { Lesson } from "@/types/app-data";
import { uid } from "@/core/date";

/** اكتشاف الفاصل تلقائيًا: , ; \t | */
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 10); const cands = [",", ";", "\t", "|"];
  let best = ","; let bestScore = -1;
  for (const c of cands) { const counts = lines.map((l) => splitCsvLine(l, c).length); const avg = counts.reduce((a, b) => a + b, 0) / Math.max(1, counts.length); const consistent = counts.every((n) => n === counts[0]); const score = avg * (consistent ? 2 : 1); if (avg > 1 && score > bestScore) { bestScore = score; best = c; } }
  return best;
}
export function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) { const ch = line[i]; if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (ch === delim && !q) { out.push(cur); cur = ""; } else cur += ch; }
  out.push(cur); return out.map((s) => s.trim());
}
/** تحليل مدة مرن: "12:34", "1:02:03", "45m", "1h 20m", "90", "1.5h", "٤٥ دقيقة" */
export function parseDuration(raw: string | undefined): number {
  if (!raw) return 0; let s = raw.trim().toLowerCase().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  if (!s) return 0;
  if (/^\d+(:\d{1,2}){1,2}$/.test(s)) { const parts = s.split(":").map(Number); return parts.length === 3 ? parts[0] * 60 + parts[1] + parts[2] / 60 : parts[0] + parts[1] / 60; }
  let total = 0; let matched = false;
  const h = s.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|س|ساعة|ساعات)/); if (h) { total += parseFloat(h[1]) * 60; matched = true; s = s.replace(h[0], ""); }
  const m = s.match(/(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes|د|دقيقة|دقائق)/); if (m) { total += parseFloat(m[1]); matched = true; s = s.replace(m[0], ""); }
  const sec = s.match(/(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds|ث|ثانية)/); if (sec) { total += parseFloat(sec[1]) / 60; matched = true; }
  if (matched) return Math.round(total * 100) / 100;
  const n = parseFloat(s.replace(/[^\d.]/g, "")); return isNaN(n) ? 0 : n;
}
const TITLE_KEYS = ["title", "name", "lesson", "عنوان", "الدرس", "اسم"]; const DUR_KEYS = ["duration", "length", "time", "minutes", "mins", "المدة", "الوقت", "دقائق"]; const URL_KEYS = ["url", "link", "video", "href", "رابط", "فيديو"]; const DONE_KEYS = ["done", "completed", "status", "watched", "مكتمل", "الحالة"];
const findCol = (headers: string[], keys: string[]) => headers.findIndex((h) => keys.some((k) => h.toLowerCase().includes(k)));

export interface CsvImportResult { lessons: Lesson[]; delimiter: string; columns: { title: number; duration: number; url: number; done: number }; skipped: number; hadHeader: boolean }
/** استيراد CSV مع اكتشاف الفاصل والأعمدة تلقائيًا */
export function parseCoursesCsv(text: string): CsvImportResult {
  const delimiter = detectDelimiter(text); const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { lessons: [], delimiter, columns: { title: 0, duration: -1, url: -1, done: -1 }, skipped: 0, hadHeader: false };
  const first = splitCsvLine(lines[0], delimiter); let title = findCol(first, TITLE_KEYS), duration = findCol(first, DUR_KEYS), url = findCol(first, URL_KEYS), done = findCol(first, DONE_KEYS);
  const looksLikeData = first.some((v) => /^https?:\/\//.test(v) || /^\d+(:\d{1,2})+$/.test(v));
  const hadHeader = (title >= 0 || duration >= 0 || url >= 0) && !looksLikeData;
  const rows = (hadHeader ? lines.slice(1) : lines).map((l) => splitCsvLine(l, delimiter));
  if (!hadHeader) { // استنتاج بالمحتوى
    const sample = rows.slice(0, 5); const cols = Math.max(...sample.map((r) => r.length));
    url = -1; duration = -1; title = -1;
    for (let c = 0; c < cols; c++) { const vals = sample.map((r) => r[c] ?? ""); if (url < 0 && vals.some((v) => /^https?:\/\//.test(v))) url = c; else if (duration < 0 && vals.every((v) => !v || parseDuration(v) > 0) && vals.some((v) => /\d/.test(v)) && vals.every((v) => v.length < 12)) duration = c; else if (title < 0) title = c; }
    if (title < 0) title = 0; done = -1;
  }
  let skipped = 0; const lessons: Lesson[] = [];
  for (const r of rows) { const t = r[title]?.trim(); if (!t) { skipped++; continue; } const d = done >= 0 ? /^(1|true|yes|done|completed|نعم|مكتمل|✓)$/i.test(r[done] ?? "") : false; lessons.push({ id: uid("ls"), title: t, durationMin: duration >= 0 ? parseDuration(r[duration]) : 0, videoUrl: url >= 0 ? r[url] ?? "" : "", done: d, doneAt: d ? new Date().toISOString() : undefined }); }
  return { lessons, delimiter, columns: { title, duration, url, done }, skipped, hadHeader };
}
