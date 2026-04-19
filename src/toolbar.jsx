// Left-docked vertical toolbar with fly-out context panel
const { useState: useStateTb } = React;

const TOOLS = [
  { id:"pen",     label:"Pen",          Icon: Icons.Pen,      key:"P" },
  { id:"hl",      label:"Highlighter",  Icon: Icons.Highlight,key:"H" },
  { id:"eraser",  label:"Eraser",       Icon: Icons.Eraser,   key:"E" },
  { id:"lasso",   label:"Lasso select", Icon: Icons.Lasso,    key:"S" },
  { id:"shapes",  label:"Shapes & smart lines", Icon: Icons.Shapes, key:"R" },
  { id:"text",    label:"Text block",   Icon: Icons.Text,     key:"T" },
  { id:"bucket",  label:"Fill",         Icon: Icons.Bucket,   key:"F" },
  { id:"ruler",   label:"Ruler",        Icon: Icons.Ruler,    key:"L" },
  { id:"laser",   label:"Laser pointer",Icon: Icons.Laser,    key:"X" },
];

const PEN_COLORS = ["#1f1c15","#b9432b","#b9722e","#8a7215","#3b6e86","#5a7f4a","#6b5aa6","#c24b7a"];
const PEN_SIZES  = [1.5, 2.5, 4, 7, 12];

function Toolbar({ tool, setTool, penColor, setPenColor, penSize, setPenSize, onInsertOpen, onUndo, onRedo }) {
  const showContext = tool==="pen" || tool==="hl" || tool==="shapes";
  return (
    <>
      {/* vertical dock — hugs the left edge of the canvas */}
      <div style={{
        position:"absolute", top:"50%", left:12, transform:"translateY(-50%)", zIndex:30,
        display:"flex", flexDirection:"column", gap:6, alignItems:"center",
      }}>
        <div style={dockBar}>
          <GlassBtn onClick={onUndo} title="Undo (⌘Z)"><Icons.Undo/></GlassBtn>
          <GlassBtn onClick={onRedo} title="Redo (⌘⇧Z)"><Icons.Redo/></GlassBtn>
          <Divider/>
          {TOOLS.map(t=>{
            const active = tool===t.id;
            return (
              <GlassBtn key={t.id} onClick={()=>setTool(t.id)} active={active} title={`${t.label} (${t.key})`}>
                <t.Icon/>
              </GlassBtn>
            );
          })}
          <Divider/>
          <GlassBtn onClick={onInsertOpen} title="Insert media"><Icons.Plus/></GlassBtn>
        </div>
      </div>

      {/* fly-out context panel, docked to the right of the main dock */}
      {showContext && (
        <div style={{
          position:"absolute", top:"50%", left:72, transform:"translateY(-50%)", zIndex:29,
          animation:"slateFly .16s ease-out"
        }}>
          {(tool==="pen" || tool==="hl") && (
            <div style={{...dockBar, flexDirection:"column", padding:"8px 6px", gap:6}}>
              <div style={{fontSize:9.5, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"var(--ink-3)", padding:"0 2px 2px"}}>Color</div>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:5, padding:"0 2px"}}>
                {PEN_COLORS.map(c=>(
                  <button key={c} onClick={()=>setPenColor(c)} title={c} style={{
                    width:18, height:18, borderRadius:999,
                    border: penColor===c ? "2px solid var(--ink)" : "2px solid transparent",
                    background:c, cursor:"pointer", padding:0, boxShadow:"0 0 0 1px rgba(0,0,0,.1)"
                  }}/>
                ))}
              </div>
              <div style={{height:1, background:"var(--chrome-b)", width:"100%", margin:"4px 0"}}/>
              <div style={{fontSize:9.5, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"var(--ink-3)", padding:"0 2px 2px"}}>Size</div>
              <div style={{display:"flex", flexDirection:"column", gap:2}}>
                {PEN_SIZES.map(s=>(
                  <button key={s} onClick={()=>setPenSize(s)} title={`${s}px`} style={{
                    width:32, height:24, borderRadius:6, border:"none",
                    background: penSize===s ? "var(--chrome-2)" : "transparent", cursor:"pointer",
                    display:"grid", placeItems:"center"
                  }}>
                    <span style={{width:s*2, height:s*2, borderRadius:999, background:penColor, display:"inline-block"}}/>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tool==="shapes" && (
            <div style={{...dockBar, flexDirection:"column", padding:"6px", gap:2}}>
              <GlassBtn title="Rectangle"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="5" width="14" height="10" rx="1"/></svg></GlassBtn>
              <GlassBtn title="Circle"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10" cy="10" r="6"/></svg></GlassBtn>
              <GlassBtn title="Arrow"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 10h12M11 6l4 4-4 4"/></svg></GlassBtn>
              <GlassBtn title="Line"><svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 14L16 6"/></svg></GlassBtn>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes slateFly { from { opacity:0; transform:translate(-6px,-50%); } to { opacity:1; transform:translate(0,-50%); } }
      `}</style>
    </>
  );
}

function GlassBtn({children, onClick, active, title}) {
  return (
    <button onClick={onClick} title={title} style={{
      width:36, height:36, display:"grid", placeItems:"center", borderRadius:8,
      background: active ? "var(--ink)" : "transparent",
      color: active ? "var(--paper)" : "var(--ink-2)",
      border:"none", cursor:"pointer", transition:"background .12s"
    }}
    onMouseEnter={e=>{ if(!active) e.currentTarget.style.background="var(--chrome-2)"; }}
    onMouseLeave={e=>{ if(!active) e.currentTarget.style.background="transparent"; }}
    >{children}</button>
  );
}

function Divider() {
  return <span style={{height:1, width:22, background:"var(--chrome-b)", margin:"4px 0"}}/>;
}

const dockBar = {
  display:"flex", flexDirection:"column", alignItems:"center", gap:2, padding:"6px",
  background:"color-mix(in oklch, var(--chrome) 88%, transparent)",
  backdropFilter:"blur(16px) saturate(140%)",
  WebkitBackdropFilter:"blur(16px) saturate(140%)",
  border:"1px solid var(--chrome-b)", borderRadius:14,
  boxShadow:"var(--shadow-2)"
};

window.Toolbar = Toolbar;
