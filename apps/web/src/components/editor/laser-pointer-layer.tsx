"use client";

/** Presenter-style laser dot — matches prototype red glow (`src/pageRenderers.jsx`). */
export function LaserPointerLayer({
  active,
  xNorm,
  yNorm,
}: {
  active: boolean;
  xNorm: number | null;
  yNorm: number | null;
}) {
  if (!active || xNorm == null || yNorm == null) return null;
  return (
    <div
      className="pointer-events-none absolute z-[8]"
      style={{
        left: `${xNorm * 100}%`,
        top: `${yNorm * 100}%`,
        transform: "translate(-50%, -50%)",
        width: 16,
        height: 16,
        borderRadius: 999,
        background: "radial-gradient(circle, #ff3b30 0%, rgba(255,59,48,0) 70%)",
        boxShadow: "0 0 16px 6px rgba(255,59,48,.35)",
      }}
      aria-hidden
    />
  );
}
