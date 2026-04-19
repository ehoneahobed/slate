"use client";

import Link from "next/link";
import type { ChromeTool } from "@/components/editor/canvas-chrome-tool";
import { FollowingPageInkSurface } from "@/components/notebook/following-page-ink-surface";
import type { FollowingPageWriteApi } from "@/components/notebook/following-page-ink-surface";
import type { FollowingSheetPayload } from "@/lib/notebook/following-sheets";
import type { PageRoughShapeKind } from "@/lib/page-blocks/types";
import type { UiTheme } from "@/lib/user-settings";

type Props = {
  notebookId: string;
  sheets: FollowingSheetPayload[];
  moreCount: number;
  chromeTool: ChromeTool;
  setChromeToolAndClearLaser: (t: ChromeTool) => void;
  shapeDrawKind: PageRoughShapeKind;
  color: string;
  penSize: number;
  readOnly: boolean;
  serverUiTheme: UiTheme;
  registerFollowerApi: (pageId: string, api: FollowingPageWriteApi) => void;
  unregisterFollowerApi: (pageId: string) => void;
  onFocusWritingSurface: (pageId: string) => void;
};

/** Editable later pages — same tools as the primary sheet; click a sheet to focus it for undo / block shortcuts. */
export function NotebookFollowingPages({
  notebookId,
  sheets,
  moreCount,
  chromeTool,
  setChromeToolAndClearLaser,
  shapeDrawKind,
  color,
  penSize,
  readOnly,
  serverUiTheme,
  registerFollowerApi,
  unregisterFollowerApi,
  onFocusWritingSurface,
}: Props) {
  if (sheets.length === 0 && moreCount === 0) return null;

  return (
    <div className="mt-14 space-y-12 print:hidden">
      <div className="mx-auto max-w-[1180px] border-t border-[var(--chrome-b)] pt-10">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-3)]">
          Later in this notebook
        </p>
        <p className="mx-auto mt-1 max-w-lg text-center text-xs leading-relaxed text-[var(--ink-4)]">
          Click a page below to focus it — then draw, type, and use the dock tools as usual. Scroll continues through the whole stack.
        </p>
      </div>

      {sheets.map((s) => (
        <FollowingPageInkSurface
          key={s.pageId}
          notebookId={notebookId}
          pageId={s.pageId}
          title={s.title}
          sectionBreak={s.sectionBreak}
          sectionTitle={s.sectionTitle}
          initialBackground={s.backgroundType}
          initialStrokes={s.strokes}
          initialBlocks={s.blocks}
          pageSize={s.pageSize}
          chromeTool={chromeTool}
          setChromeToolAndClearLaser={setChromeToolAndClearLaser}
          shapeDrawKind={shapeDrawKind}
          color={color}
          penSize={penSize}
          readOnly={readOnly}
          ssrUiTheme={serverUiTheme}
          onFocusWritingSurface={onFocusWritingSurface}
          registerApi={registerFollowerApi}
          unregisterApi={unregisterFollowerApi}
        />
      ))}

      {moreCount > 0 ? (
        <p className="mx-auto max-w-[1180px] text-center text-sm text-[var(--ink-3)]">
          {moreCount} more {moreCount === 1 ? "page" : "pages"} in this notebook — see the{" "}
          <Link href={`/dashboard/notebooks/${notebookId}`} className="font-semibold text-[var(--ink)] underline-offset-2 hover:underline">
            notebook outline
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
