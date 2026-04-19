"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { updateNotebookTitleAction } from "@/app/dashboard/notebooks/[notebookId]/actions";
import {
  createPageAction,
  createSectionAction,
  deletePageAction,
  updateSectionTitleAction,
} from "@/app/dashboard/notebooks/[notebookId]/pages/[pageId]/actions";

export type NotebookOverviewSection = { id: string; title: string; position: number };
export type NotebookOverviewPage = {
  id: string;
  sectionId: string;
  title: string;
  position: number;
  backgroundType: string;
};

type Props = {
  notebookId: string;
  initialTitle: string;
  notebookColor?: string | null;
  sections: NotebookOverviewSection[];
  pages: NotebookOverviewPage[];
};

const BG_LABEL: Record<string, string> = {
  ruled: "Ruled",
  grid: "Grid",
  plain: "Plain",
  cornell: "Cornell",
};

function bgLabel(bg: string): string {
  return BG_LABEL[bg] ?? bg;
}

function SectionTitleField({
  notebookId,
  sectionId,
  title,
  onSaved,
}: {
  notebookId: string;
  sectionId: string;
  title: string;
  onSaved: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <input
      key={`${sectionId}-${title}`}
      defaultValue={title}
      disabled={pending}
      onBlur={(e) => {
        const v = e.currentTarget.value.trim();
        if (!v || v === title) {
          e.currentTarget.value = title;
          return;
        }
        start(async () => {
          await updateSectionTitleAction(notebookId, sectionId, v);
          onSaved();
        });
      }}
      maxLength={200}
      className="mt-1 block w-full max-w-md rounded-lg border border-transparent bg-transparent px-0 py-1 text-lg font-semibold text-[var(--ink)] outline-none hover:border-[var(--chrome-b)] focus:border-[var(--ink)] disabled:opacity-60"
      aria-label="Section title"
    />
  );
}

