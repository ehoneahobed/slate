import { isPageTextFontId, type PageBlockText, type PageTextFontId, type TextSegment } from "@/lib/page-blocks/types";
import { defaultNotebookFontSizePx, pageTextFontStack } from "@/lib/page-blocks/text-typography";

export function getTextSegments(block: PageBlockText): TextSegment[] {
  if (block.segments?.length) return normalizeSegments(block.segments);
  return [{ text: block.text }];
}

export function segmentsPlainText(segments: TextSegment[]): string {
  return segments.map((s) => s.text).join("");
}

function segmentKey(s: TextSegment): string {
  return `${s.fontSizePx ?? ""}\0${s.fontFamily ?? ""}`;
}

export function normalizeSegments(segments: TextSegment[]): TextSegment[] {
  const out: TextSegment[] = [];
  for (const raw of segments) {
    const text = typeof raw.text === "string" ? raw.text : "";
    if (!text) continue;
    const fontSizePx =
      typeof raw.fontSizePx === "number" && Number.isFinite(raw.fontSizePx)
        ? Math.min(96, Math.max(8, raw.fontSizePx))
        : undefined;
    const fontFamily =
      typeof raw.fontFamily === "string" && isPageTextFontId(raw.fontFamily) ? raw.fontFamily : undefined;
    const seg: TextSegment = { text, fontSizePx, fontFamily };
    const last = out[out.length - 1];
    if (last && segmentKey(last) === segmentKey(seg) && last.text.length + text.length <= 8000) {
      last.text += text;
    } else {
      out.push(seg);
    }
  }
  return out.length ? out : [{ text: "" }];
}

export function effectiveSegmentStyle(
  seg: TextSegment,
  block: PageBlockText,
  bg: string,
): { fontSizePx: number; fontFamily: PageTextFontId } {
  const defFs = defaultNotebookFontSizePx(bg);
  return {
    fontSizePx: seg.fontSizePx ?? block.fontSizePx ?? defFs,
    fontFamily: seg.fontFamily ?? block.fontFamily ?? "caveat",
  };
}

export function blockWithSegments(block: PageBlockText, segments: TextSegment[]): PageBlockText {
  const n = normalizeSegments(segments);
  const plain = segmentsPlainText(n).slice(0, 8000);
  return {
    ...block,
    segments: n,
    text: plain,
  };
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function segmentsToEditableHtml(block: PageBlockText, bg: string): string {
  const segs = getTextSegments(block);
  const parts: string[] = [];
  for (const seg of segs) {
    const { fontSizePx: fs, fontFamily: ff } = effectiveSegmentStyle(seg, block, bg);
    const body = escapeHtml(seg.text).replace(/\n/g, "<br />");
    const stack = pageTextFontStack(ff);
    parts.push(
      `<span data-fs="${fs}" data-ff="${ff}" style="font-size:${fs}px;font-family:${stack}">${body}</span>`,
    );
  }
  const defFs = block.fontSizePx ?? defaultNotebookFontSizePx(bg);
  const defFf = block.fontFamily ?? "caveat";
  const defStack = pageTextFontStack(defFf);
  return (
    parts.join("") ||
    `<span data-fs="${defFs}" data-ff="${defFf}" style="font-size:${defFs}px;font-family:${defStack}"><br /></span>`
  );
}

export function editableRootToSegments(root: HTMLElement, block: PageBlockText, bg: string): TextSegment[] {
  const defaultFs = block.fontSizePx ?? defaultNotebookFontSizePx(bg);
  const defaultFf = block.fontFamily ?? "caveat";
  const runs: TextSegment[] = [];

  function styleFromEl(el: HTMLElement | null): { fontSizePx: number; fontFamily: PageTextFontId } {
    if (!el || (!el.hasAttribute("data-fs") && !el.hasAttribute("data-ff"))) {
      return { fontSizePx: defaultFs, fontFamily: defaultFf };
    }
    const ds = el.dataset.fs;
    const df = el.dataset.ff;
    const fontSizePx =
      ds && Number.isFinite(Number(ds)) ? Math.min(96, Math.max(8, Math.round(Number(ds)))) : defaultFs;
    const fontFamily = df && isPageTextFontId(df) ? df : defaultFf;
    return { fontSizePx, fontFamily };
  }

  function pushText(text: string, el: HTMLElement | null) {
    if (!text) return;
    const { fontSizePx, fontFamily } = styleFromEl(el);
    const seg: TextSegment = { text };
    if (fontSizePx !== defaultFs) seg.fontSizePx = fontSizePx;
    if (fontFamily !== defaultFf) seg.fontFamily = fontFamily;
    runs.push(seg);
  }

  function walk(node: Node, styleEl: HTMLElement | null) {
    if (node.nodeType === Node.TEXT_NODE) {
      pushText(node.textContent ?? "", styleEl);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toUpperCase();
    if (tag === "BR") {
      pushText("\n", styleEl);
      return;
    }
    const annotated = tag === "SPAN" && (el.hasAttribute("data-fs") || el.hasAttribute("data-ff"));
    const nextStyle = annotated ? el : styleEl;
    for (const c of el.childNodes) {
      walk(c, nextStyle);
    }
  }

  for (const c of root.childNodes) {
    walk(c, null);
  }

  return normalizeSegments(runs);
}

/** Font/size at the caret — used when extending only one axis of a selection style. */
export function caretStyleHint(root: HTMLElement, block: PageBlockText, bg: string): { fontSizePx: number; fontFamily: PageTextFontId } {
  const defaultFs = block.fontSizePx ?? defaultNotebookFontSizePx(bg);
  const defaultFf = block.fontFamily ?? "caveat";
  if (typeof window === "undefined") {
    return { fontSizePx: defaultFs, fontFamily: defaultFf };
  }
  const sel = window.getSelection();
  if (!sel?.anchorNode || !root.contains(sel.anchorNode)) {
    return { fontSizePx: defaultFs, fontFamily: defaultFf };
  }
  let n: Node | null = sel.anchorNode;
  if (n.nodeType === Node.TEXT_NODE) n = (n as Text).parentElement;
  while (n && n !== root) {
    if (n instanceof HTMLElement && (n.hasAttribute("data-fs") || n.hasAttribute("data-ff"))) {
      const ds = n.dataset.fs;
      const df = n.dataset.ff;
      const fontSizePx =
        ds && Number.isFinite(Number(ds)) ? Math.min(96, Math.max(8, Math.round(Number(ds)))) : defaultFs;
      const fontFamily = df && isPageTextFontId(df) ? df : defaultFf;
      return { fontSizePx, fontFamily };
    }
    n = n.parentElement;
  }
  return { fontSizePx: defaultFs, fontFamily: defaultFf };
}

export function wrapSelectionWithStyle(
  root: HTMLElement,
  patch: { fontSizePx: number; fontFamily: PageTextFontId },
): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return false;

  const span = document.createElement("span");
  span.setAttribute("data-fs", String(patch.fontSizePx));
  span.setAttribute("data-ff", patch.fontFamily);
  span.style.fontSize = `${patch.fontSizePx}px`;
  span.style.fontFamily = pageTextFontStack(patch.fontFamily);

  try {
    const frag = range.extractContents();
    span.appendChild(frag);
    range.insertNode(span);
    sel.removeAllRanges();
    const nr = document.createRange();
    nr.selectNodeContents(span);
    nr.collapse(false);
    sel.addRange(nr);
    return true;
  } catch {
    return false;
  }
}
