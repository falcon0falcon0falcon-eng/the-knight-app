import { pgTable, text, jsonb, bigint, timestamp, primaryKey, index } from "drizzle-orm/pg-core";

// حساب مجهول (account-scoped data). code يُستخدم لربط أجهزة أخرى.
export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Document-per-key: مطابق لمفاتيح legacy (entries, photos, ...). لا PDF bytes هنا أبدًا.
export const documents = pgTable(
  "documents",
  {
    accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    data: jsonb("data").notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
    serverAt: bigint("server_at", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.key] }), index("documents_account_server_idx").on(t.accountId, t.serverAt)],
);

// سجل تدقيق لتنفيذ إجراءات الـAI المؤكدة من المستخدم
export const aiAuditLog = pgTable("ai_audit_log", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  mode: text("mode").notNull(),
  actionType: text("action_type").notNull(),
  payload: jsonb("payload").notNull(),
  result: text("result").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
