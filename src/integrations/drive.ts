"use client";
// Google Drive (drive.file scope) — client-side فقط. الملفات لا تمر عبر خادمنا.
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const FOLDER_NAME = "Me vs Me Books";
const TOKEN_KEY = "mevsme:drive:token";
type TokenClient = { requestAccessToken: (o?: { prompt?: string }) => void };
declare global { interface Window { google?: { accounts: { oauth2: { initTokenClient: (c: { client_id: string; scope: string; callback: (r: { access_token?: string; expires_in?: number; error?: string }) => void }) => TokenClient; revoke: (t: string, cb: () => void) => void } } } } }

export const driveConfigured = () => !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
function getToken(): string | null { try { const raw = localStorage.getItem(TOKEN_KEY); if (!raw) return null; const { token, exp } = JSON.parse(raw); return Date.now() < exp ? token : null; } catch { return null; } }
export const driveConnected = () => !!getToken();
function loadGis(): Promise<void> { return new Promise((res, rej) => { if (window.google?.accounts) return res(); const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.onload = () => res(); s.onerror = () => rej(new Error("تعذر تحميل مكتبة Google")); document.head.appendChild(s); }); }
export async function driveConnect(): Promise<void> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID; if (!clientId) throw new Error("لم يُضبط NEXT_PUBLIC_GOOGLE_CLIENT_ID");
  await loadGis();
  return new Promise((res, rej) => { const tc = window.google!.accounts.oauth2.initTokenClient({ client_id: clientId, scope: SCOPE, callback: (r) => { if (r.error || !r.access_token) return rej(new Error(r.error ?? "رُفض الإذن")); localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: r.access_token, exp: Date.now() + ((r.expires_in ?? 3600) - 60) * 1000 })); res(); } }); tc.requestAccessToken({ prompt: "consent" }); });
}
export function driveDisconnect() { const t = getToken(); localStorage.removeItem(TOKEN_KEY); if (t && window.google?.accounts) window.google.accounts.oauth2.revoke(t, () => {}); }
async function api<T>(path: string, init?: RequestInit): Promise<T> { const t = getToken(); if (!t) throw new Error("غير متصل بـ Drive"); const r = await fetch(`https://www.googleapis.com${path}`, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${t}` } }); if (r.status === 401) { localStorage.removeItem(TOKEN_KEY); throw new Error("انتهت الجلسة — أعد الاتصال"); } if (!r.ok) throw new Error(`Drive: ${r.status} ${await r.text().catch(() => "")}`); return (r.headers.get("content-type")?.includes("json") ? r.json() : (r as unknown)) as T; }
async function ensureFolder(): Promise<string> { const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`); const r = await api<{ files: { id: string }[] }>(`/drive/v3/files?q=${q}&fields=files(id)`); if (r.files[0]) return r.files[0].id; const c = await api<{ id: string }>(`/drive/v3/files`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }) }); return c.id; }
export interface DriveFile { id: string; name: string; size?: string; modifiedTime?: string }
export async function driveList(): Promise<DriveFile[]> { const folder = await ensureFolder(); const q = encodeURIComponent(`'${folder}' in parents and mimeType='application/pdf' and trashed=false`); const r = await api<{ files: DriveFile[] }>(`/drive/v3/files?q=${q}&fields=files(id,name,size,modifiedTime)&orderBy=modifiedTime desc`); return r.files; }
export async function driveUpload(blob: Blob, name: string): Promise<DriveFile> { const folder = await ensureFolder(); const meta = new Blob([JSON.stringify({ name, parents: [folder], mimeType: "application/pdf" })], { type: "application/json" }); const form = new FormData(); form.append("metadata", meta); form.append("file", blob); return api<DriveFile>(`/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,modifiedTime`, { method: "POST", body: form }); }
export async function driveDownload(id: string): Promise<Blob | null> { try { const t = getToken(); if (!t) return null; const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { headers: { Authorization: `Bearer ${t}` } }); if (!r.ok) return null; return r.blob(); } catch { return null; } }
export async function driveDelete(id: string): Promise<void> { await api(`/drive/v3/files/${id}`, { method: "DELETE" }); }
