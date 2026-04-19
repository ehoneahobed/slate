"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getSession } from "@/auth";
import { assertNotebookOwnedByUser } from "@/lib/access/page";
import { db } from "@/lib/db";
import { notebooks } from "@/lib/db/schema";

export async function updateNotebookTitleAction(notebookId: string, title: string) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!(await assertNotebookOwnedByUser(notebookId, session.user.id))) throw new Error("Forbidden");
  const t = title.trim().slice(0, 200);
  if (!t) return;
  await db
    .update(notebooks)
    .set({ title: t, updatedAt: new Date() })
    .where(eq(notebooks.id, notebookId));
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/notebooks/${notebookId}`);
}
