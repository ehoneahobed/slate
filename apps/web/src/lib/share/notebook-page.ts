import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pages, sections } from "@/lib/db/schema";

export async function assertPageBelongsToNotebook(pageId: string, notebookId: string): Promise<boolean> {
  const page = await db.query.pages.findFirst({ where: eq(pages.id, pageId) });
  if (!page) return false;
  const section = await db.query.sections.findFirst({ where: eq(sections.id, page.sectionId) });
  return section?.notebookId === notebookId;
}
