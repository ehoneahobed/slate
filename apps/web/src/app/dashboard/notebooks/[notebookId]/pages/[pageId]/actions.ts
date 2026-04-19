"use server";

import { revalidatePath } from "next/cache";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { getSession } from "@/auth";
import { assertNotebookOwnedByUser, getPageContextForOwner } from "@/lib/access/page";
import { parseStrokes, serializeStrokesPayload } from "@/lib/ink/types";
import { parsePageBlocksWorldArray, serializePageBlocksPayload } from "@/lib/page-blocks/types";
import { db } from "@/lib/db";
import { pages, sections } from "@/lib/db/schema";

const BG = new Set(["ruled", "grid", "plain", "cornell"]);
const PAGE_SIZE = new Set(["16_10", "a4", "letter", "infinite"]);

function revalidateNotebook(notebookId: string, pageId?: string) {
  revalidatePath(`/dashboard/notebooks/${notebookId}`, "layout");
  if (pageId) revalidatePath(`/dashboard/notebooks/${notebookId}/pages/${pageId}`);
}

function unwrapStrokesRows(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object" && Array.isArray((input as { strokes?: unknown }).strokes)) {
    return (input as { strokes: unknown[] }).strokes;
  }
  return [];
}

function unwrapBlocksRows(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object" && Array.isArray((input as { blocks?: unknown }).blocks)) {
    return (input as { blocks: unknown[] }).blocks;
  }
  return [];
}

export async function savePageStrokesAction(notebookId: string, pageId: string, strokes: unknown) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const ctx = await getPageContextForOwner(pageId, session.user.id);
  if (!ctx || ctx.notebook.id !== notebookId) throw new Error("Forbidden");
  const cleaned = parseStrokes(unwrapStrokesRows(strokes));
  await db
    .update(pages)
    .set({ strokesData: serializeStrokesPayload(cleaned), updatedAt: new Date() })
    .where(eq(pages.id, pageId));
  revalidateNotebook(notebookId, pageId);
}

export async function savePageBlocksAction(notebookId: string, pageId: string, blocks: unknown) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const ctx = await getPageContextForOwner(pageId, session.user.id);
  if (!ctx || ctx.notebook.id !== notebookId) throw new Error("Forbidden");
  const cleaned = parsePageBlocksWorldArray(unwrapBlocksRows(blocks));
  await db
    .update(pages)
    .set({ blocksData: serializePageBlocksPayload(cleaned), updatedAt: new Date() })
    .where(eq(pages.id, pageId));
  revalidateNotebook(notebookId, pageId);
}

export async function updatePageMetaAction(
  notebookId: string,
  pageId: string,
  input: { title?: string; backgroundType?: string; pageSize?: string },
) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const ctx = await getPageContextForOwner(pageId, session.user.id);
  if (!ctx || ctx.notebook.id !== notebookId) throw new Error("Forbidden");

  const patch: Partial<typeof pages.$inferInsert> = {};
  if (typeof input.title === "string") {
    const t = input.title.trim();
    if (t.length) patch.title = t.slice(0, 200);
  }
  if (typeof input.backgroundType === "string" && BG.has(input.backgroundType)) {
    patch.backgroundType = input.backgroundType;
  }
  if (typeof input.pageSize === "string" && PAGE_SIZE.has(input.pageSize)) {
    patch.pageSize = input.pageSize;
  }
  if (Object.keys(patch).length === 0) return;
  patch.updatedAt = new Date();
  await db.update(pages).set(patch).where(eq(pages.id, pageId));
  revalidateNotebook(notebookId, pageId);
}

