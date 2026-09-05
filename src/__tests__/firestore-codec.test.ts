import { describe, expect, it } from "vitest";
import {
  MAX_DOC_BYTES,
  decodeDocId,
  decodePayload,
  encodeDocId,
  encodePayload,
  isValidAccountCode,
  isValidAccountId,
  nextServerAt,
  normalizeAccountCode,
  shouldAcceptIncoming,
  validateIncomingDocs,
} from "@/server/firestore/codec";

describe("firestore doc ids", () => {
  it("keeps plain AppData keys as-is", () => {
    for (const k of ["entries", "xpLog", "aiChatsByMode", "uiPrefs"]) {
      expect(encodeDocId(k)).toBe(k);
      expect(decodeDocId(encodeDocId(k))).toBe(k);
    }
  });
  it("encodes ids Firestore rejects (slash, dots, __ prefix)", () => {
    for (const k of ["a/b", ".", "..", "__proto__", "مفتاح عربي"]) {
      const id = encodeDocId(k);
      expect(id).not.toContain("/");
      expect(id.startsWith("__")).toBe(false);
      expect([".", ".."]).not.toContain(id);
      expect(decodeDocId(id)).toBe(k);
    }
  });
});

describe("payload codec", () => {
  it("round-trips nested arrays (غير مدعومة أصلًا في Firestore)", () => {
    const data = { rows: [[1, 2], [3, 4]], meta: { tags: ["a", "b"] } };
    const enc = encodePayload(data);
    expect(decodePayload({ json: enc.json, encoding: enc.encoding })).toEqual(data);
  });
  it("round-trips arrays and primitives", () => {
    for (const v of [[{ id: "1", metrics: ["x"] }], "text", 42, true, null]) {
      const enc = encodePayload(v);
      expect(decodePayload({ json: enc.json, encoding: "json" })).toEqual(v);
    }
  });
  it("reads legacy structured documents", () => {
    expect(decodePayload({ data: { a: 1 } })).toEqual({ a: 1 });
  });
  it("measures bytes in utf8", () => {
    expect(encodePayload("ابن").bytes).toBe(Buffer.byteLength(JSON.stringify("ابن"), "utf8"));
  });
});

describe("push validation", () => {
  it("accepts well-formed docs and encodes them", () => {
    const { valid, rejected } = validateIncomingDocs([{ key: "entries", data: { a: 1 }, updatedAt: 10 }]);
    expect(rejected).toHaveLength(0);
    expect(valid[0].docId).toBe("entries");
    expect(JSON.parse(valid[0].payload.json)).toEqual({ a: 1 });
  });
  it("drops malformed keys and flags bad timestamps", () => {
    const { valid, rejected } = validateIncomingDocs([
      { key: "", data: 1, updatedAt: 1 },
      { key: "x".repeat(65), data: 1, updatedAt: 1 },
      { key: "ok", data: 1, updatedAt: "nope" },
      null,
    ]);
    expect(valid).toHaveLength(0);
    expect(rejected).toEqual([{ key: "ok", reason: "invalid", serverUpdatedAt: 0 }]);
  });
  it("rejects documents beyond the Firestore 1MiB limit", () => {
    const big = "x".repeat(MAX_DOC_BYTES + 10);
    const { valid, rejected } = validateIncomingDocs([{ key: "photos", data: big, updatedAt: 1 }]);
    expect(valid).toHaveLength(0);
    expect(rejected[0]).toMatchObject({ key: "photos", reason: "too_large" });
  });
  it("caps a batch at 200 docs", () => {
    const docs = Array.from({ length: 500 }, (_, i) => ({ key: `k${i}`, data: i, updatedAt: 1 }));
    expect(validateIncomingDocs(docs).valid).toHaveLength(200);
  });
  it("ignores non-array input", () => {
    expect(validateIncomingDocs({ nope: true }).valid).toHaveLength(0);
  });
});

describe("last-write-wins", () => {
  it("never overwrites a newer server document", () => {
    expect(shouldAcceptIncoming(100, 99)).toBe(false);
    expect(shouldAcceptIncoming(100, 100)).toBe(true);
    expect(shouldAcceptIncoming(100, 101)).toBe(true);
    expect(shouldAcceptIncoming(undefined, 0)).toBe(true);
  });
  it("keeps serverAt strictly increasing inside one batch", () => {
    const a = nextServerAt(1000, undefined);
    const b = nextServerAt(1000, a);
    const c = nextServerAt(1000, b);
    expect([a, b, c]).toEqual([1000, 1001, 1002]);
    expect(nextServerAt(2000, 1002)).toBe(2000);
  });
});

describe("account identifiers", () => {
  it("validates ids and codes", () => {
    expect(isValidAccountId("acc_abc12345xyz")).toBe(true);
    expect(isValidAccountId("short")).toBe(false);
    expect(isValidAccountId("bad/id/with/slash")).toBe(false);
    expect(isValidAccountCode("A1B2C3-D4E5")).toBe(true);
    expect(isValidAccountCode("abc")).toBe(false);
    expect(isValidAccountCode("has/slash")).toBe(false);
  });
  it("normalizes codes for case-insensitive linking", () => {
    expect(normalizeAccountCode(" a1b2c3-d4e5 ")).toBe("A1B2C3-D4E5");
  });
});

describe("firestore deadlines", () => {
  it("رمي FirestoreTimeoutError عند تجاوز المهلة", async () => {
    const { withDeadline, isFirestoreTimeoutError } = await import("@/server/firestore/deadline");
    const never = new Promise(() => {});
    await expect(withDeadline(never, "pull", 20)).rejects.toSatisfy(isFirestoreTimeoutError);
  });
  it("يمرر النتيجة عندما تسبق العملية المهلة", async () => {
    const { withDeadline } = await import("@/server/firestore/deadline");
    await expect(withDeadline(Promise.resolve("ok"), "pull", 500)).resolves.toBe("ok");
  });
});
