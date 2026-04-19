import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ShareOutlineAside } from "@/components/share/share-outline-aside";
import { firstPageIdInNotebookOrder, loadNotebookOutline, outlineNotebookStats } from "@/lib/notebook/outline";
import { resolveActiveShareLink } from "@/lib/share/resolve";

export default async function SharedNotebookTocPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: tokenParam } = await params;
  const rawToken = decodeURIComponent(tokenParam);
  const link = await resolveActiveShareLink(rawToken);
  if (!link) notFound();

  const tree = await loadNotebookOutline(link.notebookId);
  if (!tree) notFound();

  const basePath = `/share/${encodeURIComponent(rawToken)}`;
  const firstId = firstPageIdInNotebookOrder(tree.outline);
  if (firstId) {
    redirect(`${basePath}/pages/${firstId}`);
  }

  const stats = outlineNotebookStats(tree.outline);

  return (
    <main className="flex min-h-dvh w-full flex-col bg-[var(--paper-2)] lg:flex-row">
      <ShareOutlineAside
        notebookTitle={tree.notebookTitle}
        outline={tree.outline}
        basePath={basePath}
        currentPageId={null}
        stats={stats}
      />
      <div className="relative min-w-0 flex-1 lg:pl-72">
        <header className="border-b border-[var(--chrome-b)] bg-[color-mix(in_oklch,var(--paper)_82%,var(--paper-2))] px-5 py-8 lg:px-12 lg:py-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--ink-3)]">Shared notebook</p>
          <h1 className="mt-2 max-w-3xl font-[family-name:var(--font-instrument-serif)] text-3xl leading-[1.08] text-[var(--ink)] sm:text-4xl">
            {tree.notebookTitle.trim() || "Notebook"}
          </h1>
          <p className="mt-4 text-sm text-[var(--ink-2)]">
            {stats.sectionCount} {stats.sectionCount === 1 ? "section" : "sections"} · {stats.pageCount}{" "}
            {stats.pageCount === 1 ? "page" : "pages"}
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--ink-3)]">
            This notebook does not have any pages yet. Ask the owner to add a page, or check back later.
          </p>
        </header>
        <div className="mx-auto max-w-[min(1180px,100%)] px-5 py-10 lg:px-10">
          <p className="text-sm text-[var(--ink-2)]">
            Need an empty section removed?{" "}
            <Link className="font-semibold text-[var(--ink)] underline-offset-2 hover:underline" href="/">
              Open Slate
            </Link>{" "}
            to edit your own notebooks.
          </p>
        </div>
      </div>
    </main>
  );
}