export function NotebookOverviewClient({
  notebookId,
  initialTitle,
  notebookColor,
  sections,
  pages,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const outlineScrollRef = useRef<HTMLDivElement | null>(null);
  const outlineDragRef = useRef<{ pointerId: number; lastY: number } | null>(null);
  const [pageDeleteArmId, setPageDeleteArmId] = useState<string | null>(null);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (titleEditing) titleInputRef.current?.focus({ preventScroll: true });
  }, [titleEditing]);

  useEffect(() => {
    if (pageDeleteArmId == null) return;
    const t = window.setTimeout(() => setPageDeleteArmId(null), 10_000);
    return () => window.clearTimeout(t);
  }, [pageDeleteArmId]);

  const commitTitle = useCallback(() => {
    const next = titleDraft.trim();
    setTitleEditing(false);
    if (!next || next === initialTitle.trim()) {
      return;
    }
    start(async () => {
      await updateNotebookTitleAction(notebookId, next);
      router.refresh();
    });
  }, [titleDraft, initialTitle, notebookId, router]);

  const sortedSections = [...sections].sort((a, b) => a.position - b.position);

  const pagesForSection = useCallback(
    (sectionId: string) =>
      pages
        .filter((p) => p.sectionId === sectionId)
        .sort((a, b) => a.position - b.position),
    [pages],
  );

  const accent = notebookColor && /^#[0-9a-f]{6}$/i.test(notebookColor) ? notebookColor : "var(--accent)";
  const canDeleteAnyPage = pages.length > 1;

  return (
    <div className="space-y-8">
      <header className="border-b border-[var(--chrome-b)] pb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            {titleEditing ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  ref={titleInputRef}
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitTitle();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setTitleEditing(false);
                    }
                  }}
                  maxLength={200}
                  className="w-full max-w-2xl rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] px-3 py-2 font-[family-name:var(--font-instrument-serif)] text-3xl leading-tight text-[var(--ink)] shadow-[var(--shadow-1)] outline-none focus:border-[var(--ink)] sm:text-4xl"
                  aria-label="Notebook title"
                />
                <span className="text-xs text-[var(--ink-3)]">Enter to save · Esc to cancel</span>
              </div>
            ) : (
              <div className="group flex flex-wrap items-baseline gap-3">
                <h1 className="font-[family-name:var(--font-instrument-serif)] text-3xl leading-tight text-[var(--ink)] sm:text-4xl">
                  {initialTitle}
                </h1>
                <button
                  type="button"
                  onClick={() => {
                    setTitleDraft(initialTitle);
                    setTitleEditing(true);
                  }}
                  className="shrink-0 rounded-md border border-[var(--chrome-b)] bg-[var(--paper-2)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-2)] hover:bg-[var(--chrome-2)] sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                >
                  Rename
                </button>
              </div>
            )}
            <p className="mt-3 text-sm text-[var(--ink-3)]">
              Tip: open any page to write and draw. Rename this notebook anytime.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-4)]">Notebook ID</span>
          <code className="max-w-full truncate rounded-md bg-[var(--paper-2)] px-2 py-1 font-mono text-[11px] text-[var(--ink-2)]">
            {notebookId}
          </code>
          <button
            type="button"
            className="rounded-md border border-[var(--chrome-b)] px-2 py-1 text-[11px] font-semibold text-[var(--ink-2)] hover:bg-[var(--paper-2)]"
            onClick={() => void navigator.clipboard.writeText(notebookId).then(() => undefined)}
          >
            Copy
          </button>
        </div>
      </header>

      <section
        className="overflow-x-hidden rounded-2xl border border-[var(--rule)] bg-[var(--paper)] shadow-[var(--shadow-1)]"
        aria-labelledby="outline-heading"
      >
        <div
          className="flex flex-col gap-1 border-b border-[var(--chrome-b)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderLeftWidth: 4, borderLeftStyle: "solid", borderLeftColor: accent }}
        >
          <div>
            <h2 id="outline-heading" className="text-sm font-bold uppercase tracking-wide text-[var(--ink-3)]">
              Outline
            </h2>
            <p className="mt-0.5 text-xs text-[var(--ink-3)]">Sections group your pages. Add pages inside a section.</p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await createSectionAction(notebookId);
                router.refresh();
              })
            }
            className="shrink-0 rounded-lg border border-[var(--chrome-b)] bg-[var(--paper-2)] px-3 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--chrome-2)] disabled:opacity-50"
          >
            + New section
          </button>
        </div>

        <div className="flex max-h-[min(72dvh,820px)] min-h-0">
          <div
            className="hidden w-7 shrink-0 select-none touch-none sm:flex sm:flex-col sm:items-center sm:border-r sm:border-[var(--chrome-b)] sm:bg-[var(--paper-2)] sm:py-3"
            aria-label="Drag up or down to scroll the outline"
            title="Drag to scroll (stylus / pen friendly)"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
              outlineDragRef.current = { pointerId: e.pointerId, lastY: e.clientY };
            }}
            onPointerMove={(e) => {
              const d = outlineDragRef.current;
              const el = outlineScrollRef.current;
              if (!d || !el || d.pointerId !== e.pointerId) return;
              const dy = e.clientY - d.lastY;
              d.lastY = e.clientY;
              el.scrollTop -= dy;
            }}
            onPointerUp={(e) => {
              const d = outlineDragRef.current;
              if (!d || d.pointerId !== e.pointerId) return;
              try {
                (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
              } catch {
                /* ignore */
              }
              outlineDragRef.current = null;
            }}
            onPointerCancel={(e) => {
              const d = outlineDragRef.current;
              if (!d || d.pointerId !== e.pointerId) return;
              try {
                (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
              } catch {
                /* ignore */
              }
              outlineDragRef.current = null;
            }}
          >
            <span className="px-0.5 text-center text-[8px] font-bold uppercase leading-tight tracking-wide text-[var(--ink-4)] [writing-mode:vertical-rl]">
              Scroll
            </span>
          </div>
          <div
            ref={outlineScrollRef}
            className="min-h-0 min-w-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
          >
            <div className="divide-y divide-[var(--chrome-b)]">
          {sortedSections.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[var(--ink-3)]">No sections yet. Create one to get started.</p>
          ) : (
            sortedSections.map((sec) => {
              const secPages = pagesForSection(sec.id);
              return (
                <div key={sec.id} className="px-5 py-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <label className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-4)]">
                        Section title
                      </label>
                      <SectionTitleField
                        notebookId={notebookId}
                        sectionId={sec.id}
                        title={sec.title}
                        onSaved={() => router.refresh()}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const { pageId } = await createPageAction(notebookId, sec.id);
                          router.push(`/dashboard/notebooks/${notebookId}/pages/${pageId}`);
                        })
                      }
                      className="shrink-0 rounded-lg bg-[var(--ink)] px-3 py-2 text-xs font-semibold text-[var(--paper)] hover:opacity-95 disabled:opacity-50"
                    >
                      + Page in section
                    </button>
                  </div>

                  {secPages.length === 0 ? (
                    <p className="mt-4 rounded-lg border border-dashed border-[var(--chrome-b)] bg-[var(--paper-2)]/80 px-3 py-4 text-center text-sm text-[var(--ink-3)]">
                      No pages in this section yet.
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-1.5">
                      {secPages.map((p) => (
                        <li key={p.id} className="flex items-stretch gap-2">
                          <Link
                            href={`/dashboard/notebooks/${notebookId}/pages/${p.id}`}
                            className="group flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-[var(--chrome-b)] hover:bg-[var(--paper-2)]"
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span
                                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--paper-2)] text-[var(--ink-2)] shadow-[inset_0_0_0_1px_var(--chrome-b)] group-hover:bg-[var(--paper)]"
                                aria-hidden
                              >
                                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                                  <path
                                    d="M6 3h8v14H6V3z"
                                    stroke="currentColor"
                                    strokeWidth="1.3"
                                    strokeLinejoin="round"
                                  />
                                  <path d="M8 7h4M8 10h4M8 13h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                                </svg>
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-[var(--ink)] group-hover:underline">
                                  {p.title}
                                </span>
                                <span className="text-xs text-[var(--ink-3)]">{bgLabel(p.backgroundType)} paper</span>
                              </span>
                            </span>
                            <span className="shrink-0 text-xs font-semibold text-[var(--ink-4)] group-hover:text-[var(--ink-2)]">
                              Open →
                            </span>
                          </Link>
                          <button
                            type="button"
                            title={
                              !canDeleteAnyPage
                                ? "Cannot delete the only page in this notebook"
                                : pageDeleteArmId === p.id
                                  ? "Click again to delete"
                                  : "Delete page"
                            }
                            disabled={pending || !canDeleteAnyPage}
                            aria-label={pageDeleteArmId === p.id ? "Confirm delete page" : "Delete page"}
                            className={`grid w-10 shrink-0 place-items-center self-center rounded-xl border text-[var(--ink-3)] transition-colors hover:bg-[var(--paper-2)] hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-40 ${
                              pageDeleteArmId === p.id
                                ? "border-[color-mix(in_oklch,var(--danger)_45%,transparent)] bg-[color-mix(in_oklch,var(--danger)_10%,var(--paper))] text-[var(--danger)]"
                                : "border-transparent"
                            }`}
                            onClick={() => {
                              if (!canDeleteAnyPage) return;
                              if (pageDeleteArmId !== p.id) {
                                setPageDeleteArmId(p.id);
                                return;
                              }
                              setPageDeleteArmId(null);
                              start(async () => {
                                await deletePageAction(notebookId, p.id);
                                router.refresh();
                              });
                            }}
                          >
                            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
                              <path d="M5 6.5h10" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
                              <path
                                d="M8 6.5V5h4v1.5"
                                stroke="currentColor"
                                strokeWidth="1.25"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path d="M6.5 8.5l1 7h5l1-7" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
