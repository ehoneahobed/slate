import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notebooks, pages, sections, workspaces } from "@/lib/db/schema";

export type PageOwnerContext = {
  page: typeof pages.$inferSelect;
  section: typeof sections.$inferSelect;
  notebook: typeof notebooks.$inferSelect;
};

/**
 * Returns page + ancestors only if the notebook lives in a workspace owned by `userId`.
 */
export async function getPageContextForOwner(
  pageId: string,
  userId: string,
): Promise<PageOwnerContext | null> {
  const page = await db.query.pages.findFirst({ where: eq(pages.id, pageId) });
  if (!page) return null;

  const section = await db.query.sections.findFirst({ where: eq(sections.id, page.sectionId) });
  if (!section) return null;

  const notebook = await db.query.notebooks.findFirst({ where: eq(notebooks.id, section.notebookId) });
  if (!notebook) return null;

  const workspace = await db.query.workspaces.findFirst({ where: eq(workspaces.id, notebook.workspaceId) });
  if (!workspace || workspace.ownerUserId !== userId) return null;

  return { page, section, notebook };
}

export async function assertNotebookOwnedByUser(notebookId: string, userId: string): Promise<boolean> {
  const notebook = await db.query.notebooks.findFirst({ where: eq(notebooks.id, notebookId) });
  if (!notebook) return false;
  const workspace = await db.query.workspaces.findFirst({ where: eq(workspaces.id, notebook.workspaceId) });
  return Boolean(workspace && workspace.ownerUserId === userId);
}
