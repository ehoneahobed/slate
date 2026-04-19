import { notFound } from "next/navigation";
import { getSession } from "@/auth";
import { PageEditorClient } from "@/components/editor/page-editor-client";
import { getPageContextForOwner } from "@/lib/access/page";
import { loadNotebookOutline } from "@/lib/notebook/outline";
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

  const { strokes, blocks, needsPersistWorldMigration } = resolvePageSheetCoords({
    strokesData: ctx.page.strokesData,
    blocksData: ctx.page.blocksData ?? [],
    pageSize: ctx.page.pageSize,
  });

  return (
    <PageEditorClient
      key={pageId}
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
    />
  );
}
