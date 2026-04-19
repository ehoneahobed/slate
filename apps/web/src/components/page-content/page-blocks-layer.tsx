"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type { ChromeTool } from "@/components/editor/canvas-chrome-tool";
import {
  snapBlockPositionLegacy,
  snapBlockPositionWorld,
  snapBlockSizeLegacy,
  snapBlockSizeWorld,
} from "@/lib/page-blocks/block-snap";
import type { BlocksCoordSpace, PageBlock, PageBlockRect, PageBlockText, PageRoughShapeKind, PageTextFontId } from "@/lib/page-blocks/types";
import { isPageRoughShapeBlock } from "@/lib/page-blocks/types";
import { sheetWorldFromClientRect, sheetWorldUyMax } from "@/lib/page-blocks/world-sheet-coords";
import {
  blockWithSegments,
  caretStyleHint,
  editableRootToSegments,
  effectiveSegmentStyle,
  getTextSegments,
  segmentsPlainText,
  segmentsToEditableHtml,
  wrapSelectionWithStyle,
} from "@/lib/page-blocks/text-segments";
import {
  defaultNotebookFontSizePx,
  NOTEBOOK_TEXT_SIZE_PRESETS,
  notebookTextPadding,
  notebookTextStyle,
  pageTextFontStack,
} from "@/lib/page-blocks/text-typography";
import { RoughRectCanvas } from "@/components/page-content/rough-rect-canvas";

export type PageBlocksChangeOpts = { recordHistory?: boolean };

type Props = {
  blocks: PageBlock[];
  onBlocksChange: (next: PageBlock[], opts?: PageBlocksChangeOpts) => void;
  tool: ChromeTool;
  readOnly: boolean;
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  pendingTextEditId?: string | null;
  onPendingTextEditConsumed?: () => void;
  pageBackgroundType?: string;
  layoutCoordSpace: BlocksCoordSpace;
  /** Fired when a text block enters/leaves inline edit (for toolbar font-size chrome). */
  onEditingTextIdChange?: (id: string | null) => void;
  /**
   * Click / double-click to place a text block. With `layoutCoordSpace === "world-v2"`, `vertical`
   * is `uy = pxFromTop / sheetWidth` (same as ink). Legacy mode passes page-height fraction [0,1].
   */
  onRequestTextAt?: (nx: number, vertical: number, source: "text-tool" | "select-dblclick") => void;
  /** While `tool === "shapes"`, drag on empty sheet to define shape bounds (world-v2 coords). */
  onShapeDrawCommit?: (rect: Pick<PageBlockRect, "x" | "y" | "w" | "h">, kind: PageRoughShapeKind) => void;
  /** Which rough shape is created by the next drag (rect / ellipse / diamond). */
  shapeDrawKind?: PageRoughShapeKind;
  /** Ink surface root — same rect as StrokeCanvas `worldNormRootRef` for identical world `(nx, uy)`. */
  sheetWorldRef?: RefObject<HTMLElement | null>;
};

function replaceOne(blocks: PageBlock[], id: string, updated: PageBlock): PageBlock[] {
  return blocks.map((x) => (x.id === id ? updated : x));
}

type DragKind = "move" | "resize";

type DragSession = {
  kind: DragKind;
  id: string;
  startBlocks: PageBlock[];
  orig: PageBlock;
  startNx: number;
  /** Legacy: page-height fraction. World: uy (px from top / sheet width). */
  startNv: number;
};

function syncTextBlockHeight(
  wrapEl: HTMLDivElement | null,
  contentEl: HTMLElement | null,
  b: PageBlockText,
  onBlocksChange: Props["onBlocksChange"],
  currentBlocks: PageBlock[],
  layoutCoordSpace: BlocksCoordSpace,
) {
  if (!wrapEl || !contentEl) return;
  const r = wrapEl.getBoundingClientRect();
  const pageH = r.height;
  const pageW = r.width;
  if (pageH < 8 || pageW < 8) return;
  const uyMax = pageH / pageW;
  const nh =
    layoutCoordSpace === "world-v2"
      ? Math.min(Math.max(0, uyMax - b.y), Math.max(0.045, contentEl.scrollHeight / pageW))
      : Math.min(0.98, Math.max(0.045, contentEl.scrollHeight / pageH));
  if (Math.abs(nh - b.h) < 0.004) return;
  const next = replaceOne(currentBlocks, b.id, { ...b, h: nh });
  onBlocksChange(next, { recordHistory: false });
}

function blockFrameStyle(b: PageBlock, layoutCoordSpace: BlocksCoordSpace, cw: number, ch: number) {
  if (layoutCoordSpace === "legacy-page") {
    return {
      position: "absolute" as const,
      left: `${b.x * 100}%`,
      top: `${b.y * 100}%`,
      width: `${b.w * 100}%`,
      height: `${b.h * 100}%`,
    };
  }
  const ar = cw / Math.max(ch, 1e-6);
  return {
    position: "absolute" as const,
    left: `${b.x * 100}%`,
    top: `${b.y * ar * 100}%`,
    width: `${b.w * 100}%`,
    height: `${b.h * ar * 100}%`,
  };
}

