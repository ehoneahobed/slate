"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  extractYoutubeVideoId,
  normalizeHttpsUrl,
  type PageRoughShapeKind,
  type PageStickyTint,
} from "@/lib/page-blocks/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onAddText: () => void;
  onAddYoutube: (videoId: string) => void;
  onAddImage: (src: string) => void;
  onAddRoughShape: (kind: PageRoughShapeKind) => void;
  onAddSticky: (tint: PageStickyTint) => void;
  onAddWebEmbed: (url: string, title?: string) => void;
  onAddFileCard: (url: string, label: string) => void;
  onAddMath: (latex: string, opts?: { display?: boolean }) => void;
  onAddCode: (code: string, opts?: { filename?: string }) => void;
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
  items: {
    t: string;
    s: string;
    icon: ReactNode;
    action: "text" | "youtube" | "image" | "web" | "file" | "math" | "code" | PageRoughShapeKind | "sticky";
    stickyTint?: PageStickyTint;
  }[];
}[] = [
  {
    label: "Stickies",
    items: (
      [
        { tint: "yellow" as const, t: "Yellow", s: "Quick ink-style reminder" },
        { tint: "pink" as const, t: "Pink", s: "Soft highlight note" },
        { tint: "blue" as const, t: "Blue", s: "Cool tone note" },
        { tint: "green" as const, t: "Green", s: "Fresh tone note" },
      ] as const
    ).map(({ tint, t, s }) => ({
      t,
      s,
      action: "sticky" as const,
      stickyTint: tint,
      icon: (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M5 3.5h10c.8 0 1.5.7 1.5 1.5v9L12 17.5H5A1.5 1.5 0 013.5 16V5c0-.8.7-1.5 1.5-1.5z" fill="currentColor" opacity=".12" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      ),
    })),
  },
  {
    label: "Web & files",
    items: [
      {
        t: "Web page / blog",
        s: "Embed an https page in a frame (some sites block this)",
        action: "web",
        icon: (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
            <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.4" />
            <path d="M6 10h8M10 6v8" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        ),
      },
      {
        t: "File link",
        s: "PDF, archive, or any https file — opens in a new tab",
        action: "file",
        icon: (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M5 4.5h7l3 3V15.5H5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M12 4.5V7h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        ),
      },
    ],
  },
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
    label: "Embeds",
    items: [
      {
        t: "LaTeX / math",
        s: "Equations and formulas (KaTeX)",
        action: "math",
        icon: (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M4 4.5h12M4 10h7M4 15.5h10" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
            <path d="M13.5 7.5l2.5 2.5-2.5 2.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        t: "Code snippet",
        s: "Notebook-style window with monospace body",
        action: "code",
        icon: (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
            <rect x="3" y="4" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M6.5 8.5L5 10l1.5 1.5M10 12.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
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
export function InsertBlocksModal({
  open,
  onClose,
  onAddText,
  onAddYoutube,
  onAddImage,
  onAddRoughShape,
  onAddSticky,
  onAddWebEmbed,
  onAddFileCard,
  onAddMath,
  onAddCode,
}: Props) {
  const [youtubeDraft, setYoutubeDraft] = useState("");
  const [imageDraft, setImageDraft] = useState("");
  const [webUrlDraft, setWebUrlDraft] = useState("");
  const [webTitleDraft, setWebTitleDraft] = useState("");
  const [fileUrlDraft, setFileUrlDraft] = useState("");
  const [fileLabelDraft, setFileLabelDraft] = useState("");
  const [mathDraft, setMathDraft] = useState("");
  const [mathDisplayDraft, setMathDisplayDraft] = useState(true);
  const [codeDraft, setCodeDraft] = useState("");
  const [codeFilenameDraft, setCodeFilenameDraft] = useState("");
  const [panel, setPanel] = useState<"menu" | "youtube" | "image" | "web" | "file" | "math" | "code">("menu");

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
    setWebUrlDraft("");
    setWebTitleDraft("");
    setFileUrlDraft("");
    setFileLabelDraft("");
    setMathDraft("");
    setMathDisplayDraft(true);
    setCodeDraft("");
    setCodeFilenameDraft("");
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

  function runWeb() {
    const url = normalizeHttpsUrl(webUrlDraft);
    if (!url) return;
    const title = webTitleDraft.trim();
    onAddWebEmbed(url, title ? title.slice(0, 200) : undefined);
    close();
  }

  function runFile() {
    const url = normalizeHttpsUrl(fileUrlDraft);
    if (!url) return;
    const label = fileLabelDraft.trim() || "Linked file";
    onAddFileCard(url, label.slice(0, 200));
    close();
  }

  function runMath() {
    const latex = mathDraft.trim();
    if (!latex) return;
    onAddMath(latex, { display: mathDisplayDraft });
    close();
  }

  function runCode() {
    const code = codeDraft.replace(/\r\n/g, "\n");
    if (!code.trim()) return;
    const filename = codeFilenameDraft.trim();
    onAddCode(code, filename ? { filename: filename.slice(0, 120) } : undefined);
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
                        } else if (it.action === "sticky" && it.stickyTint) {
                          onAddSticky(it.stickyTint);
                          close();
                        } else if (it.action === "rect" || it.action === "ellipse" || it.action === "diamond") {
                          onAddRoughShape(it.action);
                          close();
                        } else if (it.action === "youtube") setPanel("youtube");
                        else if (it.action === "web") setPanel("web");
                        else if (it.action === "file") setPanel("file");
                        else if (it.action === "math") setPanel("math");
                        else if (it.action === "code") setPanel("code");
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

        {panel === "web" ? (
          <div className="mt-4 space-y-3">
            <button type="button" className="text-xs text-[var(--accent)] hover:underline" onClick={() => setPanel("menu")}>
              ← Back
            </button>
            <label className="block text-xs font-semibold text-[var(--ink-2)]">Page URL (https)</label>
            <input
              value={webUrlDraft}
              onChange={(e) => setWebUrlDraft(e.target.value)}
              className="w-full rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--ink)]"
              placeholder="https://example.com/article…"
              autoFocus
            />
            <label className="block text-xs font-semibold text-[var(--ink-2)]">Optional title (chrome bar)</label>
            <input
              value={webTitleDraft}
              onChange={(e) => setWebTitleDraft(e.target.value)}
              className="w-full rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--ink)]"
              placeholder="My favorite post"
            />
            <button
              type="button"
              className="rounded-lg bg-[var(--ink)] px-4 py-2 text-xs font-semibold text-[var(--paper)]"
              onClick={() => runWeb()}
            >
              Add web embed
            </button>
          </div>
        ) : null}

        {panel === "file" ? (
          <div className="mt-4 space-y-3">
            <button type="button" className="text-xs text-[var(--accent)] hover:underline" onClick={() => setPanel("menu")}>
              ← Back
            </button>
            <label className="block text-xs font-semibold text-[var(--ink-2)]">File URL (https)</label>
            <input
              value={fileUrlDraft}
              onChange={(e) => setFileUrlDraft(e.target.value)}
              className="w-full rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--ink)]"
              placeholder="https://…/slides.pdf"
              autoFocus
            />
            <label className="block text-xs font-semibold text-[var(--ink-2)]">Label</label>
            <input
              value={fileLabelDraft}
              onChange={(e) => setFileLabelDraft(e.target.value)}
              className="w-full rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--ink)]"
              placeholder="Lecture 3 PDF"
            />
            <button
              type="button"
              className="rounded-lg bg-[var(--ink)] px-4 py-2 text-xs font-semibold text-[var(--paper)]"
              onClick={() => runFile()}
            >
              Add file card
            </button>
          </div>
        ) : null}

        {panel === "math" ? (
          <div className="mt-4 space-y-3">
            <button type="button" className="text-xs text-[var(--accent)] hover:underline" onClick={() => setPanel("menu")}>
              ← Back
            </button>
            <label className="block text-xs font-semibold text-[var(--ink-2)]">LaTeX</label>
            <textarea
              value={mathDraft}
              onChange={(e) => setMathDraft(e.target.value)}
              rows={5}
              className="w-full resize-y rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] px-3 py-2 font-mono text-[13px] leading-relaxed outline-none focus:border-[var(--ink)]"
              placeholder={'\\theta_{t+1} = \\theta_t - \\eta \\nabla_\\theta L(\\theta_t)'}
              autoFocus
            />
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[var(--ink-2)]">
              <input
                type="checkbox"
                checked={mathDisplayDraft}
                onChange={(e) => setMathDisplayDraft(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--chrome-b)]"
              />
              Display mode (centered block)
            </label>
            <button
              type="button"
              className="rounded-lg bg-[var(--ink)] px-4 py-2 text-xs font-semibold text-[var(--paper)]"
              onClick={() => runMath()}
            >
              Add math
            </button>
          </div>
        ) : null}

        {panel === "code" ? (
          <div className="mt-4 space-y-3">
            <button type="button" className="text-xs text-[var(--accent)] hover:underline" onClick={() => setPanel("menu")}>
              ← Back
            </button>
            <label className="block text-xs font-semibold text-[var(--ink-2)]">Filename (optional)</label>
            <input
              value={codeFilenameDraft}
              onChange={(e) => setCodeFilenameDraft(e.target.value)}
              className="w-full rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--ink)]"
              placeholder="gd.py"
            />
            <label className="block text-xs font-semibold text-[var(--ink-2)]">Source</label>
            <textarea
              value={codeDraft}
              onChange={(e) => setCodeDraft(e.target.value)}
              rows={10}
              className="w-full resize-y rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] px-3 py-2 font-mono text-[12px] leading-relaxed outline-none focus:border-[var(--ink)]"
              placeholder="# your snippet…"
              autoFocus
            />
            <button
              type="button"
              className="rounded-lg bg-[var(--ink)] px-4 py-2 text-xs font-semibold text-[var(--paper)]"
              onClick={() => runCode()}
            >
              Add code
            </button>
          </div>
        ) : null}
      </div>
    </ModalShell>
  );
}
