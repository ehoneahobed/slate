import Link from "next/link";
import type { OutlineSection } from "@/lib/notebook/outline";
import { sortedOutlineSections } from "@/lib/notebook/outline";

export type ShareOutlineStats = {
  sectionCount: number;
  pageCount: number;
  emptySectionCount: number;
};

type Props = {
  notebookTitle: string;
  outline: OutlineSection[];
  basePath: string;
  /** Page id to highlight in the list; omit or empty string when none (e.g. empty notebook). */
  currentPageId?: string | null;
  stats: ShareOutlineStats;
  /** 1-based position of the open page in notebook order; omit when unknown. */
  currentPageIndex?: number | null;
};

/** Full-viewport outline rail for public share — fixed to the left on large screens. */
export function ShareOutlineAside({
  notebookTitle,
  outline,
  basePath,
  currentPageId = null,
  stats,
  currentPageIndex = null,
}: Props) {
  const title = notebookTitle.trim() || "Notebook";
  const activeId = currentPageId?.trim() || null;
  const sections = sortedOutlineSections(outline);

  return (
    <aside
      aria-label="Notebook outline"
      className={
        "flex w-full shrink-0 flex-col border-[var(--rule)] bg-[var(--paper)] " +
        "max-h-[min(42vh,22rem)] border-b shadow-[0_1px_0_color-mix(in_oklch,var(--ink)_4%,transparent)] " +
        "lg:fixed lg:left-0 lg:top-0 lg:z-20 lg:h-dvh lg:max-h-none lg:w-72 lg:min-w-[260px] lg:max-w-[288px] " +
        "lg:border-b-0 lg:border-r lg:shadow-[4px_0_24px_-8px_color-mix(in_oklch,var(--ink)_12%,transparent)]"
      }
    >
      <div className="shrink-0 border-b border-[var(--chrome-b)] px-4 pb-4 pt-4 lg:px-5 lg:pt-5">
        <Link
          href="/"
          className="inline-flex items-baseline gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--ink-3)] transition-colors hover:text-[var(--ink)]"
        >
          <span className="font-[family-name:var(--font-instrument-serif)] normal-case tracking-normal text-base text-[var(--ink)]">Slate</span>
          <span className="text-[var(--ink-4)]">·</span>
          <span>Share</span>
        </Link>
        <Link
          href={basePath}
          className="mt-3 block truncate text-sm font-semibold leading-snug text-[var(--ink)] hover:underline"
          title={title}
        >
          {title}
        </Link>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--ink-3)]">
          {stats.sectionCount} {stats.sectionCount === 1 ? "section" : "sections"}
          <span className="mx-1 text-[var(--ink-4)]">·</span>
          {stats.pageCount} {stats.pageCount === 1 ? "page" : "pages"}
          {currentPageIndex != null && stats.pageCount > 0 ? (
            <>
              <span className="mx-1 text-[var(--ink-4)]">·</span>
              <span className="tabular-nums">
                Viewing {currentPageIndex}/{stats.pageCount}
              </span>
            </>
          ) : null}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 lg:px-4">
        <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-3)]">Contents</p>
        <div className="space-y-4">
          {sections.map((sec) => {
            const nav = [...sec.pages].sort((a, b) => a.position - b.position);
            return (
              <div key={sec.id} className="rounded-xl border border-[color-mix(in_oklch,var(--chrome-b)_85%,transparent)] bg-[color-mix(in_oklch,var(--paper)_70%,var(--paper-2))] p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                  <span className="line-clamp-2" title={sec.title}>
                    {sec.title}
                  </span>
                </div>
                {nav.length === 0 ? (
                  <p className="mt-2 pl-0.5 text-xs text-[var(--ink-4)]">No pages in this section.</p>
                ) : (
                  <ul className="mt-2 space-y-0.5">
                    {nav.map((p) => {
                      const active = activeId != null && p.id === activeId;
                      return (
                        <li key={p.id}>
                          <Link
                            className={`block truncate rounded-lg px-2.5 py-1.5 text-[13px] leading-snug transition-colors ${
                              active
                                ? "bg-[var(--accent-soft)] font-semibold text-[var(--ink)] ring-1 ring-[color-mix(in_oklch,var(--accent)_35%,transparent)]"
                                : "text-[var(--ink-2)] hover:bg-[color-mix(in_oklch,var(--paper)_50%,var(--paper-2))] hover:text-[var(--ink)]"
                            }`}
                            href={`${basePath}/pages/${p.id}`}
                          >
                            {p.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 border-t border-[var(--chrome-b)] bg-[color-mix(in_oklch,var(--paper-2)_55%,var(--paper))] px-4 py-3.5 lg:px-5">
        <Link href="/" className="group block rounded-lg p-1 -m-1 transition-colors hover:bg-[color-mix(in_oklch,var(--paper)_88%,transparent)]">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ink-3)] group-hover:text-[var(--ink-2)]">Made with</span>
          <span className="mt-0.5 block font-[family-name:var(--font-instrument-serif)] text-xl leading-tight text-[var(--ink)] group-hover:underline">
            Slate
          </span>
          <span className="mt-1 block text-[11px] leading-snug text-[var(--ink-3)] group-hover:text-[var(--ink-2)]">
            Notes, whiteboard & teaching — try Slate free
          </span>
        </Link>
      </div>
    </aside>
  );
}
