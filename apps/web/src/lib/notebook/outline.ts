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
    pages: allPages
      .filter((p) => p.sectionId === s.id)
      .map((p) => ({ id: p.id, title: p.title, position: p.position })),
  }));

  return { notebookTitle: nb.title, outline };
}
