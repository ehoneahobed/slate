"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { extractYoutubeVideoId, type PageRoughShapeKind } from "@/lib/page-blocks/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onAddText: () => void;
  onAddYoutube: (videoId: string) => void;
  onAddImage: (src: string) => void;
  onAddRoughShape: (kind: PageRoughShapeKind) => void;
};

function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[100] grid place-items-center bg-[color-mix(in_oklch,var(--ink)_32%,transparent)] p-6 backdrop-blur-[4px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="insert-modal-title"
        className="max-h-[88vh] w-full max-w-[720px] overflow-auto rounded-2xl border border-[var(--chrome-b)] bg-[var(--paper)] shadow-[var(--shadow-3)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-[var(--chrome-b)] px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="insert-modal-title" className="font-[family-name:var(--font-instrument-serif)] text-2xl leading-tight text-[var(--ink)]">
              {title}
            </h2>
            {subtitle ? <p className="mt-1 text-[12.5px] text-[var(--ink-3)]">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border-0 bg-transparent text-[var(--ink-2)] hover:bg-[var(--paper-2)]"
            aria-label="Close"
            onClick={onClose}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InsertTile({
  title: t,
  subtitle: s,
  icon,
  onClick,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex gap-2.5 rounded-[10px] border border-[var(--chrome-b)] bg-[var(--paper-2)] p-3 text-left transition-colors hover:bg-[var(--paper)]"
    >
      <div className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] text-[var(--ink-2)]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-[var(--ink)]">{t}</div>
        <div className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">{s}</div>
      </div>
    </button>
  );
}

const groups: {
  label: string;
  items: { t: string; s: string; icon: ReactNode; action: "text" | "youtube" | "image" | PageRoughShapeKind }[];
}[] = [
  {
    label: "Shapes",
    items: [
      {
        t: "Rectangle",
        s: "Drag on the page to draw a rough rectangle",
        action: "rect",
        icon: (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
            <rect x="3.5" y="4.5" width="13" height="11" rx="1" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        ),
      },
      {
        t: "Ellipse",
        s: "Drag on the page to draw a rough ellipse inside the box",
        action: "ellipse",
        icon: (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
            <ellipse cx="10" cy="10" rx="7" ry="5" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        ),
      },
      {
        t: "Diamond",
        s: "Drag on the page to draw a rough diamond (rotated square)",
        action: "diamond",
        icon: (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M10 3.5l7.5 6.5L10 16.5 2.5 10 10 3.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Media",
    items: [
      {
        t: "Image (URL)",
        s: "Paste an https image link",
        action: "image",
        icon: (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
            <rect x="3" y="5" width="14" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="7" cy="9" r="1.2" fill="currentColor" />
            <path d="M3 14l4-4 3 3 3.5-3.5L17 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        t: "YouTube",
        s: "Paste a watch or youtu.be link",
        action: "youtube",
        icon: (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
            <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
            <path d="M8 8v4l4-2-4-2z" fill="currentColor" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Text",
    items: [
      {
        t: "Text block",
        s: "Typed notes on the page — use Select to move or edit",
        action: "text",
        icon: (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M5 4h10M5 8h10M5 12h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        ),
      },
    ],
  },
];

/** Insert palette — mirrors `src/modals.jsx` InsertModal. */
export function InsertBlocksModal({ open, onClose, onAddText, onAddYoutube, onAddImage, onAddRoughShape }: Props) {
  const [youtubeDraft, setYoutubeDraft] = useState("");
  const [imageDraft, setImageDraft] = useState("");
  const [panel, setPanel] = useState<"menu" | "youtube" | "image">("menu");

  useEffect(() => {
    if (!open) return;
    function onEsc(ev: KeyboardEvent) {
      if (ev.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  function close() {
    setPanel("menu");
    setYoutubeDraft("");
    setImageDraft("");
    onClose();
  }

  function runYoutube() {
    const id = extractYoutubeVideoId(youtubeDraft);
    if (!id) return;
    onAddYoutube(id);
    close();
  }

  function runImage() {
    const s = imageDraft.trim();
    try {
      const u = new URL(s);
      if (u.protocol !== "https:") return;
    } catch {
      return;
    }
    onAddImage(s);
    close();
  }

  return (
    <ModalShell open={open} onClose={close} title="Insert" subtitle="Or press / on the canvas to open this menu.">
      <div className="px-5 pb-5 pt-1">
        {panel === "menu" ? (
          <>
            {groups.map((g) => (
              <div key={g.label} className="mt-4">
                <div className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{g.label}</div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
                  {g.items.map((it) => (
                    <InsertTile
                      key={it.t}
                      title={it.t}
                      subtitle={it.s}
                      icon={it.icon}
                      onClick={() => {
                        if (it.action === "text") {
                          onAddText();
                          close();
                        } else if (it.action === "rect" || it.action === "ellipse" || it.action === "diamond") {
                          onAddRoughShape(it.action);
                          close();
                        } else if (it.action === "youtube") setPanel("youtube");
                        else setPanel("image");
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : null}

        {panel === "youtube" ? (
          <div className="mt-4 space-y-3">
            <button type="button" className="text-xs text-[var(--accent)] hover:underline" onClick={() => setPanel("menu")}>
              ← Back
            </button>
            <label className="block text-xs font-semibold text-[var(--ink-2)]">YouTube URL</label>
            <input
              value={youtubeDraft}
              onChange={(e) => setYoutubeDraft(e.target.value)}
              className="w-full rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--ink)]"
              placeholder="https://www.youtube.com/watch?v=…"
              autoFocus
            />
            <button
              type="button"
              className="rounded-lg bg-[var(--ink)] px-4 py-2 text-xs font-semibold text-[var(--paper)]"
              onClick={() => runYoutube()}
            >
              Add embed
            </button>
          </div>
        ) : null}

        {panel === "image" ? (
          <div className="mt-4 space-y-3">
            <button type="button" className="text-xs text-[var(--accent)] hover:underline" onClick={() => setPanel("menu")}>
              ← Back
            </button>
            <label className="block text-xs font-semibold text-[var(--ink-2)]">Image URL (https)</label>
            <input
              value={imageDraft}
              onChange={(e) => setImageDraft(e.target.value)}
              className="w-full rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--ink)]"
              placeholder="https://…"
              autoFocus
            />
            <button
              type="button"
              className="rounded-lg bg-[var(--ink)] px-4 py-2 text-xs font-semibold text-[var(--paper)]"
              onClick={() => runImage()}
            >
              Add image
            </button>
          </div>
        ) : null}
      </div>
    </ModalShell>
  );
}
