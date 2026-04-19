import Link from "next/link";
import { notFound } from "next/navigation";
import { loadNotebookOutline } from "@/lib/notebook/outline";
import { resolveActiveShareLink } from "@/lib/share/resolve";

export default async function SharedNotebookTocPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: tokenParam } = await params;
  const rawToken = decodeURIComponent(tokenParam);
  const link = await resolveActiveShareLink(rawToken);
  if (!link) notFound();

  const tree = await loadNotebookOutline(link.notebookId);
  if (!tree) notFound();

  const basePath = `/share/${encodeURIComponent(rawToken)}`;

  return (
    <main className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-instrument-serif)] text-3xl leading-tight">{tree.notebookTitle}</h1>
        <p className="mt-2 text-sm text-[var(--ink-3)]">Read-only · pick a page below</p>
      </div>

      <div className="rounded-[var(--r-lg)] border border-[var(--rule)] bg-[var(--paper)] p-4">
        <h2 className="text-sm font-semibold text-[var(--ink-2)]">Sections & pages</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {tree.outline.map((s) => {
            const nav = [...s.pages].sort((a, b) => a.position - b.position);
            return (
              <li key={s.id} className="rounded-md border border-[var(--chrome-b)] bg-[var(--paper-2)] p-3">
                <div className="font-medium">{s.title}</div>
                <ul className="mt-2 space-y-1 text-[var(--ink-2)]">
                  {nav.map((p) => (
                    <li key={p.id}>
                      <Link className="font-medium text-[var(--ink)] hover:underline" href={`${basePath}/pages/${p.id}`}>
                        {p.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
