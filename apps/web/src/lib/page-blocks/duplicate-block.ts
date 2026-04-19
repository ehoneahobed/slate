import { PAGE_BLOCK_WORLD_UY_CEILING, type PageBlock } from "@/lib/page-blocks/types";

const OFFSET_X = 0.02;
const OFFSET_Y = 0.03;

function nudgeWorldRect(b: Pick<PageBlock, "x" | "y" | "w" | "h">): { x: number; y: number } {
  let x = b.x + OFFSET_X;
  if (x + b.w > 1) x = Math.max(0, b.x - OFFSET_X);
  x = Math.min(1 - b.w, Math.max(0, x));

  let y = b.y + OFFSET_Y;
  if (y + b.h > PAGE_BLOCK_WORLD_UY_CEILING) y = Math.max(0, b.y - OFFSET_Y);
  y = Math.min(PAGE_BLOCK_WORLD_UY_CEILING - b.h, Math.max(0, y));

  return { x, y };
}

/** Deep-clone a block with a new id and a slight offset so the copy is visible. */
export function duplicatePageBlock(block: PageBlock): PageBlock {
  const id = crypto.randomUUID();
  const { x, y } = nudgeWorldRect(block);
  const rect = { id, x, y, w: block.w, h: block.h };

  if (block.kind === "text") {
    return {
      ...block,
      ...rect,
      segments: block.segments?.map((s) => ({ ...s })),
    };
  }
  if (block.kind === "youtube") {
    return { ...block, ...rect };
  }
  if (block.kind === "image") {
    return { ...block, ...rect };
  }
  if (block.kind === "sticky") {
    return { ...block, ...rect };
  }
  if (block.kind === "math" || block.kind === "code") {
    return { ...block, ...rect };
  }
  if (block.kind === "web_embed") {
    return { ...block, ...rect };
  }
  if (block.kind === "file_card") {
    return { ...block, ...rect };
  }
  if (block.kind === "rect" || block.kind === "ellipse" || block.kind === "diamond") {
    return { ...block, ...rect };
  }
  const _exhaustive: never = block;
  return _exhaustive;
}
