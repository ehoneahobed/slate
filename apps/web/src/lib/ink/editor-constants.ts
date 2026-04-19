import type { UiTheme } from "@/lib/user-settings";

/** Shared with page editor UI — mirrors `Whiteboard.html` / `src/toolbar.jsx` prototype (light paper). */
export const PEN_COLORS = ["#1f1c15", "#b9432b", "#b9722e", "#8a7215", "#3b6e86", "#5a7f4a", "#6b5aa6", "#c24b7a"] as const;

/** Same hues, tuned for visibility on `html[data-theme="dark"]` sheet chrome. */
export const PEN_SWATCHES_DARK_BG = [
  "#ece9e2",
  "#ff8a7a",
  "#ffb86c",
  "#f5e88a",
  "#7ec8e3",
  "#9fe6a8",
  "#d4c4ff",
  "#ff8cc8",
] as const;

export const PEN_SIZES = [1.5, 2.5, 4, 7, 12] as const;

export function penSwatches(theme: UiTheme): readonly string[] {
  return theme === "dark" ? PEN_SWATCHES_DARK_BG : PEN_COLORS;
}

/** Default pen / shape stroke on the canvas — mirrors `globals.css` `--ink` per theme. */
export function defaultPenStrokeColor(theme: UiTheme): string {
  if (theme === "dark") return "#ece9e2";
  if (theme === "clean") return "#0f1318";
  return "#1f1c15";
}
