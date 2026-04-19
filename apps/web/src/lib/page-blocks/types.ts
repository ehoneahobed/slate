/**
 * Typed page blocks (embeds + text) — persisted in `page.blocksData` JSONB.
 * - `legacy-page`: x,w,y,h ∈ [0,1] relative to sheet width (x,w) and height (y,h).
 * - `world-v2`: x,w ∈ [0,1] width fractions; y,h are “width units” (same scale as ink uy).
 */
export type BlocksCoordSpace = "legacy-page" | "world-v2";

export type PageTextFontId = "caveat" | "instrument" | "inter" | "jetbrains-mono";

const PAGE_TEXT_FONT_IDS = new Set<PageTextFontId>(["caveat", "instrument", "inter", "jetbrains-mono"]);

export function isPageTextFontId(v: string): v is PageTextFontId {
  return PAGE_TEXT_FONT_IDS.has(v as PageTextFontId);
}

export type TextSegment = {
  text: string;
  fontSizePx?: number;
  fontFamily?: PageTextFontId;
};

export type PageBlockText = {
  kind: "text";
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Plain join of segments (legacy + search); kept in sync when `segments` is used. */
  text: string;
  /** Optional px font size default for runs that omit `fontSizePx`. */
  fontSizePx?: number;
  /** Optional font default for runs that omit `fontFamily`. */
  fontFamily?: PageTextFontId;
  /** Rich runs; when absent, `text` is a single implicit segment. */
  segments?: TextSegment[];
};

export type PageBlockYoutube = {
  kind: "youtube";
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 11-char YouTube video id */
  videoId: string;
};

export type PageBlockImage = {
  kind: "image";
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** https URL only */
  src: string;
};

/** Rough hand-drawn shapes share geometry + stroke/fill (Excalidraw-style). */
export type PageRoughShapeKind = "rect" | "ellipse" | "diamond";

export type PageRoughShapeFillStyle = "hachure" | "solid" | "cross-hatch" | "zigzag" | "dots";

type PageRoughShapeFields = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Stroke color, e.g. `#1f1c15` */
  stroke: string;
  /** CSS px-ish width for the border (clamped when persisting). */
  strokeWidthPx?: number;
  /** Optional flat fill (`#rrggbb`, `#rrggbbaa`, or short `rgba()`). */
  fill?: string;
  /**
   * Rough.js fill pattern when `fill` is set. Default at render time is `hachure`
   * so notebook grid stays visible between hatch lines; use `solid` to obscure it.
   */
  fillStyle?: PageRoughShapeFillStyle;
};

export type PageBlockRect = { kind: "rect" } & PageRoughShapeFields;
export type PageBlockEllipse = { kind: "ellipse" } & PageRoughShapeFields;
export type PageBlockDiamond = { kind: "diamond" } & PageRoughShapeFields;

export type PageBlockRoughShape = PageBlockRect | PageBlockEllipse | PageBlockDiamond;

export function isPageRoughShapeBlock(b: PageBlock): b is PageBlockRoughShape {
  return b.kind === "rect" || b.kind === "ellipse" || b.kind === "diamond";
}

export type PageBlock = PageBlockText | PageBlockYoutube | PageBlockImage | PageBlockRoughShape;

const YT_HOST = /^(?:www\.)?(?:youtube\.com|youtube-nocookie\.com|youtu\.be)$/i;

