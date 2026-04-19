import { migrateStrokesLegacyToWorld, pageLayoutAspectFromUnknown } from "@/lib/ink/world-coords";
import { parseStrokesPayload, type InkStroke } from "@/lib/ink/types";
import {
  migrateBlocksLegacyToWorld,
  parsePageBlocksPayload,
  type PageBlock,
} from "@/lib/page-blocks/types";

/**
 * Normalizes strokes/blocks to world-v2 coordinates for rendering.
 * Legacy payloads are migrated using the page’s current `pageSize` aspect (best-effort).
 */
export function resolvePageSheetCoords(input: {
  strokesData: unknown;
  blocksData: unknown;
  pageSize: string | null | undefined;
}): { strokes: InkStroke[]; blocks: PageBlock[]; needsPersistWorldMigration: boolean } {
  const sp = parseStrokesPayload(input.strokesData);
  const bp = parsePageBlocksPayload(input.blocksData ?? []);
  const aspect = pageLayoutAspectFromUnknown(input.pageSize);
  const strokes =
    sp.coordSpace === "legacy-page" ? migrateStrokesLegacyToWorld(sp.strokes, aspect) : sp.strokes;
  const blocks =
    bp.coordSpace === "legacy-page" ? migrateBlocksLegacyToWorld(bp.blocks, aspect) : bp.blocks;
  return {
    strokes,
    blocks,
    needsPersistWorldMigration: sp.coordSpace === "legacy-page" || bp.coordSpace === "legacy-page",
  };
}
