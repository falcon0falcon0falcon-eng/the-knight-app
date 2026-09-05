import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * AI proxy — يقرأ OPENAI_API_KEY (أو OPENAI_BASE_URL لمزودات متوافقة) من الخادم.
 * لا يخزن شيئًا. إن لم يوجد مفتاح يعيد {provider:"none"} ليعمل المدرّب المحلي على العميل.
 */
export async function GET() { return NextResponse.json({ provider: process.env.OPENAI_API_KEY ? "openai" : "none", model: process.env.OPENAI_MODEL ?? "gpt-4o-mini" }); }

export async function POST(req: NextRequest) {
  const key = process.env.OPENAI_API_KEY; if (!key) return NextResponse.json({ provider: "none" }, { status: 200 });
  const body = (await req.json().catch(() => null)) as { system: string; messages: { role: "user" | "assistant"; content: string }[]; model?: string; temperature?: number } | null;
  if (!body?.messages?.length) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  try {
    const r = await fetch(`${base}/chat/completions`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ model: body.model || process.env.OPENAI_MODEL || "gpt-4o-mini", temperature: body.temperature ?? 0.6, messages: [{ role: "system", content: body.system }, ...body.messages.slice(-16)] }) });
    if (!r.ok) return NextResponse.json({ error: `provider ${r.status}: ${(await r.text()).slice(0, 300)}` }, { status: 502 });
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    return NextResponse.json({ provider: "openai", text: j.choices?.[0]?.message?.content ?? "" });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "network" }, { status: 502 }); }
}
