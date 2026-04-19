type PageBackgroundProps = {
  type: string;
  /** Disambiguate SVG pattern ids when two backgrounds mount on one route (e.g. infinite scroll tail). */
  idSuffix?: string;
};

/** Ruled / grid / plain / Cornell backgrounds for the page sheet (Phase 1). */
export function PageBackground({ type, idSuffix = "" }: PageBackgroundProps) {
  const common = { position: "absolute" as const, inset: 0, pointerEvents: "none" as const };
  const ns = idSuffix.replace(/[^a-zA-Z0-9_-]/g, "") ? `-${idSuffix.replace(/[^a-zA-Z0-9_-]/g, "")}` : "";

  if (type === "plain") return null;

  if (type === "ruled") {
    const pid = `ruled${ns}`;
    return (
      <svg style={{ ...common, width: "100%", height: "100%" }} preserveAspectRatio="none">
        <defs>
          <pattern id={pid} width="100%" height="32" patternUnits="userSpaceOnUse">
            <line x1="0" y1="31.5" x2="2000" y2="31.5" stroke="var(--rule)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${pid})`} />
        <line x1="70" y1="0" x2="70" y2="100%" stroke="var(--accent-2)" strokeWidth="1" opacity={0.55} />
      </svg>
    );
  }

  if (type === "cornell") {
    return (
      <div style={common} className="cornell-bg">
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `repeating-linear-gradient(transparent 0 31px, var(--rule) 31px 32px)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: "72%",
            width: 1,
            background: "var(--accent-2)",
            opacity: 0.65,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "72%",
            right: 0,
            top: "38%",
            height: 1,
            background: "var(--rule)",
          }}
        />
      </div>
    );
  }

  // grid
  const gid = `grid${ns}`;
  const g5id = `grid5${ns}`;
  return (
    <svg style={{ ...common, width: "100%", height: "100%" }} preserveAspectRatio="none">
      <defs>
        <pattern id={gid} width="22" height="22" patternUnits="userSpaceOnUse">
          <path d="M22 0H0V22" fill="none" stroke="var(--rule-2)" strokeWidth="1" />
        </pattern>
        <pattern id={g5id} width="110" height="110" patternUnits="userSpaceOnUse">
          <rect width="110" height="110" fill={`url(#${gid})`} />
          <path d="M110 0H0V110" fill="none" stroke="var(--rule)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${g5id})`} />
    </svg>
  );
}
