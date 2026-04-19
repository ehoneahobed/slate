import type { CSSProperties } from "react";

/** Paper size presets — matches prototype inspector (`src/inspector.jsx`). */

export const PAGE_SIZE_IDS = ["16_10", "a4", "letter", "infinite"] as const;
export type PageSizeId = (typeof PAGE_SIZE_IDS)[number];

/** Shared min height for “infinite” paper — ink + text use one surface this tall. */
export const INFINITE_PAGE_MIN_HEIGHT = "min(220vh, 3200px)" as const;

/** Ink points are normalized 0–1 to the current page rectangle (trim sizes or the infinite scroll sheet). */

export function normalizePageSize(raw: string | null | undefined): PageSizeId {
  if (raw && (PAGE_SIZE_IDS as readonly string[]).includes(raw)) return raw as PageSizeId;
  return "16_10";
}

export const PAGE_SIZE_LABELS: Record<PageSizeId, string> = {
  "16_10": "16:10",
  a4: "A4",
  letter: "Letter",
  infinite: "Infinite",
};

/**
 * Outer “paper card” — trim size / infinite scroll shell.
 */
export function pageFrameStyle(size: PageSizeId): CSSProperties {
  const maxW = "min(1180px, 100%)";
  switch (size) {
    case "16_10":
      return { width: "100%", maxWidth: maxW, aspectRatio: "16 / 10" };
    case "a4":
      return { width: "100%", maxWidth: maxW, aspectRatio: "210 / 297" };
    case "letter":
      return { width: "100%", maxWidth: maxW, aspectRatio: "8.5 / 11" };
    case "infinite":
      return {
        width: "100%",
        maxWidth: maxW,
        minHeight: INFINITE_PAGE_MIN_HEIGHT,
        height: "auto",
      };
    default:
      return { width: "100%", maxWidth: maxW, aspectRatio: "16 / 10" };
  }
}