export function extractYoutubeVideoId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (!YT_HOST.test(u.hostname)) return null;
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").slice(0, 11);
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (u.pathname.startsWith("/embed/")) {
      const id = u.pathname.slice(7, 18);
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    const v = u.searchParams.get("v");
    return v && /^[\w-]{11}$/.test(v) ? v : null;
  } catch {
    if (/^[\w-]{11}$/.test(raw)) return raw;
    return null;
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Max world-v2 vertical extent (`y` + `h` in width units) for persisted blocks. */
export const PAGE_BLOCK_WORLD_UY_CEILING = 500;

function clampWorldYh(n: number, min: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return min;
  return Math.min(PAGE_BLOCK_WORLD_UY_CEILING, Math.max(min, n));
}

/** Legacy rects: y,h were page-height fractions. Convert to world uy / height-in-width-units. */
export function migrateBlocksLegacyToWorld(blocks: PageBlock[], pageAspectHeightOverWidth: number): PageBlock[] {
  return blocks.map((b) => ({
    ...b,
    y: b.y * pageAspectHeightOverWidth,
    h: b.h * pageAspectHeightOverWidth,
  }));
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function readRect(v: Record<string, unknown>): { x: number; y: number; w: number; h: number } | null {
  const x = clamp01(Number(v.x));
  const y = clamp01(Number(v.y));
  const w = clamp01(Number(v.w));
  const h = clamp01(Number(v.h));
  if (w < 0.02 || h < 0.02) return null;
  return { x, y, w, h };
}

function readRectWorld(v: Record<string, unknown>): { x: number; y: number; w: number; h: number } | null {
  const x = clamp01(Number(v.x));
  const w = clamp01(Number(v.w));
  const y = clampWorldYh(Number(v.y), 0);
  const h = clampWorldYh(Number(v.h), 0.02);
  if (w < 0.02 || h < 0.02) return null;
  return { x, y, w, h };
}

function readId(v: Record<string, unknown>): string | null {
  const id = v.id;
  if (typeof id !== "string" || id.length < 8 || id.length > 80) return null;
  return id;
}

const HEX_3_6 = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const HEX_8 = /^#[0-9a-f]{8}$/i;

function readHexColor(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (s.length > 12) return null;
  return HEX_3_6.test(s) ? s : null;
}

function readOptionalFill(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim().slice(0, 48);
  if (!s) return undefined;
  if (HEX_3_6.test(s) || HEX_8.test(s)) return s;
  if (/^rgba?\(\s*[\d.\s%,]+\)$/i.test(s) && s.length <= 48) return s;
  return undefined;
}

const ROUGH_SHAPE_FILL_STYLES = new Set(["hachure", "solid", "cross-hatch", "zigzag", "dots"]);

function readRoughShapeFillStyle(v: unknown): PageRoughShapeFillStyle | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return ROUGH_SHAPE_FILL_STYLES.has(s) ? (s as PageRoughShapeFillStyle) : undefined;
}

function pushParsedRoughShape(
  out: PageBlock[],
  kind: PageRoughShapeKind,
  id: string,
  rect: { x: number; y: number; w: number; h: number },
  row: Record<string, unknown>,
) {
  const strokeRaw = readHexColor(row.stroke) ?? "#1f1c15";
  let strokeWidthPx: number | undefined;
  if (typeof row.strokeWidthPx === "number" && Number.isFinite(row.strokeWidthPx)) {
    strokeWidthPx = Math.min(16, Math.max(0.5, row.strokeWidthPx));
  }
  const fill = readOptionalFill(row.fill);
  const fillStyle = readRoughShapeFillStyle(row.fillStyle);
  const extra = {
    id,
    ...rect,
    stroke: strokeRaw,
    ...(strokeWidthPx != null ? { strokeWidthPx } : {}),
    ...(fill != null ? { fill } : {}),
    ...(fill != null && fillStyle != null ? { fillStyle } : {}),
  };
  if (kind === "rect") out.push({ kind: "rect", ...extra });
  else if (kind === "ellipse") out.push({ kind: "ellipse", ...extra });
  else out.push({ kind: "diamond", ...extra });
}

function parsePageBlocksFromRows(rows: unknown[], readRectFn: typeof readRect): PageBlock[] {
  const out: PageBlock[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const id = readId(row);
    const rect = readRectFn(row);
    if (!id || !rect) continue;
    const kind = row.kind;
    if (kind === "text" && typeof row.text === "string") {
      let fontSizePx: number | undefined;
      if (typeof row.fontSizePx === "number" && Number.isFinite(row.fontSizePx)) {
        fontSizePx = Math.min(96, Math.max(8, row.fontSizePx));
      }
      let fontFamily: PageTextFontId | undefined;
      if (typeof row.fontFamily === "string" && isPageTextFontId(row.fontFamily)) {
        fontFamily = row.fontFamily;
      }
      let segments: TextSegment[] | undefined;
      if (Array.isArray(row.segments)) {
        const parsed: TextSegment[] = [];
        for (const s of row.segments) {
          if (!isRecord(s) || typeof s.text !== "string") continue;
          const t = s.text.slice(0, 8000);
          if (!t) continue;
          const seg: TextSegment = { text: t };
          if (typeof s.fontSizePx === "number" && Number.isFinite(s.fontSizePx)) {
            seg.fontSizePx = Math.min(96, Math.max(8, s.fontSizePx));
          }
          if (typeof s.fontFamily === "string" && isPageTextFontId(s.fontFamily)) {
            seg.fontFamily = s.fontFamily;
          }
          parsed.push(seg);
        }
        if (parsed.length) segments = parsed;
      }
      out.push({
        kind: "text",
        id,
        ...rect,
        text: row.text.slice(0, 8000),
        ...(fontSizePx != null ? { fontSizePx } : {}),
        ...(fontFamily != null ? { fontFamily } : {}),
        ...(segments != null ? { segments } : {}),
      });
      continue;
    }
    if (kind === "youtube" && typeof row.videoId === "string" && /^[\w-]{11}$/.test(row.videoId)) {
      out.push({ kind: "youtube", id, ...rect, videoId: row.videoId });
      continue;
    }
    if (kind === "image" && typeof row.src === "string") {
      let ok = false;
      try {
        const u = new URL(row.src);
        ok = u.protocol === "https:" && u.hostname.length > 0 && row.src.length <= 2000;
      } catch {
        ok = false;
      }
      if (ok) out.push({ kind: "image", id, ...rect, src: row.src });
      continue;
    }
    if (kind === "rect" || kind === "ellipse" || kind === "diamond") {
      pushParsedRoughShape(out, kind, id, rect, row);
      continue;
    }
  }
  return out;
}

export function parsePageBlocks(raw: unknown): PageBlock[] {
  if (!Array.isArray(raw)) return [];
  return parsePageBlocksFromRows(raw, readRect);
}

/** Validates blocks stored in world-v2 envelopes (y/h may exceed 1). */
export function parsePageBlocksWorldArray(raw: unknown): PageBlock[] {
  if (!Array.isArray(raw)) return [];
  return parsePageBlocksFromRows(raw, readRectWorld);
}

function isBlocksEnvelope(v: unknown): v is { coordSpace: unknown; blocks: unknown } {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v) && "blocks" in (v as object);
}

export function parsePageBlocksPayload(raw: unknown): { coordSpace: BlocksCoordSpace; blocks: PageBlock[] } {
  if (isBlocksEnvelope(raw)) {
    const o = raw as Record<string, unknown>;
    if (o.coordSpace === "world-v2" && Array.isArray(o.blocks)) {
      return { coordSpace: "world-v2", blocks: parsePageBlocksFromRows(o.blocks, readRectWorld) };
    }
    if (Array.isArray(o.blocks)) {
      return { coordSpace: "legacy-page", blocks: parsePageBlocksFromRows(o.blocks, readRect) };
    }
    return { coordSpace: "legacy-page", blocks: [] };
  }
  if (Array.isArray(raw)) {
    return { coordSpace: "legacy-page", blocks: parsePageBlocks(raw) };
  }
  return { coordSpace: "legacy-page", blocks: [] };
}

export function serializePageBlocksPayload(blocks: PageBlock[]): { coordSpace: "world-v2"; blocks: PageBlock[] } {
  return { coordSpace: "world-v2", blocks };
}
