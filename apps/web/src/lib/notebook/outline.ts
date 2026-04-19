import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { notebooks, pages, sections } from "@/lib/db/schema";

export type OutlinePage = { id: string; title: string; position: number };

export type OutlineSection = {
  id: string;
  title: string;
  position: number;
  pages: OutlinePage[];
};

/** Sections in notebook order (by `position`). */
export function sortedOutlineSections(outline: OutlineSection[]): OutlineSection[] {
  return [...outline].sort((a, b) => a.position - b.position);
}

/** First page id in global notebook order (section `position`, then page `position`). */
export function firstPageIdInNotebookOrder(outline: OutlineSection[]): string | null {
  for (const s of sortedOutlineSections(outline)) {
    const nav = [...s.pages].sort((a, b) => a.position - b.position);
    if (nav.length > 0) return nav[0]!.id;
  }
  return null;
}

/** Aggregate counts for share headers / sidebars. */
export function outlineNotebookStats(outline: OutlineSection[]): {
  sectionCount: number;
  pageCount: number;
  emptySectionCount: number;
} {
  let pageCount = 0;
  let emptySectionCount = 0;
  for (const s of outline) {
    if (s.pages.length === 0) emptySectionCount++;
    pageCount += s.pages.length;
  }
  return { sectionCount: outline.length, pageCount, emptySectionCount };
}

/** 1-based index of `pageId` in global notebook order, or null if not found. */
export function pageIndexInNotebookOrder(outline: OutlineSection[], pageId: string): number | null {
  let idx = 0;
  for (const sec of sortedOutlineSections(outline)) {
    const nav = [...sec.pages].sort((a, b) => a.position - b.position);
    for (const p of nav) {
      idx++;
      if (p.id === pageId) return idx;
    }
  }
  return null;
}

/**
 * Sections and pages for editor spine / TOC. Caller must enforce access (e.g. workspace owner).
 */
export async function loadNotebookOutline(
  notebookId: string,
): Promise<{ notebookTitle: string; outline: OutlineSection[] } | null> {
  const nb = await db.query.notebooks.findFirst({ where: eq(notebooks.id, notebookId) });
  if (!nb) return null;

  const secs = await db
    .select()
    .from(sections)
    .where(eq(sections.notebookId, notebookId))
    .orderBy(asc(sections.position));

  const sectionIds = secs.map((s) => s.id);
  const allPages =
    sectionIds.length === 0
      ? []
      : await db
          .select()
          .from(pages)
          .where(inArray(pages.sectionId, sectionIds))
          .orderBy(asc(pages.position));

  const outline: OutlineSection[] = secs.map((s) => ({
    id: s.id,
    title: s.title,
    position: s.position,
    /** Order within the section only (positions are per-section integers). */
    pages: allPages
      .filter((p) => p.sectionId === s.id)
      .sort((a, b) => a.position - b.position)
      .map((p) => ({ id: p.id, title: p.title, position: p.position })),
  }));

  return { notebookTitle: nb.title, outline };
}
