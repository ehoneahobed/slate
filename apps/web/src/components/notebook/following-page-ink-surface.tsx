"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { ChromeTool } from "@/components/editor/canvas-chrome-tool";
import { isDrawingTool } from "@/components/editor/canvas-chrome-tool";
import { LaserPointerLayer } from "@/components/editor/laser-pointer-layer";
import { PageBackground } from "@/components/ink/page-background";
import type { EditorTool } from "@/components/ink/stroke-canvas";
import { StrokeCanvas } from "@/components/ink/stroke-canvas";
import type { PageSizeId } from "@/lib/ink/page-size";
import { INFINITE_PAGE_MIN_HEIGHT, pageFrameStyle } from "@/lib/ink/page-size";
import { pageLayoutAspectRatio } from "@/lib/ink/world-coords";
import type { InkStroke } from "@/lib/ink/types";
import { duplicatePageBlock } from "@/lib/page-blocks/duplicate-block";
import {
  isPageRoughShapeBlock,
  PAGE_BLOCK_WORLD_UY_CEILING,
  type PageBlock,
  type PageBlockRoughShape,
  type PageRoughShapeKind,
} from "@/lib/page-blocks/types";
import { notebookTextContentInsetWorld } from "@/lib/page-blocks/text-typography";
import type { PageBlocksChangeOpts } from "@/components/page-content/page-blocks-layer";
import { PageBlocksLayer } from "@/components/page-content/page-blocks-layer";
import { savePageBlocksAction, savePageStrokesAction } from "@/app/dashboard/notebooks/[notebookId]/pages/[pageId]/actions";
import type { UiTheme } from "@/lib/user-settings";
import { useUiTheme } from "@/lib/ui-theme";

const RECT_FILL_HACHURE = "rgba(31, 28, 21, 0.12)";
const RECT_FILL_SOLID = "rgba(247, 245, 240, 0.96)";

function roughShapeFillToolbarMode(b: PageBlockRoughShape): "none" | "hachure" | "solid" {
  if (!b.fill) return "none";
  if (b.fillStyle === "solid") return "solid";
  return "hachure";
}

type HistorySnap = { strokes: InkStroke[]; blocks: PageBlock[] };

export type FollowingPageWriteApi = {
  blur: () => void;
  consumeKeydown: (e: KeyboardEvent) => boolean;
  undo: () => void;
  redo: () => void;
};

