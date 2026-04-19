import { and, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getSession } from "@/auth";
import { PageEditorClient } from "@/components/editor/page-editor-client";
import { getPageContextForOwner } from "@/lib/access/page";
import { db } from "@/lib/db";
import { shareLinks } from "@/lib/db/schema";
import { loadFollowingSheets } from "@/lib/notebook/following-sheets";
import { loadNotebookOutline } from "@/lib/notebook/outline";
import { getUserTheme } from "@/lib/user-settings";
import { normalizePageSize } from "@/lib/ink/page-size";
import { resolvePageSheetCoords } from "@/lib/page-sheet/coords";

export default async function NotebookPageEditor({
  params,
}: {
  params: Promise<{ notebookId: string; pageId: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const { notebookId, pageId } = await params;
  const ctx = await getPageContextForOwner(pageId, session.user.id);
  if (!ctx || ctx.notebook.id !== notebookId) notFound();

  const tree = await loadNotebookOutline(notebookId);
  if (!tree) notFound();

  const following = await loadFollowingSheets(notebookId, tree.outline, pageId, session.user.id);

  const activeShareLinks = await db
    .select({
      id: shareLinks.id,
      mode: shareLinks.mode,
      createdAt: shareLinks.createdAt,
    })
    .from(shareLinks)
    .where(and(eq(shareLinks.notebookId, notebookId), isNull(shareLinks.revokedAt)));

  const serverUiTheme = await getUserTheme(session.user.id);

  const { strokes, blocks, needsPersistWorldMigration } = resolvePageSheetCoords({
    strokesData: ctx.page.strokesData,
    blocksData: ctx.page.blocksData ?? [],
    pageSize: ctx.page.pageSize,
  });

  return (
    <PageEditorClient
      key={`${pageId}-${serverUiTheme}`}
      notebookId={notebookId}
      notebookTitle={tree.notebookTitle}
      outline={tree.outline}
      pageId={pageId}
      sectionId={ctx.section.id}
      initialTitle={ctx.page.title}
      initialBackground={ctx.page.backgroundType}
      initialStrokes={strokes}
      initialBlocks={blocks}
      initialPageSize={normalizePageSize(ctx.page.pageSize ?? undefined)}
      needsPersistWorldMigration={needsPersistWorldMigration}
      serverUiTheme={serverUiTheme}
      followingSheets={following.sheets}
      followingSheetsMoreCount={following.moreCount}
      activeShareLinks={activeShareLinks}
    />
  );
}
