/**
 * Ink stroke payload — persisted in `page.strokesData` JSONB.
 * - `legacy-page`: `[nx, ny]` with nx, ny ∈ [0,1] relative to sheet width/height.
 * - `world-v2`: `[nx, uy]` with nx ∈ [0,1] relative to width; uy = pxFromTop / sheetWidth (height in “width units”).
 */
export type InkTool = "pen" | "hl" | "erase";

export type StrokeCoordSpace = "legacy-page" | "world-v2";

export type InkStroke = {
  tool: Exclude<InkTool, "erase">;
  color: string;
  width: number;
  pts: [number, number][];
};

export function isInkStroke(value: unknown): value is InkStroke {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.tool !== "pen" && v.tool !== "hl") return false;
  if (typeof v.color !== "string") return false;
  if (typeof v.width !== "number") return false;
  if (!Array.isArray(v.pts)) return false;
  for (const p of v.pts) {
    if (!Array.isArray(p) || p.length !== 2) return false;
    const x = p[0];
    const y = p[1];
    if (typeof x !== "number" || typeof y !== "number") return false;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x < -1e-3 || x > 1 + 1e-3) return false;
    if (y < -1e-3 || y > 1e3) return false;
  }
  return true;
}

export function parseStrokes(raw: unknown): InkStroke[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isInkStroke);
}

function isStrokeEnvelope(v: unknown): v is { coordSpace: unknown; strokes: unknown } {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v) && "strokes" in (v as object);
}

/**
 * Reads persisted `strokesData`: legacy raw array or `{ coordSpace: "world-v2", strokes }`.
 */
export function parseStrokesPayload(raw: unknown): { coordSpace: StrokeCoordSpace; strokes: InkStroke[] } {
  if (isStrokeEnvelope(raw)) {
    const o = raw as Record<string, unknown>;
    if (o.coordSpace === "world-v2" && Array.isArray(o.strokes)) {
      return { coordSpace: "world-v2", strokes: parseStrokes(o.strokes) };
    }
  }
  if (Array.isArray(raw)) {
    return { coordSpace: "legacy-page", strokes: parseStrokes(raw) };
  }
  return { coordSpace: "legacy-page", strokes: [] };
}

export function serializeStrokesPayload(strokes: InkStroke[]): { coordSpace: "world-v2"; strokes: InkStroke[] } {
  return { coordSpace: "world-v2", strokes };
}
