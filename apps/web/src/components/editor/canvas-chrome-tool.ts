import type { EditorTool } from "@/components/ink/stroke-canvas";

/** Full toolbar palette — `src/toolbar.jsx` / Whiteboard prototype. */
export type ChromeTool =
  | EditorTool
  | "lasso"
  | "shapes"
  | "text"
  | "bucket"
  | "ruler"
  | "laser"
  | "select"
  | "move";

export function isDrawingTool(t: ChromeTool): t is EditorTool {
  return t === "pen" || t === "hl" || t === "eraser";
}
