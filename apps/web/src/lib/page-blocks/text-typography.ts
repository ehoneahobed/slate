import type { CSSProperties } from "react";
import type { PageTextFontId } from "@/lib/page-blocks/types";

/** Preset px sizes for the handwriting toolbar. */
export const NOTEBOOK_TEXT_SIZE_PRESETS = [14, 16, 18, 21, 24, 28, 32, 40] as const;

/** CSS `font-family` stacks aligned with `app/layout.tsx` variables. */
export function pageTextFontStack(id: PageTextFontId): string {
  switch (id) {
    case "instrument":
      return "var(--font-instrument-serif), ui-serif, Georgia, serif";
    case "inter":
      return "var(--font-inter), system-ui, sans-serif";
    case "jetbrains-mono":
      return "var(--font-jetbrains-mono), ui-monospace, monospace";
    case "caveat":
    default:
      return "var(--font-caveat), cursive";
  }
}

/** Padding for text blocks — shared by mixed-run (segment) layout and background rhythm. */
export function notebookTextPadding(backgroundType: string): string {
  switch (backgroundType) {
    case "ruled":
      return "5px 10px 10px 14px";
    case "cornell":
      return "4px 10px 10px 14px";
    case "grid":
      return "3px 8px 8px 12px";
    default:
      return "6px 10px 10px 12px";
  }
}

/**
 * Top/left padding of the note body in world-v2 units (`px / sheetWidth`) so the block frame can be
 * shifted: the content box (where the caret sits) then lines up with the click under `notebookTextPadding`.
 */
export function notebookTextContentInsetWorld(
  backgroundType: string,
  sheetWidthPx: number,
): { dnx: number; duy: number } {
  const pad = notebookTextPadding(backgroundType);
  const nums = pad.match(/\d+/g)?.map((m) => Number.parseInt(m, 10)) ?? [];
  let topPx = 0;
  let leftPx = 0;
  if (nums.length === 4) {
    topPx = nums[0];
    leftPx = nums[3];
  } else if (nums.length === 2) {
    topPx = nums[0];
    leftPx = nums[1];
  } else if (nums.length === 1) {
    topPx = leftPx = nums[0];
  }
  const w = Math.max(sheetWidthPx, 1e-6);
  return { dnx: leftPx / w, duy: topPx / w };
}

/** Default body size (px) for handwritten notes — matches ruled/cornell rhythm when no per-block override. */
export function defaultNotebookFontSizePx(backgroundType: string): number {
  switch (backgroundType) {
    case "ruled":
    case "cornell":
      return 21;
    case "grid":
      return 16;
    default:
      return 18;
  }
}

/**
 * Typography for text blocks — line rhythm follows page background unless `fontSizePx` overrides size.
 * Optional `fontFamily` swaps the handwriting face (including background-default sizes).
 */
export function notebookTextStyle(
  backgroundType: string,
  fontSizePx?: number | null,
  fontFamily?: PageTextFontId | null,
): CSSProperties {
  const ink: CSSProperties = {
    fontFamily: pageTextFontStack(fontFamily ?? "caveat"),
    color: "var(--ink)",
  };

  if (fontSizePx != null && Number.isFinite(fontSizePx)) {
    const fs = Math.min(96, Math.max(8, fontSizePx));
    return {
      ...ink,
      fontSize: `${fs}px`,
      lineHeight: 1.45,
      padding: notebookTextPadding(backgroundType),
    };
  }

  switch (backgroundType) {
    case "ruled":
      return { ...ink, lineHeight: "32px", fontSize: "21px", padding: notebookTextPadding("ruled") };
    case "cornell":
      return { ...ink, lineHeight: "31px", fontSize: "21px", padding: notebookTextPadding("cornell") };
    case "grid":
      return { ...ink, lineHeight: "22px", fontSize: "16px", padding: notebookTextPadding("grid") };
    default:
      return {
        ...ink,
        lineHeight: 1.45,
        fontSize: "clamp(16px, 2.2vw, 22px)",
        padding: notebookTextPadding("plain"),
      };
  }
}
