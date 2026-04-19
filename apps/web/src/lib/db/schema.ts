import { relations, sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

/** Better Auth — generated shape (see better-auth CLI); snake_case columns in Postgres */
export const user = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().default(""),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const session = pgTable(
  "session",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: "date" }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: "date" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

/** Per-user UI preferences (Phase 1 — themes). */
export const userSettings = pgTable("user_settings", {
  userId: text("userId")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** paper | clean | dark */
  theme: text("theme").notNull().default("paper"),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

/** Slate domain */
export const workspaces = pgTable("workspace", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  ownerUserId: text("ownerUserId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
});

export const notebooks = pgTable("notebook", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  workspaceId: text("workspaceId")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  color: text("color"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

/** Public share links (Phase 2 — read-only first). */
export const shareLinks = pgTable("share_link", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  notebookId: text("notebookId")
    .notNull()
    .references(() => notebooks.id, { onDelete: "cascade" }),
  /** sha256 hex of the raw token from the URL */
  tokenHash: text("tokenHash").notNull().unique(),
  /** read | read_annotate | live */
  mode: text("mode").notNull().default("read"),
  passcodeHash: text("passcodeHash"),
  expiresAt: timestamp("expiresAt", { mode: "date" }),
  revokedAt: timestamp("revokedAt", { mode: "date" }),
  createdByUserId: text("createdByUserId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
});

export const sections = pgTable("section", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  notebookId: text("notebookId")
    .notNull()
    .references(() => notebooks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  color: text("color"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
});

export const pages = pgTable("page", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  sectionId: text("sectionId")
    .notNull()
    .references(() => sections.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
  /** ruled | grid | plain | cornell */
  backgroundType: text("backgroundType").notNull().default("ruled"),
  /** 16_10 | a4 | letter | infinite — sheet proportions (prototype “Paper size”) */
  pageSize: text("pageSize").notNull().default("16_10"),
  /** Stroke payload: legacy JSON array or `{ coordSpace, strokes }` — see `lib/ink/types.ts` */
  strokesData: jsonb("strokesData")
    .$type<unknown>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  /** Block payload: legacy array or `{ coordSpace, blocks }` — see `lib/page-blocks/types.ts` */
  blocksData: jsonb("blocksData")
    .$type<unknown>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  workspaces: many(workspaces),
  settings: one(userSettings, { fields: [user.id], references: [userSettings.userId] }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(user, { fields: [workspaces.ownerUserId], references: [user.id] }),
  notebooks: many(notebooks),
}));

export const notebooksRelations = relations(notebooks, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [notebooks.workspaceId], references: [workspaces.id] }),
  sections: many(sections),
  shareLinks: many(shareLinks),
}));

export const shareLinksRelations = relations(shareLinks, ({ one }) => ({
  notebook: one(notebooks, { fields: [shareLinks.notebookId], references: [notebooks.id] }),
  createdBy: one(user, { fields: [shareLinks.createdByUserId], references: [user.id] }),
}));

export const sectionsRelations = relations(sections, ({ one, many }) => ({
  notebook: one(notebooks, { fields: [sections.notebookId], references: [notebooks.id] }),
  pages: many(pages),
}));

export const pagesRelations = relations(pages, ({ one }) => ({
  section: one(sections, { fields: [pages.sectionId], references: [sections.id] }),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(user, { fields: [userSettings.userId], references: [user.id] }),
}));
