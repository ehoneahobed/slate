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
import { SharePanel, type ShareLinkRow } from "@/components/share/share-panel";
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
  type PageStickyTint,
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

const EDITOR_SHEET_PREFS_KEY = "slate:editor-sheet-prefs:v1";
const EDITOR_NAV_LEFT_KEY = "slate:editor-nav-left:v1";
const EDITOR_NAV_RIGHT_KEY = "slate:editor-nav-right:v1";

function readEditorNavOpen(key: string, defaultOpen: boolean): boolean {
  if (typeof window === "undefined") return defaultOpen;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === "0") return false;
    if (raw === "1") return true;
    return defaultOpen;
  } catch {
    return defaultOpen;
  }
}

export type EditorSheetPrefs = {
  snapToGrid: boolean;
  showRulers: boolean;
  showPageNumber: boolean;
};

function defaultEditorSheetPrefs(): EditorSheetPrefs {
  return { snapToGrid: true, showRulers: false, showPageNumber: true };
}

function readEditorSheetPrefs(): EditorSheetPrefs {
  if (typeof window === "undefined") return defaultEditorSheetPrefs();
  try {
    const raw = window.localStorage.getItem(EDITOR_SHEET_PREFS_KEY);
    if (!raw) return defaultEditorSheetPrefs();
    const o = JSON.parse(raw) as Partial<EditorSheetPrefs>;
    return {
      snapToGrid: typeof o.snapToGrid === "boolean" ? o.snapToGrid : true,
      showRulers: typeof o.showRulers === "boolean" ? o.showRulers : false,
      showPageNumber: typeof o.showPageNumber === "boolean" ? o.showPageNumber : true,
    };
  } catch {
    return defaultEditorSheetPrefs();
  }
}

const PAGE_BG_OPTIONS = ["plain", "ruled", "grid", "cornell"] as const;
type PageBgOption = (typeof PAGE_BG_OPTIONS)[number];

function PageBackgroundSwatchPreview({ kind }: { kind: PageBgOption }) {
  const paper = "var(--paper)";
  const line = "color-mix(in oklch, var(--rule) 70%, transparent)";
  if (kind === "plain") {
    return <div className="h-full w-full rounded-[6px] border border-[var(--chrome-b)]" style={{ background: paper }} />;
  }
  if (kind === "ruled") {
    return (
      <div
        className="h-full w-full rounded-[6px] border border-[var(--chrome-b)]"
        style={{
          backgroundColor: paper,
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 11px, ${line} 11px 12px)`,
        }}
      />
    );
  }
  if (kind === "grid") {
    return (
      <div
        className="h-full w-full rounded-[6px] border border-[var(--chrome-b)]"
        style={{
          backgroundColor: paper,
          backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
          backgroundSize: "14px 14px",
        }}
      />
    );
  }
  return (
    <div
      className="grid h-full w-full grid-cols-[22%_1fr] gap-px overflow-hidden rounded-[6px] border border-[var(--chrome-b)]"
      style={{ background: paper }}
    >
      <div className="min-h-0 border-r border-[var(--chrome-b)] bg-[color-mix(in_oklch,var(--paper-2)_70%,transparent)]" />
      <div
        className="min-h-0"
        style={{
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 10px, ${line} 10px 11px)`,
        }}
      />
    </div>
  );
}

