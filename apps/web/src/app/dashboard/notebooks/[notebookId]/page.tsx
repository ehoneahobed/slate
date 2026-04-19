import Link from "next/link";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getSession } from "@/auth";
import { NotebookOverviewClient } from "@/components/dashboard/notebook-overview-client";
import { SharePanel } from "@/components/share/share-panel";
import { db } from "@/lib/db";
import { notebooks, pages, sections, shareLinks, workspaces } from "@/lib/db/schema";

async function loadNotebook(notebookId: string, userId: string) {
  const nb = await db.query.notebooks.findFirst({
    where: eq(notebooks.id, notebookId),
  });
  if (!nb) return null;

  const ws = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, nb.workspaceId),
  });
  if (!ws || ws.ownerUserId !== userId) return null;

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

  return { notebook: nb, sections: secs, pages: allPages };
}

export default async function NotebookPage({ params }: { params: Promise<{ notebookId: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const { notebookId } = await params;
  const data = await loadNotebook(notebookId, session.user.id);
  if (!data) notFound();

  const activeShareLinks = await db
    .select({
      id: shareLinks.id,
      mode: shareLinks.mode,
      createdAt: shareLinks.createdAt,
    })
    .from(shareLinks)
    .where(and(eq(shareLinks.notebookId, notebookId), isNull(shareLinks.revokedAt)));

  return (
    <main className="mx-auto max-w-3xl touch-pan-y space-y-10 px-1 pb-16 sm:px-0">
      <div className="text-sm text-[var(--ink-3)]">
        <Link className="rounded-md font-medium text-[var(--ink-2)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]" href="/dashboard">
          ← Dashboard
        </Link>
      </div>

      <NotebookOverviewClient
        notebookId={notebookId}
        initialTitle={data.notebook.title}
        notebookColor={data.notebook.color}
        sections={data.sections.map((s) => ({ id: s.id, title: s.title, position: s.position }))}
        pages={data.pages.map((p) => ({
          id: p.id,
          sectionId: p.sectionId,
          title: p.title,
          position: p.position,
          backgroundType: p.backgroundType,
        }))}
      />

      <SharePanel notebookId={notebookId} links={activeShareLinks} />
    </main>
  );
}
