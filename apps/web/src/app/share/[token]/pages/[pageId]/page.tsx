import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareNotebookContinuous } from "@/components/share/share-notebook-continuous";
import { ShareOutlineAside } from "@/components/share/share-outline-aside";
import { SharePageView } from "@/components/share/share-page-view";
import { db } from "@/lib/db";
import { pages } from "@/lib/db/schema";
import { normalizePageSize } from "@/lib/ink/page-size";
import { resolvePageSheetCoords } from "@/lib/page-sheet/coords";
import { loadFollowingSheetsForShare } from "@/lib/notebook/following-sheets";
import { loadNotebookOutline, outlineNotebookStats, pageIndexInNotebookOrder } from "@/lib/notebook/outline";
import { assertPageBelongsToNotebook } from "@/lib/share/notebook-page";
import { resolveActiveShareLink } from "@/lib/share/resolve";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string; pageId: string }>;
}): Promise<Metadata> {
  const { token: tokenParam, pageId } = await params;
  const rawToken = decodeURIComponent(tokenParam);
  const link = await resolveActiveShareLink(rawToken);
  if (!link) {
    return { title: "Shared notebook", robots: { index: false, follow: false } };
  }
  const ok = await assertPageBelongsToNotebook(pageId, link.notebookId);
  if (!ok) {
    return { title: "Shared notebook", robots: { index: false, follow: false } };
  }
  const tree = await loadNotebookOutline(link.notebookId);
  if (!tree) {
    return { title: "Shared notebook", robots: { index: false, follow: false } };
  }
  let pageTitle: string | null = null;
  for (const section of tree.outline) {
    const p = section.pages.find((x) => x.id === pageId);
    if (p) {
      pageTitle = p.title;
      break;
    }
  }
  const base = pageTitle ? `${pageTitle} · ${tree.notebookTitle}` : tree.notebookTitle;
  return {
    title: `${base} (read-only)`,
    robots: { index: false, follow: false },
  };
}

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

  const following = await loadFollowingSheetsForShare(link.notebookId, tree.outline, pageId);
  const stats = outlineNotebookStats(tree.outline);
  const pageOrderIndex = pageIndexInNotebookOrder(tree.outline, pageId);

  return (
    <main className="flex min-h-dvh w-full flex-col bg-[var(--paper-2)] lg:flex-row">
      <ShareOutlineAside
        notebookTitle={tree.notebookTitle}
        outline={tree.outline}
        basePath={basePath}
        currentPageId={pageId}
        stats={stats}
        currentPageIndex={pageOrderIndex}
      />
      <div className="relative min-w-0 flex-1 lg:pl-72">
        <header className="border-b border-[var(--chrome-b)] bg-[color-mix(in_oklch,var(--paper)_82%,var(--paper-2))] px-5 py-8 lg:px-12 lg:py-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--ink-3)]">Shared notebook</p>
          <h1 className="mt-2 max-w-3xl font-[family-name:var(--font-instrument-serif)] text-3xl leading-[1.08] text-[var(--ink)] sm:text-4xl">
            {tree.notebookTitle.trim() || "Notebook"}
          </h1>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[var(--ink-2)]">
            <span>
              {stats.sectionCount} {stats.sectionCount === 1 ? "section" : "sections"}
            </span>
            <span aria-hidden className="text-[var(--ink-4)]">
              ·
            </span>
            <span>
              {stats.pageCount} {stats.pageCount === 1 ? "page" : "pages"}
            </span>
            {pageOrderIndex != null ? (
              <>
                <span aria-hidden className="text-[var(--ink-4)]">
                  ·
                </span>
                <span className="tabular-nums text-[var(--ink)]">
                  This sheet is page {pageOrderIndex} of {stats.pageCount}
                </span>
              </>
            ) : null}
          </div>
          {stats.emptySectionCount > 0 ? (
            <p className="mt-2 text-xs text-[var(--ink-3)]">
              Includes {stats.emptySectionCount} empty {stats.emptySectionCount === 1 ? "section" : "sections"} (no pages yet).
            </p>
          ) : null}
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-[var(--ink-3)]">
            You are viewing a read-only share. Ink, blocks, and layout are preserved; editing is disabled. Use the outline on the left to jump to any
            page.
          </p>
        </header>

        <div className="mx-auto max-w-[min(1180px,100%)] space-y-6 px-5 py-8 lg:px-10 lg:py-10">
          <div>
            <h2 className="font-[family-name:var(--font-instrument-serif)] text-2xl leading-tight text-[var(--ink)]">{page.title}</h2>
            <p className="mt-1 text-xs font-medium text-[var(--ink-3)]">Read-only · current page</p>
          </div>
          <SharePageView
            backgroundType={page.backgroundType}
            strokes={strokes}
            blocks={blocks}
            pageSize={normalizePageSize(page.pageSize ?? undefined)}
          />
          <ShareNotebookContinuous basePath={basePath} sheets={following.sheets} moreCount={following.moreCount} />
        </div>
      </div>
    </main>
  );
}