export async function createSectionAction(notebookId: string): Promise<{ sectionId: string }> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!(await assertNotebookOwnedByUser(notebookId, session.user.id))) throw new Error("Forbidden");

  const [last] = await db
    .select()
    .from(sections)
    .where(eq(sections.notebookId, notebookId))
    .orderBy(desc(sections.position))
    .limit(1);
  const nextPos = last ? last.position + 1 : 0;
  const sectionId = crypto.randomUUID();

  await db.insert(sections).values({
    id: sectionId,
    notebookId,
    title: `Section ${nextPos + 1}`,
    color: "#b9722e",
    position: nextPos,
  });

  revalidateNotebook(notebookId);
  return { sectionId };
}

export async function updateSectionTitleAction(notebookId: string, sectionId: string, title: string) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!(await assertNotebookOwnedByUser(notebookId, session.user.id))) throw new Error("Forbidden");

  const t = title.trim().slice(0, 200);
  if (!t.length) throw new Error("Invalid title");

  const row = await db.query.sections.findFirst({
    where: and(eq(sections.id, sectionId), eq(sections.notebookId, notebookId)),
  });
  if (!row) throw new Error("Not found");

  await db.update(sections).set({ title: t }).where(eq(sections.id, sectionId));

  revalidateNotebook(notebookId);
}

export async function createPageAction(notebookId: string, sectionId: string): Promise<{ pageId: string }> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!(await assertNotebookOwnedByUser(notebookId, session.user.id))) throw new Error("Forbidden");

  const sec = await db.query.sections.findFirst({
    where: eq(sections.id, sectionId),
  });
  if (!sec || sec.notebookId !== notebookId) throw new Error("Forbidden");

  const [last] = await db
    .select()
    .from(pages)
    .where(eq(pages.sectionId, sectionId))
    .orderBy(desc(pages.position))
    .limit(1);
  const nextPos = last ? last.position + 1 : 0;
  const pageId = crypto.randomUUID();

  /** Default title uses notebook-wide ordinal so new sections are not all "Page 1". */
  const [{ c: pageCount }] = await db
    .select({ c: count() })
    .from(pages)
    .innerJoin(sections, eq(pages.sectionId, sections.id))
    .where(eq(sections.notebookId, notebookId));
  const nextOrdinal = Number(pageCount) + 1;

  await db.insert(pages).values({
    id: pageId,
    sectionId,
    title: `Page ${nextOrdinal}`,
    position: nextPos,
    backgroundType: "ruled",
  });

  revalidateNotebook(notebookId, pageId);
  return { pageId };
}

export async function deletePageAction(notebookId: string, pageId: string) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const ctx = await getPageContextForOwner(pageId, session.user.id);
  if (!ctx || ctx.notebook.id !== notebookId) throw new Error("Forbidden");

  const secs = await db.select({ id: sections.id }).from(sections).where(eq(sections.notebookId, notebookId));
  const sectionIds = secs.map((s) => s.id);
  if (!sectionIds.length) return;

  const [row] = await db
    .select({ c: count() })
    .from(pages)
    .where(inArray(pages.sectionId, sectionIds));
  if (Number(row.c) <= 1) return;

  await db.delete(pages).where(eq(pages.id, pageId));
  revalidateNotebook(notebookId);
}

export async function reorderPageAction(notebookId: string, pageId: string, direction: "up" | "down") {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const ctx = await getPageContextForOwner(pageId, session.user.id);
  if (!ctx || ctx.notebook.id !== notebookId) throw new Error("Forbidden");

  const siblings = await db
    .select()
    .from(pages)
    .where(eq(pages.sectionId, ctx.section.id))
    .orderBy(asc(pages.position));

  const idx = siblings.findIndex((p) => p.id === pageId);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= siblings.length) return;

  const a = siblings[idx];
  const b = siblings[swapIdx];
  const posA = a.position;
  const posB = b.position;

  await db.transaction(async (tx) => {
    await tx.update(pages).set({ position: posB, updatedAt: new Date() }).where(eq(pages.id, a.id));
    await tx.update(pages).set({ position: posA, updatedAt: new Date() }).where(eq(pages.id, b.id));
  });

  revalidateNotebook(notebookId, pageId);
}
