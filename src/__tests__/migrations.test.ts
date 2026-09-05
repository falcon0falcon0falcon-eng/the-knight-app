import { describe, it, expect } from "vitest";
import { migrateToLatest, mergeAppData, CURRENT_SCHEMA_VERSION } from "@/migrations";
import { defaultAppData } from "@/types/app-data";
import { parseTeachingPhrase, extractActions, parseForgetPhrase } from "@/domain/ai";

describe("legacy migration", () => {
  const legacy = {
    entries: JSON.stringify({ "2024-05-01": { tasks: [{ id: "t1", title: "old", done: true }], gym: true, xpAwarded: { gym: 15 } } }),
    weights: [{ date: "2024-05-01", weight: 88 }],
    bookHighlights: [{ id: "h1", bookId: "b", page: 3, color: "#ff0" }],
    bookDrawings: [{ id: "d1", bookId: "b", page: 4, color: "#f00", paths: [] }],
    aiChatHistory: [{ id: "m1", role: "user", content: "hi", at: "" }],
    aiMemory: [{ id: "mem1", text: "أحب القراءة ليلًا", createdAt: "", source: "taught" }],
    customStreakHabits: [{ id: "c1", name: "مشي", area: "physical" }],
    streakHabitOrder: ["c1", "fajr"],
    sobrietyStartAt: "2024-01-01T00:00:00.000Z",
    someUnknownKey: { a: 1 },
  };
  it("migrates flat legacy (v0) to latest without losing data", () => {
    const { data, report } = migrateToLatest(legacy);
    expect(report.fromVersion).toBe(0);
    expect(data.entries["2024-05-01"].tasks[0].source).toBe("custom");
    expect(data.bodyEntries.find((b) => b.date === "2024-05-01")?.weight).toBe(88);
    expect(data.weights.length).toBe(1); // الأصل محفوظ
    expect(data.bookAnnotations.map((a) => a.type).sort()).toEqual(["drawing", "highlight"]);
    expect(data.aiChatsByMode.game.length).toBe(1);
    expect(data.aiMemoriesByMode.global[0].text).toContain("القراءة");
    expect(data.habits[0].id).toBe("c1"); // order respected
    expect(data.habits.find((h) => h.id === "c1")?.custom).toBe(true);
    expect(data.xpLog.length).toBe(1); // rebuilt from xpAwarded
    expect(data.legacy.someUnknownKey).toEqual({ a: 1 });
    expect(report.unknownKeys).toContain("someUnknownKey");
    expect(data.sobrietyStartAt).toBe("2024-01-01T00:00:00.000Z");
  });
  it("is idempotent for new envelope", () => { const first = migrateToLatest(legacy).data; const again = migrateToLatest({ schemaVersion: CURRENT_SCHEMA_VERSION, data: first }).data; expect(again.xpLog.length).toBe(first.xpLog.length); expect(again.bookAnnotations.length).toBe(first.bookAnnotations.length); expect(again.habits.length).toBe(first.habits.length); });
  it("merge keeps local ids and adds incoming", () => { const a = defaultAppData(); a.books = [{ id: "x", title: "A", author: "", pages: 1, currentPage: 1, storage: "none", sessions: [], addedAt: "" }]; const b = defaultAppData(); b.books = [{ id: "x", title: "A2", author: "", pages: 1, currentPage: 1, storage: "none", sessions: [], addedAt: "" }, { id: "y", title: "B", author: "", pages: 1, currentPage: 1, storage: "none", sessions: [], addedAt: "" }]; const m = mergeAppData(a, b); expect(m.books.length).toBe(2); expect(m.books.find((k) => k.id === "x")!.title).toBe("A"); });
  it("backup restore roundtrip preserves xp total", () => { const d = defaultAppData(); d.xpLog = [{ id: "1", at: "", date: "2025-01-01", amount: 120, source: "s", label: "l" }]; const json = JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, data: d }); const { data } = migrateToLatest(JSON.parse(json)); expect(data.xpLog.reduce((a, e) => a + e.amount, 0)).toBe(120); });
});
describe("ai parsing", () => {
  it("teaching phrases", () => { expect(parseTeachingPhrase("احفظ في ذاكرتك أني أستيقظ الساعة 5")).toBe("أستيقظ الساعة 5"); expect(parseTeachingPhrase("تذكر: أكره السهر")).toBe("أكره السهر"); expect(parseTeachingPhrase("remember that I train at night")).toBe("I train at night"); expect(parseTeachingPhrase("ما هدف اليوم؟")).toBeNull(); expect(parseForgetPhrase("انسَ أني أكره السهر")).toBe("أكره السهر"); });
  it("extracts actions block", () => { const { clean, actions } = extractActions('نصيحة\n```actions\n[{"type":"addTask","payload":{"title":"x"}},{"type":"dropDatabase"}]\n```'); expect(clean).toBe("نصيحة"); expect(actions.length).toBe(1); expect(actions[0].type).toBe("addTask"); });
});
