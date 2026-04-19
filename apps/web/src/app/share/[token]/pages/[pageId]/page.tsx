import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ShareOutlineAside } from "@/components/share/share-outline-aside";
import { SharePageView } from "@/components/share/share-page-view";
import { db } from "@/lib/db";
import { pages } from "@/lib/db/schema";
import { normalizePageSize } from "@/lib/ink/page-size";
import { resolvePageSheetCoords } from "@/lib/page-sheet/coords";
import { loadNotebookOutline } from "@/lib/notebook/outline";
import { assertPageBelongsToNotebook } from "@/lib/share/notebook-page";
import { resolveActiveShareLink } from "@/lib/share/resolve";

export default async function SharedPageView({
  params,
}: {
  params: Promise<{ token: string; pageId: string }>;
}) {
  const { token: tokenParam, pageId } = await params;
  const rawToken = decodeURIComponent(tokenParam);
  const link = await resolveActiveShareLink(rawToken);
  if (!link) notFound();

  const ok = await assertPageBelongsToNotebook(pageId, link.notebookId);
  if (!ok) notFound();

  const page = await db.query.pages.findFirst({ where: eq(pages.id, pageId) });
  if (!page) notFound();

  const { strokes, blocks } = resolvePageSheetCoords({
    strokesData: page.strokesData,
    blocksData: page.blocksData ?? [],
    pageSize: page.pageSize,
  });
  const basePath = `/share/${encodeURIComponent(rawToken)}`;

  const tree = await loadNotebookOutline(link.notebookId);
  if (!tree) notFound();

  return (
    <main className="space-y-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(240px,0.3fr)_minmax(0,1fr)]">
        <ShareOutlineAside
          notebookTitle={tree.notebookTitle}
          outline={tree.outline}
          basePath={basePath}
          currentPageId={pageId}
        />
        <div className="min-w-0 space-y-4">
          <div>
            <h1 className="font-[family-name:var(--font-instrument-serif)] text-2xl leading-tight">{page.title}</h1>
            <p className="mt-1 text-xs text-[var(--ink-3)]">Read-only</p>
          </div>
          <SharePageView
            backgroundType={page.backgroundType}
            strokes={strokes}
            blocks={blocks}
            pageSize={normalizePageSize(page.pageSize ?? undefined)}
          />
        </div>
      </div>
    </main>
  );
}
