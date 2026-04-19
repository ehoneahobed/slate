"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { InkStroke, StrokeCoordSpace } from "@/lib/ink/types";
import type { UiTheme } from "@/lib/user-settings";

function dist2(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function pointSegDist2(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = px - x1;
  const wy = py - y1;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return dist2(px, py, x1, y1);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return dist2(px, py, x2, y2);
  const t = c1 / c2;
  const projx = x1 + t * vx;
  const projy = y1 + t * vy;
  return dist2(px, py, projx, projy);
}

function eraseStrokes(
  strokes: InkStroke[],
  eraserPts: [number, number][],
  radiusPx: number,
  w: number,
  h: number,
  coordSpace: StrokeCoordSpace,
) {
  if (!eraserPts.length) return strokes;
  const r2 = radiusPx * radiusPx;
  const toPx =
    coordSpace === "world-v2"
      ? (nx: number, uy: number) => [nx * w, uy * w] as const
      : (nx: number, ny: number) => [nx * w, ny * h] as const;

  function nearEraser(px: number, py: number) {
    for (let i = 0; i < eraserPts.length; i++) {
      const [ex, ey] = eraserPts[i];
      if (dist2(px, py, ex, ey) <= r2) return true;
    }
    for (let i = 1; i < eraserPts.length; i++) {
      const [x1, y1] = eraserPts[i - 1];
      const [x2, y2] = eraserPts[i];
      if (pointSegDist2(px, py, x1, y1, x2, y2) <= r2) return true;
    }
    return false;
  }

  return strokes.filter((st) => {
    for (let i = 0; i < st.pts.length; i++) {
      const [px, py] = toPx(st.pts[i][0], st.pts[i][1]);
      if (nearEraser(px, py)) return false;
    }
    return true;
  });
}

/** Draw one stroke without clearing the canvas (caller clears once per frame). */
function drawStrokePath(
  ctx: CanvasRenderingContext2D,
  stroke: InkStroke,
  cw: number,
  ch: number,
  coordSpace: StrokeCoordSpace,
) {
  if (stroke.pts.length < 2) return;
  const pts =
    coordSpace === "world-v2"
      ? stroke.pts.map(([nx, uy]) => [nx * cw, uy * cw] as const)
      : stroke.pts.map(([nx, ny]) => [nx * cw, ny * ch] as const);
  const scale = Math.max(0.6, cw / 900);
  const lw = Math.max(0.8, stroke.width * scale);

  ctx.save();
  if (stroke.tool === "hl") {
    const dark =
      typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark";
    /** `multiply` on light paper; `screen` keeps highlighter visible on dark UI. */
    ctx.globalCompositeOperation = dark ? "screen" : "multiply";
    ctx.globalAlpha = dark ? 0.38 : 0.42;
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.tool === "hl" ? lw * 2.8 : lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  ctx.restore();
}

export type EditorTool = "pen" | "hl" | "eraser";

type Props = {
  strokes: InkStroke[];
  onChange: (next: InkStroke[]) => void;
  tool: EditorTool;
  color: string;
  width: number;
  readOnly: boolean;
  coordSpace: StrokeCoordSpace;
  /**
   * When `coordSpace === "world-v2"`, use this element’s bounding rect for `(nx, uy)` so ink matches
   * the same world space as `PageBlocksLayer` (typically the shared ink surface root).
   */
  worldNormRootRef?: RefObject<HTMLElement | null>;
  /** When the UI theme changes, strokes are repainted (highlighter blend mode depends on theme). */
  uiTheme?: UiTheme;
};

export function StrokeCanvas({
  strokes,
  onChange,
  tool,
  color,
  width,
  readOnly,
  coordSpace,
  worldNormRootRef,
  uiTheme,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef(strokes);
  const drawingRef = useRef<InkStroke | null>(null);
  const eraserBufRef = useRef<[number, number][] | null>(null);
  /** Avoid resetting canvas bitmap every frame (subpixel jitter clears ink and flashes over DOM below). */
  const lastBitmapRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = wrap.clientWidth;
    const ch = wrap.clientHeight;
    if (cw < 2 || ch < 2) return;

    const nextW = Math.max(1, Math.round(cw * dpr));
    const nextH = Math.max(1, Math.round(ch * dpr));
    const { w: lw, h: lh } = lastBitmapRef.current;
    if (lw !== nextW || lh !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
      lastBitmapRef.current = { w: nextW, h: nextH };
    }

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    ctx.clearRect(0, 0, cw, ch);
    for (const st of strokesRef.current) {
      drawStrokePath(ctx, st, cw, ch, coordSpace);
    }
    const cur = drawingRef.current;
    if (cur && cur.pts.length > 1) {
      drawStrokePath(ctx, cur, cw, ch, coordSpace);
    }

    if (tool === "eraser" && eraserBufRef.current && eraserBufRef.current.length > 1) {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "#c45d20";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      const e = eraserBufRef.current;
      ctx.moveTo(e[0][0], e[0][1]);
      for (let i = 1; i < e.length; i++) ctx.lineTo(e[i][0], e[i][1]);
      ctx.stroke();
      ctx.restore();
    }
  }, [tool, coordSpace]);

  useEffect(() => {
    paint();
  }, [strokes, paint, uiTheme]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => paint());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [paint]);

  const canInk = !readOnly && (tool === "pen" || tool === "hl");
  const canErase = !readOnly && tool === "eraser";

  function norm(e: React.PointerEvent, wrap: HTMLDivElement) {
    const root = coordSpace === "world-v2" && worldNormRootRef?.current ? worldNormRootRef.current : wrap;
    const r = root.getBoundingClientRect();
    const x = (e.clientX - r.left) / Math.max(r.width, 1e-6);
    if (coordSpace === "world-v2") {
      const nx = Math.min(1, Math.max(0, x));
      const uy = Math.max(0, (e.clientY - r.top) / Math.max(r.width, 1e-6));
      return [nx, uy] as const;
    }
    const y = (e.clientY - r.top) / Math.max(r.height, 1e-6);
    return [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))] as const;
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (readOnly) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (canInk) {
      wrap.setPointerCapture(e.pointerId);
      const [nx, ny] = norm(e, wrap);
      const inkTool = tool === "hl" ? "hl" : "pen";
      drawingRef.current = { tool: inkTool, color, width, pts: [[nx, ny]] };
      paint();
    } else if (canErase) {
      wrap.setPointerCapture(e.pointerId);
      const r = wrap.getBoundingClientRect();
      eraserBufRef.current = [[e.clientX - r.left, e.clientY - r.top]];
      paint();
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (drawingRef.current) {
      const [nx, ny] = norm(e, wrap);
      const last = drawingRef.current.pts[drawingRef.current.pts.length - 1];
      if (dist2(nx, ny, last[0], last[1]) < 1e-6) return;
      drawingRef.current.pts.push([nx, ny]);
      paint();
    } else if (eraserBufRef.current) {
      const r = wrap.getBoundingClientRect();
      eraserBufRef.current.push([e.clientX - r.left, e.clientY - r.top]);
      paint();
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const wrap = wrapRef.current;
    if (wrap?.hasPointerCapture(e.pointerId)) {
      try {
        wrap.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    if (drawingRef.current && drawingRef.current.pts.length > 1) {
      const next = strokesRef.current.concat([drawingRef.current]);
      drawingRef.current = null;
      onChange(next);
    } else {
      drawingRef.current = null;
    }

    if (eraserBufRef.current && eraserBufRef.current.length > 0) {
      const cw = wrap ? wrap.clientWidth : 1;
      const ch = wrap ? wrap.clientHeight : 1;
      const radius = Math.max(14, width * 4);
      const next = eraseStrokes(strokesRef.current, eraserBufRef.current, radius, cw, ch, coordSpace);
      eraserBufRef.current = null;
      if (next.length !== strokesRef.current.length) {
        onChange(next);
      } else {
        paint();
      }
    }
    paint();
  }

  const capture = canInk || canErase;

  return (
    <div
      ref={wrapRef}
      className="isolate"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 6,
        touchAction: "none",
        pointerEvents: capture ? "auto" : "none",
        cursor: canInk ? "crosshair" : canErase ? "cell" : "default",
      }}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full bg-transparent"
        style={{ background: "transparent" }}
      />
    </div>
  );
}
