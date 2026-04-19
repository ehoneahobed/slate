// App shell — wires everything together
const { useState: useAppState, useEffect: useAppEffect, useMemo: useAppMemo } = React;

function App() {
  const [tweaks, setTweaks] = useAppState(window.TWEAKS);
  const [activePage, setActivePage] = useAppState(window.ACTIVE_PAGE_ID);
  const [spineCollapsed, setSpineCollapsed] = useAppState(false);
  const [pageType, setPageType] = useAppState("ruled");

  const [tool, setTool] = useAppState("pen");
  const [penColor, setPenColor] = useAppState("#1f1c15");
  const [penSize, setPenSize] = useAppState(2.5);

  const [aiOpen, setAiOpen] = useAppState(false);
  const [showLibrary, setShowLibrary] = useAppState(false);
  const [showInsert, setShowInsert] = useAppState(false);
  const [showShare, setShowShare] = useAppState(false);
  const [showSettings, setShowSettings] = useAppState(false);
  const [studentMode, setStudentMode] = useAppState(false);
  const [focusMode, setFocusMode] = useAppState(false);

  // F toggles focus mode; Esc exits
  useAppEffect(()=>{
    function onKey(e){
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "f" || e.key === "F") { e.preventDefault(); setFocusMode(m=>!m); }
      if (e.key === "Escape" && focusMode) { setFocusMode(false); }
    }
    window.addEventListener("keydown", onKey);
    return ()=> window.removeEventListener("keydown", onKey);
  }, [focusMode]);

  // Tweaks host bridge
  const [tweaksVisible, setTweaksVisible] = useAppState(false);
  useAppEffect(()=>{
    function onMsg(e){
      const d = e.data; if (!d || typeof d!=="object") return;
      if (d.type==="__activate_edit_mode") setTweaksVisible(true);
      if (d.type==="__deactivate_edit_mode") setTweaksVisible(false);
    }
    window.addEventListener("message", onMsg);
    try { window.parent.postMessage({type:"__edit_mode_available"}, "*"); } catch(_){}
    return ()=> window.removeEventListener("message", onMsg);
  },[]);

  // apply theme + grain to <html>
  useAppEffect(()=>{
    document.documentElement.setAttribute("data-theme", tweaks.theme || "paper");
    const g = document.getElementById("grain");
    if (g) g.style.display = tweaks.showGrain ? "block" : "none";
    // handwriting font global
    document.documentElement.style.setProperty("--hand", `"${tweaks.handwritingFont || "Caveat"}", cursive`);
  }, [tweaks]);

  // Flatten pages for scrolling
  const allPages = useAppMemo(()=>{
    const out = [];
    window.SECTIONS.forEach(s => s.pages.forEach(p => out.push(p)));
    return out;
  }, []);
  const activeIdx = allPages.findIndex(p=>p.id===activePage);

  // Linear view when spineStyle === "linear": show one page with prev/next
  const linear = tweaks.spineStyle === "linear";
  const visiblePages = linear
    ? allPages.filter(p => p.id === activePage)
    : allPages;

  const onPageClick = (id) => {
    setActivePage(id);
    setTimeout(()=>{
      const el = document.getElementById(`page-${id}`);
      if (el) {
        const container = document.getElementById("canvas-scroll");
        if (container) container.scrollTo({top: el.offsetTop - 80, behavior:"smooth"});
      }
    }, 20);
  };

  return (
    <div style={{display:"flex", height:"100vh", background:"var(--bg)"}}>
      {!focusMode && <Spine
        collapsed={spineCollapsed}
        onCollapse={()=>setSpineCollapsed(c=>!c)}
        activePageId={activePage}
        onPageClick={onPageClick}
        onOpenLibrary={()=>setShowLibrary(true)}
        onOpenShare={()=>setShowShare(true)}
        onOpenSettings={()=>setShowSettings(true)}
        style={tweaks.spineStyle}
      />}

      {/* canvas column */}
      <main style={{flex:1, display:"flex", flexDirection:"column", position:"relative", minWidth:0}}>
        {/* top bar */}
        {!focusMode && <div style={{
          display:"flex", alignItems:"center", gap:10, padding:"10px 18px",
          borderBottom:"1px solid var(--chrome-b)", background:"var(--chrome)",
          height:52, flexShrink:0
        }}>
          <div style={{display:"flex", alignItems:"center", gap:6, fontSize:12.5, color:"var(--ink-3)"}}>
            <span>{window.ACTIVE_NOTEBOOK.title}</span>
            <Icons.ChevronR size={12}/>
            <span>01 · Foundations</span>
            <Icons.ChevronR size={12}/>
            <span style={{color:"var(--ink)", fontWeight:600}}>Gradient descent — intuition</span>
          </div>
          <div style={{flex:1}}/>

          {/* collaborators */}
          <div style={{display:"flex", alignItems:"center"}}>
            {[{n:"P", c:"#b9722e"},{n:"J", c:"#3b6e86"},{n:"A", c:"#5a7f4a"}].map((a,i)=>(
              <span key={i} style={{
                width:26, height:26, borderRadius:999, background:a.c, color:"#fff",
                display:"grid", placeItems:"center", fontSize:11, fontWeight:700,
                marginLeft: i===0 ? 0 : -8, border:"2px solid var(--chrome)"
              }}>{a.n}</span>
            ))}
            <span style={{fontSize:11.5, color:"var(--ink-3)", marginLeft:8}}>3 viewing</span>
          </div>

          {tweaks.aiEnabled && (
            <button onClick={()=>{ setAiOpen(true); }} style={{
              display:"inline-flex", alignItems:"center", gap:6, padding:"6px 10px",
              background:"var(--paper)", border:"1px solid var(--chrome-b)", borderRadius:8,
              fontSize:12, cursor:"pointer", color:"var(--ink-2)"
            }} title="Ask Slate about this page">
              <Icons.Sparkles size={14}/> Ask Slate
            </button>
          )}
          <button onClick={()=>setFocusMode(true)} style={{
            display:"inline-flex", alignItems:"center", gap:6, padding:"6px 10px",
            background:"var(--paper)", border:"1px solid var(--chrome-b)", borderRadius:8,
            fontSize:12, cursor:"pointer", color:"var(--ink-2)"
          }} title="Focus mode — hide all chrome (F)">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h3M13 4h3v3M16 13v3h-3M7 16H4v-3"/></svg>
            Focus
          </button>
          <button onClick={()=>setStudentMode(m=>!m)} style={{
            display:"inline-flex", alignItems:"center", gap:6, padding:"6px 10px",
            background:"var(--paper)", border:"1px solid var(--chrome-b)", borderRadius:8,
            fontSize:12, cursor:"pointer", color:"var(--ink-2)"
          }} title="Preview as student">
            <Icons.Eye size={14}/> {studentMode ? "Exit preview" : "Preview"}
          </button>
          <button onClick={()=>setShowShare(true)} style={{
            display:"inline-flex", alignItems:"center", gap:6, padding:"6px 12px",
            background:"var(--ink)", color:"var(--paper)", border:"none", borderRadius:8,
            fontSize:12, fontWeight:600, cursor:"pointer"
          }}>
            <Icons.Share size={14}/> Share
          </button>
        </div>}

        {/* Toolbar (hidden in student-read-only + focus mode) */}
        {!studentMode && !focusMode && (
          <Toolbar tool={tool} setTool={setTool}
            penColor={penColor} setPenColor={setPenColor}
            penSize={penSize} setPenSize={setPenSize}
            onInsertOpen={()=>setShowInsert(true)}
            onUndo={()=>{}} onRedo={()=>{}}
          />
        )}

        {/* Focus mode — floating exit pill */}
        {focusMode && (
          <button onClick={()=>setFocusMode(false)} style={{
            position:"absolute", top:14, right:14, zIndex:30,
            display:"inline-flex", alignItems:"center", gap:8, padding:"8px 14px",
            background:"color-mix(in oklch, var(--chrome) 86%, transparent)",
            backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)",
            border:"1px solid var(--chrome-b)", borderRadius:999,
            boxShadow:"var(--shadow-2)", fontSize:12, cursor:"pointer", color:"var(--ink-2)"
          }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4H4v3M13 4h3v3M16 13v3h-3M7 16H4v-3"/></svg>
            Exit focus · <span style={{fontFamily:"var(--mono)", fontSize:10.5, color:"var(--ink-4)"}}>Esc</span>
          </button>
        )}
        {studentMode && (
          <div style={{
            position:"absolute", top:14, left:"50%", transform:"translateX(-50%)", zIndex:30,
            display:"flex", alignItems:"center", gap:10, padding:"8px 14px",
            background:"color-mix(in oklch, var(--chrome) 86%, transparent)", backdropFilter:"blur(16px)",
            border:"1px solid var(--chrome-b)", borderRadius:999, boxShadow:"var(--shadow-2)"
          }}>
            <Icons.Eye size={14}/>
            <span style={{fontSize:12.5, color:"var(--ink-2)"}}>Student view — shared read + personal annotations</span>
            <span style={{width:1, height:16, background:"var(--chrome-b)"}}/>
            <button style={{background:"transparent", border:"none", fontSize:12, color:"var(--ink)", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:4}}>
              <Icons.Pen size={14}/> Annotate my copy
            </button>
          </div>
        )}

        {/* Scrolling canvas */}
        <div id="canvas-scroll" style={{
          flex:1, overflow:"auto",
          padding: focusMode ? "40px 20px 60px" : "28px 20px 60px 80px",
          minHeight:0,
          background: `radial-gradient(1200px 600px at 50% -10%, color-mix(in oklch, var(--paper) 40%, var(--bg)), var(--bg))`
        }}>
          {linear && activeIdx > 0 && (
            <div style={{textAlign:"center", marginBottom:12}}>
              <button onClick={()=>onPageClick(allPages[activeIdx-1].id)} style={navBtn}>
                <Icons.ChevronD style={{transform:"rotate(180deg)"}}/> previous page
              </button>
            </div>
          )}

          {visiblePages.map((p, i) => (
            <PageCard key={p.id}
              page={p}
              idx={allPages.findIndex(x=>x.id===p.id)}
              total={allPages.length}
              active={p.id===activePage}
              readOnly={studentMode}
            />
          ))}

          {linear && activeIdx < allPages.length-1 && (
            <div style={{textAlign:"center", marginTop:-12}}>
              <button onClick={()=>onPageClick(allPages[activeIdx+1].id)} style={navBtn}>
                <Icons.ChevronD/> next page
              </button>
            </div>
          )}

          {!linear && (
            <div style={{textAlign:"center", color:"var(--ink-4)", fontFamily:"var(--mono)", fontSize:11, padding:"20px 0 40px"}}>
              — end of {window.ACTIVE_NOTEBOOK.title} · {allPages.length} pages —
            </div>
          )}
        </div>

        {/* Bottom page indicator */}
        <div style={{
          position:"absolute", bottom:16, left:"50%", transform:"translateX(-50%)",
          display:"flex", gap:8, alignItems:"center", padding:"6px 10px",
          background:"color-mix(in oklch, var(--chrome) 86%, transparent)", backdropFilter:"blur(16px)",
          border:"1px solid var(--chrome-b)", borderRadius:999, boxShadow:"var(--shadow-1)",
          fontSize:11.5, color:"var(--ink-2)", fontFamily:"var(--mono)"
        }}>
          <Icons.Page size={12}/>
          page {String((activeIdx+1)).padStart(2,"0")} / {allPages.length}
          <span style={{width:1, height:12, background:"var(--chrome-b)", margin:"0 4px"}}/>
          <button style={{border:"none", background:"transparent", cursor:"pointer", color:"var(--ink-2)", display:"inline-flex", alignItems:"center", gap:4, fontSize:11.5, fontFamily:"var(--mono)"}}>
            <Icons.Plus size={12}/> add page
          </button>
        </div>
      </main>

      {!studentMode && !focusMode && (
        <Inspector
          pageType={pageType} setPageType={setPageType}
          aiEnabled={tweaks.aiEnabled}
          aiOpen={aiOpen} setAiOpen={setAiOpen}
        />
      )}

      <LibraryModal open={showLibrary} onClose={()=>setShowLibrary(false)} onOpenNotebook={()=>setShowLibrary(false)}/>
      <InsertModal open={showInsert} onClose={()=>setShowInsert(false)}/>
      <ShareModal open={showShare} onClose={()=>setShowShare(false)}/>
      <SettingsModal open={showSettings} onClose={()=>setShowSettings(false)}/>

      <TweaksPanel tweaks={tweaks} setTweaks={setTweaks} visible={tweaksVisible}/>
    </div>
  );
}

const navBtn = {
  display:"inline-flex", alignItems:"center", gap:6, padding:"8px 14px",
  background:"var(--paper)", border:"1px solid var(--chrome-b)", borderRadius:999,
  fontSize:12, color:"var(--ink-2)", cursor:"pointer", fontFamily:"var(--mono)"
};

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