function placeCaretAtEnd(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
  el.focus({ preventScroll: true });
}

function textRunsAreStyled(b: PageBlockText): boolean {
  const segs = getTextSegments(b);
  return segs.length > 1 || segs.some((s) => s.fontSizePx != null || s.fontFamily != null);
}

const TEXT_FONT_CHOICES: { id: PageTextFontId; label: string }[] = [
  { id: "caveat", label: "Hand" },
  { id: "instrument", label: "Serif" },
  { id: "inter", label: "Sans" },
  { id: "jetbrains-mono", label: "Mono" },
];

function TextSelectionBubble({
  getEditor,
  block,
  bg,
  displayBlocks,
  onBlocksChange,
  scheduleHeightSync,
}: {
  getEditor: () => HTMLElement | null;
  block: PageBlockText;
  bg: string;
  displayBlocks: PageBlock[];
  onBlocksChange: (next: PageBlock[], opts?: PageBlocksChangeOpts) => void;
  scheduleHeightSync: (id: string, snapshot: PageBlock[]) => void;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const refresh = useCallback(() => {
    const root = getEditor();
    if (!root) {
      setPos(null);
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !root.contains(sel.anchorNode) || !root.contains(sel.focusNode)) {
      setPos(null);
      return;
    }
    const r = sel.getRangeAt(0).getBoundingClientRect();
    const br = root.getBoundingClientRect();
    if (r.width < 1 && r.height < 1) {
      setPos(null);
      return;
    }
    setPos({ x: r.left - br.left + r.width / 2, y: r.top - br.top });
  }, [getEditor]);

  useEffect(() => {
    document.addEventListener("selectionchange", refresh);
    return () => document.removeEventListener("selectionchange", refresh);
  }, [refresh]);

  useEffect(() => {
    const root = getEditor();
    if (!root) return;
    root.addEventListener("mouseup", refresh);
    root.addEventListener("keyup", refresh);
    return () => {
      root.removeEventListener("mouseup", refresh);
      root.removeEventListener("keyup", refresh);
    };
  }, [getEditor, refresh]);

  const applyPatch = (patch: { fontSizePx: number; fontFamily: PageTextFontId }) => {
    const root = getEditor();
    if (!root) return;
    if (!wrapSelectionWithStyle(root, patch)) return;
    const row = displayBlocks.find((x) => x.id === block.id && x.kind === "text");
    if (!row || row.kind !== "text") return;
    const segs = editableRootToSegments(root, row, bg);
    const nextB = blockWithSegments(row, segs);
    const next = replaceOne(displayBlocks, block.id, nextB);
    onBlocksChange(next, { recordHistory: true });
    scheduleHeightSync(block.id, next);
  };

  const applySize = (px: number) => {
    const root = getEditor();
    const hint = root
      ? caretStyleHint(root, block, bg)
      : {
          fontSizePx: block.fontSizePx ?? defaultNotebookFontSizePx(bg),
          fontFamily: (block.fontFamily ?? "caveat") as PageTextFontId,
        };
    applyPatch({ fontSizePx: px, fontFamily: hint.fontFamily });
  };

  const applyFont = (ff: PageTextFontId) => {
    const root = getEditor();
    const hint = root
      ? caretStyleHint(root, block, bg)
      : { fontSizePx: block.fontSizePx ?? defaultNotebookFontSizePx(bg) };
    applyPatch({ fontSizePx: hint.fontSizePx, fontFamily: ff });
  };

  if (!pos) return null;

  return (
    <div
      className="absolute z-[6] flex max-w-[min(100%,280px)] flex-wrap items-center gap-0.5 rounded-lg border border-[var(--chrome-b)] bg-[color-mix(in_oklch,var(--chrome)_92%,transparent)] px-1 py-1 shadow-[var(--shadow-1)] backdrop-blur"
      style={{
        left: pos.x,
        top: pos.y,
        transform: "translate(-50%, calc(-100% - 6px))",
        pointerEvents: "auto",
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {TEXT_FONT_CHOICES.map((f) => (
        <button
          key={f.id}
          type="button"
          title={f.label}
          className="rounded-md border border-transparent px-1 py-0.5 text-[10px] font-semibold text-[var(--ink-2)] hover:bg-[var(--paper-2)]"
          style={{ fontFamily: pageTextFontStack(f.id) }}
          onClick={() => applyFont(f.id)}
        >
          {f.label}
        </button>
      ))}
      <span className="mx-0.5 h-4 w-px shrink-0 bg-[var(--chrome-b)]" />
      {NOTEBOOK_TEXT_SIZE_PRESETS.map((s) => (
        <button
          key={s}
          type="button"
          title={`${s}px`}
          onClick={() => applySize(s)}
          className="shrink-0 rounded-md px-1 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--ink-2)] hover:bg-[var(--paper-2)]"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

/** Text, image, and YouTube blocks — sit above ink while Select/Text so notes stay clickable. */
export function PageBlocksLayer({
  blocks,
  onBlocksChange,
  tool,
  readOnly,
  selectedId,
  onSelectId,
  pendingTextEditId,
  onPendingTextEditConsumed,
  onRequestTextAt,
  pageBackgroundType = "plain",
  layoutCoordSpace,
  onEditingTextIdChange,
  onShapeDrawCommit,
  shapeDrawKind = "rect",
  sheetWorldRef,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<DragSession | null>(null);
  const ceRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const lastHydratedTextId = useRef<string | null>(null);
  const textInputRaf = useRef<number | undefined>(undefined);
  const [preview, setPreview] = useState<PageBlock[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [sheetGeo, setSheetGeo] = useState({ cw: 1, ch: 1 });
  /** Live bounds while dragging a new rectangle (`tool === "shapes"`). */
  const [rectDragDraft, setRectDragDraft] = useState<Pick<PageBlockRect, "x" | "y" | "w" | "h"> | null>(null);
  const rectDragSessionRef = useRef<{
    ax: number;
    ay: number;
    uyMax: number;
    pointerId: number;
    plane: HTMLDivElement;
  } | null>(null);
  const rectDragMoveRef = useRef<((ev: PointerEvent) => void) | null>(null);
  const rectDragEndRef = useRef<((ev: PointerEvent) => void) | null>(null);
  const isRectDragActiveRef = useRef(false);

  const selectMode = !readOnly && tool === "select";
  const textToolMode = !readOnly && tool === "text";
  const rectDrawMode = !readOnly && tool === "shapes";
  const blocksAboveInk = selectMode || textToolMode || rectDrawMode;

  useLayoutEffect(() => {
    const measure = () => {
      const el = sheetWorldRef?.current ?? wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setSheetGeo({ cw: r.width, ch: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    const w = wrapRef.current;
    const s = sheetWorldRef?.current;
    if (w) ro.observe(w);
    if (s && s !== w) ro.observe(s);
    return () => ro.disconnect();
  }, [sheetWorldRef]);

  useEffect(() => {
    if (tool === "text" || tool === "select") return;
    const t = window.setTimeout(() => setEditingTextId(null), 0);
    return () => window.clearTimeout(t);
  }, [tool]);

  useEffect(() => {
    if (!pendingTextEditId) return;
    const exists = blocks.some((b) => b.id === pendingTextEditId && b.kind === "text");
    if (!exists) return;
    const id = pendingTextEditId;
    const done = () => {
      setEditingTextId(id);
      onPendingTextEditConsumed?.();
    };
    const t = window.setTimeout(done, 0);
    return () => window.clearTimeout(t);
  }, [pendingTextEditId, blocks, onPendingTextEditConsumed]);

  const displayBlocks = preview ?? blocks;

  const scheduleHeightSync = useCallback(
    (id: string, snapshot: PageBlock[]) => {
      requestAnimationFrame(() => {
        const wrap = wrapRef.current;
        const el = ceRefs.current.get(id);
        const row = snapshot.find((x) => x.id === id);
        if (!wrap || !el || !row || row.kind !== "text") return;
        syncTextBlockHeight(wrap, el, row, onBlocksChange, snapshot, layoutCoordSpace);
      });
    },
    [onBlocksChange, layoutCoordSpace],
  );

  useLayoutEffect(() => {
    if (!editingTextId) {
      lastHydratedTextId.current = null;
      return;
    }
    const el = ceRefs.current.get(editingTextId);
    const row = displayBlocks.find((x) => x.id === editingTextId);
    if (!el || !row || row.kind !== "text") return;
    if (lastHydratedTextId.current !== editingTextId) {
      el.innerHTML = segmentsToEditableHtml(row, pageBackgroundType);
      placeCaretAtEnd(el);
      lastHydratedTextId.current = editingTextId;
    }
  }, [editingTextId, displayBlocks, pageBackgroundType]);

  useLayoutEffect(() => {
    if (!editingTextId) return;
    const wrap = wrapRef.current;
    const el = ceRefs.current.get(editingTextId);
    const row = blocks.find((x) => x.id === editingTextId);
    if (!wrap || !el || !row || row.kind !== "text") return;
    syncTextBlockHeight(wrap, el, row, onBlocksChange, blocks, layoutCoordSpace);
  }, [editingTextId, blocks, onBlocksChange, layoutCoordSpace]);

  /** Restore focus after switching tools (e.g. Select → Text) so typing works without an extra click. */
  useLayoutEffect(() => {
    if (!editingTextId) return;
    if (!(textToolMode || selectMode)) return;
    const el = ceRefs.current.get(editingTextId);
    if (el && document.activeElement !== el) {
      el.focus({ preventScroll: true });
    }
  }, [editingTextId, textToolMode, selectMode]);

  useEffect(() => {
    onEditingTextIdChange?.(editingTextId);
  }, [editingTextId, onEditingTextIdChange]);

  function normClient(clientX: number, clientY: number) {
    const sheet = sheetWorldRef?.current ?? wrapRef.current;
    if (!sheet) return { nx: 0, nv: 0 };
    const r = sheet.getBoundingClientRect();
    if (layoutCoordSpace === "legacy-page") {
      const nx = Math.min(1, Math.max(0, (clientX - r.left) / Math.max(r.width, 1e-6)));
      const ny = Math.min(1, Math.max(0, (clientY - r.top) / Math.max(r.height, 1e-6)));
      return { nx, nv: ny };
    }
    const { nx, uy } = sheetWorldFromClientRect(r, clientX, clientY);
    return { nx, nv: uy };
  }

  const MIN_RECT_DRAG_W = 0.04;
  const MIN_RECT_DRAG_H = 0.035;

  function normalizeRectDragBox(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    uyMax: number,
  ): Pick<PageBlockRect, "x" | "y" | "w" | "h"> {
    let x = Math.min(ax, bx);
    let y = Math.min(ay, by);
    let w = Math.abs(bx - ax);
    let h = Math.abs(by - ay);
    x = Math.min(1 - 1e-6, Math.max(0, x));
    y = Math.min(uyMax - 1e-6, Math.max(0, y));
    w = Math.min(1 - x, w);
    h = Math.min(uyMax - y, h);
    return { x, y, w, h };
  }

  function removeRectDragWindowListeners() {
    const s = rectDragSessionRef.current;
    if (s?.plane) {
      try {
        if (s.plane.hasPointerCapture(s.pointerId)) {
          s.plane.releasePointerCapture(s.pointerId);
        }
      } catch {
        /* ignore */
      }
    }
    const m = rectDragMoveRef.current;
    const u = rectDragEndRef.current;
    if (m) window.removeEventListener("pointermove", m);
    if (u) {
      window.removeEventListener("pointerup", u);
      window.removeEventListener("pointercancel", u);
    }
    rectDragMoveRef.current = null;
    rectDragEndRef.current = null;
    rectDragSessionRef.current = null;
    isRectDragActiveRef.current = false;
  }

  const tearDownRectDragListeners = useCallback(() => {
    removeRectDragWindowListeners();
    setRectDragDraft(null);
  }, []);

  useEffect(() => {
    if (rectDrawMode) return;
    removeRectDragWindowListeners();
    const t = window.setTimeout(() => setRectDragDraft(null), 0);
    return () => window.clearTimeout(t);
  }, [rectDrawMode]);

  useEffect(() => {
    if (!rectDrawMode) return;
    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key !== "Escape" || !isRectDragActiveRef.current) return;
      tearDownRectDragListeners();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rectDrawMode, tearDownRectDragListeners]);

  function beginDrag(kind: DragKind, b: PageBlock, clientX: number, clientY: number) {
    if (!wrapRef.current) return;
    const { nx, nv } = normClient(clientX, clientY);
    sessionRef.current = {
      kind,
      id: b.id,
      startBlocks: displayBlocks,
      orig: { ...b },
      startNx: nx,
      startNv: nv,
    };
    setDragging(true);
    setPreview(displayBlocks);
  }

  function finalizeDragRect(kind: DragKind, o: PageBlock, dx: number, dy: number, uyMax: number, shiftKey: boolean): PageBlock {
    const snap = !shiftKey;
    if (kind === "move") {
      let x = Math.min(1 - o.w, Math.max(0, o.x + dx));
      let y =
        layoutCoordSpace === "world-v2"
          ? Math.min(uyMax - o.h, Math.max(0, o.y + dy))
          : Math.min(1 - o.h, Math.max(0, o.y + dy));
      if (snap && layoutCoordSpace === "world-v2") {
        ({ x, y } = snapBlockPositionWorld(x, y, o.w, o.h, uyMax));
      } else if (snap && layoutCoordSpace === "legacy-page") {
        ({ x, y } = snapBlockPositionLegacy(x, y, o.w, o.h));
      }
      return { ...o, x, y } as PageBlock;
    }

    let nw = Math.min(1 - o.x, Math.max(0.08, o.w + dx));
    let nh =
      layoutCoordSpace === "world-v2"
        ? Math.min(uyMax - o.y, Math.max(0.05, o.h + dy))
        : Math.min(1 - o.y, Math.max(0.05, o.h + dy));
    if (snap && layoutCoordSpace === "world-v2") {
      ({ w: nw, h: nh } = snapBlockSizeWorld(o.x, o.y, nw, nh, uyMax, 0.08, 0.05));
    } else if (snap && layoutCoordSpace === "legacy-page") {
      ({ w: nw, h: nh } = snapBlockSizeLegacy(o.x, o.y, nw, nh, 0.08, 0.05));
    }
    return { ...o, w: nw, h: nh } as PageBlock;
  }

  function applyPointer(clientX: number, clientY: number, shiftKey?: boolean) {
    const sheet = sheetWorldRef?.current ?? wrapRef.current;
    const s = sessionRef.current;
    if (!sheet || !s) return;
    const { nx, nv } = normClient(clientX, clientY);
    const dx = nx - s.startNx;
    const dy = nv - s.startNv;
    const o = s.orig;
    const uyMax = sheetWorldUyMax(sheet.getBoundingClientRect());
    const updated = finalizeDragRect(s.kind, o, dx, dy, uyMax, shiftKey ?? false);
    setPreview(replaceOne(s.startBlocks, s.id, updated));
  }

  function endDrag(clientX: number, clientY: number, shiftKey?: boolean) {
    const s = sessionRef.current;
    sessionRef.current = null;
    setDragging(false);
    setPreview(null);
    if (!s) return;
    const sheet = sheetWorldRef?.current ?? wrapRef.current;
    if (!sheet) return;
    const { nx, nv } = normClient(clientX, clientY);
    const dx = nx - s.startNx;
    const dy = nv - s.startNv;
    const o = s.orig;
    const uyMax = sheetWorldUyMax(sheet.getBoundingClientRect());
    const updated = finalizeDragRect(s.kind, o, dx, dy, uyMax, shiftKey ?? false);
    const next = replaceOne(s.startBlocks, s.id, updated);
    onBlocksChange(next, { recordHistory: true });
  }

  function startMove(e: React.PointerEvent, b: PageBlock) {
    if (!selectMode) return;
    e.stopPropagation();
    e.preventDefault();
    beginDrag("move", b, e.clientX, e.clientY);
    onSelectId(b.id);

    function move(ev: PointerEvent) {
      applyPointer(ev.clientX, ev.clientY, ev.shiftKey);
    }
    function up(ev: PointerEvent) {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      endDrag(ev.clientX, ev.clientY, ev.shiftKey);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  function startResize(e: React.PointerEvent, b: PageBlock) {
    if (!selectMode) return;
    e.stopPropagation();
    e.preventDefault();
    beginDrag("resize", b, e.clientX, e.clientY);
    onSelectId(b.id);

    function move(ev: PointerEvent) {
      applyPointer(ev.clientX, ev.clientY, ev.shiftKey);
    }
    function up(ev: PointerEvent) {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      endDrag(ev.clientX, ev.clientY, ev.shiftKey);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  function onBlockPointerDown(e: React.PointerEvent, b: PageBlock) {
    if (b.kind === "text" && textToolMode) {
      if ((e.target as HTMLElement).closest("[data-text-note-editor]")) return;
      e.stopPropagation();
      onSelectId(b.id);
      setEditingTextId(b.id);
      return;
    }

    if (!selectMode) return;
    if ((e.target as HTMLElement).closest("[data-drag-handle]")) return;
    if ((e.target as HTMLElement).closest("[data-resize-handle]")) return;
    if (b.kind === "text" && (e.target as HTMLElement).closest("[data-text-note-editor]")) return;

    if (b.kind === "text") {
      e.stopPropagation();
      onSelectId(b.id);
      setEditingTextId(b.id);
      return;
    }

    if (isPageRoughShapeBlock(b)) {
      e.stopPropagation();
      startMove(e, b);
      return;
    }

    onSelectId(b.id);
  }

  function handleShapeDrawPlanePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    if (!rectDrawMode || !onShapeDrawCommit) return;
    if (isRectDragActiveRef.current) return;
    e.preventDefault();
    const plane = e.currentTarget;
    const sheet = sheetWorldRef?.current ?? wrapRef.current;
    if (!sheet) return;
    const r = sheet.getBoundingClientRect();
    const uyMax = sheetWorldUyMax(r);
    const { nx: ax, uy: ay } = sheetWorldFromClientRect(r, e.clientX, e.clientY);
    try {
      plane.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    rectDragSessionRef.current = {
      ax,
      ay,
      uyMax,
      pointerId: e.pointerId,
      plane,
    };
    isRectDragActiveRef.current = true;
    setRectDragDraft(normalizeRectDragBox(ax, ay, ax, ay, uyMax));

    function move(ev: PointerEvent) {
      const s = rectDragSessionRef.current;
      if (!s) return;
      const { nx: bx, uy: by } = sheetWorldFromClientRect(r, ev.clientX, ev.clientY);
      setRectDragDraft(normalizeRectDragBox(s.ax, s.ay, bx, by, s.uyMax));
    }

    function upOrCancel(ev: PointerEvent) {
      const s = rectDragSessionRef.current;
      tearDownRectDragListeners();
      if (!s || !onShapeDrawCommit) return;
      const { nx: bx, uy: by } = sheetWorldFromClientRect(r, ev.clientX, ev.clientY);
      const box = normalizeRectDragBox(s.ax, s.ay, bx, by, s.uyMax);
      if (ev.type === "pointerup" && box.w >= MIN_RECT_DRAG_W && box.h >= MIN_RECT_DRAG_H) {
        onShapeDrawCommit(box, shapeDrawKind);
      }
    }

    rectDragMoveRef.current = move;
    rectDragEndRef.current = upOrCancel;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", upOrCancel);
    window.addEventListener("pointercancel", upOrCancel);
  }

  const handleTextToolPlanePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 || !onRequestTextAt) return;
      const sheet = sheetWorldRef?.current ?? wrapRef.current;
      if (!sheet) return;
      const { nx, uy } = sheetWorldFromClientRect(sheet.getBoundingClientRect(), e.clientX, e.clientY);
      onRequestTextAt(nx, uy, "text-tool");
    },
    [onRequestTextAt, sheetWorldRef],
  );

  return (
    <div
      ref={wrapRef}
      className={`absolute inset-0 ${blocksAboveInk ? "z-[9]" : "z-[4]"}`}
      style={{ pointerEvents: "auto" }}
      onPointerDown={(e) => {
        if (!selectMode) return;
        if (e.target === e.currentTarget) onSelectId(null);
      }}
      onDoubleClick={(e) => {
        if (!selectMode || !onRequestTextAt) return;
        const wrap = wrapRef.current;
        if (!wrap || e.target !== e.currentTarget) return;
        const { nx, nv } = normClient(e.clientX, e.clientY);
        onRequestTextAt(nx, nv, "select-dblclick");
      }}
    >
      {textToolMode && onRequestTextAt ? (
        <div
          key="__slate-text-tool-plane__"
          className="absolute inset-0 z-[20] touch-none"
          style={{ pointerEvents: "auto", cursor: "text" }}
          aria-hidden
          onPointerDown={handleTextToolPlanePointerDown}
        />
      ) : null}
      {displayBlocks.map((b) => {
        const sel = b.id === selectedId;
        const base = blockFrameStyle(b, layoutCoordSpace, sheetGeo.cw, sheetGeo.ch);
        const zStack: CSSProperties =
          textToolMode && !readOnly ? (b.kind === "text" ? { zIndex: 30 } : { zIndex: 10 }) : {};

        if (b.kind === "text") {
          const editing = !readOnly && editingTextId === b.id;
          const mixed = textRunsAreStyled(b);
          const readSurface: CSSProperties = mixed
            ? {
                color: "var(--ink)",
                padding: notebookTextPadding(pageBackgroundType),
                lineHeight: 1.45,
              }
            : notebookTextStyle(pageBackgroundType, b.fontSizePx ?? null, b.fontFamily ?? null);
          const editingChrome: CSSProperties = {
            color: "var(--ink)",
            padding: notebookTextPadding(pageBackgroundType),
            lineHeight: 1.45,
            overflow: "hidden",
            pointerEvents: "auto",
          };
          /**
           * Text tool: a full-bleed transparent layer (z-0) captures clicks on empty space inside the
           * note’s box and places a new note — the glyph button stays above (z-1) to edit this note.
           * Previously the shell used pointer-events:none so those clicks fell through the whole layer
           * and never hit the sheet handler (e.target !== wrap).
           */
          const textToolPassThrough = textToolMode && !readOnly;
          const showTextToolBackdrop = textToolPassThrough && !editing && onRequestTextAt;
          /** While editing, height sync can make the shell tall; `none` lets clicks reach the text-tool plane except on children that opt back in (CE, bubble). */
          const textShellPointerEvents =
            textToolPassThrough && editing ? ("none" as const) : ("auto" as const);
          return (
            <div
              key={b.id}
              data-page-block-id={b.id}
              style={{
                ...base,
                ...zStack,
                pointerEvents: textShellPointerEvents,
              }}
              className={`relative flex min-h-0 flex-col overflow-hidden ${
                sel && selectMode
                  ? "rounded-sm ring-1 ring-[var(--accent)] ring-offset-0"
                  : "rounded-none border-0 border-transparent bg-transparent shadow-none"
              }`}
              onPointerDown={textToolPassThrough ? undefined : (e) => onBlockPointerDown(e, b)}
            >
              {showTextToolBackdrop ? (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Place text note"
                  className="absolute inset-0 z-0 min-h-0 w-full cursor-text border-0 bg-transparent p-0"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const wrap = wrapRef.current;
                    if (!wrap || !onRequestTextAt) return;
                    const { nx, nv } = normClient(e.clientX, e.clientY);
                    onRequestTextAt(nx, nv, "text-tool");
                  }}
                />
              ) : null}
              {selectMode && sel ? (
                <div
                  data-drag-handle
                  title="Drag — hold Shift to turn off grid snap"
                  className="absolute bottom-0 left-0 top-0 z-[2] w-3 cursor-grab bg-[color-mix(in_oklch,var(--accent-2)_18%,transparent)] active:cursor-grabbing"
                  style={{ pointerEvents: "auto" }}
                  onPointerDown={(e) => startMove(e, b)}
                />
              ) : null}
              {editing ? (
                <>
                  <TextSelectionBubble
                    getEditor={() => ceRefs.current.get(b.id) ?? null}
                    block={b}
                    bg={pageBackgroundType}
                    displayBlocks={displayBlocks}
                    onBlocksChange={onBlocksChange}
                    scheduleHeightSync={scheduleHeightSync}
                  />
                  {/* Text tool: none-wrapper + self-start CE so synced block height does not steal plane clicks. */}
                  <div
                    className={`relative z-[1] flex min-h-0 w-full flex-1 flex-col ${
                      textToolPassThrough ? "pointer-events-none" : ""
                    }`}
                  >
                    <div
                      ref={(el) => {
                        if (el) ceRefs.current.set(b.id, el);
                        else ceRefs.current.delete(b.id);
                      }}
                      data-text-note-editor
                      contentEditable
                      suppressContentEditableWarning
                      role="textbox"
                      aria-multiline={true}
                      className={`relative min-h-0 w-full border-0 bg-transparent outline-none ring-0 focus:ring-0 ${
                        textToolPassThrough ? "shrink-0 self-start" : "flex-1"
                      } ${selectMode && sel ? "pl-4" : ""}`}
                      style={editingChrome}
                      onPointerDown={(e) => e.stopPropagation()}
                      onInput={() => {
                        if (textInputRaf.current != null) window.cancelAnimationFrame(textInputRaf.current);
                        textInputRaf.current = window.requestAnimationFrame(() => {
                          textInputRaf.current = undefined;
                          const el = ceRefs.current.get(b.id);
                          if (!el) return;
                          const row = displayBlocks.find((x) => x.id === b.id && x.kind === "text");
                          if (!row || row.kind !== "text") return;
                          const segs = editableRootToSegments(el, row, pageBackgroundType);
                          const nextB = blockWithSegments(row, segs);
                          const next = replaceOne(displayBlocks, b.id, nextB);
                          onBlocksChange(next, { recordHistory: false });
                          scheduleHeightSync(b.id, next);
                        });
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const el = ceRefs.current.get(b.id);
                        if (!el) return;
                        const plain = e.clipboardData.getData("text/plain");
                        const sel = window.getSelection();
                        if (!sel?.rangeCount) return;
                        const r = sel.getRangeAt(0);
                        if (!el.contains(r.commonAncestorContainer)) return;
                        r.deleteContents();
                        r.insertNode(document.createTextNode(plain));
                        r.collapse(false);
                        sel.removeAllRanges();
                        sel.addRange(r);
                        el.dispatchEvent(new Event("input", { bubbles: true }));
                      }}
                      onBlur={() => {
                        if (textInputRaf.current != null) {
                          window.cancelAnimationFrame(textInputRaf.current);
                          textInputRaf.current = undefined;
                        }
                        const wrap = wrapRef.current;
                        const el = ceRefs.current.get(b.id);
                        const row = blocks.find((x) => x.id === b.id);
                        if (el && row && row.kind === "text") {
                          const segs = editableRootToSegments(el, row, pageBackgroundType);
                          const nextB = blockWithSegments(row, segs);
                          const committed = replaceOne(blocks, b.id, nextB);
                          onBlocksChange(committed, { recordHistory: false });
                          syncTextBlockHeight(wrap, el, nextB, onBlocksChange, committed, layoutCoordSpace);
                        }
                        setEditingTextId(null);
                      }}
                    />
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className={`relative z-[1] min-h-0 w-full min-w-0 shrink-0 cursor-text self-start overflow-visible border-0 bg-transparent text-left outline-none ring-0 focus:ring-0 focus-visible:ring-1 focus-visible:ring-[var(--accent)] ${selectMode && sel ? "pl-4" : ""}`}
                  style={{ ...readSurface, pointerEvents: "auto", whiteSpace: "pre-wrap" }}
                  disabled={readOnly || !(selectMode || textToolMode)}
                  onPointerDown={
                    textToolPassThrough
                      ? (e) => {
                          e.stopPropagation();
                          onBlockPointerDown(e, b);
                        }
                      : undefined
                  }
                  onClick={(e) => {
                    if (!selectMode && !textToolMode) return;
                    e.stopPropagation();
                    onSelectId(b.id);
                    setEditingTextId(b.id);
                  }}
                >
                  {segmentsPlainText(getTextSegments(b)).length === 0 ? (
                    "\u00a0"
                  ) : (
                    getTextSegments(b).map((seg, i) => {
                      const st = effectiveSegmentStyle(seg, b, pageBackgroundType);
                      return (
                        <span
                          key={i}
                          style={{
                            fontFamily: pageTextFontStack(st.fontFamily),
                            fontSize: st.fontSizePx,
                          }}
                        >
                          {seg.text}
                        </span>
                      );
                    })
                  )}
                </button>
              )}
              {selectMode && sel ? (
                <button
                  type="button"
                  data-resize-handle
                  aria-label="Resize"
                  title="Resize — hold Shift to turn off grid snap"
                  className="absolute bottom-0 right-0 z-[2] h-3 w-3 cursor-nwse-resize rounded-br-sm border-l border-t border-[color-mix(in_oklch,var(--accent)_40%,transparent)] bg-[color-mix(in_oklch,var(--paper)_70%,transparent)]"
                  style={{ pointerEvents: "auto" }}
                  onPointerDown={(e) => startResize(e, b)}
                />
              ) : null}
            </div>
          );
        }

        if (isPageRoughShapeBlock(b)) {
          const swPx = Math.min(16, Math.max(1, Math.round(b.strokeWidthPx ?? 2)));
          return (
            <div
              key={b.id}
              data-page-block-id={b.id}
              style={{ ...base, ...zStack }}
              className={`relative flex min-h-0 flex-col overflow-visible border-0 bg-transparent shadow-none ${
                sel ? "ring-1 ring-[var(--accent)]" : ""
              } ${selectMode ? "cursor-grab active:cursor-grabbing" : ""}`}
              onPointerDown={(e) => onBlockPointerDown(e, b)}
            >
              <div className="relative min-h-0 flex-1">
                <RoughRectCanvas
                  blockId={b.id}
                  stroke={b.stroke}
                  strokeWidthPx={swPx}
                  fill={b.fill}
                  fillStyle={b.fillStyle}
                  variant={b.kind}
                />
              </div>
              {selectMode && sel ? (
                <button
                  type="button"
                  data-resize-handle
                  aria-label="Resize"
                  title="Resize — hold Shift to turn off grid snap"
                  className="absolute bottom-0 right-0 z-[2] h-3 w-3 cursor-nwse-resize rounded-sm border border-[color-mix(in_oklch,var(--accent)_45%,transparent)] bg-[color-mix(in_oklch,var(--paper)_85%,transparent)] shadow-[0_0_0_1px_rgba(0,0,0,.06)]"
                  onPointerDown={(e) => startResize(e, b)}
                />
              ) : null}
            </div>
          );
        }

        if (b.kind === "youtube") {
          const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(b.videoId)}?rel=0`;
          return (
            <div
              key={b.id}
              data-page-block-id={b.id}
              style={{ ...base, ...zStack }}
              className={`flex flex-col overflow-hidden rounded-md border bg-[var(--paper)] shadow-[var(--shadow-1)] ${
                sel ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-[var(--chrome-b)]"
              }`}
              onPointerDown={(e) => onBlockPointerDown(e, b)}
            >
              {selectMode ? (
                <div
                  data-drag-handle
                  title="Drag — hold Shift to turn off grid snap"
                  className="flex h-7 shrink-0 cursor-grab items-center border-b border-[var(--chrome-b)] bg-[var(--paper-2)] px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-3)] active:cursor-grabbing"
                  onPointerDown={(e) => startMove(e, b)}
                >
                  YouTube
                </div>
              ) : null}
              <div className="relative min-h-0 flex-1 bg-black/5">
                <iframe
                  title="YouTube embed"
                  src={src}
                  className="h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ pointerEvents: selectMode && !dragging ? "auto" : "none" }}
                />
              </div>
              {selectMode && sel ? (
                <button
                  type="button"
                  data-resize-handle
                  aria-label="Resize"
                  title="Resize — hold Shift to turn off grid snap"
                  className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize rounded-br-md border-l border-t border-[var(--chrome-b)] bg-[var(--paper-2)]"
                  onPointerDown={(e) => startResize(e, b)}
                />
              ) : null}
            </div>
          );
        }

        return (
          <div
            key={b.id}
            data-page-block-id={b.id}
            style={{ ...base, ...zStack }}
            className={`relative flex flex-col overflow-hidden rounded-md border bg-[var(--paper)] shadow-[var(--shadow-1)] ${
              sel ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-[var(--chrome-b)]"
            }`}
            onPointerDown={(e) => onBlockPointerDown(e, b)}
          >
            {selectMode ? (
              <div
                data-drag-handle
                title="Drag — hold Shift to turn off grid snap"
                className="flex h-7 shrink-0 cursor-grab items-center border-b border-[var(--chrome-b)] bg-[var(--paper-2)] px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-3)] active:cursor-grabbing"
                onPointerDown={(e) => startMove(e, b)}
              >
                Image
              </div>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.src} alt="" className="h-full w-full object-contain" draggable={false} />
            {selectMode && sel ? (
              <button
                type="button"
                data-resize-handle
                aria-label="Resize"
                title="Resize — hold Shift to turn off grid snap"
                className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize rounded-br-md border-l border-t border-[var(--chrome-b)] bg-[var(--paper-2)]"
                onPointerDown={(e) => startResize(e, b)}
              />
            ) : null}
          </div>
        );
      })}
      {rectDrawMode && onShapeDrawCommit ? (
        <div
          key="__slate-shape-draw-plane__"
          className="absolute inset-0 z-[40] touch-none"
          style={{ pointerEvents: "auto", cursor: "crosshair" }}
          aria-hidden
          onPointerDown={handleShapeDrawPlanePointerDown}
        />
      ) : null}
      {rectDragDraft && rectDrawMode ? (
        <div
          className="pointer-events-none absolute z-[50]"
          style={blockFrameStyle(
            {
              kind: "rect",
              id: "__slate-rect-draft__",
              ...rectDragDraft,
              stroke: "#4f46e5",
              strokeWidthPx: 2,
            },
            layoutCoordSpace,
            sheetGeo.cw,
            sheetGeo.ch,
          )}
        >
          <RoughRectCanvas blockId="__slate-rect-draft__" stroke="#4f46e5" strokeWidthPx={2} variant={shapeDrawKind} />
        </div>
      ) : null}
    </div>
  );
}
