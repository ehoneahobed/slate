"use client";

import { useLayoutEffect, useRef } from "react";
import rough from "roughjs";
import { buildExcalidrawRoughRectOptions } from "@/lib/page-blocks/excalidraw-rough-rect";
import { stableRoughSeedFromId } from "@/lib/page-blocks/rough-seed";
import type { ExcalidrawRectFillStyle } from "@/lib/page-blocks/excalidraw-rough-rect";

export type RoughShapeCanvasVariant = "rect" | "ellipse" | "diamond";

type Props = {
  blockId: string;
  stroke: string;
  strokeWidthPx: number;
  /** Omitted or transparent = stroke only (grid / paper shows through). */
  fill?: string;
  /** When `fill` is set: default render uses `hachure` unless overridden. */
  fillStyle?: ExcalidrawRectFillStyle;
  /** Bounding-box shape drawn with the same Rough options as rectangles. */
  variant?: RoughShapeCanvasVariant;
  className?: string;
};

function normalizeFill(fill: string | undefined): string | undefined {
  if (!fill) return undefined;
  const t = fill.trim().toLowerCase();
  if (t === "transparent" || t === "none") return undefined;
  return fill;
}

/**
 * Hand-drawn rectangle (Rough.js) using the same option strategy as Excalidraw
 * for rectangles (`generateRoughOptions` + `adjustRoughness`).
 */
export function RoughRectCanvas({
  blockId,
  stroke,
  strokeWidthPx,
  fill: fillProp,
  fillStyle,
  variant = "rect",
  className,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const cv = canvasRef.current;
    if (!wrap || !cv) return;

    const paint = () => {
      const w = Math.max(0, Math.floor(wrap.clientWidth));
      const h = Math.max(0, Math.floor(wrap.clientHeight));
      const fill = normalizeFill(fillProp);
      const sw = Math.min(16, Math.max(1, Math.round(strokeWidthPx)));
      if (w < 4 || h < 4) {
        cv.width = 0;
        cv.height = 0;
        return;
      }

      const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
      cv.width = Math.floor(w * dpr);
      cv.height = Math.floor(h * dpr);
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;

      const ctx = cv.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      const pad = Math.ceil(sw * 1.35) + 3;
      const rw = Math.max(1, w - 2 * pad);
      const rh = Math.max(1, h - 2 * pad);

      const rc = rough.canvas(cv);
      const opts = buildExcalidrawRoughRectOptions({
        seed: stableRoughSeedFromId(blockId),
        strokeColor: stroke,
        strokeWidth: sw,
        widthPx: rw,
        heightPx: rh,
        fillColor: fill,
        ...(fill ? { fillStyle: fillStyle ?? "hachure" } : {}),
      });

      let drawable;
      if (variant === "ellipse") {
        drawable = rc.ellipse(pad + rw / 2, pad + rh / 2, rw, rh, opts);
      } else if (variant === "diamond") {
        const pts: [number, number][] = [
          [pad + rw / 2, pad],
          [pad + rw, pad + rh / 2],
          [pad + rw / 2, pad + rh],
          [pad, pad + rh / 2],
        ];
        drawable = rc.polygon(pts, opts);
      } else {
        drawable = rc.rectangle(pad, pad, rw, rh, opts);
      }

      if (ctx) {
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
      }
      rc.draw(drawable);
    };

    paint();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => paint()) : null;
    ro?.observe(wrap);
    return () => ro?.disconnect();
  }, [blockId, stroke, strokeWidthPx, fillProp, fillStyle, variant]);

  return (
    <div ref={wrapRef} className={className ?? "absolute inset-0 min-h-0 min-w-0"}>
      <canvas ref={canvasRef} className="pointer-events-none absolute left-0 top-0 h-full w-full" aria-hidden />
    </div>
  );
}
