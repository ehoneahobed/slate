import Link from "next/link";
import { SharePageView } from "@/components/share/share-page-view";
import type { FollowingSheetPayload } from "@/lib/notebook/following-sheets";

type Props = {
  /** e.g. `/share/{rawToken}` — links use `/pages/{pageId}` under this path. */
  basePath: string;
  sheets: FollowingSheetPayload[];
  moreCount: number;
};

/**
 * Read-only stack of later pages (same global order as the editor’s “later in this notebook”),
 * so shared notebooks scroll continuously instead of stopping after one sheet.
 */
export function ShareNotebookContinuous({ basePath, sheets, moreCount }: Props) {
  if (sheets.length === 0 && moreCount === 0) return null;

  return (
    <div className="mt-12 space-y-12 border-t border-[var(--chrome-b)] pt-10">
      <div className="mx-auto max-w-[1180px]">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-3)]">Next in this notebook</p>
        <p className="mx-auto mt-1 max-w-lg text-center text-xs leading-relaxed text-[var(--ink-4)]">
          Keep scrolling for read-only pages in order after this one. Use the outline on the left to open any page directly.
        </p>
      </div>

      {sheets.map((s) => (
        <article key={s.pageId} className="space-y-3">
          {s.sectionBreak ? (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">{s.sectionTitle}</p>
          ) : null}
          <div>
            <Link
              href={`${basePath}/pages/${encodeURIComponent(s.pageId)}`}
              className="font-[family-name:var(--font-instrument-serif)] text-xl leading-tight text-[var(--ink)] underline-offset-4 hover:underline"
            >
              {s.title}
            </Link>
            <p className="mt-0.5 text-xs text-[var(--ink-3)]">Read-only</p>
          </div>
          <SharePageView
            backgroundType={s.backgroundType}
            strokes={s.strokes}
            blocks={s.blocks}
            pageSize={s.pageSize}
          />
        </article>
      ))}

      {moreCount > 0 ? (
        <p className="mx-auto max-w-[1180px] text-center text-sm text-[var(--ink-3)]">
          {moreCount} more {moreCount === 1 ? "page" : "pages"} in this notebook — pick a page in the outline to view it.
        </p>
      ) : null}
    </div>
  );
}
