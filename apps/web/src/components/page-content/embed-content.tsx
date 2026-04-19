"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import { useEffect, useRef } from "react";

/** Client-side KaTeX render for page math blocks. */
export function MathBlockHtml({ latex, displayMode }: { latex: string; displayMode: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      katex.render(latex, el, {
        displayMode,
        throwOnError: false,
        errorColor: "var(--danger)",
        trust: false,
        maxSize: 14,
        maxExpand: 1200,
      });
    } catch {
      el.textContent = latex;
    }
    return () => {
      el.innerHTML = "";
    };
  }, [latex, displayMode]);
  return <div ref={ref} className="min-h-0 overflow-x-auto px-2 py-2 text-[var(--ink)] [&_.katex]:!text-[var(--ink)]" dir="ltr" />;
}

/** macOS-style window chrome + scrollable code body (prototype “gd.py”). */
export function CodeEmbedBody({
  code,
  filename,
  rootClassName = "",
  /** When false (e.g. public share), window chrome uses a neutral cursor. */
  chromeDraggable = true,
}: {
  code: string;
  filename?: string;
  /** Appended to the outer wrapper (e.g. `rounded-t-none border-t` when a drag bar sits above). */
  rootClassName?: string;
  chromeDraggable?: boolean;
}) {
  const name = filename?.trim() || "snippet";
  return (
    <div
      className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-b-xl border border-t-0 border-[color-mix(in_oklch,var(--ink)_18%,var(--chrome-b))] bg-[#1c1a17] text-[#f2efe6] shadow-[inset_0_1px_0_rgba(255,255,255,.04)] ${rootClassName}`.trim()}
    >
      <div
        data-code-chrome
        className={`flex shrink-0 items-center gap-2 border-b border-white/10 bg-[#2c2924] px-2.5 py-1.5 ${
          chromeDraggable ? "cursor-grab active:cursor-grabbing" : ""
        }`.trim()}
        title={chromeDraggable ? "Drag to move this code block (Select tool)" : undefined}
      >
        <span className="flex gap-1" aria-hidden>
          <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
          <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
          <span className="h-2 w-2 rounded-full bg-[#28c840]" />
        </span>
        <span className="min-w-0 truncate font-mono text-[10px] font-medium tracking-tight text-white/60">{name}</span>
      </div>
      <pre className="min-h-0 min-w-0 w-full max-w-full flex-1 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[11px] leading-relaxed text-[#e8e4dc] [overflow-wrap:anywhere]">
        {code}
      </pre>
    </div>
  );
}
