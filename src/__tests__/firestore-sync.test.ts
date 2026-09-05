import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeFirestore } from "./helpers/fake-firestore";

const fake = new FakeFirestore();

// طبقة Firestore الحقيقية تُستدعى، لكن getDb يعيد قاعدة في الذاكرة (لا حاجة لمحاكي Java)
vi.mock("@/server/firebase", () => ({
  getDb: () => fake,
  tryGetDb: () => fake,
  isCloudConfigured: () => true,
  isCloudDisabledError: () => false,
}));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "__serverTimestamp__" },
}));

const { ensureAccount, findAccountByCode, getAccount } = await import("@/server/firestore/accounts");
const { pullDocuments, pushDocuments, deleteAccountDocuments } = await import("@/server/firestore/documents");
const { recordAiAudit } = await import("@/server/firestore/ai-audit");

const ACCOUNT = "acc_device_one_1234";
const CODE = "A1B2C3-D4E5";

beforeEach(() => {
  fake.store.clear();
  fake.commits = 0;
});

describe("accounts", () => {
  it("creates an account on first sight and indexes its code", async () => {
    const acc = await ensureAccount(ACCOUNT, CODE);
    expect(acc).toMatchObject({ id: ACCOUNT, code: CODE });
    expect(fake.store.get(`accountCodes/${CODE}`)).toMatchObject({ accountId: ACCOUNT });
    expect(await getAccount(ACCOUNT)).toMatchObject({ id: ACCOUNT, code: CODE });
  });

  it("is idempotent and rejects a wrong code for an existing account", async () => {
    await ensureAccount(ACCOUNT, CODE);
    expect(await ensureAccount(ACCOUNT, CODE)).toMatchObject({ id: ACCOUNT });
    expect(await ensureAccount(ACCOUNT, "ZZZZZZ-9999")).toBeNull();
  });

  it("refuses to hand an already-taken code to a different device", async () => {
    await ensureAccount(ACCOUNT, CODE);
    expect(await ensureAccount("acc_device_two_5678", CODE)).toBeNull();
  });

  it("rejects malformed identifiers without touching Firestore", async () => {
    expect(await ensureAccount("short", CODE)).toBeNull();
    expect(await ensureAccount(ACCOUNT, "bad")).toBeNull();
    expect(fake.store.size).toBe(0);
  });

  it("links a device by code (case-insensitive)", async () => {
    await ensureAccount(ACCOUNT, CODE);
    expect(await findAccountByCode("a1b2c3-d4e5")).toMatchObject({ id: ACCOUNT, code: CODE });
    expect(await findAccountByCode("NOPE-0000")).toBeNull();
  });

  it("repairs the code index for legacy accounts", async () => {
    fake.store.set(`accounts/${ACCOUNT}`, { code: CODE, createdAt: 1 });
    expect(await findAccountByCode(CODE)).toMatchObject({ id: ACCOUNT });
    expect(fake.store.get(`accountCodes/${CODE}`)).toMatchObject({ accountId: ACCOUNT });
  });
});