function SheetPrefsToggle({
  label,
  checked,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-[var(--chrome-b)] hover:bg-[var(--paper-2)] ${disabled ? "cursor-not-allowed opacity-50 hover:border-transparent hover:bg-transparent" : ""}`}
      title={hint}
    >
      <span className="text-[13px] leading-snug text-[var(--ink)]">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 rounded border-[var(--chrome-b)] text-[var(--ink)] focus:ring-2 focus:ring-[var(--accent)]"
      />
    </label>
  );
}

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
  /** Active public share links for this notebook (same payload as notebook overview). */
  activeShareLinks?: ShareLinkRow[];
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
  activeShareLinks = [],
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
  /** Right page sidebar: tips & shortcuts panel starts collapsed for readability. */
  const [pageSidebarTipsOpen, setPageSidebarTipsOpen] = useState(false);
  const [sheetPrefs, setSheetPrefs] = useState<EditorSheetPrefs>(() => defaultEditorSheetPrefs());
  const [navLeftOpen, setNavLeftOpen] = useState(true);
  const [navRightOpen, setNavRightOpen] = useState(true);
  /** Optimistic background / paper size for following sheets while sidebar edits land + `router.refresh()`. */
  const [liveFollowingMeta, setLiveFollowingMeta] = useState<
    Partial<Record<string, { backgroundType?: string; pageSize?: PageSizeId }>>
  >({});

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

  useEffect(() => {
    const prefs = readEditorSheetPrefs();
    queueMicrotask(() => setSheetPrefs(prefs));
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setNavLeftOpen(readEditorNavOpen(EDITOR_NAV_LEFT_KEY, true));
      setNavRightOpen(readEditorNavOpen(EDITOR_NAV_RIGHT_KEY, true));
    });
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(EDITOR_NAV_LEFT_KEY, navLeftOpen ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [navLeftOpen]);

  useEffect(() => {
    try {
      window.localStorage.setItem(EDITOR_NAV_RIGHT_KEY, navRightOpen ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [navRightOpen]);

  const persistSheetPrefs = useCallback((next: EditorSheetPrefs) => {
    setSheetPrefs(next);
    try {
      window.localStorage.setItem(EDITOR_SHEET_PREFS_KEY, JSON.stringify(next));
    } catch {
      /* quota / private mode */
    }
  }, []);

  /** Bumped when the user asks to scroll to the share panel so `useLayoutEffect` runs even if the sidebar was already open. */
  const [shareScrollRequest, setShareScrollRequest] = useState(0);

  /** Opens the Page sidebar (if collapsed), exits focus mode, then scrolls the share panel into view after commit. */
  const focusPublicShareSection = useCallback(() => {
    setShareScrollRequest((n) => n + 1);
    setFocusMode(false);
    setNavRightOpen(true);
  }, []);

  useLayoutEffect(() => {
    if (shareScrollRequest === 0) return;
    if (focusMode || !navRightOpen) return;
    const el = document.getElementById("notebook-public-share");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [shareScrollRequest, focusMode, navRightOpen]);

  const totalNotebookPages = useMemo(() => outline.reduce((n, sec) => n + sec.pages.length, 0), [outline]);

  const currentSectionTitle = useMemo(
    () => outline.find((s) => s.id === sectionId)?.title?.trim() ?? "",
    [outline, sectionId],
  );

  /** 1-based index through the whole notebook (sections in order, pages by `position`). Not stored — updates on reorder/add/delete. */
  const notebookPageNav = useMemo(() => {
    let idx = 0;
    let total = 0;
    for (const s of outline) {
      const nav = [...s.pages].sort((a, b) => a.position - b.position);
      for (const p of nav) {
        total++;
        if (p.id === pageId) idx = total;
      }
    }
    return { idx, total };
  }, [outline, pageId]);

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

  const activeFollowingSheet = useMemo(
    () => followingSheets.find((s) => s.pageId === activeWritingPageId),
    [followingSheets, activeWritingPageId],
  );

  const sidebarBackground = useMemo(() => {
    if (activeWritingPageId === pageId) return background;
    const live = liveFollowingMeta[activeWritingPageId];
    return live?.backgroundType ?? activeFollowingSheet?.backgroundType ?? background;
  }, [activeWritingPageId, pageId, background, liveFollowingMeta, activeFollowingSheet]);

  const sidebarPageSize = useMemo(() => {
    if (activeWritingPageId === pageId) return pageSize;
    const live = liveFollowingMeta[activeWritingPageId];
    return normalizePageSize(live?.pageSize ?? activeFollowingSheet?.pageSize ?? pageSize);
  }, [activeWritingPageId, pageId, pageSize, liveFollowingMeta, activeFollowingSheet]);

  useEffect(() => {
    queueMicrotask(() => setLiveFollowingMeta({}));
  }, [followingSheets]);

  useEffect(() => {
    queueMicrotask(() => {
      setBackground(initialBackground);
      setPageSize(normalizePageSize(initialPageSize));
    });
  }, [initialBackground, initialPageSize]);

  useEffect(() => {
    queueMicrotask(() => setActiveWritingPageId(pageId));
  }, [pageId]);

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
    if (!readOnly && activeWritingPageId !== pageId) {
      followerWriteApisRef.current.get(activeWritingPageId)?.addTextBlock();
      return;
    }
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
  }, [
    readOnly,
    activeWritingPageId,
    pageId,
    blocks,
    applyBlocks,
    setChromeToolAndClearLaser,
    background,
    pageSize,
    syncSelectBlockId,
  ]);

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
    if (!readOnly && activeWritingPageId !== pageId) {
      followerWriteApisRef.current.get(activeWritingPageId)?.addYoutubeBlock(videoId);
      return;
    }
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
    if (!readOnly && activeWritingPageId !== pageId) {
      followerWriteApisRef.current.get(activeWritingPageId)?.addImageBlock(src);
      return;
    }
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

  function addStickyBlock(tint: PageStickyTint) {
    if (!readOnly && activeWritingPageId !== pageId) {
      followerWriteApisRef.current.get(activeWritingPageId)?.addStickyBlock(tint);
      return;
    }
    const id = crypto.randomUUID();
    const n = blocks.length;
    const aspect = pageLayoutAspectRatio(pageSize);
    const w = 0.26;
    const h = Math.min(0.28 * aspect, aspect * 0.45);
    const x = Math.min(1 - w - 0.04, 0.06 + (n % 7) * 0.028);
    const y = Math.min(PAGE_BLOCK_WORLD_UY_CEILING - h, (0.06 + (n % 6) * 0.05) * aspect);
    const next: PageBlock[] = [
      ...blocks,
      {
        kind: "sticky",
        id,
        x,
        y,
        w,
        h,
        text: "",
        tint,
      },
    ];
    applyBlocks(next, { recordHistory: true });
    setChromeToolAndClearLaser("select");
    syncSelectBlockId(id);
  }

  function addMathBlock(latex: string, opts?: { display?: boolean }) {
    if (!readOnly && activeWritingPageId !== pageId) {
      followerWriteApisRef.current.get(activeWritingPageId)?.addMathBlock(latex, opts);
      return;
    }
    const id = crypto.randomUUID();
    const n = blocks.length;
    const aspect = pageLayoutAspectRatio(pageSize);
    const yLeg = Math.min(0.55, 0.12 + (n % 5) * 0.04);
    const display = opts?.display !== false;
    const next: PageBlock[] = [
      ...blocks,
      {
        kind: "math",
        id,
        x: Math.min(0.52, 0.08 + (n % 4) * 0.04),
        y: yLeg * aspect,
        w: 0.44,
        h: 0.16 * aspect,
        latex,
        display,
      },
    ];
    applyBlocks(next, { recordHistory: true });
    setChromeToolAndClearLaser("select");
    syncSelectBlockId(id);
  }

  function addCodeBlock(code: string, opts?: { filename?: string }) {
    if (!readOnly && activeWritingPageId !== pageId) {
      followerWriteApisRef.current.get(activeWritingPageId)?.addCodeBlock(code, opts);
      return;
    }
    const id = crypto.randomUUID();
    const n = blocks.length;
    const aspect = pageLayoutAspectRatio(pageSize);
    const yLeg = Math.min(0.62, 0.1 + (n % 5) * 0.045);
    const next: PageBlock[] = [
      ...blocks,
      {
        kind: "code",
        id,
        x: Math.min(0.48, 0.06 + (n % 3) * 0.05),
        y: yLeg * aspect,
        w: 0.46,
        h: 0.22 * aspect,
        code,
        ...(opts?.filename?.trim() ? { filename: opts.filename.trim().slice(0, 120) } : {}),
      },
    ];
    applyBlocks(next, { recordHistory: true });
    setChromeToolAndClearLaser("select");
    syncSelectBlockId(id);
  }

  function addWebEmbedBlock(url: string, title?: string) {
    if (!readOnly && activeWritingPageId !== pageId) {
      followerWriteApisRef.current.get(activeWritingPageId)?.addWebEmbedBlock(url, title);
      return;
    }
    const id = crypto.randomUUID();
    const n = blocks.length;
    const aspect = pageLayoutAspectRatio(pageSize);
    const yLeg = Math.min(0.42, 0.1 + (n % 4) * 0.05);
    const next: PageBlock[] = [
      ...blocks,
      {
        kind: "web_embed",
        id,
        x: Math.min(0.38, 0.06 + (n % 3) * 0.04),
        y: yLeg * aspect,
        w: 0.52,
        h: 0.42 * aspect,
        url,
        ...(title ? { title } : {}),
      },
    ];
    applyBlocks(next, { recordHistory: true });
    setChromeToolAndClearLaser("select");
    syncSelectBlockId(id);
  }

  function addFileCardBlock(url: string, label: string) {
    if (!readOnly && activeWritingPageId !== pageId) {
      followerWriteApisRef.current.get(activeWritingPageId)?.addFileCardBlock(url, label);
      return;
    }
    const id = crypto.randomUUID();
    const n = blocks.length;
    const aspect = pageLayoutAspectRatio(pageSize);
    const yLeg = Math.min(0.72, 0.08 + (n % 5) * 0.045);
    const next: PageBlock[] = [
      ...blocks,
      {
        kind: "file_card",
        id,
        x: Math.min(0.55, 0.06 + (n % 4) * 0.04),
        y: yLeg * aspect,
        w: 0.36,
        h: 0.14 * aspect,
        url,
        label,
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

      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setFindOpen(true);
        queueMicrotask(() => findInputRef.current?.focus());
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
      {!readOnly && blocks.length === 0 && strokes.length === 0 && !studentPreview ? (
        <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center p-10">
          <p className="max-w-[18rem] rounded-2xl border border-dashed border-[color-mix(in_oklch,var(--rule)_85%,var(--chrome-b))] bg-[color-mix(in_oklch,var(--paper)_72%,transparent)] px-6 py-10 text-center text-[14px] italic leading-relaxed text-[var(--ink-3)] shadow-[var(--shadow-1)]">
            Start writing, drop files, or press{" "}
            <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper-2)] px-1.5 py-0.5 font-mono text-[12px] not-italic text-[var(--ink-2)]">
              /
            </kbd>{" "}
            for the insert menu.
          </p>
        </div>
      ) : null}
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
        snapToGridEnabled={sheetPrefs.snapToGrid}
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

  const sheetChromeOverlays =
    !focusMode && (sheetPrefs.showRulers || (sheetPrefs.showPageNumber && notebookPageNav.total > 0)) ? (
      <>
        {sheetPrefs.showRulers ? (
          <>
            <div
              className="pointer-events-none absolute left-0 top-0 z-[5] h-5 w-full border-b border-[var(--rule-2)] bg-[color-mix(in_oklch,var(--paper)_94%,transparent)]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, transparent 0, transparent 39px, color-mix(in oklch, var(--ink-4) 26%, transparent) 39px 40px)",
              }}
              aria-hidden
            />
            <div
              className="pointer-events-none absolute bottom-0 left-0 top-5 z-[5] w-5 border-r border-[var(--rule-2)] bg-[color-mix(in_oklch,var(--paper)_94%,transparent)]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(180deg, transparent 0, transparent 39px, color-mix(in oklch, var(--ink-4) 26%, transparent) 39px 40px)",
              }}
              aria-hidden
            />
          </>
        ) : null}
        {sheetPrefs.showPageNumber && notebookPageNav.total > 0 ? (
          <div
            className={`pointer-events-none absolute right-3 z-[6] rounded-full border border-[var(--chrome-b)] bg-[color-mix(in_oklch,var(--paper)_90%,transparent)] px-2.5 py-1 text-[11px] font-medium tabular-nums text-[var(--ink-3)] shadow-sm backdrop-blur-sm ${sheetPrefs.showRulers ? "top-7" : "top-3"}`}
          >
            p. {String(notebookPageNav.idx).padStart(2, "0")} / {String(notebookPageNav.total).padStart(2, "0")}
          </div>
        ) : null}
      </>
    ) : null;

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
        onAddSticky={addStickyBlock}
        onAddWebEmbed={addWebEmbedBlock}
        onAddFileCard={addFileCardBlock}
        onAddMath={addMathBlock}
        onAddCode={addCodeBlock}
        onAddRoughShape={(kind) => {
          if (!readOnly && activeWritingPageId !== pageId) {
            followerWriteApisRef.current.get(activeWritingPageId)?.beginRoughShapeDraw(kind);
            setInsertOpen(false);
            return;
          }
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color-mix(in_oklch,var(--rule)_55%,transparent)] pb-4 text-sm print:hidden">
          <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] leading-snug text-[var(--ink-3)]">
            <Link className="shrink-0 rounded-md px-1 py-0.5 hover:bg-[var(--paper-2)] hover:text-[var(--ink)]" href="/dashboard">
              Dashboard
            </Link>
            <span className="shrink-0 text-[var(--ink-4)]" aria-hidden>
              /
            </span>
            <Link
              className="min-w-0 max-w-[12rem] truncate rounded-md px-1 py-0.5 hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
              href={`/dashboard/notebooks/${notebookId}`}
              title={spineTitle}
            >
              {spineTitle}
            </Link>
            {currentSectionTitle ? (
              <>
                <span className="shrink-0 text-[var(--ink-4)]" aria-hidden>
                  /
                </span>
                <Link
                  className="min-w-0 max-w-[11rem] truncate rounded-md px-1 py-0.5 hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
                  href={`/dashboard/notebooks/${notebookId}`}
                  title={currentSectionTitle}
                >
                  {currentSectionTitle}
                </Link>
              </>
            ) : null}
            <span className="shrink-0 text-[var(--ink-4)]" aria-hidden>
              /
            </span>
            <span className="min-w-0 max-w-[14rem] truncate font-medium text-[var(--ink)]" title={title}>
              {title.trim() || "Untitled page"}
            </span>
          </nav>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-xs tabular-nums text-[var(--ink-4)]">
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : ""}
            </span>
            <button
              type="button"
              className="rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-2)] hover:bg-[var(--paper-2)]"
              onClick={() => setFindOpen((v) => !v)}
              title="Find on this page (⌘F / Ctrl+F)"
            >
              Find
            </button>
            <button
              type="button"
              className="rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-2)] hover:bg-[var(--paper-2)]"
              onClick={() => window.print()}
              title="Open the print dialog — choose “Save as PDF” to export"
            >
              Print / PDF
            </button>
            <button
              type="button"
              className="rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-2)] hover:bg-[var(--paper-2)]"
              onClick={() => setFocusMode((v) => !v)}
              title="Toggle focus (F)"
            >
              {focusMode ? "Exit focus" : "Focus"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-[var(--chrome-b)] bg-[var(--paper)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-2)] hover:bg-[var(--paper-2)]"
              onClick={() => setStudentPreview((v) => !v)}
              title="Read-only ink and blocks (student-facing preview)"
            >
              {studentPreview ? "Exit preview" : "Preview"}
            </button>
            <button
              type="button"
              className="rounded-lg bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-[var(--paper)] shadow-[var(--shadow-1)] hover:opacity-90"
              title="Jump to Public read-only link in the Page sidebar (exits focus mode if needed)"
              onClick={focusPublicShareSection}
            >
              Share
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
          <button
            type="button"
            className="rounded-lg bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-[var(--paper)] shadow-[var(--shadow-1)] hover:opacity-90"
            title="Jump to Public read-only link in the Page sidebar"
            onClick={focusPublicShareSection}
          >
            Share
          </button>
        </div>
      )}

      <div
        ref={panScrollRef}
        className={
          focusMode
            ? "min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain p-4 print:overflow-visible print:p-0"
            : ""
        }
      >
        <div
          className={
            !focusMode
              ? "mx-[calc(50%-50vw)] flex w-screen max-w-[100vw] items-stretch print:mx-0 print:w-full print:flex-col"
              : "contents"
          }
        >
          {!focusMode &&
            (navLeftOpen ? (
              <aside className="relative sticky top-20 z-10 flex h-[calc(100dvh-5.5rem)] w-[min(320px,36vw)] max-w-[380px] shrink-0 flex-col gap-3 self-start overflow-hidden border-r border-[var(--rule)] bg-[var(--paper)] p-3 shadow-sm lg:top-24 print:hidden">
                <button
                  type="button"
                  className="absolute right-2 top-2 z-20 grid h-8 w-8 place-items-center rounded-lg border border-[var(--chrome-b)] bg-[color-mix(in_oklch,var(--paper)_92%,transparent)] text-[var(--ink-2)] shadow-sm backdrop-blur-sm hover:bg-[var(--paper-2)]"
                  aria-label="Collapse outline sidebar"
                  title="Collapse outline"
                  onClick={() => setNavLeftOpen(false)}
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                    <path d="M11 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <div className="relative shrink-0">
              <input
                type="search"
                readOnly
                onFocus={() => {
                  setFindOpen(true);
                  queueMicrotask(() => findInputRef.current?.focus());
                }}
                placeholder="Search notebook…"
                className="w-full cursor-pointer rounded-xl border border-[var(--chrome-b)] bg-[var(--paper-2)] py-2 pl-3 pr-14 text-[13px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-4)] focus:border-[var(--ink-3)] focus:bg-[var(--paper)]"
                aria-label="Open find (⌘K)"
              />
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-[var(--chrome-b)] bg-[var(--paper)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--ink-4)]">
                ⌘K
              </kbd>
            </div>
            <div className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{"Sections & pages"}</div>
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
                              className={`min-w-0 flex-1 truncate rounded-full px-3 py-1.5 text-[13px] transition-colors ${
                                p.id === pageId
                                  ? "bg-[color-mix(in_oklch,var(--accent-soft)_92%,var(--paper))] font-semibold text-[var(--ink)] ring-1 ring-[color-mix(in_oklch,var(--accent)_32%,transparent)]"
                                  : "text-[var(--ink-2)] hover:bg-[var(--paper-2)]"
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
            ) : (
              <div className="sticky top-20 z-10 flex h-[calc(100dvh-5.5rem)] w-11 shrink-0 flex-col items-center border-r border-[var(--rule)] bg-[var(--paper)] pt-3 shadow-sm lg:top-24 print:hidden">
                <button
                  type="button"
                  className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--chrome-b)] text-[var(--ink-2)] hover:bg-[var(--paper-2)]"
                  aria-label="Expand outline sidebar"
                  title="Expand outline"
                  onClick={() => setNavLeftOpen(true)}
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                    <path d="M9 5l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            ))}

        {!readOnly && !focusMode ? (
          <div className="sticky top-20 z-[45] hidden h-[calc(100dvh-5.5rem)] shrink-0 flex-col items-center justify-center self-start pl-1 pr-6 lg:top-24 lg:flex print:hidden">
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
        ) : null}

        <div
          className={`space-y-3 print:max-w-none print:space-y-2 ${focusMode ? "mx-auto w-full max-w-[1180px] print:mx-0 print:w-full print:max-w-none" : "min-w-0 flex-1 px-3 sm:px-5"}`}
        >
          {focusMode ? (
            <div data-page-find="title" className="sr-only" aria-hidden>
              {title}
            </div>
          ) : null}
          {!focusMode && (
            <div data-page-find="title" className="space-y-1 print:hidden">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => void onTitleBlur()}
                placeholder="Untitled page"
                className="w-full max-w-3xl border-0 border-b-2 border-transparent bg-transparent px-0 py-1.5 text-3xl font-[family-name:var(--font-instrument-serif)] leading-tight tracking-tight text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-4)] focus:border-[color-mix(in_oklch,var(--rule)_80%,var(--ink))] sm:text-4xl"
              />
              <p className="text-[13px] leading-relaxed text-[var(--ink-4)]">Blank canvas — drop anything here.</p>
              <h1 className="hidden font-[family-name:var(--font-instrument-serif)] text-3xl leading-tight text-[var(--ink)] print:block">
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
            <div
              data-slate-print-sheet
              className={`relative isolate w-full break-inside-avoid rounded-md bg-[var(--paper)] shadow-[var(--shadow-2)] print:rounded-sm print:shadow-none print:break-inside-avoid ${
                pageSize === "infinite" ? "overflow-x-hidden overflow-y-visible min-h-0" : "overflow-hidden"
              }`}
              style={pageFrameStyle(pageSize)}
            >
              {isFullBleedInk ? (
                <div className="absolute inset-0 min-h-0 overflow-hidden">
                  {sheetChromeOverlays}
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
                  {sheetChromeOverlays}
                  {inkLayers}
                </div>
              ) : null}
            </div>
            {!focusMode && notebookPageNav.total > 0 ? (
              <div className="mt-4 flex justify-center print:hidden">
                <div className="inline-flex items-center gap-3 rounded-full border border-[var(--chrome-b)] bg-[color-mix(in_oklch,var(--paper)_94%,transparent)] px-4 py-2 text-[12px] font-medium text-[var(--ink-2)] shadow-[var(--shadow-1)]">
                  <span className="tabular-nums text-[var(--ink)]">
                    Page {String(notebookPageNav.idx).padStart(2, "0")} / {String(notebookPageNav.total).padStart(2, "0")}
                  </span>
                  <span className="h-1 w-1 shrink-0 rounded-full bg-[var(--ink-4)]" aria-hidden />
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded-full bg-[var(--ink)] px-3 py-1 text-[11px] font-semibold text-[var(--paper)] hover:opacity-90 disabled:opacity-50"
                    onClick={() =>
                      start(async () => {
                        const { pageId: nid } = await createPageAction(notebookId, sectionId);
                        router.push(`/dashboard/notebooks/${notebookId}/pages/${nid}`);
                      })
                    }
                  >
                    + Add page
                  </button>
                </div>
              </div>
            ) : null}
            {!focusMode && (followingSheets.length > 0 || followingSheetsMoreCount > 0) ? (
              <NotebookFollowingPages
                notebookId={notebookId}
                sheets={followingSheets}
                moreCount={followingSheetsMoreCount}
                chromeTool={chromeTool}
                setChromeToolAndClearLaser={setChromeToolAndClearLaser}
                setShapeDrawKind={setShapeDrawKind}
                shapeDrawKind={shapeDrawKind}
                color={color}
                penSize={penSize}
                readOnly={readOnly}
                serverUiTheme={serverUiTheme}
                registerFollowerApi={registerFollowerApi}
                unregisterFollowerApi={unregisterFollowerApi}
                onFocusWritingSurface={focusWritingSurface}
                liveFollowingMeta={liveFollowingMeta}
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

        {!focusMode &&
          (navRightOpen ? (
            <aside className="relative sticky top-20 z-10 flex h-[calc(100dvh-5.5rem)] w-[min(300px,32vw)] max-w-[320px] shrink-0 flex-col gap-4 self-start overflow-y-auto overflow-x-hidden border-l border-[var(--rule)] bg-[var(--paper)] p-4 pt-11 text-sm shadow-sm lg:top-24 print:hidden">
              <button
                type="button"
                className="absolute left-2 top-2 z-20 grid h-8 w-8 place-items-center rounded-lg border border-[var(--chrome-b)] bg-[color-mix(in_oklch,var(--paper)_92%,transparent)] text-[var(--ink-2)] shadow-sm backdrop-blur-sm hover:bg-[var(--paper-2)]"
                aria-label="Collapse page sidebar"
                title="Collapse page tools"
                onClick={() => setNavRightOpen(false)}
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path d="M9 5l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            <div className="rounded-full bg-[var(--paper-2)] p-1">
              <div className="rounded-full bg-[var(--paper)] py-2 text-center text-[12px] font-semibold tracking-wide text-[var(--ink)] shadow-[var(--shadow-1)]">
                Page
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Page background</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {PAGE_BG_OPTIONS.map((bg) => {
                  const active = sidebarBackground === bg;
                  return (
                    <button
                      key={bg}
                      type="button"
                      disabled={pending}
                      title={bg}
                      onClick={() => {
                        const targetId = activeWritingPageId;
                        if (targetId === pageId) {
                          setBackground(bg);
                        } else {
                          setLiveFollowingMeta((m) => ({
                            ...m,
                            [targetId]: { ...m[targetId], backgroundType: bg },
                          }));
                        }
                        start(async () => {
                          await updatePageMetaAction(notebookId, targetId, { backgroundType: bg });
                          router.refresh();
                        });
                      }}
                      className={`flex flex-col gap-1 overflow-hidden rounded-xl border p-1.5 text-left transition-colors ${
                        active
                          ? "border-[var(--ink)] ring-2 ring-[color-mix(in_oklch,var(--accent)_40%,transparent)]"
                          : "border-[var(--chrome-b)] hover:border-[var(--ink-3)]"
                      }`}
                    >
                      <div className="aspect-[5/3] w-full min-h-[52px] overflow-hidden rounded-lg bg-[var(--paper-2)]">
                        <PageBackgroundSwatchPreview kind={bg} />
                      </div>
                      <span
                        className={`px-0.5 pb-0.5 text-center text-[10px] font-semibold capitalize ${active ? "text-[var(--ink)]" : "text-[var(--ink-2)]"}`}
                      >
                        {bg}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Paper size</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {PAGE_SIZE_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const targetId = activeWritingPageId;
                      if (targetId === pageId) {
                        setPageSize(id);
                      } else {
                        setLiveFollowingMeta((m) => ({
                          ...m,
                          [targetId]: { ...m[targetId], pageSize: id },
                        }));
                      }
                      start(async () => {
                        await updatePageMetaAction(notebookId, targetId, { pageSize: id });
                        router.refresh();
                      });
                    }}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                      sidebarPageSize === id
                        ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] shadow-sm"
                        : "border-[var(--chrome-b)] text-[var(--ink-2)] hover:border-[var(--ink-3)] hover:bg-[var(--paper-2)]"
                    }`}
                  >
                    {PAGE_SIZE_LABELS[id]}
                  </button>
                ))}
              </div>
            </div>

            <div id="notebook-public-share" className="scroll-mt-4 border-t border-[var(--chrome-b)] pt-3">
              <SharePanel notebookId={notebookId} links={activeShareLinks} embedded />
            </div>

            <div className="space-y-0.5 border-t border-[var(--chrome-b)] pt-3">
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Page options</div>
              <SheetPrefsToggle
                label="Snap to grid"
                checked={sheetPrefs.snapToGrid}
                onChange={(v) => persistSheetPrefs({ ...sheetPrefs, snapToGrid: v })}
                hint="When off, hold Shift to snap while moving or resizing blocks."
              />
              <SheetPrefsToggle
                label="Show rulers"
                checked={sheetPrefs.showRulers}
                onChange={(v) => persistSheetPrefs({ ...sheetPrefs, showRulers: v })}
                hint="Light rulers along the top and left edge of the sheet."
              />
              <SheetPrefsToggle
                label="Page number"
                checked={sheetPrefs.showPageNumber}
                onChange={(v) => persistSheetPrefs({ ...sheetPrefs, showPageNumber: v })}
                hint="Show page index on the sheet (e.g. p. 03 / 12)."
              />
              <div
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-[13px] text-[var(--ink-4)]"
                title="Coming soon"
              >
                <span>Lock page</span>
                <span className="shrink-0 rounded-full bg-[var(--paper-2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  Soon
                </span>
              </div>
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
            <div className="border-t border-[var(--chrome-b)] pt-3">
              <button
                type="button"
                aria-expanded={pageSidebarTipsOpen}
                aria-controls="page-editor-sidebar-tips"
                id="page-editor-sidebar-tips-toggle"
                onClick={() => setPageSidebarTipsOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--chrome-b)] bg-[var(--paper-2)] px-3 py-2.5 text-left transition-colors hover:border-[var(--ink-3)] hover:bg-[var(--paper)]"
              >
                <span className="text-[13px] font-semibold leading-tight text-[var(--ink)]">{"Tips & keyboard shortcuts"}</span>
                <span className="shrink-0 tabular-nums text-[11px] font-medium text-[var(--ink-3)]" aria-hidden>
                  {pageSidebarTipsOpen ? "Hide" : "Show"}
                </span>
              </button>
              {pageSidebarTipsOpen ? (
                <div
                  id="page-editor-sidebar-tips"
                  role="region"
                  aria-labelledby="page-editor-sidebar-tips-toggle"
                  className="mt-3 rounded-lg border border-[var(--chrome-b)] bg-[var(--paper-2)] p-3 text-[13px] leading-relaxed text-[var(--ink-2)]"
                >
                  <ul className="list-disc space-y-2.5 pl-[1.15rem] marker:text-[var(--ink-3)]">
                    <li>
                      <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--ink)]">
                        T
                      </kbd>{" "}
                      <span className="font-medium text-[var(--ink)]">Text tool:</span> click the page to type. Line height follows ruled / grid
                      lines.
                    </li>
                    <li>
                      <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--ink)]">
                        M
                      </kbd>{" "}
                      <span className="font-medium text-[var(--ink)]">Select:</span> drag the left strip on a note to move it. Blocks snap to a light
                      grid (toggle <span className="font-medium">Snap to grid</span> in Page options); hold{" "}
                      <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--ink)]">
                        Shift
                      </kbd>{" "}
                      while dragging or resizing to turn snap off.
                    </li>
                    <li>
                      While typing, text boxes grow with the content. If the pen is active, select a note, then press{" "}
                      <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--ink)]">
                        Enter
                      </kbd>{" "}
                      to edit it.
                    </li>
                    <li>
                      With Text or Select active, click a note to type. A{" "}
                      <span className="font-semibold text-[var(--ink)]">Handwriting</span> size panel appears to the right of the tool dock.
                    </li>
                    <li>
                      <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--ink)]">
                        ⌘D
                      </kbd>{" "}
                      /{" "}
                      <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--ink)]">
                        Ctrl+D
                      </kbd>{" "}
                      duplicates the selected block.
                    </li>
                    <li>
                      With Select or Text active, press{" "}
                      <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--ink)]">
                        Delete
                      </kbd>{" "}
                      or{" "}
                      <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--ink)]">
                        Backspace
                      </kbd>{" "}
                      twice to remove a selected block (not while the caret is inside a note).
                    </li>
                    <li>
                      <span className="font-semibold text-[var(--ink)]">Print / PDF</span> (top bar or focus bar) opens the system print dialog — use
                      “Save as PDF” where your browser or OS offers it.
                    </li>
                    <li>
                      <span className="font-semibold text-[var(--ink)]">Find</span> (
                      <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--ink)]">
                        ⌘F
                      </kbd>{" "}
                      /{" "}
                      <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--ink)]">
                        Ctrl+F
                      </kbd>
                      ) searches the page title and handwriting notes.{" "}
                      <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--ink)]">
                        F3
                      </kbd>{" "}
                      /{" "}
                      <kbd className="rounded border border-[var(--chrome-b)] bg-[var(--paper)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--ink)]">
                        ⇧F3
                      </kbd>{" "}
                      step through matches when the find bar is open.
                    </li>
                  </ul>
                </div>
              ) : null}
            </div>
          </aside>
          ) : (
            <div className="sticky top-20 z-10 flex h-[calc(100dvh-5.5rem)] w-11 shrink-0 flex-col items-center border-l border-[var(--rule)] bg-[var(--paper)] pt-3 shadow-sm lg:top-24 print:hidden">
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--chrome-b)] text-[var(--ink-2)] hover:bg-[var(--paper-2)]"
                aria-label="Expand page sidebar"
                title="Expand page tools"
                onClick={() => setNavRightOpen(true)}
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path d="M11 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        {focusMode && !readOnly ? (
          <div className="pointer-events-none fixed left-4 top-1/2 z-[45] hidden -translate-y-1/2 lg:block print:hidden">
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
        ) : null}
      </div>
    </div>
  );
}
