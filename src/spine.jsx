// Left spine — notebook switcher + sections/pages tree
const { useState, useMemo } = React;

function Spine({
  collapsed,
  onCollapse,
  activePageId,
  onPageClick,
  onOpenLibrary,
  onOpenShare,
  onOpenSettings,
  style: spineStyle,
  sections,
  setSections,
  onAddPage,
  onAddSection,
  activeNotebookId,
  onSelectNotebook,
  notebook,
}) {
  const [query, setQuery] = useState("");

  const toggle = (id) => setSections((ss) => ss.map((s) => (s.id === id ? { ...s, open: !s.open } : s)));

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((sec) => {
        const secMatch = sec.title.toLowerCase().includes(q);
        const pages = sec.pages.filter((pg) => pg.title.toLowerCase().includes(q) || secMatch);
        const open = sec.open || pages.length < sec.pages.length || secMatch;
        return { ...sec, pages, open };
      })
      .filter((sec) => sec.pages.length > 0);
  }, [sections, query]);

  const pageCount = useMemo(() => sections.reduce((n, s) => n + s.pages.length, 0), [sections]);

  if (collapsed) {
    return (
      <aside
        style={{
          width: 56,
          borderRight: "1px solid var(--chrome-b)",
          background: "var(--chrome)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "10px 0 10px",
          gap: 6,
        }}
      >
        <button onClick={onCollapse} title="Expand" style={iconBtn}>
          <Icons.Menu />
        </button>
        <div style={{ height: 1, background: "var(--chrome-b)", width: 28, margin: "6px 0" }} />
        {window.NOTEBOOKS.slice(0, 4).map((nb) => (
          <button
            key={nb.id}
            title={nb.title}
            onClick={() => onSelectNotebook && onSelectNotebook(nb.id)}
            style={{
              ...iconBtn,
              borderRadius: 8,
              background: nb.id === activeNotebookId ? "var(--accent-soft)" : "transparent",
            }}
          >
            <span
              style={{
                width: 18,
                height: 22,
                borderRadius: "2px 4px 4px 2px",
                display: "inline-block",
                background: nb.color,
                boxShadow: "inset -3px 0 0 rgba(0,0,0,.15)",
              }}
            />
          </button>
        ))}
        <button onClick={onOpenLibrary} style={{ ...iconBtn, marginTop: "auto" }} title="All notebooks">
          <Icons.Book />
        </button>
        <button onClick={onOpenSettings} style={iconBtn} title="Settings">
          <Icons.Gear />
        </button>
      </aside>
    );
  }

  return (
    <aside
      style={{
        width: 280,
        borderRight: "1px solid var(--chrome-b)",
        background: "var(--chrome)",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {/* notebook header */}
      <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid var(--chrome-b)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={onOpenLibrary} style={iconBtnSmall} title="All notebooks">
            <Icons.ArrowL />
          </button>
          <div
            style={{
              width: 20,
              height: 26,
              borderRadius: "2px 5px 5px 2px",
              background: notebook.color,
              boxShadow: "inset -4px 0 0 rgba(0,0,0,.18), 0 1px 2px rgba(0,0,0,.1)",
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "var(--serif)",
                fontSize: 20,
                lineHeight: 1.1,
                color: "var(--ink)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {notebook.title}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
              {pageCount} pages · shared with 34
            </div>
          </div>
          <button onClick={onCollapse} style={iconBtnSmall} title="Collapse">
            <Icons.Menu />
          </button>
        </div>

        {/* search */}
        <div
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--paper)",
            border: "1px solid var(--chrome-b)",
            borderRadius: 8,
            padding: "6px 10px",
          }}
        >
          <Icons.Search size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages and ink…"
            style={{
              border: "none",
              background: "transparent",
              outline: "none",
              fontSize: 13,
              flex: 1,
              color: "var(--ink)",
            }}
          />
          <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink-4)" }}>⌘K</span>
        </div>
      </div>

      {/* spine list */}
      <div style={{ flex: 1, overflow: "auto", padding: "6px 8px 14px" }}>
        {filteredSections.map((sec) => (
          <div key={sec.id} style={{ marginTop: 6 }}>
            <button
              onClick={() => toggle(sec.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                width: "100%",
                background: "transparent",
                border: "none",
                padding: "6px 8px",
                borderRadius: 6,
                cursor: "pointer",
                color: "var(--ink-2)",
                fontWeight: 600,
                fontSize: 12.5,
                letterSpacing: ".01em",
              }}
            >
              <span
                style={{
                  width: 14,
                  display: "inline-flex",
                  transition: "transform .15s",
                  transform: sec.open ? "rotate(0deg)" : "rotate(-90deg)",
                }}
              >
                <Icons.ChevronD size={14} />
              </span>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: sec.color,
                  marginLeft: -2,
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,.15)",
                }}
              />
              <span style={{ flex: 1, textAlign: "left", textTransform: "uppercase", fontFamily: "var(--ui)" }}>{sec.title}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink-4)", fontWeight: 500 }}>{sec.pages.length}</span>
            </button>
            {sec.open && (
              <div style={{ paddingLeft: 22, display: "flex", flexDirection: "column", gap: 1, marginTop: 2 }}>
                {sec.pages.map((pg) => {
                  const isActive = pg.id === activePageId;
                  return (
                    <button
                      key={pg.id}
                      onClick={() => onPageClick(pg.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        width: "100%",
                        padding: "6px 10px 6px 8px",
                        borderRadius: 6,
                        cursor: "pointer",
                        background: isActive ? "var(--accent-soft)" : "transparent",
                        border: "none",
                        textAlign: "left",
                        color: isActive ? "var(--ink)" : "var(--ink-2)",
                        fontSize: 12.5,
                        fontWeight: isActive ? 600 : 400,
                        borderLeft: `2px solid ${isActive ? "var(--accent)" : "transparent"}`,
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = "var(--chrome-2)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {pg.type === "grid" ? (
                        <Icons.Grid size={13} />
                      ) : pg.type === "ruled" ? (
                        <Icons.Ruled size={13} />
                      ) : (
                        <Icons.Blank size={13} />
                      )}
                      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pg.title}</span>
                    </button>
                  );
                })}
                <button type="button" onClick={() => onAddPage(sec.id)} style={{ ...addBtn, marginLeft: 0 }}>
                  <Icons.Plus size={12} /> New page
                </button>
              </div>
            )}
          </div>
        ))}
        <button type="button" onClick={onAddSection} style={{ ...addBtn, marginTop: 10, marginLeft: 8 }}>
          <Icons.Plus size={12} /> New section
        </button>
      </div>

      {/* footer */}
      <div style={{ padding: "10px 12px", borderTop: "1px solid var(--chrome-b)", display: "flex", gap: 8, alignItems: "center" }}>
        <button type="button" onClick={onOpenShare} style={footerBtn}>
          <Icons.Share size={14} /> Share
        </button>
        <button type="button" onClick={onOpenSettings} style={{ ...footerBtn, flex: "0 0 auto", padding: "7px 9px" }} title="Settings">
          <Icons.Gear size={14} />
        </button>
      </div>
    </aside>
  );
}

const iconBtn = {
  width: 36,
  height: 36,
  display: "grid",
  placeItems: "center",
  borderRadius: 8,
  background: "transparent",
  border: "none",
  color: "var(--ink-2)",
  cursor: "pointer",
};
const iconBtnSmall = { ...iconBtn, width: 28, height: 28 };
const addBtn = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 10px",
  background: "transparent",
  border: "1px dashed var(--chrome-b)",
  borderRadius: 6,
  color: "var(--ink-3)",
  fontSize: 11.5,
  cursor: "pointer",
  marginTop: 4,
};
const footerBtn = {
  flex: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  background: "var(--paper)",
  border: "1px solid var(--chrome-b)",
  borderRadius: 8,
  padding: "7px 10px",
  fontSize: 12.5,
  cursor: "pointer",
  color: "var(--ink)",
};

window.Spine = Spine;
