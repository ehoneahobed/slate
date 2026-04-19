"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession } from "@/auth";
import { assertNotebookOwnedByUser } from "@/lib/access/page";
import { db } from "@/lib/db";
import { shareLinks } from "@/lib/db/schema";
import { generateShareToken, hashShareToken } from "@/lib/share/token";
import { getShareBaseUrl } from "@/lib/share/url";

export async function createShareLinkAction(notebookId: string): Promise<{ url: string }> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!(await assertNotebookOwnedByUser(notebookId, session.user.id))) throw new Error("Forbidden");

  const raw = generateShareToken();
  const tokenHash = hashShareToken(raw);

  await db.insert(shareLinks).values({
    notebookId,
    tokenHash,
    mode: "read",
    createdByUserId: session.user.id,
  });

  revalidatePath(`/dashboard/notebooks/${notebookId}`, "layout");
  const base = getShareBaseUrl();
  return { url: `${base}/share/${encodeURIComponent(raw)}` };
}

export async function revokeShareLinkAction(notebookId: string, linkId: string) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!(await assertNotebookOwnedByUser(notebookId, session.user.id))) throw new Error("Forbidden");

  await db
    .update(shareLinks)
    .set({ revokedAt: new Date() })
    .where(and(eq(shareLinks.id, linkId), eq(shareLinks.notebookId, notebookId), isNull(shareLinks.revokedAt)));

  revalidatePath(`/dashboard/notebooks/${notebookId}`, "layout");
}
