/**
 * Rough.js options aligned with Excalidraw v0.18 `generateRoughOptions` /
 * `adjustRoughness` for rectangle elements (solid stroke, artist roughness).
 * @see https://github.com/excalidraw/excalidraw/blob/v0.18.0/packages/excalidraw/scene/Shape.ts
 */

import type { Options } from "roughjs/bin/core";

/** Mirrors `ROUGHNESS` in Excalidraw `constants.ts` (architect / artist / cartoonist). */
export const EXCALIDRAW_ROUGHNESS = {
  architect: 0,
  artist: 1,
  cartoonist: 2,
} as const;

/**
 * Same logic as Excalidraw’s `adjustRoughness` for a plain rectangle (no
 * roundness / linear-element branches).
 */
export function adjustRoughnessExcalidraw(roughness: number, widthPx: number, heightPx: number): number {
  const maxSize = Math.max(widthPx, heightPx);
  const minSize = Math.min(widthPx, heightPx);
  if (minSize >= 20 && maxSize >= 50) {
    return roughness;
  }
  return Math.min(roughness / (maxSize < 10 ? 3 : 2), 2.5);
}

export type ExcalidrawRectFillStyle = "hachure" | "solid" | "cross-hatch" | "zigzag" | "dots";

/**
 * Builds Rough `Options` for a rectangle matching Excalidraw’s
 * `generateRoughOptions` + rectangle branch (stroke + optional fill).
 */
export function buildExcalidrawRoughRectOptions(args: {
  seed: number;
  strokeColor: string;
  strokeWidth: number;
  /** Inner width/height used for `adjustRoughness` (px). */
  widthPx: number;
  heightPx: number;
  /** Excalidraw default new shape: `artist` (1). */
  roughnessLevel?: (typeof EXCALIDRAW_ROUGHNESS)[keyof typeof EXCALIDRAW_ROUGHNESS];
  fillColor?: string;
  /** When fill is set: Excalidraw default prop is `solid`, but hachure keeps grid visible. */
  fillStyle?: ExcalidrawRectFillStyle;
}): Options {
  const level = args.roughnessLevel ?? EXCALIDRAW_ROUGHNESS.artist;
  const sw = args.strokeWidth;
  const adj = adjustRoughnessExcalidraw(level, args.widthPx, args.heightPx);

  const base: Options = {
    seed: args.seed,
    strokeLineDash: undefined,
    disableMultiStroke: false,
    strokeWidth: sw,
    fillWeight: sw / 2,
    hachureGap: sw * 4,
    roughness: adj,
    stroke: args.strokeColor,
    preserveVertices: level < EXCALIDRAW_ROUGHNESS.cartoonist,
  };

  if (!args.fillColor) {
    return base;
  }

  const fillStyle = args.fillStyle ?? "hachure";
  return {
    ...base,
    fill: args.fillColor,
    fillStyle,
  };
}
