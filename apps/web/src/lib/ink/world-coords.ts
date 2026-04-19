import type { PageSizeId } from "@/lib/ink/page-size";
import { normalizePageSize } from "@/lib/ink/page-size";
import type { InkStroke } from "@/lib/ink/types";

/**
 * World document space (north star): horizontal fraction is always relative to sheet **width**;
 * vertical uses the **same length unit as width** (so changing only page height does not remap ink).
 * Stored as `[nx, uy]` where `nx ∈ [0,1]`, `uy = pxFromTop / sheetWidth` (can exceed 1 on tall pages).
 */
export const WORLD_REF_W = 1180;

/** Height / width of the paper preset — used only to migrate legacy page-normalized data once. */
export function pageLayoutAspectRatio(pageSize: PageSizeId): number {
  switch (pageSize) {
    case "16_10":
      return 10 / 16;
    case "a4":
      return 297 / 210;
    case "letter":
      return 11 / 8.5;
    case "infinite":
      return 3200 / WORLD_REF_W;
    default:
      return 10 / 16;
  }
}

export function pageLayoutAspectFromUnknown(raw: string | null | undefined): number {
  return pageLayoutAspectRatio(normalizePageSize(raw));
}

/** Legacy strokes: y was normalized to page height. Convert to world `uy = y_page * (h/w)`. */
export function migrateStrokesLegacyToWorld(strokes: InkStroke[], pageAspectHeightOverWidth: number): InkStroke[] {
  return strokes.map((s) => ({
    ...s,
    pts: s.pts.map(([nx, ny]) => [nx, ny * pageAspectHeightOverWidth] as [number, number]),
  }));
}

