import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FakeFirestore } from "./helpers/fake-firestore";

/**
 * اختبار نقاط الـAPI نفسها (وليس طبقة Firestore فقط) فوق قاعدة في الذاكرة:
 * ترويسات الهوية، رموز الحالة، والعقد الكامل push/pull/link/audit.
 */
const fake = new FakeFirestore();
let configured = true;

vi.mock("@/server/firebase", async () => {
  const actual = await vi.importActual<typeof import("@/server/firebase")>("@/server/firebase");
  return {
    ...actual,
    getDb: () => fake,
    tryGetDb: () => (configured ? fake : null),
    isCloudConfigured: () => configured,
  };
});
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "__ts__" } }));

const sync = await import("@/app/api/sync/route");
const link = await import("@/app/api/sync/link/route");
const audit = await import("@/app/api/ai/audit/route");
const health = await import("@/app/api/health/route");

const ID = "acc_device_alpha_001";
const CODE = "A1B2C3-D4E5";
const auth = (id = ID, code = CODE) => ({ "x-account-id": id, "x-account-code": code, "content-type": "application/json" });

const get = (url: string, headers: Record<string, string>) => new NextRequest(new Request(url, { headers }));
const post = (url: string, headers: Record<string, string>, body: unknown) =>
  new NextRequest(new Request(url, { method: "POST", headers, body: JSON.stringify(body) }));

beforeEach(() => {
  fake.store.clear();
  configured = true;
});

describe("POST/GET /api/sync", () => {
  it("يرفض بلا ترويسات هوية (401)", async () => {
    const res = await sync.GET(get("http://x/api/sync?since=0", {}));
    expect(res.status).toBe(401);
  });

  it("ينشئ الحساب تلقائيًا ثم يدفع ويسحب البيانات", async () => {
    const pushRes = await sync.POST(post("http://x/api/sync", auth(), { docs: [{ key: "entries", data: { a: [1, [2]] }, updatedAt: 5 }] }));
    expect(pushRes.status).toBe(200);
    expect(await pushRes.json()).toMatchObject({ accepted: ["entries"], rejected: [] });

    const pullRes = await sync.GET(get("http://x/api/sync?since=0", auth()));
    const pulled = await pullRes.json();
    expect(pulled.docs).toEqual([{ key: "entries", data: { a: [1, [2]] }, updatedAt: 5 }]);
    expect(pulled.hasMore).toBe(false);
    expect(typeof pulled.serverTime).toBe("number");
  });

  it("يرفض رمز حساب خاطئ لنفس المعرّف (401)", async () => {
    await sync.POST(post("http://x/api/sync", auth(), { docs: [] }));
    const res = await sync.GET(get("http://x/api/sync?since=0", auth(ID, "ZZZZZZ-9999")));
    expect(res.status).toBe(401);
  });

  it("يرفض جسمًا غير صالح (400)", async () => {
    const res = await sync.POST(post("http://x/api/sync", auth(), { nope: true }));
    expect(res.status).toBe(400);
  });

  it("لا يدهس مستندًا أحدث على الخادم", async () => {
    await sync.POST(post("http://x/api/sync", auth(), { docs: [{ key: "xpLog", data: "new", updatedAt: 100 }] }));
    const res = await sync.POST(post("http://x/api/sync", auth(), { docs: [{ key: "xpLog", data: "old", updatedAt: 50 }] }));
    const body = await res.json();
    expect(body.accepted).toEqual([]);
    expect(body.rejected[0]).toMatchObject({ key: "xpLog", reason: "stale", serverUpdatedAt: 100 });
  });

  it("يعزل البيانات بين الحسابات", async () => {
    await sync.POST(post("http://x/api/sync", auth(), { docs: [{ key: "books", data: "mine", updatedAt: 1 }] }));
    const other = auth("acc_device_beta_002", "ZZZZ11-2222");
    const res = await sync.GET(get("http://x/api/sync?since=0", other));
    expect((await res.json()).docs).toEqual([]);
  });

  it("يعيد 503 cloud_disabled عندما لا تُضبط اعتمادات Firebase", async () => {
    configured = false;
    const res = await sync.GET(get("http://x/api/sync?since=0", auth()));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "cloud_disabled" });
  });
});

describe("POST /api/sync/link", () => {
  it("يربط جهازًا آخر عبر الرمز", async () => {
    await sync.POST(post("http://x/api/sync", auth(), { docs: [] }));
    const res = await link.POST(post("http://x/api/sync/link", { "content-type": "application/json" }, { code: CODE.toLowerCase() }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accountId: ID, accountCode: CODE });
  });
  it("404 لرمز غير موجود و 400 بلا رمز", async () => {
    expect((await link.POST(post("http://x/api/sync/link", { "content-type": "application/json" }, { code: "NOPE-0000" }))).status).toBe(404);
    expect((await link.POST(post("http://x/api/sync/link", { "content-type": "application/json" }, {}))).status).toBe(400);
  });
});

describe("POST /api/ai/audit", () => {
  it("يسجّل مرة واحدة لكل معرّف", async () => {
    const headers = { "x-account-id": ID, "content-type": "application/json" };
    const body = { id: "a1", mode: "doctor", actionType: "addTask", payload: { x: 1 }, result: "applied" };
    expect(await (await audit.POST(post("http://x/api/ai/audit", headers, body))).json()).toEqual({ ok: true, created: true });
    expect(await (await audit.POST(post("http://x/api/ai/audit", headers, body))).json()).toEqual({ ok: true, created: false });
  });
  it("401 بلا معرّف حساب", async () => {
    expect((await audit.POST(post("http://x/api/ai/audit", { "content-type": "application/json" }, { id: "a2" }))).status).toBe(401);
  });
});

describe("GET /api/health", () => {
  it("ok مع Firestore متاح", async () => {
    const res = await health.GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, cloud: { provider: "firestore", configured: true, reachable: true } });
  });
  it("يبقى ok محليًا عندما تكون السحابة غير مُهيّأة", async () => {
    configured = false;
    const res = await health.GET();
    expect(res.status).toBe(200);
    expect((await res.json()).cloud).toMatchObject({ configured: false, reachable: false });
  });
});
