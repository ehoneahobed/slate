import type { PageBlock } from "@/lib/page-blocks/types";
import { getTextSegments, segmentsPlainText } from "@/lib/page-blocks/text-segments";

export type PageFindMatch =
  | { id: "title"; target: "title" }
  | { id: string; target: "block"; blockId: string; snippet: string };

function snippetAround(text: string, needle: string, pad = 44): string {
  const lower = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const idx = lower.indexOf(lowerNeedle);
  if (idx < 0) return text.slice(0, Math.min(96, text.length));
  const start = Math.max(0, idx - pad);
  const end = Math.min(text.length, idx + needle.length + pad);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

/** Case-insensitive matches: page title + plain text of all text blocks (one row per block that contains the query). */
export function buildPageFindMatches(title: string, blocks: PageBlock[], rawQuery: string): PageFindMatch[] {
  const needle = rawQuery.trim();
  if (!needle) return [];

  const lowerNeedle = needle.toLowerCase();
  const out: PageFindMatch[] = [];

  if (title.toLowerCase().includes(lowerNeedle)) {
    out.push({ id: "title", target: "title" });
  }

  for (const b of blocks) {
    if (b.kind === "sticky") {
      const plain = b.text ?? "";
      if (!plain.toLowerCase().includes(lowerNeedle)) continue;
      out.push({
        id: b.id,
        target: "block",
        blockId: b.id,
        snippet: snippetAround(plain, needle),
      });
      continue;
    }
    if (b.kind === "math") {
      const plain = b.latex ?? "";
      if (!plain.toLowerCase().includes(lowerNeedle)) continue;
      out.push({
        id: b.id,
        target: "block",
        blockId: b.id,
        snippet: snippetAround(plain, needle),
      });
      continue;
    }
    if (b.kind === "code") {
      const plain = `${b.filename ?? ""}\n${b.code ?? ""}`;
      if (!plain.toLowerCase().includes(lowerNeedle)) continue;
      out.push({
        id: b.id,
        target: "block",
        blockId: b.id,
        snippet: snippetAround(plain, needle),
      });
      continue;
    }
    if (b.kind !== "text") continue;
    const plain = segmentsPlainText(getTextSegments(b));
    if (!plain.toLowerCase().includes(lowerNeedle)) continue;
    out.push({
      id: b.id,
      target: "block",
      blockId: b.id,
      snippet: snippetAround(plain, needle),
    });
  }

  return out;
}
