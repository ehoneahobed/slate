import { count, desc, eq, inArray } from "drizzle-orm";
import { getSession } from "@/auth";
import {
  DashboardLibrary,
  type DashboardLibraryNotebook,
} from "@/components/dashboard/dashboard-library";
import { db } from "@/lib/db";
import { notebooks, pages, sections, workspaces } from "@/lib/db/schema";
import { createStarterNotebook, ensureWorkspaceForUser } from "./actions";

async function loadDashboardLibrary(userId: string): Promise<DashboardLibraryNotebook[]> {
  const ws = await db.query.workspaces.findFirst({
    where: eq(workspaces.ownerUserId, userId),
  });
  if (!ws) return [];

  const nbs = await db
    .select()
    .from(notebooks)
    .where(eq(notebooks.workspaceId, ws.id))
    .orderBy(desc(notebooks.updatedAt));

  if (nbs.length === 0) return [];

  const nbIds = nbs.map((n) => n.id);

  const sectionCountRows = await db
    .select({ notebookId: sections.notebookId, n: count(sections.id) })
    .from(sections)
    .where(inArray(sections.notebookId, nbIds))
    .groupBy(sections.notebookId);

  const pageCountRows = await db
    .select({ notebookId: sections.notebookId, n: count(pages.id) })
    .from(pages)
    .innerJoin(sections, eq(pages.sectionId, sections.id))
    .where(inArray(sections.notebookId, nbIds))
    .groupBy(sections.notebookId);

  const sectionCountByNotebook = new Map(sectionCountRows.map((r) => [r.notebookId, Number(r.n)]));
  const pageCountByNotebook = new Map(pageCountRows.map((r) => [r.notebookId, Number(r.n)]));

  return nbs.map((nb) => ({
    id: nb.id,
    title: nb.title,
    color: nb.color,
    updatedAt: nb.updatedAt,
    sectionCount: sectionCountByNotebook.get(nb.id) ?? 0,
    pageCount: pageCountByNotebook.get(nb.id) ?? 0,
  }));
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user?.id) return null;

  await ensureWorkspaceForUser();
  const library = await loadDashboardLibrary(session.user.id);

  return (
    <main className="space-y-10 pb-8">
      <div className="flex flex-col gap-6 border-b border-[var(--chrome-b)] pb-10 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-3)]">Library</p>
          <h1 className="mt-1 font-[family-name:var(--font-instrument-serif)] text-4xl leading-tight text-[var(--ink)] md:text-5xl">
            Notebooks
          </h1>
          <p className="mt-3 text-base leading-relaxed text-[var(--ink-2)]">
            Each notebook is a binder: <span className="font-medium text-[var(--ink)]">sections</span> divide your work,
            and every <span className="font-medium text-[var(--ink)]">page</span> is a canvas for ink, typed notes, and
            blocks. Open a notebook for its table of contents.
          </p>
        </div>
        <form action={createStarterNotebook} className="shrink-0">
          <button
            type="submit"
            className="rounded-[var(--r-md)] bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-[var(--paper)] shadow-[var(--shadow-1)] hover:opacity-95"
          >
            New notebook
          </button>
        </form>
      </div>

      <DashboardLibrary notebooks={library} />
    </main>
  );
}
