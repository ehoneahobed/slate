/**
 * World-v2 sheet coordinates: horizontal fraction `nx` of sheet width; vertical `uy` =
 * pixels from sheet top ÷ sheet width (same unit as ink strokes).
 *
 * All callers should normalize from the **same** DOMRect (typically the ink surface root)
 * so blocks, strokes, and placement gestures line up.
 */

export type SheetWorldPoint = { nx: number; uy: number };

export function sheetWorldFromClientRect(rect: DOMRect, clientX: number, clientY: number): SheetWorldPoint {
  const w = Math.max(rect.width, 1e-6);
  const nx = Math.min(1, Math.max(0, (clientX - rect.left) / w));
  const uy = Math.max(0, (clientY - rect.top) / w);
  return { nx, uy };
}

/** Vertical extent of the sheet in world units (`height_px / width_px`). */
export function sheetWorldUyMax(rect: DOMRect): number {
  return rect.height / Math.max(rect.width, 1e-6);
}
