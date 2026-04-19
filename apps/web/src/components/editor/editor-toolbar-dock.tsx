"use client";

import type { ReactNode } from "react";
import type { ChromeTool } from "@/components/editor/canvas-chrome-tool";
import { isDrawingTool } from "@/components/editor/canvas-chrome-tool";
import { penSwatches, PEN_SIZES } from "@/lib/ink/editor-constants";
import { useUiTheme } from "@/lib/ui-theme";
import type { PageRoughShapeKind, PageTextFontId } from "@/lib/page-blocks/types";
import type { UiTheme } from "@/lib/user-settings";
import { NOTEBOOK_TEXT_SIZE_PRESETS, pageTextFontStack } from "@/lib/page-blocks/text-typography";

type Props = {
  tool: ChromeTool;
  onToolChange: (t: ChromeTool) => void;
  color: string;
  onColorChange: (c: string) => void;
  penSize: number;
  onPenSizeChange: (s: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onInsert: () => void;
  readOnly?: boolean;
  /** When a text block is selected (Select / Text tool), show handwriting size presets. */
  textFontSizePx?: number;
  onTextFontSizePxChange?: (px: number) => void;
  textFontFamily?: PageTextFontId;
  onTextFontFamilyChange?: (ff: PageTextFontId) => void;
  /** Active rough shape when the Shapes tool is on (rect / ellipse / diamond). */
  shapeDrawKind?: PageRoughShapeKind;
  onShapeDrawKindChange?: (k: PageRoughShapeKind) => void;
  /** From server `getUserTheme` — keeps ink swatches aligned with `html[data-theme]` on first paint. */
  ssrUiTheme?: UiTheme;
};

function DockBtn({
  active,
  title,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-0 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "bg-[var(--ink)] text-[var(--paper)] shadow-sm" : "bg-transparent text-[var(--ink-2)] hover:bg-[color-mix(in_oklch,var(--paper-2)_90%,transparent)]"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="my-1 h-px w-[22px] shrink-0 bg-[var(--chrome-b)]" />;
}

const dockShell =
  "pointer-events-auto flex max-h-[min(520px,calc(100vh-120px))] flex-col items-center gap-0.5 overflow-y-auto overflow-x-hidden rounded-full border border-[color-mix(in_oklch,var(--chrome-b)_85%,var(--rule))] px-1 py-2 shadow-[var(--shadow-2)]";

const dockStyle = {
  background: "color-mix(in oklch, var(--paper) 92%, transparent)",
  backdropFilter: "blur(14px) saturate(130%)",
} as const;

/** Left vertical glass dock + fly-out — `src/toolbar.jsx` / Whiteboard prototype. */
export function EditorToolbarDock({
  tool,
  onToolChange,
  color,
  onColorChange,
  penSize,
  onPenSizeChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onInsert,
  readOnly = false,
  textFontSizePx,
  onTextFontSizePxChange,
  textFontFamily,
  onTextFontFamilyChange,
  shapeDrawKind = "rect",
  onShapeDrawKindChange,
  ssrUiTheme,
}: Props) {
  const uiTheme = useUiTheme(ssrUiTheme);
  const inkSwatches = penSwatches(uiTheme);
  const showInkFlyout = isDrawingTool(tool) && tool !== "eraser";
  const showShapeFlyout =
    tool === "shapes" && !readOnly && typeof onShapeDrawKindChange === "function";
  const showTextSizes =
    typeof textFontSizePx === "number" &&
    Number.isFinite(textFontSizePx) &&
    typeof onTextFontSizePxChange === "function";
  const showTextFamilies = textFontFamily != null && typeof onTextFontFamilyChange === "function";
  const showTextFlyout = showTextSizes && showTextFamilies && (tool === "text" || tool === "select");

  return (
    <div className="relative w-max shrink-0 pointer-events-none">
      <div className="pointer-events-none z-20 flex flex-col items-center gap-1.5" aria-label="Drawing tools">
        <div className={dockShell} style={{ ...dockStyle }}>
          <DockBtn active={false} title="Undo (⌘Z)" onClick={onUndo} disabled={!canUndo}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M7 5H4v3M4 10a6 6 0 0 1 10.2-4.2M7 15l-3-3 3-3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </DockBtn>
          <DockBtn active={false} title="Redo (⌘⇧Z)" onClick={onRedo} disabled={!canRedo}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M13 5h3v3M16 10a6 6 0 0 0-10.2-4.2M13 15l3-3-3-3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </DockBtn>
          <Divider />
          <DockBtn active={false} title="Insert text, image, video, or shape ( / )" onClick={onInsert} disabled={readOnly}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </DockBtn>
          <Divider />
          <DockBtn active={tool === "move"} title="Move — drag to pan the page (V)" onClick={() => onToolChange("move")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M18 8v2a4 4 0 0 1-4 4h-2a4 4 0 0 0-4 4v2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M18 13h-3M10 18H8a2 2 0 0 1-2-2v-3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </DockBtn>
          <DockBtn active={tool === "select"} title="Select — move & edit blocks (M)" onClick={() => onToolChange("select")}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M4 4l6 14 2-5 5-1-13-8z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
            </svg>
          </DockBtn>
          <DockBtn active={tool === "pen"} title="Pen (P)" onClick={() => onToolChange("pen")}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M3 17l1.2-4 9.5-9.5a1.5 1.5 0 0 1 2.1 0l.7.7a1.5 1.5 0 0 1 0 2.1L7 15.8 3 17z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </DockBtn>
          <DockBtn active={tool === "hl"} title="Highlighter (H)" onClick={() => onToolChange("hl")}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M4 16L14 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </DockBtn>
          <DockBtn
            active={tool === "text"}
            title={readOnly ? "Text — read-only" : "Text (T) — click page to type"}
            disabled={readOnly}
            onClick={() => onToolChange("text")}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M6 4h8M10 4v12M7 16h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </DockBtn>
          <DockBtn active={tool === "eraser"} title="Eraser (E)" onClick={() => onToolChange("eraser")}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M8 4l8 8-4 4H4V8l4-4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </DockBtn>
          <DockBtn
            active={tool === "lasso"}
            title="Lasso select (coming soon)"
            disabled
            onClick={() => onToolChange("lasso")}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M5 8c0-3 2.5-5 5-5s5 2 5 5c0 2-1 3.5-2.5 4.5S9 16 8 17s-2 1-3 0-1-2 0-3 2-2 3-3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </DockBtn>
          <DockBtn
            active={tool === "shapes"}
            title={
              readOnly
                ? "Shapes — read-only"
                : "Shapes — drag on the page; pick rectangle, ellipse, or diamond in the panel"
            }
            disabled={readOnly}
            onClick={() => onToolChange("shapes")}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <rect x="3" y="5" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="14" cy="12" r="3" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </DockBtn>
          <DockBtn active={tool === "bucket"} title="Fill (coming soon)" disabled onClick={() => onToolChange("bucket")}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M10 3l6 6-4 4-6-6 4-4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M5 15c1 2 3 3 5 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </DockBtn>
          <DockBtn active={tool === "ruler"} title="Ruler (coming soon)" disabled onClick={() => onToolChange("ruler")}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M4 16L16 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <path d="M6 14l1-1M9 11l1-1M12 8l1-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </DockBtn>
          <DockBtn active={tool === "laser"} title="Laser pointer (X)" onClick={() => onToolChange("laser")}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <circle cx="10" cy="10" r="3" fill="currentColor" />
              <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.2" opacity={0.45} />
            </svg>
          </DockBtn>
        </div>
      </div>

      {showTextFlyout ? (
        <div
          className="pointer-events-none absolute left-[4.25rem] top-1/2 z-[19]"
          style={{ animation: "slate-toolbar-fly 0.16s ease-out forwards" }}
        >
          <div className={`${dockShell} flex-col pointer-events-auto`} style={{ ...dockStyle }}>
            <div className="px-0.5 pb-0.5 text-[9.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">
              Handwriting
            </div>
            <div className="mb-1 grid grid-cols-2 gap-1 px-0.5">
              {(["caveat", "instrument", "inter", "jetbrains-mono"] as const).map((fid) => (
                <button
                  key={fid}
                  type="button"
                  title={fid}
                  onClick={() => onTextFontFamilyChange(fid)}
                  className={`rounded-md px-1 py-1 text-[10px] font-semibold ${
                    textFontFamily === fid
                      ? "bg-[var(--ink)] text-[var(--paper)]"
                      : "bg-transparent text-[var(--ink-2)] hover:bg-[var(--paper-2)]"
                  }`}
                  style={{ fontFamily: pageTextFontStack(fid) }}
                >
                  {fid === "caveat" ? "Hand" : fid === "instrument" ? "Serif" : fid === "inter" ? "Sans" : "Mono"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1 px-0.5">
              {NOTEBOOK_TEXT_SIZE_PRESETS.map((s) => (
                <button
                  key={s}
                  type="button"
                  title={`${s}px`}
                  onClick={() => onTextFontSizePxChange(s)}
                  className={`rounded-md px-1 py-1 text-[11px] font-semibold tabular-nums ${
                    Math.round(textFontSizePx) === s
                      ? "bg-[var(--ink)] text-[var(--paper)]"
                      : "bg-transparent text-[var(--ink-2)] hover:bg-[var(--paper-2)]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {showShapeFlyout ? (
        <div
          className="pointer-events-none absolute left-[4.25rem] top-1/2 z-[19] -translate-y-1/2"
          style={{ animation: "slate-toolbar-fly 0.16s ease-out forwards" }}
        >
          <div className={`${dockShell} flex-col pointer-events-auto`} style={{ ...dockStyle }}>
            <div className="px-0.5 pb-0.5 text-[9.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Shape</div>
            <div className="grid grid-cols-1 gap-1 px-0.5">
              <button
                type="button"
                title="Rectangle"
                onClick={() => onShapeDrawKindChange?.("rect")}
                className={`grid h-8 w-8 place-items-center rounded-md border-0 ${
                  shapeDrawKind === "rect" ? "bg-[var(--ink)] text-[var(--paper)]" : "bg-transparent text-[var(--ink-2)] hover:bg-[var(--paper-2)]"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <rect x="4" y="5.5" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </button>
              <button
                type="button"
                title="Ellipse"
                onClick={() => onShapeDrawKindChange?.("ellipse")}
                className={`grid h-8 w-8 place-items-center rounded-md border-0 ${
                  shapeDrawKind === "ellipse" ? "bg-[var(--ink)] text-[var(--paper)]" : "bg-transparent text-[var(--ink-2)] hover:bg-[var(--paper-2)]"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <ellipse cx="10" cy="10" rx="6" ry="4" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </button>
              <button
                type="button"
                title="Diamond"
                onClick={() => onShapeDrawKindChange?.("diamond")}
                className={`grid h-8 w-8 place-items-center rounded-md border-0 ${
                  shapeDrawKind === "diamond" ? "bg-[var(--ink)] text-[var(--paper)]" : "bg-transparent text-[var(--ink-2)] hover:bg-[var(--paper-2)]"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path d="M10 4l6 6-6 6-6-6 6-6z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showInkFlyout && (
        <div
          className="pointer-events-none absolute left-[4.25rem] top-1/2 z-[19]"
          style={{ animation: "slate-toolbar-fly 0.16s ease-out forwards" }}
        >
          <div className={`${dockShell} flex-col`} style={{ ...dockStyle }}>
            <div className="px-0.5 pb-0.5 text-[9.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Color</div>
            <div className="grid grid-cols-2 gap-1.5 px-0.5">
              {inkSwatches.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  aria-label={`Color ${c}`}
                  onClick={() => onColorChange(c)}
                  className="h-[18px] w-[18px] rounded-full p-0 shadow-[0_0_0_1px_rgba(0,0,0,.08)]"
                  style={{
                    background: c,
                    border: color === c ? "2px solid var(--ink)" : "2px solid transparent",
                  }}
                />
              ))}
            </div>
            <div className="my-1 h-px w-full bg-[var(--chrome-b)]" />
            <div className="px-0.5 pb-0.5 text-[9.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Size</div>
            <div className="flex flex-col gap-0.5">
              {PEN_SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  title={`${s}px`}
                  onClick={() => onPenSizeChange(s)}
                  className={`grid h-7 w-8 place-items-center rounded-md border-0 ${
                    penSize === s ? "bg-[var(--chrome-2)]" : "bg-transparent hover:bg-[var(--paper-2)]"
                  }`}
                >
                  <span
                    className="rounded-full"
                    style={{
                      width: Math.max(4, s * 2),
                      height: Math.max(4, s * 2),
                      background: color,
                      boxShadow: "0 0 0 1px rgba(0,0,0,.08)",
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
