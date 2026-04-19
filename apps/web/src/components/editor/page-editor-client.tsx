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
import { EditorToolbarDock } from "@/components/editor/editor-toolbar-dock";
import { InsertBlocksModal } from "@/components/editor/insert-blocks-modal";
import type { FollowingPageWriteApi } from "@/components/notebook/following-page-ink-surface";
import { NotebookFollowingPages } from "@/components/notebook/notebook-following-pages";
import { LaserPointerLayer } from "@/components/editor/laser-pointer-layer";
import { PageBackground } from "@/components/ink/page-background";
import type { EditorTool } from "@/components/ink/stroke-canvas";
import { StrokeCanvas } from "@/components/ink/stroke-canvas";
import { defaultPenStrokeColor, penSwatches, PEN_SIZES } from "@/lib/ink/editor-constants";
import type { UiTheme } from "@/lib/user-settings";
import { useUiTheme } from "@/lib/ui-theme";
import type { PageSizeId } from "@/lib/ink/page-size";
import {
  INFINITE_PAGE_MIN_HEIGHT,
  normalizePageSize,
  PAGE_SIZE_IDS,
  PAGE_SIZE_LABELS,
  pageFrameStyle,
} from "@/lib/ink/page-size";
import { pageLayoutAspectRatio } from "@/lib/ink/world-coords";
import type { InkStroke } from "@/lib/ink/types";
import { duplicatePageBlock } from "@/lib/page-blocks/duplicate-block";
import { buildPageFindMatches, type PageFindMatch } from "@/lib/page-blocks/page-find";
import {
  isPageRoughShapeBlock,
  PAGE_BLOCK_WORLD_UY_CEILING,
  type PageBlock,
  type PageBlockRoughShape,
  type PageRoughShapeKind,
  type PageTextFontId,
} from "@/lib/page-blocks/types";
import {
  defaultNotebookFontSizePx,
  notebookTextContentInsetWorld,
  NOTEBOOK_TEXT_SIZE_PRESETS,
} from "@/lib/page-blocks/text-typography";
import type { PageBlocksChangeOpts } from "@/components/page-content/page-blocks-layer";
import { PageBlocksLayer } from "@/components/page-content/page-blocks-layer";
import {
  createPageAction,
  createSectionAction,
  deletePageAction,
  reorderPageAction,
  savePageBlocksAction,
  savePageStrokesAction,
  updatePageMetaAction,
  updateSectionTitleAction,
} from "@/app/dashboard/notebooks/[notebookId]/pages/[pageId]/actions";
import type { FollowingSheetPayload } from "@/lib/notebook/following-sheets";
import type { OutlineSection } from "@/lib/notebook/outline";

/** Preset fills for rectangle blocks (Excalidrough hachure vs solid). */
const RECT_FILL_HACHURE = "rgba(31, 28, 21, 0.12)";
const RECT_FILL_SOLID = "rgba(247, 245, 240, 0.96)";

function roughShapeFillToolbarMode(b: PageBlockRoughShape): "none" | "hachure" | "solid" {
  if (!b.fill) return "none";
  if (b.fillStyle === "solid") return "solid";
  return "hachure";
}

