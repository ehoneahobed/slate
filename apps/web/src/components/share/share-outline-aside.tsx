import Link from "next/link";
import type { OutlineSection } from "@/lib/notebook/outline";

type Props = {
  notebookTitle: string;
  outline: OutlineSection[];
  basePath: string;
  currentPageId: string;
};

/** Read-only section → page navigation for published share views. */
export function ShareOutlineAside({ notebookTitle, outline, basePath, currentPageId }: Props) {
  const title = notebookTitle.trim() || "Notebook";

  return (
    <aside className="flex max-h-56 flex-col gap-2 rounded-[var(--r-lg)] border border-[var(--rule)] bg-[var(--paper)] p-3 text-sm lg:max-h-[calc(100vh-8rem)]">
      <Link className="truncate text-xs font-medium text-[var(--ink-2)] hover:underline" href={basePath} title={title}>
        ← {title}
      </Link>
      <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Sections & pages</div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {outline.map((sec) => {
          const nav = [...sec.pages].sort((a, b) => a.position - b.position);
          return (
            <div key={sec.id} className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                <span className="line-clamp-2" title={sec.title}>
                  {sec.title}
                </span>
              </div>
              {nav.length === 0 ? (
                <p className="pl-1 text-xs text-[var(--ink-4)]">No pages.</p>
              ) : (
                <ul className="space-y-0.5 border-l border-[var(--chrome-b)] pl-2">
                  {nav.map((p) => (
                    <li key={p.id}>
                      <Link
                        className={`block truncate rounded-md px-2 py-1 text-[13px] hover:bg-[var(--paper-2)] ${
                          p.id === currentPageId ? "bg-[var(--accent-soft)] font-semibold text-[var(--ink)]" : "text-[var(--ink-2)]"
                        }`}
                        href={`${basePath}/pages/${p.id}`}
                      >
                        {p.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
