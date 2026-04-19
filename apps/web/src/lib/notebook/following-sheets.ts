import { inArray } from "drizzle-orm";
import { getPageContextForOwner } from "@/lib/access/page";
import { db } from "@/lib/db";
import { pages, sections } from "@/lib/db/schema";
import { normalizePageSize, type PageSizeId } from "@/lib/ink/page-size";
import type { InkStroke } from "@/lib/ink/types";
import type { PageBlock } from "@/lib/page-blocks/types";
import { resolvePageSheetCoords } from "@/lib/page-sheet/coords";
import type { OutlineSection } from "@/lib/notebook/outline";

const MAX_SHEETS = 24;

export type FollowingSheetPayload = {
  pageId: string;
  title: string;
  sectionTitle: string;
  /** True when this page starts a new section after the previous sheet (or after the live page). */
  sectionBreak: boolean;
  backgroundType: string;
  pageSize: PageSizeId;
  strokes: InkStroke[];
  blocks: PageBlock[];
};

export type LoadFollowingSheetsResult = {
  sheets: FollowingSheetPayload[];
  /** Additional pages after this batch (not loaded for performance). */
  moreCount: number;
};

function flattenOutline(outline: OutlineSection[]) {
  const flat: { pageId: string; title: string; sectionId: string; sectionTitle: string }[] = [];
  for (const sec of [...outline].sort((a, b) => a.position - b.position)) {
    const nav = [...sec.pages].sort((a, b) => a.position - b.position);
    for (const p of nav) {
      flat.push({
        pageId: p.id,
        title: p.title,
        sectionId: sec.id,
        sectionTitle: sec.title,
      });
    }
  }
  return flat;
}

/**
 * Loads read-only sheet payloads for every page after `currentPageId` in notebook order
 * (sections by position, pages by position), capped for performance.
 */
export async function loadFollowingSheets(
  notebookId: string,
  outline: OutlineSection[],
  currentPageId: string,
  userId: string,
): Promise<LoadFollowingSheetsResult> {
  const ordered = flattenOutline(outline);
  const idx = ordered.findIndex((x) => x.pageId === currentPageId);
  if (idx < 0) return { sheets: [], moreCount: 0 };

  const tail = ordered.slice(idx + 1);
  const slice = tail.slice(0, MAX_SHEETS);
  const moreCount = tail.length - slice.length;

  const contexts = await Promise.all(slice.map((meta) => getPageContextForOwner(meta.pageId, userId)));

  const sheets: FollowingSheetPayload[] = [];
  let prevSectionId: string | null = ordered[idx]?.sectionId ?? null;

  for (let i = 0; i < slice.length; i++) {
    const meta = slice[i]!;
    const ctx = contexts[i];
    if (!ctx || ctx.notebook.id !== notebookId) continue;

    const coords = resolvePageSheetCoords({
      strokesData: ctx.page.strokesData,
      blocksData: ctx.page.blocksData ?? [],
      pageSize: ctx.page.pageSize,
    });

    const sectionBreak = prevSectionId !== null && meta.sectionId !== prevSectionId;

    sheets.push({
      pageId: meta.pageId,
      title: meta.title,
      sectionTitle: meta.sectionTitle,
      sectionBreak,
      backgroundType: ctx.page.backgroundType,
      pageSize: normalizePageSize(ctx.page.pageSize ?? undefined),
      strokes: coords.strokes,
      blocks: coords.blocks,
    });

    prevSectionId = meta.sectionId;
  }

  return { sheets, moreCount };
}

/**
 * Same ordering as {@link loadFollowingSheets}, but for public share views: loads page rows
 * when they belong to `notebookId` (no workspace owner check). Caller must have already
 * validated share access for this notebook.
 */
export async function loadFollowingSheetsForShare(
  notebookId: string,
  outline: OutlineSection[],
  currentPageId: string,
): Promise<LoadFollowingSheetsResult> {
  const ordered = flattenOutline(outline);
  const idx = ordered.findIndex((x) => x.pageId === currentPageId);
  if (idx < 0) return { sheets: [], moreCount: 0 };

  const tail = ordered.slice(idx + 1);
  const slice = tail.slice(0, MAX_SHEETS);
  const moreCount = tail.length - slice.length;
  if (slice.length === 0) return { sheets: [], moreCount };

  const pageIds = slice.map((s) => s.pageId);
  const pageRows = await db.select().from(pages).where(inArray(pages.id, pageIds));
  const pageById = new Map(pageRows.map((p) => [p.id, p]));

  const sectionIdSet = new Set(pageRows.map((p) => p.sectionId));
  const sectionRows =
    sectionIdSet.size === 0 ? [] : await db.select().from(sections).where(inArray(sections.id, [...sectionIdSet]));
  const sectionById = new Map(sectionRows.map((s) => [s.id, s]));

  const sheets: FollowingSheetPayload[] = [];
  let prevSectionId: string | null = ordered[idx]!.sectionId;

  for (const meta of slice) {
    const page = pageById.get(meta.pageId);
    if (!page) continue;
    const sec = sectionById.get(page.sectionId);
    if (!sec || sec.notebookId !== notebookId) continue;

    const coords = resolvePageSheetCoords({
      strokesData: page.strokesData,
      blocksData: page.blocksData ?? [],
      pageSize: page.pageSize,
    });

    const sectionBreak = prevSectionId !== null && meta.sectionId !== prevSectionId;

    sheets.push({
      pageId: meta.pageId,
      title: meta.title,
      sectionTitle: meta.sectionTitle,
      sectionBreak,
      backgroundType: page.backgroundType,
      pageSize: normalizePageSize(page.pageSize ?? undefined),
      strokes: coords.strokes,
      blocks: coords.blocks,
    });

    prevSectionId = meta.sectionId;
  }

  return { sheets, moreCount };
}
