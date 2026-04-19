"use client";

import { PageBlocksLayer } from "@/components/page-content/page-blocks-layer";
import { PageBackground } from "@/components/ink/page-background";
import { StrokeCanvas } from "@/components/ink/stroke-canvas";
import type { PageSizeId } from "@/lib/ink/page-size";
import { INFINITE_PAGE_MIN_HEIGHT, pageFrameStyle } from "@/lib/ink/page-size";
import type { InkStroke } from "@/lib/ink/types";
import type { PageBlock } from "@/lib/page-blocks/types";

type Props = {
  backgroundType: string;
  strokes: InkStroke[];
  blocks: PageBlock[];
  pageSize: PageSizeId;
};

/** Read-only published page (public share) — ink + embeds under the same stack as the editor. */
export function SharePageView({ backgroundType, strokes, blocks, pageSize }: Props) {
  const isFullBleedInk = pageSize === "16_10" || pageSize === "a4" || pageSize === "letter";

  const stack = (
    <>
      <PageBackground type={backgroundType} />
      <PageBlocksLayer
        blocks={blocks}
        onBlocksChange={() => {}}
        tool="pen"
        readOnly
        selectedId={null}
        onSelectId={() => {}}
        pageBackgroundType={backgroundType}
        layoutCoordSpace="world-v2"
      />
      <StrokeCanvas
        strokes={strokes}
        onChange={() => {}}
        tool="pen"
        color="#1f1c15"
        width={2.5}
        readOnly
        coordSpace="world-v2"
      />
    </>
  );

  return (
    <div
      className={`relative isolate mx-auto w-full rounded-md bg-[var(--paper)] shadow-[var(--shadow-2)] ${
        pageSize === "infinite" ? "overflow-x-hidden overflow-y-visible min-h-0" : "overflow-hidden"
      }`}
      style={pageFrameStyle(pageSize)}
    >
      {isFullBleedInk ? (
        <div className="absolute inset-0 min-h-0 overflow-hidden">
          <div className="relative isolate h-full w-full overflow-hidden">{stack}</div>
        </div>
      ) : pageSize === "infinite" ? (
        <div className="relative isolate w-full overflow-hidden" style={{ minHeight: INFINITE_PAGE_MIN_HEIGHT }}>
          {stack}
        </div>
      ) : null}
    </div>
  );
}