type MovePanProps = { onPanDelta: (dx: number, dy: number) => void };
function MovePanLayer({ onPanDelta }: MovePanProps) {
  const dragRef = useRef<{ pointerId: number; lx: number; ly: number } | null>(null);
  return (
    <div
      className="absolute inset-0 z-[50] cursor-grab touch-pan-y active:cursor-grabbing"
      aria-hidden
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        dragRef.current = { pointerId: e.pointerId, lx: e.clientX, ly: e.clientY };
      }}
      onPointerMove={(e) => {
        const d = dragRef.current;
        if (!d || d.pointerId !== e.pointerId) return;
        const dx = e.clientX - d.lx;
        const dy = e.clientY - d.ly;
        d.lx = e.clientX;
        d.ly = e.clientY;
        onPanDelta(dx, dy);
      }}
      onPointerUp={(e) => {
        const d = dragRef.current;
        if (!d || d.pointerId !== e.pointerId) return;
        try {
          (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        dragRef.current = null;
      }}
      onPointerCancel={(e) => {
        const d = dragRef.current;
        if (!d || d.pointerId !== e.pointerId) return;
        try {
          (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        dragRef.current = null;
      }}
    />
  );
}

export type FollowingPageInkSurfaceProps = {
  notebookId: string;
  pageId: string;
  title: string;
  sectionBreak: boolean;
  sectionTitle: string;
  initialBackground: string;
  initialStrokes: InkStroke[];
  initialBlocks: PageBlock[];
  pageSize: PageSizeId;
  chromeTool: ChromeTool;
  setChromeToolAndClearLaser: (t: ChromeTool) => void;
  shapeDrawKind: PageRoughShapeKind;
  color: string;
  penSize: number;
  readOnly: boolean;
  ssrUiTheme: UiTheme;
  /** Blur other sheets and set this page as the keyboard/undo target. */
  onFocusWritingSurface: (pageId: string) => void;
  registerApi: (pageId: string, api: FollowingPageWriteApi) => void;
  unregisterApi: (pageId: string) => void;
};

export function FollowingPageInkSurface({
  notebookId,
  pageId,
  title,
  sectionBreak,
  sectionTitle,
  initialBackground,
  initialStrokes,
  initialBlocks,
  pageSize,
  chromeTool,
  setChromeToolAndClearLaser,
  shapeDrawKind,
  color,
  penSize,
  readOnly,
  ssrUiTheme,
  onFocusWritingSurface,
  registerApi,
  unregisterApi,
}: FollowingPageInkSurfaceProps) {
    const router = useRouter();
    const uiTheme = useUiTheme(ssrUiTheme);
    const [pending, start] = useTransition();
    const [strokes, setStrokes] = useState(initialStrokes);
    const [blocks, setBlocks] = useState(initialBlocks);
    const [background] = useState(initialBackground);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [pendingTextEditId, setPendingTextEditId] = useState<string | null>(null);
    const [, setEditingTextBlockId] = useState<string | null>(null);
    const [laserNorm, setLaserNorm] = useState<{ x: number; y: number } | null>(null);
    const [blockDeleteArmedForId, setBlockDeleteArmedForId] = useState<string | null>(null);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    const inkRef = useRef<HTMLDivElement | null>(null);
    const saveTimer = useRef<number | undefined>(undefined);
    const blocksSaveTimer = useRef<number | undefined>(undefined);
    const pastRef = useRef<HistorySnap[]>([]);
    const futureRef = useRef<HistorySnap[]>([]);
    const strokesRef = useRef(strokes);
    const blocksRef = useRef(blocks);
    useLayoutEffect(() => {
      strokesRef.current = strokes;
      blocksRef.current = blocks;
    }, [strokes, blocks]);

    useEffect(() => {
      if (blockDeleteArmedForId == null) return;
      const t = window.setTimeout(() => setBlockDeleteArmedForId(null), 12_000);
      return () => window.clearTimeout(t);
    }, [blockDeleteArmedForId]);

    const pushHistory = useCallback(() => {
      pastRef.current.push({ strokes: strokesRef.current, blocks: blocksRef.current });
      if (pastRef.current.length > 40) pastRef.current.shift();
      futureRef.current = [];
      setCanUndo(pastRef.current.length > 0);
      setCanRedo(false);
    }, []);

    const scheduleSave = useCallback(
      (next: InkStroke[]) => {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => {
          start(async () => {
            try {
              await savePageStrokesAction(notebookId, pageId, next);
              router.refresh();
            } catch {
              /* ignore */
            }
          });
        }, 650);
      },
      [notebookId, pageId, router, start],
    );

    const scheduleBlocksSave = useCallback(
      (next: PageBlock[]) => {
        window.clearTimeout(blocksSaveTimer.current);
        blocksSaveTimer.current = window.setTimeout(() => {
          start(async () => {
            try {
              await savePageBlocksAction(notebookId, pageId, next);
              router.refresh();
            } catch {
              /* ignore */
            }
          });
        }, 650);
      },
      [notebookId, pageId, router, start],
    );

    const applyBlocks = useCallback(
      (next: PageBlock[], opts?: PageBlocksChangeOpts) => {
        if (opts?.recordHistory) pushHistory();
        setBlocks(next);
        scheduleBlocksSave(next);
      },
      [pushHistory, scheduleBlocksSave],
    );

    const syncSelectBlockId = useCallback((id: string | null) => {
      setBlockDeleteArmedForId((armed) => (armed != null && id !== armed ? null : armed));
      setSelectedBlockId(id);
    }, []);

    const onStrokesChange = useCallback(
      (next: InkStroke[]) => {
        if (readOnly) return;
        pushHistory();
        setStrokes(next);
        scheduleSave(next);
      },
      [readOnly, pushHistory, scheduleSave],
    );

    const undoLocal = useCallback(() => {
      if (!pastRef.current.length) return;
      const prev = pastRef.current.pop()!;
      futureRef.current.push({ strokes: strokesRef.current, blocks: blocksRef.current });
      window.clearTimeout(saveTimer.current);
      window.clearTimeout(blocksSaveTimer.current);
      setStrokes(prev.strokes);
      setBlocks(prev.blocks);
      setCanUndo(pastRef.current.length > 0);
      setCanRedo(futureRef.current.length > 0);
      start(async () => {
        try {
          await savePageStrokesAction(notebookId, pageId, prev.strokes);
          await savePageBlocksAction(notebookId, pageId, prev.blocks);
          router.refresh();
        } catch {
          /* ignore */
        }
      });
    }, [notebookId, pageId, router, start]);

    const redoLocal = useCallback(() => {
      if (!futureRef.current.length) return;
      const nxt = futureRef.current.pop()!;
      pastRef.current.push({ strokes: strokesRef.current, blocks: blocksRef.current });
      window.clearTimeout(saveTimer.current);
      window.clearTimeout(blocksSaveTimer.current);
      setStrokes(nxt.strokes);
      setBlocks(nxt.blocks);
      setCanUndo(pastRef.current.length > 0);
      setCanRedo(futureRef.current.length > 0);
      start(async () => {
        try {
          await savePageStrokesAction(notebookId, pageId, nxt.strokes);
          await savePageBlocksAction(notebookId, pageId, nxt.blocks);
          router.refresh();
        } catch {
          /* ignore */
        }
      });
    }, [notebookId, pageId, router, start]);

    const blur = useCallback(() => {
      setSelectedBlockId(null);
      setPendingTextEditId(null);
      setEditingTextBlockId(null);
      setBlockDeleteArmedForId(null);
      setLaserNorm(null);
    }, []);

    const duplicateSelectedBlock = useCallback(() => {
      if (!selectedBlockId) return;
      if (chromeTool !== "select" && chromeTool !== "text") return;
      const src = blocks.find((b) => b.id === selectedBlockId);
      if (!src) return;
      const dup = duplicatePageBlock(src);
      const idx = blocks.findIndex((b) => b.id === selectedBlockId);
      const next = [...blocks.slice(0, idx + 1), dup, ...blocks.slice(idx + 1)];
      applyBlocks(next, { recordHistory: true });
      syncSelectBlockId(dup.id);
    }, [selectedBlockId, chromeTool, blocks, applyBlocks, syncSelectBlockId]);

    const consumeKeydown = useCallback(
      (e: KeyboardEvent) => {
        if (readOnly) return false;
        if ((e.metaKey || e.ctrlKey) && (e.key === "d" || e.key === "D")) {
          if (!selectedBlockId || (chromeTool !== "select" && chromeTool !== "text")) return false;
          e.preventDefault();
          duplicateSelectedBlock();
          return true;
        }
        if (
          (e.key === "Delete" || e.key === "Backspace") &&
          (chromeTool === "select" || chromeTool === "text") &&
          selectedBlockId
        ) {
          e.preventDefault();
          if (blockDeleteArmedForId !== selectedBlockId) {
            setBlockDeleteArmedForId(selectedBlockId);
            return true;
          }
          const next = blocks.filter((b) => b.id !== selectedBlockId);
          syncSelectBlockId(null);
          applyBlocks(next, { recordHistory: true });
          return true;
        }
        if (e.key === "Enter" && !e.shiftKey && selectedBlockId) {
          const blk = blocks.find((x) => x.id === selectedBlockId);
          if (blk?.kind === "text") {
            e.preventDefault();
            setChromeToolAndClearLaser("select");
            setPendingTextEditId(selectedBlockId);
            return true;
          }
        }
        return false;
      },
      [
        readOnly,
        selectedBlockId,
        chromeTool,
        blocks,
        blockDeleteArmedForId,
        duplicateSelectedBlock,
        applyBlocks,
        syncSelectBlockId,
        setChromeToolAndClearLaser,
      ],
    );

    const apiImpl = useRef({
      blur,
      consumeKeydown,
      undo: undoLocal,
      redo: redoLocal,
    });

    useLayoutEffect(() => {
      apiImpl.current = { blur, consumeKeydown, undo: undoLocal, redo: redoLocal };
    });

    useEffect(() => {
      const api: FollowingPageWriteApi = {
        blur: () => apiImpl.current.blur(),
        consumeKeydown: (ev) => apiImpl.current.consumeKeydown(ev),
        undo: () => apiImpl.current.undo(),
        redo: () => apiImpl.current.redo(),
      };
      registerApi(pageId, api);
      return () => unregisterApi(pageId);
    }, [pageId, registerApi, unregisterApi]);

    const selectedRoughShapeBlock = useMemo((): PageBlockRoughShape | null => {
      if (!selectedBlockId) return null;
      const b = blocks.find((x) => x.id === selectedBlockId);
      return b && isPageRoughShapeBlock(b) ? b : null;
    }, [blocks, selectedBlockId]);

    const setSelectedRoughShapeFillMode = useCallback(
      (mode: "none" | "hachure" | "solid") => {
        if (!selectedBlockId) return;
        const next = blocks.map((b) => {
          if (b.id !== selectedBlockId || !isPageRoughShapeBlock(b)) return b;
          if (mode === "none") {
            const cleared = { ...b };
            delete cleared.fill;
            delete cleared.fillStyle;
            return cleared;
          }
          if (mode === "hachure") {
            return { ...b, fill: RECT_FILL_HACHURE, fillStyle: "hachure" as const };
          }
          return { ...b, fill: RECT_FILL_SOLID, fillStyle: "solid" as const };
        });
        applyBlocks(next, { recordHistory: true });
      },
      [selectedBlockId, blocks, applyBlocks],
    );

    const clearPendingTextEdit = useCallback(() => setPendingTextEditId(null), []);

    const placeTextBlockAt = useCallback(
      (nx: number, uy: number, source: "text-tool" | "select-dblclick") => {
        const id = crypto.randomUUID();
        const ink = inkRef.current;
        const ir = ink?.getBoundingClientRect();
        const aspect = ir && ir.width > 0 ? ir.height / ir.width : pageLayoutAspectRatio(pageSize);
        const sheetW = ir && ir.width > 0 ? ir.width : 0;
        const { dnx, duy } = sheetW > 0 ? notebookTextContentInsetWorld(background, sheetW) : { dnx: 0, duy: 0 };
        const wDefault = source === "text-tool" ? 0.32 : 0.42;
        const w = Math.min(0.94, Math.max(0.12, wDefault));
        const x = Math.min(1 - w, Math.max(0, nx - dnx));
        const h = (source === "text-tool" ? 0.1 : 0.14) * Math.max(aspect, 1e-6);
        const uyMaxDoc = Math.min(PAGE_BLOCK_WORLD_UY_CEILING, aspect);
        const y = Math.min(uyMaxDoc - h, Math.max(0, uy - duy));
        const next: PageBlock[] = [
          ...blocks,
          {
            kind: "text",
            id,
            x,
            y,
            w,
            h,
            text: "",
          },
        ];
        applyBlocks(next, { recordHistory: true });
        setChromeToolAndClearLaser(source === "text-tool" ? "text" : "select");
        syncSelectBlockId(id);
        setPendingTextEditId(id);
      },
      [blocks, applyBlocks, setChromeToolAndClearLaser, background, pageSize, syncSelectBlockId],
    );

    const commitShapeFromDrag = useCallback(
      (r: { x: number; y: number; w: number; h: number }, kind: PageRoughShapeKind) => {
        const id = crypto.randomUUID();
        const shape: PageBlockRoughShape =
          kind === "rect"
            ? { kind: "rect", id, x: r.x, y: r.y, w: r.w, h: r.h, stroke: color, strokeWidthPx: 2 }
            : kind === "ellipse"
              ? { kind: "ellipse", id, x: r.x, y: r.y, w: r.w, h: r.h, stroke: color, strokeWidthPx: 2 }
              : { kind: "diamond", id, x: r.x, y: r.y, w: r.w, h: r.h, stroke: color, strokeWidthPx: 2 };
        const next: PageBlock[] = [...blocks, shape];
        applyBlocks(next, { recordHistory: true });
        syncSelectBlockId(id);
      },
      [blocks, applyBlocks, color, syncSelectBlockId],
    );

    const drawingTool: EditorTool = isDrawingTool(chromeTool) ? chromeTool : "pen";
    const inkReadOnly = readOnly || !isDrawingTool(chromeTool);

    const onInkPointerMove = useCallback(
      (e: ReactPointerEvent<HTMLDivElement>) => {
        if (chromeTool !== "laser" || readOnly) return;
        const el = inkRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        setLaserNorm({
          x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
          y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
        });
      },
      [chromeTool, readOnly],
    );

    const onInkPointerLeave = useCallback(() => setLaserNorm(null), []);

    const applyPanDelta = useCallback((dx: number, dy: number) => {
      window.scrollBy({ left: -dx, top: -dy, behavior: "auto" });
    }, []);

    const isFullBleedInk = pageSize === "16_10" || pageSize === "a4" || pageSize === "letter";

    const inkLayers = (
      <>
        <PageBackground type={background} />
        <PageBlocksLayer
          blocks={blocks}
          onBlocksChange={applyBlocks}
          tool={chromeTool}
          readOnly={readOnly}
          selectedId={selectedBlockId}
          onSelectId={syncSelectBlockId}
          pendingTextEditId={pendingTextEditId}
          onPendingTextEditConsumed={clearPendingTextEdit}
          onRequestTextAt={readOnly ? undefined : placeTextBlockAt}
          pageBackgroundType={background}
          layoutCoordSpace="world-v2"
          onEditingTextIdChange={setEditingTextBlockId}
          onShapeDrawCommit={readOnly ? undefined : commitShapeFromDrag}
          shapeDrawKind={shapeDrawKind}
          sheetWorldRef={inkRef}
        />
        <StrokeCanvas
          strokes={strokes}
          onChange={onStrokesChange}
          tool={drawingTool}
          color={color}
          width={penSize}
          readOnly={inkReadOnly}
          coordSpace="world-v2"
          worldNormRootRef={inkRef}
          uiTheme={uiTheme}
        />
        <LaserPointerLayer active={chromeTool === "laser" && !readOnly} xNorm={laserNorm?.x ?? null} yNorm={laserNorm?.y ?? null} />
        {chromeTool === "move" && !readOnly ? <MovePanLayer onPanDelta={applyPanDelta} /> : null}
      </>
    );

    useEffect(
      () => () => {
        window.clearTimeout(saveTimer.current);
        window.clearTimeout(blocksSaveTimer.current);
      },
      [],
    );

    return (
      <article
        className="mx-auto max-w-[1180px] space-y-3 [content-visibility:auto] [contain-intrinsic-size:auto_880px]"
        data-following-page-id={pageId}
      >
        {sectionBreak ? (
          <div className="flex items-center gap-3 py-2" aria-label={`Section: ${sectionTitle}`}>
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--chrome-b)] to-transparent" />
            <span className="max-w-[min(100%,28rem)] shrink-0 rounded-full border border-[var(--chrome-b)] bg-[color-mix(in_oklch,var(--accent-soft)_55%,var(--paper))] px-3 py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-2)]">
              {sectionTitle}
            </span>
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--chrome-b)] to-transparent" />
          </div>
        ) : null}

        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[var(--chrome-b)] pb-2">
          <h2 className="min-w-0 truncate font-[family-name:var(--font-instrument-serif)] text-lg text-[var(--ink)]">{title}</h2>
          <Link
            href={`/dashboard/notebooks/${notebookId}/pages/${pageId}`}
            className="shrink-0 rounded-lg border border-[var(--chrome-b)] bg-[var(--paper-2)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-2)] hover:bg-[var(--chrome-2)]"
          >
            Open alone
          </Link>
        </div>

        <p className="text-[11px] leading-snug text-[var(--ink-4)]">
          Editable here — same pen, select, and text tools as the page above. Undo/redo applies to this page while it is focused (click/tap the sheet).
          {pending ? " Saving…" : ""}
        </p>

        {chromeTool === "select" && selectedRoughShapeBlock ? (
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--chrome-b)] bg-[color-mix(in_oklch,var(--chrome)_90%,transparent)] px-2 py-1.5 text-[10px]">
            <span className="font-bold uppercase text-[var(--ink-3)]">Shape</span>
            {(["none", "hachure", "solid"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={readOnly}
                onClick={() => setSelectedRoughShapeFillMode(mode)}
                className={`rounded px-1.5 py-0.5 font-semibold ${
                  roughShapeFillToolbarMode(selectedRoughShapeBlock) === mode
                    ? "bg-[var(--ink)] text-[var(--paper)]"
                    : "text-[var(--ink-2)] hover:bg-[var(--paper-2)]"
                }`}
              >
                {mode === "none" ? "Line" : mode === "hachure" ? "Hatch" : "Solid"}
              </button>
            ))}
          </div>
        ) : null}

        <div data-writing-surface="following" className="relative isolate touch-pan-y">
          <div
            data-slate-print-sheet
            className={`relative isolate w-full break-inside-avoid rounded-md bg-[var(--paper)] shadow-[var(--shadow-2)] ${
              pageSize === "infinite" ? "overflow-x-hidden overflow-y-visible min-h-0" : "overflow-hidden"
            }`}
            style={pageFrameStyle(pageSize)}
          >
            {isFullBleedInk ? (
              <div className="absolute inset-0 min-h-0 overflow-hidden">
                <div
                  ref={inkRef}
                  className="relative isolate h-full w-full overflow-hidden"
                  onPointerDownCapture={() => onFocusWritingSurface(pageId)}
                  onPointerMove={onInkPointerMove}
                  onPointerLeave={onInkPointerLeave}
                >
                  {inkLayers}
                </div>
              </div>
            ) : pageSize === "infinite" ? (
              <div
                ref={inkRef}
                className="relative isolate w-full overflow-hidden"
                style={{ minHeight: INFINITE_PAGE_MIN_HEIGHT }}
                onPointerDownCapture={() => onFocusWritingSurface(pageId)}
                onPointerMove={onInkPointerMove}
                onPointerLeave={onInkPointerLeave}
              >
                {inkLayers}
              </div>
            ) : null}
          </div>
        </div>

        <p className="text-[10px] text-[var(--ink-4)]">
          Local undo: {canUndo ? "⌘Z" : "—"} · redo: {canRedo ? "⌘⇧Z" : "—"}
        </p>
      </article>
    );
}