/** Full-bleed overlay: drag to scroll the page (window or focus-mode scroll container). */
function MovePanLayer({ onPanDelta }: { onPanDelta: (dx: number, dy: number) => void }) {
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

type HistorySnap = { strokes: InkStroke[]; blocks: PageBlock[] };

type Props = {
  notebookId: string;
  notebookTitle: string;
  outline: OutlineSection[];
  pageId: string;
  sectionId: string;
  initialTitle: string;
  initialBackground: string;
  initialStrokes: InkStroke[];
  initialBlocks: PageBlock[];
  initialPageSize: string;
  /** When true, one-time save upgrades DB from legacy arrays to world-v2 envelopes. */
  needsPersistWorldMigration: boolean;
  /** Matches `html[data-theme]` from the server for ink defaults and swatches. */
  serverUiTheme: UiTheme;
  /** Read-only previews of later pages (vertical notebook flow). */
  followingSheets?: FollowingSheetPayload[];
  followingSheetsMoreCount?: number;
};

export function PageEditorClient({
  notebookId,
  notebookTitle,
  outline,
  pageId,
  sectionId,
  initialTitle,
  initialBackground,
  initialStrokes,
  initialBlocks,
  initialPageSize,
  needsPersistWorldMigration,
  serverUiTheme,
  followingSheets = [],
  followingSheetsMoreCount = 0,
}: Props) {
  const router = useRouter();
  const uiTheme = useUiTheme(serverUiTheme);
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(initialTitle);
  const [background, setBackground] = useState(initialBackground);
  const [strokes, setStrokes] = useState<InkStroke[]>(initialStrokes);
  const [blocks, setBlocks] = useState<PageBlock[]>(initialBlocks);
  const [pageSize, setPageSize] = useState<PageSizeId>(() => normalizePageSize(initialPageSize));
  const [chromeTool, setChromeTool] = useState<ChromeTool>("pen");
  const [shapeDrawKind, setShapeDrawKind] = useState<PageRoughShapeKind>("rect");
  const [color, setColor] = useState(() => defaultPenStrokeColor(serverUiTheme));
  const [penSize, setPenSize] = useState(2.5);
  const [focusMode, setFocusMode] = useState(false);
  const [studentPreview, setStudentPreview] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionTitleDraft, setSectionTitleDraft] = useState("");
  const [insertOpen, setInsertOpen] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [pendingTextEditId, setPendingTextEditId] = useState<string | null>(null);
  /** Which text block is in inline edit — keeps font-size toolbar visible while typing (selection can blur). */
  const [editingTextBlockId, setEditingTextBlockId] = useState<string | null>(null);
  const [laserNorm, setLaserNorm] = useState<{ x: number; y: number } | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findActiveIdx, setFindActiveIdx] = useState(0);
  /** Two-step delete page: 1 = first confirm, 2 = final confirm; null = closed. */
  const [deletePageStep, setDeletePageStep] = useState<1 | 2 | null>(null);
  /** Block id waiting for a second Delete/Backspace before removal. */
  const [blockDeleteArmedForId, setBlockDeleteArmedForId] = useState<string | null>(null);
  /** TOC sidebar: page id waiting for second click on trash before delete. */
  const [tocPageDeleteArmId, setTocPageDeleteArmId] = useState<string | null>(null);

  const saveTimer = useRef<number | undefined>(undefined);
  const blocksSaveTimer = useRef<number | undefined>(undefined);
  const sectionTitleInputRef = useRef<HTMLInputElement | null>(null);
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const inkRef = useRef<HTMLDivElement | null>(null);
  /** Focus mode: scroll container for Move tool panning; non-focus uses `window`. */
  const panScrollRef = useRef<HTMLDivElement | null>(null);
  const findMatchesRef = useRef<ReturnType<typeof buildPageFindMatches>>([]);
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

  useEffect(() => {
    if (tocPageDeleteArmId == null) return;
    const t = window.setTimeout(() => setTocPageDeleteArmId(null), 10_000);
    return () => window.clearTimeout(t);
  }, [tocPageDeleteArmId]);

  const totalNotebookPages = useMemo(() => outline.reduce((n, sec) => n + sec.pages.length, 0), [outline]);

  useLayoutEffect(() => {
    if (!needsPersistWorldMigration) return;
    const key = `slate:v2migrated:${pageId}`;
    try {
      if (typeof window !== "undefined" && window.sessionStorage.getItem(key)) return;
    } catch {
      /* private mode */
    }
    start(async () => {
      try {
        setSaveState("saving");
        await savePageStrokesAction(notebookId, pageId, strokesRef.current);
        await savePageBlocksAction(notebookId, pageId, blocksRef.current);
        try {
          window.sessionStorage.setItem(key, "1");
        } catch {
          /* ignore */
        }
        setSaveState("saved");
        router.refresh();
      } catch {
        setSaveState("error");
      }
    });
  }, [needsPersistWorldMigration, notebookId, pageId, router, start]);

  const pushHistory = useCallback(() => {
    pastRef.current.push({ strokes: strokesRef.current, blocks: blocksRef.current });
    if (pastRef.current.length > 80) pastRef.current.shift();
    futureRef.current = [];
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(false);
  }, []);

  const setChromeToolAndClearLaser = useCallback((next: ChromeTool) => {
    if (next !== "laser") setLaserNorm(null);
    if (next !== "select" && next !== "text") setBlockDeleteArmedForId(null);
    setChromeTool(next);
  }, []);

  /** Updates selection and clears block-delete arm when the selected id changes (avoids delete-on-first-key after re-select). */
  const syncSelectBlockId = useCallback((id: string | null) => {
    setBlockDeleteArmedForId((armed) => (armed != null && id !== armed ? null : armed));
    setSelectedBlockId(id);
  }, []);

  const [activeWritingPageId, setActiveWritingPageId] = useState(pageId);
  const followerWriteApisRef = useRef<Map<string, FollowingPageWriteApi>>(new Map());

  const focusWritingSurface = useCallback(
    (nextActiveId: string) => {
      if (nextActiveId === pageId) {
        followerWriteApisRef.current.forEach((api) => api.blur());
      } else {
        syncSelectBlockId(null);
        setPendingTextEditId(null);
        setEditingTextBlockId(null);
        setBlockDeleteArmedForId(null);
        setLaserNorm(null);
        followerWriteApisRef.current.forEach((api, id) => {
          if (id !== nextActiveId) api.blur();
        });
      }
      setActiveWritingPageId(nextActiveId);
    },
    [pageId, syncSelectBlockId],
  );

  const registerFollowerApi = useCallback((id: string, api: FollowingPageWriteApi) => {
    followerWriteApisRef.current.set(id, api);
  }, []);

  const unregisterFollowerApi = useCallback((id: string) => {
    followerWriteApisRef.current.delete(id);
  }, []);

  const scheduleSave = useCallback(
    (next: InkStroke[]) => {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        start(async () => {
          try {
            setSaveState("saving");
            await savePageStrokesAction(notebookId, pageId, next);
            setSaveState("saved");
            router.refresh();
          } catch {
            setSaveState("error");
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
            setSaveState("saving");
            await savePageBlocksAction(notebookId, pageId, next);
            setSaveState("saved");
            router.refresh();
          } catch {
            setSaveState("error");
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

  const onStrokesChange = useCallback(
    (next: InkStroke[]) => {
      if (studentPreview) return;
      pushHistory();
      setStrokes(next);
      scheduleSave(next);
    },
    [pushHistory, scheduleSave, studentPreview],
  );

  const undo = useCallback(() => {
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
        setSaveState("saving");
        await savePageStrokesAction(notebookId, pageId, prev.strokes);
        await savePageBlocksAction(notebookId, pageId, prev.blocks);
        setSaveState("saved");
        router.refresh();
      } catch {
        setSaveState("error");
      }
    });
  }, [notebookId, pageId, router, start]);

  const redo = useCallback(() => {
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
        setSaveState("saving");
        await savePageStrokesAction(notebookId, pageId, nxt.strokes);
        await savePageBlocksAction(notebookId, pageId, nxt.blocks);
        setSaveState("saved");
        router.refresh();
      } catch {
        setSaveState("error");
      }
    });
  }, [notebookId, pageId, router, start]);

  const runToolbarUndo = useCallback(() => {
    if (!studentPreview && activeWritingPageId !== pageId) {
      followerWriteApisRef.current.get(activeWritingPageId)?.undo();
      return;
    }
    undo();
  }, [studentPreview, activeWritingPageId, pageId, undo]);

  const runToolbarRedo = useCallback(() => {
    if (!studentPreview && activeWritingPageId !== pageId) {
      followerWriteApisRef.current.get(activeWritingPageId)?.redo();
      return;
    }
    redo();
  }, [studentPreview, activeWritingPageId, pageId, redo]);

  const dockCanUndo = activeWritingPageId === pageId ? canUndo : true;
  const dockCanRedo = activeWritingPageId === pageId ? canRedo : true;

  useEffect(
    () => () => {
      window.clearTimeout(saveTimer.current);
      window.clearTimeout(blocksSaveTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!editingSectionId) return;
    sectionTitleInputRef.current?.focus();
    sectionTitleInputRef.current?.select();
  }, [editingSectionId]);

  function commitSectionTitle(sectionId: string) {
    const sec = outline.find((s) => s.id === sectionId);
    if (!sec) {
      setEditingSectionId(null);
      return;
    }
    const trimmed = sectionTitleDraft.trim();
    if (!trimmed) {
      setSectionTitleDraft(sec.title);
      setEditingSectionId(null);
      return;
    }
    if (trimmed === sec.title) {
      setEditingSectionId(null);
      return;
    }
    setEditingSectionId(null);
    start(async () => {
      await updateSectionTitleAction(notebookId, sectionId, trimmed);
      router.refresh();
    });
  }

  function onTitleBlur() {
    const t = title.trim();
    if (!t || t === initialTitle) return;
    start(async () => {
      await updatePageMetaAction(notebookId, pageId, { title: t });
      router.refresh();
    });
  }

  const readOnly = studentPreview;
  const drawingTool: EditorTool = isDrawingTool(chromeTool) ? chromeTool : "pen";
  const inkReadOnly = readOnly || !isDrawingTool(chromeTool);

  const textBlockToolbar = useMemo(() => {
    if (readOnly) return null;
    if (chromeTool !== "select" && chromeTool !== "text") return null;
    const id = editingTextBlockId ?? selectedBlockId;
    if (!id) return null;
    const bl = blocks.find((x) => x.id === id);
    if (!bl || bl.kind !== "text") return null;
    const def = defaultNotebookFontSizePx(background);
    const ff: PageTextFontId = bl.fontFamily ?? "caveat";
    return { px: bl.fontSizePx ?? def, def, ff };
  }, [readOnly, chromeTool, blocks, editingTextBlockId, selectedBlockId, background]);

  const setSelectedTextFontSizePx = useCallback(
    (px: number) => {
      const id = editingTextBlockId ?? selectedBlockId;
      if (!id) return;
      const def = defaultNotebookFontSizePx(background);
      const n = Math.round(Math.min(96, Math.max(8, px)));
      const next = blocks.map((x) => {
        if (x.id !== id || x.kind !== "text") return x;
        return { ...x, fontSizePx: n === def ? undefined : n };
      });
      applyBlocks(next, { recordHistory: true });
    },
    [editingTextBlockId, selectedBlockId, blocks, background, applyBlocks],
  );

  const setSelectedTextFontFamily = useCallback(
    (fontFamily: PageTextFontId) => {
      const id = editingTextBlockId ?? selectedBlockId;
      if (!id) return;
      const next = blocks.map((x) => {
        if (x.id !== id || x.kind !== "text") return x;
        return { ...x, fontFamily: fontFamily === "caveat" ? undefined : fontFamily };
      });
      applyBlocks(next, { recordHistory: true });
    },
    [editingTextBlockId, selectedBlockId, blocks, applyBlocks],
  );

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

  const findMatches = useMemo(() => buildPageFindMatches(title, blocks, findQuery), [title, blocks, findQuery]);

  useEffect(() => {
    findMatchesRef.current = findMatches;
  }, [findMatches]);

  const scrollToFindMatch = useCallback(
    (m: PageFindMatch) => {
      if (m.target === "title") {
        document.querySelector('[data-page-find="title"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      setChromeToolAndClearLaser("select");
      syncSelectBlockId(m.blockId);
      requestAnimationFrame(() => {
        const id = m.blockId;
        const sel =
          typeof CSS !== "undefined" && "escape" in CSS
            ? `[data-page-block-id="${CSS.escape(id)}"]`
            : `[data-page-block-id="${id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
        document.querySelector(sel)?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    },
    [setChromeToolAndClearLaser, syncSelectBlockId],
  );

  const goFindRelative = useCallback(
    (delta: number) => {
      const list = findMatchesRef.current;
      if (!list.length) return;
      setFindActiveIdx((i) => {
        const n = (i + delta + list.length) % list.length;
        queueMicrotask(() => scrollToFindMatch(list[n]));
        return n;
      });
    },
    [scrollToFindMatch],
  );

  useLayoutEffect(() => {
    if (!findOpen) return;
    findInputRef.current?.focus({ preventScroll: true });
  }, [findOpen]);

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

  const clearPendingTextEdit = useCallback(() => setPendingTextEditId(null), []);

  const addTextBlock = useCallback(() => {
    const id = crypto.randomUUID();
    const n = blocks.length;
    const aspect = pageLayoutAspectRatio(pageSize);
    const RIGHT = 0.055;
    const leftPad =
      background === "ruled" || background === "cornell" ? 0.1 : background === "grid" ? 0.07 : 0.05;
    const x = Math.min(1 - RIGHT - 0.28, leftPad + (n % 5) * 0.035);
    const w = Math.min(0.94, 1 - x - RIGHT);
    const h = 0.12 * aspect;
    const y0 = Math.min(aspect - h, (0.1 + (n % 6) * 0.05) * aspect);
    const next: PageBlock[] = [
      ...blocks,
      {
        kind: "text",
        id,
        x,
        y: y0,
        w,
        h,
        text: "Notes…",
      },
    ];
    applyBlocks(next, { recordHistory: true });
    setChromeToolAndClearLaser("select");
    syncSelectBlockId(id);
    setPendingTextEditId(id);
  }, [blocks, applyBlocks, setChromeToolAndClearLaser, background, pageSize, syncSelectBlockId]);

  /** Click / double-click empty page — place a text block (Text tool keeps Text active). */
  const placeTextBlockAt = useCallback(
    (nx: number, uy: number, source: "text-tool" | "select-dblclick") => {
      const id = crypto.randomUUID();
      const ink = inkRef.current;
      const ir = ink?.getBoundingClientRect();
      const aspect = ir && ir.width > 0 ? ir.height / ir.width : pageLayoutAspectRatio(pageSize);
      const sheetW = ir && ir.width > 0 ? ir.width : 0;
      /** Frame is inset so the padded content area (caret) sits on the click — `notebookTextPadding` lives inside the block. */
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

  function addYoutubeBlock(videoId: string) {
    const id = crypto.randomUUID();
    const n = blocks.length;
    const aspect = pageLayoutAspectRatio(pageSize);
    const yLeg = Math.min(0.5, 0.12 + (n % 5) * 0.04);
    const next: PageBlock[] = [
      ...blocks,
      {
        kind: "youtube",
        id,
        x: Math.min(0.45, 0.1 + (n % 4) * 0.04),
        y: yLeg * aspect,
        w: 0.48,
        h: 0.36 * aspect,
        videoId,
      },
    ];
    applyBlocks(next, { recordHistory: true });
    setChromeToolAndClearLaser("select");
    syncSelectBlockId(id);
  }

  function addImageBlock(src: string) {
    const id = crypto.randomUUID();
    const n = blocks.length;
    const aspect = pageLayoutAspectRatio(pageSize);
    const yLeg = Math.min(0.65, 0.1 + (n % 5) * 0.05);
    const next: PageBlock[] = [
      ...blocks,
      {
        kind: "image",
        id,
        x: Math.min(0.5, 0.08 + (n % 4) * 0.05),
        y: yLeg * aspect,
        w: 0.4,
        h: 0.28 * aspect,
        src,
      },
    ];
    applyBlocks(next, { recordHistory: true });
    setChromeToolAndClearLaser("select");
    syncSelectBlockId(id);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? "";
      const inFindBar = Boolean(target?.closest("[data-page-find-bar]"));

      if (deletePageStep !== null) {
        if (e.key === "Escape") {
          e.preventDefault();
          setDeletePageStep(null);
        }
        return;
      }

      if (findOpen && e.key === "Escape") {
        e.preventDefault();
        setFindOpen(false);
        return;
      }

      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        if (!inFindBar) return;
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        setFindOpen((v) => !v);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (activeWritingPageId !== pageId) {
          const api = followerWriteApisRef.current.get(activeWritingPageId);
          if (api) {
            if (e.shiftKey) api.redo();
            else api.undo();
          }
          return;
        }
        if (e.shiftKey) redo();
        else undo();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === "d" || e.key === "D")) {
        if (readOnly) return;
        if (activeWritingPageId !== pageId) {
          const api = followerWriteApisRef.current.get(activeWritingPageId);
          if (api?.consumeKeydown(e)) return;
        }
        if (!selectedBlockId || (chromeTool !== "select" && chromeTool !== "text")) return;
        e.preventDefault();
        duplicateSelectedBlock();
        return;
      }

      if (findOpen && e.key === "F3") {
        e.preventDefault();
        goFindRelative(e.shiftKey ? -1 : 1);
        return;
      }

      if ((e.key === "f" || e.key === "F") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setFocusMode((m) => !m);
      }
      if (e.key === "Escape" && focusMode) {
        setFocusMode(false);
      }

      if (e.key === "/" && !readOnly && !focusMode) {
        e.preventDefault();
        setInsertOpen(true);
        return;
      }

      if (readOnly) return;

      if (e.key === "Enter" && !e.shiftKey) {
        if (activeWritingPageId !== pageId) {
          const api = followerWriteApisRef.current.get(activeWritingPageId);
          if (api?.consumeKeydown(e)) return;
        }
        if (selectedBlockId) {
          const blk = blocks.find((x) => x.id === selectedBlockId);
          if (blk?.kind === "text") {
            e.preventDefault();
            setChromeToolAndClearLaser("select");
            setPendingTextEditId(selectedBlockId);
            return;
          }
        }
      }

      if ((e.key === "t" || e.key === "T") && !focusMode) {
        e.preventDefault();
        setChromeToolAndClearLaser("text");
        return;
      }

      if (e.key === "Escape" && chromeTool === "text") {
        e.preventDefault();
        setChromeToolAndClearLaser("pen");
        return;
      }

      if (e.key === "Escape" && chromeTool === "shapes") {
        e.preventDefault();
        setChromeToolAndClearLaser("select");
        return;
      }

      if (e.key === "p" || e.key === "P") setChromeToolAndClearLaser("pen");
      if (e.key === "h" || e.key === "H") setChromeToolAndClearLaser("hl");
      if (e.key === "e" || e.key === "E") setChromeToolAndClearLaser("eraser");
      if (e.key === "x" || e.key === "X") setChromeToolAndClearLaser("laser");
      if (e.key === "m" || e.key === "M") setChromeToolAndClearLaser("select");
      if (e.key === "v" || e.key === "V") setChromeToolAndClearLaser("move");

      if ((e.key === "Delete" || e.key === "Backspace") && (chromeTool === "select" || chromeTool === "text")) {
        if (activeWritingPageId !== pageId) {
          const api = followerWriteApisRef.current.get(activeWritingPageId);
          if (api?.consumeKeydown(e)) return;
        }
        if (selectedBlockId) {
          e.preventDefault();
          if (blockDeleteArmedForId !== selectedBlockId) {
            setBlockDeleteArmedForId(selectedBlockId);
            return;
          }
          const next = blocks.filter((b) => b.id !== selectedBlockId);
          syncSelectBlockId(null);
          applyBlocks(next, { recordHistory: true });
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    readOnly,
    focusMode,
    findOpen,
    undo,
    redo,
    chromeTool,
    selectedBlockId,
    blocks,
    applyBlocks,
    setChromeToolAndClearLaser,
    duplicateSelectedBlock,
    goFindRelative,
    deletePageStep,
    blockDeleteArmedForId,
    syncSelectBlockId,
    activeWritingPageId,
    pageId,
  ]);

  const spineTitle = notebookTitle.trim() || "Notebook";
  /** Ink + blocks fill the whole trim sheet (not a letterboxed 16:10 island). */
  const isFullBleedInk = pageSize === "16_10" || pageSize === "a4" || pageSize === "letter";

  const applyPanDelta = useCallback((dx: number, dy: number) => {
    if (focusMode) {
      const el = panScrollRef.current;
      if (el) {
        el.scrollLeft -= dx;
        el.scrollTop -= dy;
      }
    } else {
      window.scrollBy({ left: -dx, top: -dy, behavior: "auto" });
    }
  }, [focusMode]);

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

  return (
    <div
      className={
        focusMode
          ? "fixed inset-0 z-40 flex min-h-0 flex-col overflow-hidden bg-[var(--bg)] print:static print:inset-auto print:z-auto print:min-h-0 print:overflow-visible print:bg-white"
          : "space-y-4 print:space-y-2"
      }
    >
      <InsertBlocksModal
        open={insertOpen}
        onClose={() => setInsertOpen(false)}
        onAddText={addTextBlock}
        onAddYoutube={addYoutubeBlock}
        onAddImage={addImageBlock}
        onAddRoughShape={(kind) => {
          setShapeDrawKind(kind);
          setInsertOpen(false);
          setChromeToolAndClearLaser("shapes");
        }}
      />

      {deletePageStep !== null ? (
        <div
          role="presentation"
          className="fixed inset-0 z-[100] grid place-items-center bg-[color-mix(in_oklch,var(--ink)_32%,transparent)] p-6 backdrop-blur-[4px]"
          onClick={() => setDeletePageStep(null)}
        >
          <div
            role="dialog"
            aria-modal
            aria-labelledby="delete-page-dialog-title"
            className="w-full max-w-md rounded-2xl border border-[var(--chrome-b)] bg-[var(--paper)] p-5 shadow-[var(--shadow-3)]"
            onClick={(ev) => ev.stopPropagation()}
          >
            {deletePageStep === 1 ? (
              <>
                <h2 id="delete-page-dialog-title" className="font-[family-name:var(--font-instrument-serif)] text-xl text-[var(--ink)]">
                  Delete this page?
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-3)]">
                  This removes the page from the notebook, including its ink and blocks. You can still undo in-editor changes with Undo until you leave
                  the page; deleting the page itself is permanent on the server.
                </p>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] px-3 py-2 text-xs font-semibold text-[var(--ink-2)]"
                    onClick={() => setDeletePageStep(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-[var(--ink)] px-3 py-2 text-xs font-semibold text-[var(--paper)]"
                    onClick={() => setDeletePageStep(2)}
                  >
                    Continue
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="delete-page-dialog-title" className="font-[family-name:var(--font-instrument-serif)] text-xl text-[var(--danger)]">
                  Delete permanently
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-3)]">
                  Last step: confirm that you want to delete this page. This cannot be undone.
                </p>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] px-3 py-2 text-xs font-semibold text-[var(--ink-2)]"
                    onClick={() => setDeletePageStep(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded-lg border border-[color-mix(in_oklch,var(--danger)_40%,transparent)] bg-[color-mix(in_oklch,var(--danger)_12%,var(--paper))] px-3 py-2 text-xs font-semibold text-[var(--danger)] disabled:opacity-50"
                    onClick={() =>
                      start(async () => {
                        setDeletePageStep(null);
                        await deletePageAction(notebookId, pageId);
                        router.push(`/dashboard/notebooks/${notebookId}`);
                      })
                    }
                  >
                    Delete page forever
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {!focusMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm print:hidden">
          <div className="flex flex-wrap items-center gap-2 text-[var(--ink-3)]">
            <Link className="hover:underline" href="/dashboard">
              Dashboard
            </Link>
            <span>/</span>
            <Link className="max-w-[14rem] truncate hover:underline" href={`/dashboard/notebooks/${notebookId}`} title={spineTitle}>
              {spineTitle}
            </Link>
            <span>/</span>
            <span className="text-[var(--ink)]">Page</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--ink-4)]">
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : ""}
            </span>
            <button
              type="button"
              className="rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] px-3 py-1.5 text-xs font-semibold"
              onClick={() => setFindOpen((v) => !v)}
              title="Find on this page (⌘F / Ctrl+F)"
            >
              Find
            </button>
            <button
              type="button"
              className="rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] px-3 py-1.5 text-xs font-semibold"
              onClick={() => window.print()}
              title="Open the print dialog — choose “Save as PDF” to export"
            >
              Print / PDF
            </button>
            <button
              type="button"
              className="rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] px-3 py-1.5 text-xs font-semibold"
              onClick={() => setFocusMode((v) => !v)}
              title="Toggle focus (F)"
            >
              {focusMode ? "Exit focus" : "Focus (F)"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] px-3 py-1.5 text-xs font-semibold"
              onClick={() => setStudentPreview((v) => !v)}
            >
              {studentPreview ? "Exit student preview" : "Student preview"}
            </button>
          </div>
        </div>
      )}

      {focusMode && (
        <div className="flex shrink-0 items-center justify-end gap-2 border-b border-[var(--chrome-b)] px-4 py-2 print:hidden">
          <button
            type="button"
            className="rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] px-3 py-1.5 text-xs font-semibold"
            onClick={() => setFindOpen((v) => !v)}
            title="Find on this page (⌘F / Ctrl+F)"
          >
            Find
          </button>
          <button
            type="button"
            className="rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] px-3 py-1.5 text-xs font-semibold"
            onClick={() => window.print()}
            title="Open the print dialog — choose “Save as PDF” to export"
          >
            Print / PDF
          </button>
          <button
            type="button"
            className="rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] px-3 py-1.5 text-xs font-semibold"
            onClick={() => setFocusMode(false)}
          >
            Exit focus
          </button>
        </div>
      )}

      <div
        ref={panScrollRef}
        className={
          focusMode
            ? "min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain p-4 print:overflow-visible print:p-0"
            : "grid gap-6 lg:grid-cols-[minmax(260px,0.34fr)_minmax(0,1fr)_260px] lg:items-start print:grid-cols-1 print:gap-0"
        }
      >
        {!focusMode && (
          <aside className="sticky top-20 z-10 flex max-h-[calc(100vh-8rem)] min-h-0 flex-col gap-3 self-start overflow-hidden rounded-[var(--r-lg)] border border-[var(--rule)] bg-[var(--paper)] p-3 text-sm lg:top-24 lg:max-h-[calc(100vh-10rem)] print:hidden">
            <div className="shrink-0 text-xs font-bold uppercase tracking-wide text-[var(--ink-3)]">Sections & pages</div>
            <div className="min-h-0 flex-1 touch-pan-y space-y-4 overflow-y-auto overscroll-y-contain pr-1">
              {outline.map((sec) => {
                const nav = [...sec.pages].sort((a, b) => a.position - b.position);
                const isCurrentSection = sec.id === sectionId;
                return (
                  <div key={sec.id} className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      {editingSectionId === sec.id ? (
                        <input
                          ref={sectionTitleInputRef}
                          value={sectionTitleDraft}
                          onChange={(e) => setSectionTitleDraft(e.target.value)}
                          onBlur={() => commitSectionTitle(sec.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setEditingSectionId(null);
                              setSectionTitleDraft(sec.title);
                            }
                            if (e.key === "Enter") {
                              e.preventDefault();
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="min-w-0 flex-1 rounded border border-[var(--chrome-b)] bg-[var(--paper)] px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--ink)] outline-none focus:border-[var(--ink)]"
                          aria-label="Section title"
                        />
                      ) : (
                        <div
                          className={`min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide ${
                            isCurrentSection ? "text-[var(--ink)]" : "text-[var(--ink-3)]"
                          }`}
                          title={sec.title}
                        >
                          <span className="line-clamp-2">{sec.title}</span>
                        </div>
                      )}
                      <div className="flex shrink-0 items-start gap-1">
                        {editingSectionId !== sec.id && (
                          <button
                            type="button"
                            disabled={pending}
                            className="rounded border border-[var(--chrome-b)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--ink-3)] hover:bg-[var(--paper-2)] disabled:opacity-50"
                            title="Rename section"
                            aria-label="Rename section"
                            onClick={() => {
                              setEditingSectionId(sec.id);
                              setSectionTitleDraft(sec.title);
                            }}
                          >
                            Edit
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={pending}
                          className="rounded border border-[var(--chrome-b)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--ink-2)] hover:bg-[var(--paper-2)] disabled:opacity-50"
                          title="Add page in this section"
                          onClick={() =>
                            start(async () => {
                              const { pageId: nid } = await createPageAction(notebookId, sec.id);
                              router.push(`/dashboard/notebooks/${notebookId}/pages/${nid}`);
                            })
                          }
                        >
                          + page
                        </button>
                      </div>
                    </div>
                    {nav.length === 0 ? (
                      <p className="pl-1 text-xs text-[var(--ink-4)]">No pages yet.</p>
                    ) : (
                      <ul className="space-y-0.5 border-l border-[var(--chrome-b)] pl-2">
                        {nav.map((p) => (
                          <li key={p.id} className="flex items-center gap-0.5">
                            <Link
                              className={`min-w-0 flex-1 truncate rounded-md px-2 py-1 text-[13px] hover:bg-[var(--paper-2)] ${
                                p.id === pageId ? "bg-[var(--accent-soft)] font-semibold text-[var(--ink)]" : "text-[var(--ink-2)]"
                              }`}
                              href={`/dashboard/notebooks/${notebookId}/pages/${p.id}`}
                            >
                              {p.title}
                            </Link>
                            {!readOnly ? (
                              <button
                                type="button"
                                title={
                                  totalNotebookPages <= 1
                                    ? "Cannot delete the only page in this notebook"
                                    : tocPageDeleteArmId === p.id
                                      ? "Click again to delete"
                                      : "Delete page"
                                }
                                disabled={pending || totalNotebookPages <= 1}
                                aria-label={tocPageDeleteArmId === p.id ? "Confirm delete page" : "Delete page"}
                                className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border border-transparent text-[var(--ink-3)] hover:border-[var(--chrome-b)] hover:bg-[var(--paper-2)] hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-40 ${
                                  tocPageDeleteArmId === p.id ? "border-[color-mix(in_oklch,var(--danger)_45%,transparent)] bg-[color-mix(in_oklch,var(--danger)_10%,var(--paper))] text-[var(--danger)]" : ""
                                }`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (totalNotebookPages <= 1) return;
                                  if (tocPageDeleteArmId !== p.id) {
                                    setTocPageDeleteArmId(p.id);
                                    return;
                                  }
                                  setTocPageDeleteArmId(null);
                                  start(async () => {
                                    await deletePageAction(notebookId, p.id);
                                    if (p.id === pageId) {
                                      router.push(`/dashboard/notebooks/${notebookId}`);
                                    } else {
                                      router.refresh();
                                    }
                                  });
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
                                  <path d="M5 6.5h10" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
                                  <path
                                    d="M8 6.5V5h4v1.5"
                                    stroke="currentColor"
                                    strokeWidth="1.25"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d="M6.5 8.5l1 7h5l1-7"
                                    stroke="currentColor"
                                    strokeWidth="1.25"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="shrink-0 flex flex-col gap-2 border-t border-[var(--chrome-b)] pt-3">
              <button
                type="button"
                disabled={pending}
                className="rounded-md border border-[var(--chrome-b)] px-3 py-2 text-xs font-semibold text-[var(--ink-2)] disabled:opacity-50"
                onClick={() =>
                  start(async () => {
                    await createSectionAction(notebookId);
                    router.refresh();
                  })
                }
              >
                New section
              </button>
              <button
                type="button"
                disabled={pending}
                className="rounded-md bg-[var(--ink)] px-3 py-2 text-xs font-semibold text-[var(--paper)] disabled:opacity-50"
                onClick={() =>
                  start(async () => {
                    const { pageId: nid } = await createPageAction(notebookId, sectionId);
                    router.push(`/dashboard/notebooks/${notebookId}/pages/${nid}`);
                  })
                }
              >
                New page (here)
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  className="flex-1 rounded-md border border-[var(--chrome-b)] px-2 py-1 text-xs"
                  onClick={() => start(async () => reorderPageAction(notebookId, pageId, "up"))}
                >
                  Move ↑
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="flex-1 rounded-md border border-[var(--chrome-b)] px-2 py-1 text-xs"
                  onClick={() => start(async () => reorderPageAction(notebookId, pageId, "down"))}
                >
                  Move ↓
                </button>
              </div>
              <button
                type="button"
                disabled={pending}
                className="rounded-md border border-[color-mix(in_oklch,var(--danger)_35%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--danger)]"
                onClick={() => setDeletePageStep(1)}
              >
                Delete page…
              </button>
            </div>
          </aside>
        )}

        <div
          className={`space-y-3 print:max-w-none print:space-y-2 ${focusMode ? "mx-auto w-full max-w-[1180px] print:mx-0 print:w-full print:max-w-none" : ""}`}
        >
          {focusMode ? (
            <div data-page-find="title" className="sr-only" aria-hidden>
              {title}
            </div>
          ) : null}
          {!focusMode && (
            <div data-page-find="title">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => void onTitleBlur()}
                className="w-full max-w-2xl rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] px-3 py-2 text-lg font-[family-name:var(--font-instrument-serif)] text-[var(--ink)] outline-none focus:border-[var(--ink)] print:hidden"
              />
              <h1 className="hidden max-w-2xl text-lg font-[family-name:var(--font-instrument-serif)] leading-snug text-[var(--ink)] print:block">
                {title}
              </h1>
            </div>
          )}

          {findOpen && (
            <div
              data-page-find-bar
              role="search"
              className="sticky top-2 z-[35] rounded-xl border border-[var(--chrome-b)] bg-[color-mix(in_oklch,var(--chrome)_94%,transparent)] p-2 shadow-[var(--shadow-2)] backdrop-blur print:hidden"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Find</span>
                <input
                  ref={findInputRef}
                  type="search"
                  value={findQuery}
                  onChange={(e) => {
                    setFindQuery(e.target.value);
                    setFindActiveIdx(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const m = findMatches[findActiveIdx];
                      if (m) scrollToFindMatch(m);
                    }
                  }}
                  placeholder="Title or handwriting…"
                  className="min-w-[10rem] flex-1 rounded-md border border-[var(--chrome-b)] bg-[var(--paper)] px-2 py-1 text-xs outline-none focus:border-[var(--ink)]"
                  aria-label="Find on page"
                />
                <span className="shrink-0 tabular-nums text-[11px] text-[var(--ink-3)]">
                  {findMatches.length ? `${findActiveIdx + 1} / ${findMatches.length}` : "0"}
                </span>
                <button
                  type="button"
                  className="shrink-0 rounded-md border border-[var(--chrome-b)] bg-[var(--paper)] px-2 py-1 text-[11px] font-semibold text-[var(--ink-2)] disabled:opacity-40"
                  disabled={!findMatches.length}
                  aria-label="Previous match"
                  onClick={() => goFindRelative(-1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded-md border border-[var(--chrome-b)] bg-[var(--paper)] px-2 py-1 text-[11px] font-semibold text-[var(--ink-2)] disabled:opacity-40"
                  disabled={!findMatches.length}
                  aria-label="Next match"
                  onClick={() => goFindRelative(1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded-md border border-[var(--chrome-b)] bg-[var(--paper)] px-2 py-1 text-[10px] font-semibold text-[var(--ink-2)]"
                  onClick={() => setFindOpen(false)}
                >
                  Close
                </button>
              </div>
              {findMatches[findActiveIdx]?.target === "block" ? (
                <p className="mt-1 truncate text-[11px] leading-snug text-[var(--ink-3)]">
                  {(findMatches[findActiveIdx] as Extract<PageFindMatch, { target: "block" }>).snippet}
                </p>
              ) : findMatches[findActiveIdx]?.target === "title" ? (
                <p className="mt-1 text-[11px] text-[var(--ink-3)]">Page title</p>
              ) : null}
            </div>
          )}

          {!readOnly &&
          blockDeleteArmedForId &&
          selectedBlockId === blockDeleteArmedForId &&
          (chromeTool === "select" || chromeTool === "text") ? (
            <div
              role="status"
              className="sticky top-2 z-[36] rounded-xl border border-[color-mix(in_oklch,var(--danger)_28%,var(--chrome-b))] bg-[color-mix(in_oklch,var(--danger)_8%,var(--paper))] px-3 py-2 text-[12px] leading-snug text-[var(--ink-2)] shadow-[var(--shadow-2)] print:hidden"
            >
              <span className="font-semibold text-[var(--danger)]">Remove block:</span> press{" "}
              <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper-2)] px-1 font-mono text-[10px]">Delete</kbd> or{" "}
              <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper-2)] px-1 font-mono text-[10px]">Backspace</kbd> again within 12
              seconds, or change selection to cancel.
            </div>
          ) : null}

          {studentPreview && (
            <div className="flex items-center gap-2 rounded-full border border-[var(--chrome-b)] bg-[var(--paper-2)] px-3 py-2 text-xs text-[var(--ink-2)] print:hidden">
              Student preview — ink and blocks are read-only (private annotations ship in a later phase).
            </div>
          )}

          <div className="relative mx-auto w-full max-w-[1180px] print:mx-0 print:max-w-none">
            {!readOnly && (
              <div className="pointer-events-none fixed left-3 top-1/2 z-[45] hidden -translate-y-1/2 lg:block print:hidden">
                <EditorToolbarDock
                  tool={chromeTool}
                  onToolChange={setChromeToolAndClearLaser}
                  color={color}
                  onColorChange={setColor}
                  penSize={penSize}
                  onPenSizeChange={setPenSize}
                  onUndo={runToolbarUndo}
                  onRedo={runToolbarRedo}
                  canUndo={dockCanUndo}
                  canRedo={dockCanRedo}
                  onInsert={() => setInsertOpen(true)}
                  readOnly={readOnly}
                  textFontSizePx={textBlockToolbar?.px}
                  onTextFontSizePxChange={textBlockToolbar ? setSelectedTextFontSizePx : undefined}
                  textFontFamily={textBlockToolbar?.ff}
                  onTextFontFamilyChange={textBlockToolbar ? setSelectedTextFontFamily : undefined}
                  shapeDrawKind={shapeDrawKind}
                  onShapeDrawKindChange={setShapeDrawKind}
                  ssrUiTheme={serverUiTheme}
                />
              </div>
            )}
            <div
              data-slate-print-sheet
              className={`relative isolate w-full break-inside-avoid rounded-md bg-[var(--paper)] shadow-[var(--shadow-2)] print:rounded-sm print:shadow-none print:break-inside-avoid ${
                pageSize === "infinite" ? "overflow-x-hidden overflow-y-visible min-h-0" : "overflow-hidden"
              }`}
              style={pageFrameStyle(pageSize)}
            >
              {isFullBleedInk ? (
                <div className="absolute inset-0 min-h-0 overflow-hidden">
                  <div
                    ref={inkRef}
                    className="relative isolate h-full w-full overflow-hidden"
                    onPointerDownCapture={() => focusWritingSurface(pageId)}
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
                  onPointerDownCapture={() => focusWritingSurface(pageId)}
                  onPointerMove={onInkPointerMove}
                  onPointerLeave={onInkPointerLeave}
                >
                  {inkLayers}
                </div>
              ) : null}
            </div>
            {!focusMode && (followingSheets.length > 0 || followingSheetsMoreCount > 0) ? (
              <NotebookFollowingPages
                notebookId={notebookId}
                sheets={followingSheets}
                moreCount={followingSheetsMoreCount}
                chromeTool={chromeTool}
                setChromeToolAndClearLaser={setChromeToolAndClearLaser}
                shapeDrawKind={shapeDrawKind}
                color={color}
                penSize={penSize}
                readOnly={readOnly}
                serverUiTheme={serverUiTheme}
                registerFollowerApi={registerFollowerApi}
                unregisterFollowerApi={unregisterFollowerApi}
                onFocusWritingSurface={focusWritingSurface}
              />
            ) : null}
          </div>

          {!readOnly && (
            <div
              className={`mx-auto flex max-w-[1180px] gap-2 overflow-x-auto rounded-[var(--r-lg)] border border-[var(--chrome-b)] bg-[color-mix(in_oklch,var(--chrome)_88%,transparent)] px-3 py-2 backdrop-blur lg:hidden print:hidden ${focusMode ? "sticky top-0 z-20" : ""}`}
            >
              <button type="button" className="shrink-0 rounded-md border border-[var(--chrome-b)] px-2 py-1 text-[10px] font-semibold" disabled={!canUndo} onClick={() => undo()}>
                Undo
              </button>
              <button type="button" className="shrink-0 rounded-md border border-[var(--chrome-b)] px-2 py-1 text-[10px] font-semibold" disabled={!canRedo} onClick={() => redo()}>
                Redo
              </button>
              <button
                type="button"
                title="Insert text, image, video, or shape"
                className="shrink-0 rounded-md border border-[var(--chrome-b)] px-2 py-1 text-sm font-semibold leading-none text-[var(--ink-2)]"
                onClick={() => setInsertOpen(true)}
              >
                +
              </button>
              {(chromeTool === "select" || chromeTool === "text") && selectedBlockId ? (
                <button
                  type="button"
                  title="Duplicate block"
                  className="shrink-0 rounded-md border border-[var(--chrome-b)] px-2 py-1 text-[10px] font-semibold text-[var(--ink-2)]"
                  onClick={() => duplicateSelectedBlock()}
                >
                  Dup
                </button>
              ) : null}
              {chromeTool === "select" && selectedRoughShapeBlock ? (
                <>
                  <span className="mx-1 h-6 w-px shrink-0 bg-[var(--chrome-b)]" />
                  <span className="shrink-0 self-center text-[9px] font-bold uppercase text-[var(--ink-3)]">Shape</span>
                  {(["none", "hachure", "solid"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSelectedRoughShapeFillMode(mode)}
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                        roughShapeFillToolbarMode(selectedRoughShapeBlock) === mode
                          ? "bg-[var(--ink)] text-[var(--paper)]"
                          : "text-[var(--ink-2)] hover:bg-[var(--paper-2)]"
                      }`}
                    >
                      {mode === "none" ? "Line" : mode === "hachure" ? "Hatch" : "Solid"}
                    </button>
                  ))}
                </>
              ) : null}
              <span className="mx-1 h-6 w-px shrink-0 bg-[var(--chrome-b)]" />
              {(["move", "select", "pen", "hl", "text", "eraser", "laser", "shapes"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setChromeToolAndClearLaser(t)}
                  className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold capitalize ${
                    chromeTool === t ? "bg-[var(--ink)] text-[var(--paper)]" : "text-[var(--ink-2)] hover:bg-[var(--paper-2)]"
                  }`}
                >
                  {t === "hl" ? "Hl" : t === "move" ? "Pan" : t}
                </button>
              ))}
              {chromeTool === "shapes" ? (
                <>
                  {(["rect", "ellipse", "diamond"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      title={k === "rect" ? "Rectangle" : k === "ellipse" ? "Ellipse" : "Diamond"}
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-semibold capitalize ${
                        shapeDrawKind === k ? "bg-[var(--ink)] text-[var(--paper)]" : "text-[var(--ink-2)] hover:bg-[var(--paper-2)]"
                      }`}
                      onClick={() => setShapeDrawKind(k)}
                    >
                      {k === "rect" ? "Rect" : k === "ellipse" ? "Oval" : "Dia"}
                    </button>
                  ))}
                </>
              ) : null}
              <span className="mx-1 h-6 w-px shrink-0 bg-[var(--chrome-b)]" />
              {penSwatches(uiTheme).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  className="h-5 w-5 shrink-0 rounded-full border-2"
                  style={{
                    background: c,
                    borderColor: color === c ? "var(--ink)" : "transparent",
                  }}
                  onClick={() => setColor(c)}
                />
              ))}
              <span className="mx-1 h-6 w-px shrink-0 bg-[var(--chrome-b)]" />
              {PEN_SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPenSize(s)}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                    penSize === s ? "bg-[var(--chrome-2)]" : ""
                  }`}
                  title={`${s}px`}
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
              {textBlockToolbar ? (
                <>
                  <span className="mx-1 h-6 w-px shrink-0 bg-[var(--chrome-b)]" />
                  <span className="shrink-0 self-center text-[9px] font-bold uppercase text-[var(--ink-3)]">
                    Font
                  </span>
                  {(["caveat", "instrument", "inter", "jetbrains-mono"] as const).map((fid) => (
                    <button
                      key={fid}
                      type="button"
                      title={fid}
                      onClick={() => setSelectedTextFontFamily(fid)}
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                        textBlockToolbar.ff === fid ? "bg-[var(--ink)] text-[var(--paper)]" : "text-[var(--ink-2)] hover:bg-[var(--paper-2)]"
                      }`}
                    >
                      {fid === "caveat" ? "Hand" : fid === "instrument" ? "Serif" : fid === "inter" ? "Sans" : "Mono"}
                    </button>
                  ))}
                  <span className="mx-1 h-6 w-px shrink-0 bg-[var(--chrome-b)]" />
                  <span className="shrink-0 self-center text-[9px] font-bold uppercase text-[var(--ink-3)]">
                    Text px
                  </span>
                  {NOTEBOOK_TEXT_SIZE_PRESETS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      title={`${s}px`}
                      onClick={() => setSelectedTextFontSizePx(s)}
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                        Math.round(textBlockToolbar.px) === s
                          ? "bg-[var(--ink)] text-[var(--paper)]"
                          : "text-[var(--ink-2)] hover:bg-[var(--paper-2)]"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </>
              ) : null}
            </div>
          )}
        </div>

        {!focusMode && (
          <aside className="sticky top-20 z-10 max-h-[calc(100vh-8rem)] space-y-4 self-start overflow-y-auto rounded-[var(--r-lg)] border border-[var(--rule)] bg-[var(--paper)] p-3 text-sm lg:top-24 lg:max-h-[calc(100vh-10rem)] print:hidden">
            <div className="text-xs font-bold uppercase tracking-wide text-[var(--ink-3)]">Page background</div>
            <div className="grid grid-cols-2 gap-2">
              {(["plain", "ruled", "grid", "cornell"] as const).map((bg) => (
                <button
                  key={bg}
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setBackground(bg);
                    start(async () => {
                      await updatePageMetaAction(notebookId, pageId, { backgroundType: bg });
                      router.refresh();
                    });
                  }}
                  className={`rounded-md border px-2 py-2 text-xs font-semibold capitalize ${
                    background === bg ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]" : "border-[var(--chrome-b)]"
                  }`}
                >
                  {bg}
                </button>
              ))}
            </div>
            <div className="text-xs font-bold uppercase tracking-wide text-[var(--ink-3)]">Paper size</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {PAGE_SIZE_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setPageSize(id);
                    start(async () => {
                      await updatePageMetaAction(notebookId, pageId, { pageSize: id });
                      router.refresh();
                    });
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    pageSize === id ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]" : "border-[var(--chrome-b)] text-[var(--ink-2)]"
                  }`}
                >
                  {PAGE_SIZE_LABELS[id]}
                </button>
              ))}
            </div>
            {!readOnly && chromeTool === "select" && selectedRoughShapeBlock ? (
              <div className="space-y-2 border-t border-[var(--chrome-b)] pt-3">
                <div className="text-xs font-bold uppercase tracking-wide text-[var(--ink-3)]">Shape fill</div>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { mode: "none" as const, label: "Stroke only" },
                      { mode: "hachure" as const, label: "Hachure" },
                      { mode: "solid" as const, label: "Solid" },
                    ] as const
                  ).map(({ mode, label }) => {
                    const active = roughShapeFillToolbarMode(selectedRoughShapeBlock) === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        title={
                          mode === "none"
                            ? "Grid and paper show through (Excalidraw default)"
                            : mode === "hachure"
                              ? "Light hatch — grid stays visible between lines"
                              : "Solid fill — hides the grid under the interior"
                        }
                        onClick={() => setSelectedRoughShapeFillMode(mode)}
                        className={`rounded-md border px-2 py-1.5 text-[11px] font-semibold ${
                          active ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]" : "border-[var(--chrome-b)] text-[var(--ink-2)]"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] leading-snug text-[var(--ink-4)]">
                  Rough.js stroke matches Excalidraw-style rectangles. Hachure keeps the notebook grid readable between hatch lines on rectangles,
                  ellipses, and diamonds.
                </p>
              </div>
            ) : null}
            <p className="text-[11px] leading-snug text-[var(--ink-3)]">
              <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper-2)] px-1 font-mono text-[10px]">T</kbd> Text tool: click
              to type (line height follows ruled/grid).               <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper-2)] px-1 font-mono text-[10px]">M</kbd>{" "}
              Select: drag the left strip to move (blocks snap to a light grid; hold{" "}
              <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper-2)] px-1 font-mono text-[10px]">Shift</kbd> while dragging or
              resizing to turn snap off). While typing, boxes grow with content. If the pen is active, select a note then press{" "}
              <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper-2)] px-1 font-mono text-[10px]">Enter</kbd> to edit. With Text or
              Select active, pick a note or click into it to type: a <span className="font-semibold text-[var(--ink-2)]">Handwriting</span> size panel
              opens to the right of the dock.{" "}
              <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper-2)] px-1 font-mono text-[10px]">⌘D</kbd> /{" "}
              <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper-2)] px-1 font-mono text-[10px]">Ctrl+D</kbd> duplicates the
              selected block. With Select or Text active, press{" "}
              <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper-2)] px-1 font-mono text-[10px]">Delete</kbd> or{" "}
              <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper-2)] px-1 font-mono text-[10px]">Backspace</kbd> twice to remove a
              selected block (not while typing inside a note). Use <span className="font-semibold text-[var(--ink-2)]">Print / PDF</span> (top bar or
              focus bar) to open the system
              print dialog — choose “Save as PDF” where your browser or OS offers it.{" "}
              <span className="font-semibold text-[var(--ink-2)]">Find</span> (or{" "}
              <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper-2)] px-1 font-mono text-[10px]">⌘F</kbd> /{" "}
              <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper-2)] px-1 font-mono text-[10px]">Ctrl+F</kbd>) searches the page
              title and handwriting notes; <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper-2)] px-1 font-mono text-[10px]">F3</kbd>{" "}
              / <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper-2)] px-1 font-mono text-[10px]">⇧F3</kbd> steps matches when the
              find bar is open.
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}
