import type { ReactNode } from "react";

export default function ShareLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--paper-2)] text-[var(--ink)]">
      <header className="border-b border-[var(--rule)] bg-[var(--paper)] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">Slate · shared view</p>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-8">{children}</div>
    </div>
  );
}
