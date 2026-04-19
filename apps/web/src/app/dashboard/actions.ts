"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession } from "@/auth";
import { db } from "@/lib/db";
import { notebooks, pages, sections, workspaces } from "@/lib/db/schema";

export async function ensureWorkspaceForUser() {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const found = await db.query.workspaces.findFirst({
    where: eq(workspaces.ownerUserId, session.user.id),
  });
  if (found) return found;

  const [created] = await db
    .insert(workspaces)
    .values({ ownerUserId: session.user.id, name: "Primary workspace" })
    .returning();
  return created ?? null;
}

export async function createStarterNotebook(): Promise<void> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const ws = await ensureWorkspaceForUser();
  if (!ws) throw new Error("Unauthorized");

  const notebookId = crypto.randomUUID();
  const sectionId = crypto.randomUUID();
  const pageId = crypto.randomUUID();

  await db.insert(notebooks).values({
    id: notebookId,
    workspaceId: ws.id,
    title: "Untitled notebook",
    color: "#b9722e",
  });

  await db.insert(sections).values({
    id: sectionId,
    notebookId,
    title: "Section 1",
    color: "#b9722e",
    position: 0,
  });

  await db.insert(pages).values({
    id: pageId,
    sectionId,
    title: "Page 1",
    position: 0,
    backgroundType: "ruled",
  });

  revalidatePath("/dashboard");
}