describe("push / pull", () => {
  it("stores docs under the account subcollection and pulls them back intact", async () => {
    const data = { "2026-09-05": { tasks: [{ id: "t1", metrics: ["x", "y"] }], nested: [[1, 2]] } };
    const push = await pushDocuments(ACCOUNT, [{ key: "entries", data, updatedAt: 100 }]);
    expect(push.accepted).toEqual(["entries"]);
    expect([...fake.store.keys()]).toEqual([`accounts/${ACCOUNT}/documents/entries`]);

    const pull = await pullDocuments(ACCOUNT, 0);
    expect(pull.docs).toEqual([{ key: "entries", data, updatedAt: 100 }]);
    expect(pull.hasMore).toBe(false);
  });

  it("never overwrites a newer server doc (no destructive overwrite)", async () => {
    await pushDocuments(ACCOUNT, [{ key: "xpLog", data: { v: "new" }, updatedAt: 500 }]);
    const res = await pushDocuments(ACCOUNT, [{ key: "xpLog", data: { v: "old" }, updatedAt: 400 }]);
    expect(res.accepted).toEqual([]);
    expect(res.rejected).toEqual([{ key: "xpLog", reason: "stale", serverUpdatedAt: 500 }]);
    const pull = await pullDocuments(ACCOUNT, 0);
    expect(pull.docs[0].data).toEqual({ v: "new" });
  });

  it("accepts an update with a newer timestamp", async () => {
    await pushDocuments(ACCOUNT, [{ key: "uiPrefs", data: { theme: "dark" }, updatedAt: 1 }]);
    const res = await pushDocuments(ACCOUNT, [{ key: "uiPrefs", data: { theme: "light" }, updatedAt: 2 }]);
    expect(res.accepted).toEqual(["uiPrefs"]);
    expect((await pullDocuments(ACCOUNT, 0)).docs[0].data).toEqual({ theme: "light" });
  });

  it("only returns docs changed after `since`", async () => {
    const first = await pushDocuments(ACCOUNT, [{ key: "books", data: [1], updatedAt: 1 }]);
    const cursor = first.serverTime;
    await new Promise((r) => setTimeout(r, 5));
    await pushDocuments(ACCOUNT, [{ key: "goals", data: [2], updatedAt: 2 }]);
    const pull = await pullDocuments(ACCOUNT, cursor);
    expect(pull.docs.map((d) => d.key)).toEqual(["goals"]);
  });

  it("paginates large pulls and reports hasMore with a resumable cursor", async () => {
    await pushDocuments(
      ACCOUNT,
      Array.from({ length: 5 }, (_, i) => ({ key: `k${i}`, data: i, updatedAt: i + 1 })),
    );
    const page1 = await pullDocuments(ACCOUNT, 0, 2);
    expect(page1.docs).toHaveLength(2);
    expect(page1.hasMore).toBe(true);
    const page2 = await pullDocuments(ACCOUNT, page1.serverTime, 2);
    expect(page2.docs.map((d) => d.key)).not.toEqual(page1.docs.map((d) => d.key));
    const page3 = await pullDocuments(ACCOUNT, page2.serverTime, 10);
    expect([...page1.docs, ...page2.docs, ...page3.docs].map((d) => d.key).sort()).toEqual(["k0", "k1", "k2", "k3", "k4"]);
    expect(page3.hasMore).toBe(false);
  });

  it("writes one batch per push and isolates accounts", async () => {
    await pushDocuments(ACCOUNT, [
      { key: "a", data: 1, updatedAt: 1 },
      { key: "b", data: 2, updatedAt: 1 },
    ]);
    expect(fake.commits).toBe(1);
    await pushDocuments("acc_other_device_99", [{ key: "a", data: 9, updatedAt: 1 }]);
    expect((await pullDocuments(ACCOUNT, 0)).docs.find((d) => d.key === "a")?.data).toBe(1);
    expect((await pullDocuments("acc_other_device_99", 0)).docs[0].data).toBe(9);
  });

  it("rejects oversized docs without writing anything", async () => {
    const res = await pushDocuments(ACCOUNT, [{ key: "photos", data: "x".repeat(1_000_000), updatedAt: 1 }]);
    expect(res.accepted).toEqual([]);
    expect(res.rejected[0]).toMatchObject({ key: "photos", reason: "too_large" });
    expect(fake.store.size).toBe(0);
  });

  it("encodes unsafe keys into valid Firestore document ids", async () => {
    await pushDocuments(ACCOUNT, [{ key: "a/b", data: 1, updatedAt: 1 }]);
    const [path] = [...fake.store.keys()];
    expect(path.split("/")).toHaveLength(4);
    expect((await pullDocuments(ACCOUNT, 0)).docs[0].key).toBe("a/b");
  });

  it("reads legacy structured documents written before the JSON encoding", async () => {
    fake.store.set(`accounts/${ACCOUNT}/documents/legacyKey`, { key: "legacyKey", data: { old: true }, updatedAt: 7, serverAt: 7 });
    expect((await pullDocuments(ACCOUNT, 0)).docs[0]).toEqual({ key: "legacyKey", data: { old: true }, updatedAt: 7 });
  });

  it("deletes every document of an account", async () => {
    await pushDocuments(ACCOUNT, [
      { key: "a", data: 1, updatedAt: 1 },
      { key: "b", data: 1, updatedAt: 1 },
    ]);
    expect(await deleteAccountDocuments(ACCOUNT)).toBe(2);
    expect((await pullDocuments(ACCOUNT, 0)).docs).toEqual([]);
  });
});

describe("ai audit log", () => {
  it("writes once per id (idempotent)", async () => {
    const entry = { id: "audit_1", accountId: ACCOUNT, mode: "doctor", actionType: "addTask", payload: { a: [1, 2] }, result: "applied" };
    expect(await recordAiAudit(entry)).toBe(true);
    expect(await recordAiAudit(entry)).toBe(false);
    const stored = fake.store.get("aiAuditLog/audit_1") as { payloadJson: string; result: string };
    expect(JSON.parse(stored.payloadJson)).toEqual({ a: [1, 2] });
    expect(stored.result).toBe("applied");
  });
});
