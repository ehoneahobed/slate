import Link from "next/link";

export type DashboardLibraryNotebook = {
  id: string;
  title: string;
  color: string | null;
  updatedAt: Date;
  sectionCount: number;
  pageCount: number;
};

function isAccentHex(c: string | null | undefined): c is string {
  return Boolean(c && /^#[0-9a-f]{6}$/i.test(c));
}

function formatUpdated(d: Date): string {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 36) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function DashboardLibrary({ notebooks }: { notebooks: DashboardLibraryNotebook[] }) {
  if (notebooks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--chrome-b)] bg-[color-mix(in_oklch,var(--paper)_88%,transparent)] px-8 py-16 text-center shadow-[var(--shadow-1)]">
        <div className="mx-auto max-w-md">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--paper-2)] text-[var(--ink-2)] shadow-[inset_0_0_0_1px_var(--chrome-b)]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M7 3h10a2 2 0 012 2v14l-4-2-4 2-4-2-4 2V5a2 2 0 012-2z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path d="M9 8h6M9 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="font-[family-name:var(--font-instrument-serif)] text-2xl text-[var(--ink)]">Start your first notebook</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ink-2)]">
            Notebooks hold <span className="font-medium text-[var(--ink)]">sections</span>, and each section holds{" "}
            <span className="font-medium text-[var(--ink)]">pages</span> for ink, text blocks, and shapes—organized like a
            real binder. Open a notebook to see its table of contents.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {notebooks.map((nb) => {
        const accent = isAccentHex(nb.color) ? nb.color : "var(--accent)";
        const nSec = nb.sectionCount;
        const nPg = nb.pageCount;
        return (
          <li key={nb.id} className="min-h-[168px]">
            <Link
              href={`/dashboard/notebooks/${nb.id}`}
              className="flex h-full min-h-[168px] flex-col overflow-hidden rounded-2xl border border-[var(--rule)] bg-[var(--paper)] shadow-[var(--shadow-1)] outline-none ring-[var(--accent)] transition-shadow hover:shadow-[var(--shadow-2)] focus-visible:ring-2"
              style={{ borderLeftWidth: 4, borderLeftStyle: "solid", borderLeftColor: accent }}
            >
              <span className="flex flex-1 flex-col px-5 pb-5 pt-5">
                <span className="font-[family-name:var(--font-instrument-serif)] text-xl leading-snug text-[var(--ink)] sm:text-2xl">
                  {nb.title}
                </span>
                <span className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium uppercase tracking-wide text-[var(--ink-3)]">
                  <span>
                    {nSec} {nSec === 1 ? "section" : "sections"}
                  </span>
                  <span>
                    {nPg} {nPg === 1 ? "page" : "pages"}
                  </span>
                  <span className="text-[var(--ink-4)]">Updated {formatUpdated(nb.updatedAt)}</span>
                </span>
                <span className="mt-auto flex items-center justify-between border-t border-[var(--chrome-b)] pt-4 text-sm font-semibold text-[var(--ink-2)]">
                  <span>Open notebook</span>
                  <span aria-hidden className="text-[var(--ink-4)]">
                    →
                  </span>
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
