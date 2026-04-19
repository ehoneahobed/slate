import type { ReactNode } from "react";

/** Public share routes render their own full-bleed chrome (fixed outline + main column). */
export default function ShareLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-[var(--paper-2)] text-[var(--ink)] antialiased">{children}</div>;
}
