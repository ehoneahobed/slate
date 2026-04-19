/** ~1.25% of sheet width — aligns blocks on a fine grid without feeling “steppy” on small moves. */
export const BLOCK_SNAP_GRID = 1 / 80;

function snapScalar(v: number, grid: number): number {
  if (grid <= 0) return v;
  return Math.round(v / grid) * grid;
}

/** Snap top-left for world-v2 (x,w ∈ [0,1]; y,h in uy). Hold Shift in the editor to skip snapping. */
export function snapBlockPositionWorld(
  x: number,
  y: number,
  w: number,
  h: number,
  uyMax: number,
): { x: number; y: number } {
  let sx = snapScalar(x, BLOCK_SNAP_GRID);
  let sy = snapScalar(y, BLOCK_SNAP_GRID);
  sx = Math.min(1 - w, Math.max(0, sx));
  sy = Math.min(uyMax - h, Math.max(0, sy));
  return { x: sx, y: sy };
}

export function snapBlockSizeWorld(
  x: number,
  y: number,
  w: number,
  h: number,
  uyMax: number,
  minW: number,
  minH: number,
): { w: number; h: number } {
  let sw = Math.max(minW, snapScalar(w, BLOCK_SNAP_GRID));
  let sh = Math.max(minH, snapScalar(h, BLOCK_SNAP_GRID));
  sw = Math.min(1 - x, sw);
  sh = Math.min(uyMax - y, sh);
  sw = Math.max(minW, sw);
  sh = Math.max(minH, sh);
  return { w: sw, h: sh };
}

/** Legacy rects: all dimensions are 0–1 fractions of the page. */
export function snapBlockPositionLegacy(x: number, y: number, w: number, h: number): { x: number; y: number } {
  let sx = snapScalar(x, BLOCK_SNAP_GRID);
  let sy = snapScalar(y, BLOCK_SNAP_GRID);
  sx = Math.min(1 - w, Math.max(0, sx));
  sy = Math.min(1 - h, Math.max(0, sy));
  return { x: sx, y: sy };
}

export function snapBlockSizeLegacy(
  x: number,
  y: number,
  w: number,
  h: number,
  minW: number,
  minH: number,
): { w: number; h: number } {
  let sw = Math.max(minW, snapScalar(w, BLOCK_SNAP_GRID));
  let sh = Math.max(minH, snapScalar(h, BLOCK_SNAP_GRID));
  sw = Math.min(1 - x, sw);
  sh = Math.min(1 - y, sh);
  sw = Math.max(minW, sw);
  sh = Math.max(minH, sh);
  return { w: sw, h: sh };
}
