// Modals: library, insert-media, share, student-view, settings
const { useState: useStateM } = React;

function ModalShell({open, onClose, children, width=720, title, subtitle}) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, zIndex:100,
      background:"rgba(30,25,15,.35)", backdropFilter:"blur(4px)",
      display:"grid", placeItems:"center", padding:"40px"
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:"100%", maxWidth:width, maxHeight:"88vh", overflow:"auto",
        background:"var(--paper)", borderRadius:16, boxShadow:"var(--shadow-3)",
        border:"1px solid var(--chrome-b)"
      }}>
        <div style={{display:"flex", alignItems:"flex-start", gap:14, padding:"18px 22px 14px", borderBottom:"1px solid var(--chrome-b)"}}>
          <div style={{flex:1}}>
            <div style={{fontFamily:"var(--serif)", fontSize:24, lineHeight:1.05}}>{title}</div>
            {subtitle && <div style={{fontSize:12.5, color:"var(--ink-3)", marginTop:4}}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{width:32, height:32, borderRadius:8, border:"none", background:"transparent", cursor:"pointer", color:"var(--ink-2)"}}><Icons.Close/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---- Library ---- */
function LibraryModal({open, onClose, onOpenNotebook}) {
  return (
    <ModalShell open={open} onClose={onClose} width={880} title="Your notebooks" subtitle="Linear like a book. Stacked like a shelf.">
      <div style={{padding:"18px 22px"}}>
        <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:16}}>
          <div style={{flex:1, display:"flex", gap:8, alignItems:"center",
            background:"var(--paper-2)", border:"1px solid var(--chrome-b)", borderRadius:10, padding:"7px 12px"}}>
            <Icons.Search size={14}/>
            <input placeholder="Search notebooks, pages, or handwritten text…" style={{border:"none", background:"transparent", outline:"none", fontSize:13, flex:1, color:"var(--ink)"}}/>
          </div>
          <button style={primaryBtn}><Icons.Plus size={14}/> New notebook</button>
        </div>

        <div style={{fontSize:10.5, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"var(--ink-3)", margin:"6px 0 10px"}}>Pinned</div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:14}}>
          {window.NOTEBOOKS.map(nb=>(
            <button key={nb.id} onClick={()=>onOpenNotebook(nb.id)} style={{
              display:"flex", gap:12, padding:"14px", background:"var(--paper-2)",
              border:"1px solid var(--chrome-b)", borderRadius:12, cursor:"pointer",
              alignItems:"stretch", textAlign:"left"
            }}>
              {/* spine */}
              <div style={{width:46, borderRadius:"3px 6px 6px 3px", background:nb.color, position:"relative",
                boxShadow:"inset -6px 0 0 rgba(0,0,0,.2), inset 0 0 0 1px rgba(0,0,0,.1)",
                display:"flex", alignItems:"flex-end", padding:"10px 8px"}}>
                <span style={{color:"#fff", fontSize:9.5, fontFamily:"var(--mono)", writingMode:"vertical-rl", transform:"rotate(180deg)", letterSpacing:".15em", opacity:.85}}>
                  {nb.title.toUpperCase()}
                </span>
              </div>
              <div style={{flex:1, display:"flex", flexDirection:"column", minWidth:0}}>
                <div style={{fontFamily:"var(--serif)", fontSize:17, lineHeight:1.1, color:"var(--ink)"}}>{nb.title}</div>
                <div style={{fontSize:11.5, color:"var(--ink-3)", marginTop:4}}>{nb.pages} pages · {nb.updated}</div>
                <div style={{flex:1}}/>
                <div style={{display:"flex", gap:4, marginTop:10}}>
                  {[...Array(Math.min(4, Math.ceil(nb.pages/10)))].map((_,i)=>(
                    <span key={i} style={{flex:1, height:4, borderRadius:2, background:"var(--rule)"}}/>
                  ))}
                </div>
              </div>
            </button>
          ))}
          <button style={{
            display:"grid", placeItems:"center", background:"transparent", border:"1.5px dashed var(--rule)",
            borderRadius:12, cursor:"pointer", color:"var(--ink-3)", minHeight:140, gap:6
          }}>
            <Icons.Plus/> <span style={{fontSize:12.5}}>New notebook</span>
          </button>
        </div>

        <div style={{fontSize:10.5, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"var(--ink-3)", margin:"22px 0 10px"}}>Shared with you</div>
        <div style={{display:"flex", flexDirection:"column", gap:4}}>
          {[
            {t:"CS231n — student copy", by:"Dr. Alinsky", new:3},
            {t:"Linear Algebra, Spring", by:"Prof. Ezra"},
          ].map(r=>(
            <div key={r.t} style={{display:"flex", alignItems:"center", gap:10, padding:"8px 10px", borderRadius:8, background:"var(--paper-2)", border:"1px solid var(--chrome-b)"}}>
              <Icons.Book size={16}/>
              <span style={{flex:1, fontSize:13, color:"var(--ink)"}}>{r.t}</span>
              <span style={{fontSize:11.5, color:"var(--ink-3)"}}>shared by {r.by}</span>
              {r.new && <span style={{fontSize:10.5, fontWeight:700, padding:"2px 6px", borderRadius:999, background:"var(--accent)", color:"#fff"}}>{r.new} new</span>}
            </div>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}

/* ---- Insert media ---- */
function InsertModal({open, onClose}) {
  const groups = [
    { label:"Media",    items:[
      {Icon:Icons.Image,  t:"Image",          s:"JPG, PNG, SVG, HEIC"},
      {Icon:Icons.Media,  t:"Video",          s:"MP4, MOV, up to 500MB"},
      {Icon:Icons.Youtube,t:"YouTube / Vimeo",s:"paste a link, embeds inline"},
      {Icon:Icons.Mic,    t:"Audio recording",s:"record lecture narration"},
      {Icon:Icons.Pdf,    t:"PDF",            s:"annotate on top of pages"},
    ]},
    { label:"Text",     items:[
      {Icon:Icons.Text,   t:"Text block",     s:"typed paragraph, rich formatting"},
      {Icon:Icons.Math,   t:"Math / LaTeX",   s:"inline or block equations"},
      {Icon:Icons.Code,   t:"Code block",     s:"syntax highlight, 90+ languages"},
      {Icon:Icons.Table,  t:"Table",          s:"rows & columns"},
    ]},
    { label:"Canvas",   items:[
      {Icon:Icons.Shapes,    t:"Shape",          s:"rect, circle, arrow, custom"},
      {Icon:Icons.StickyNote,t:"Sticky note",    s:"yellow · pink · blue · green"},
      {Icon:Icons.Link,      t:"Link to page",   s:"jump to any page in any notebook"},
    ]},
  ];
  return (
    <ModalShell open={open} onClose={onClose} width={720} title="Insert" subtitle="Or press / on the canvas to open this menu inline.">
      <div style={{padding:"6px 22px 22px"}}>
        {groups.map(g=>(
          <div key={g.label} style={{marginTop:16}}>
            <div style={{fontSize:10.5, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"var(--ink-3)", marginBottom:8}}>{g.label}</div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px,1fr))", gap:8}}>
              {g.items.map(it=>(
                <button key={it.t} style={{
                  display:"flex", gap:10, alignItems:"flex-start", padding:"11px 12px",
                  background:"var(--paper-2)", border:"1px solid var(--chrome-b)",
                  borderRadius:10, cursor:"pointer", textAlign:"left"
                }}>
                  <div style={{width:34, height:34, borderRadius:8, background:"var(--paper)", border:"1px solid var(--chrome-b)",
                    display:"grid", placeItems:"center", color:"var(--ink-2)"}}>
                    <it.Icon size={18}/>
                  </div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:13, fontWeight:600, color:"var(--ink)"}}>{it.t}</div>
                    <div style={{fontSize:11.5, color:"var(--ink-3)", marginTop:2}}>{it.s}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}

/* ---- Share ---- */
const SHARE_URL = "https://slate.so/dl-fall26/share?k=9f3ad21-priya";

function ShareLinkRow() {
  const [label, setLabel] = useStateM("Copy");
  function copy() {
    const write = () => navigator.clipboard.writeText(SHARE_URL);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      write()
        .then(() => {
          setLabel("Copied");
          setTimeout(() => setLabel("Copy"), 1600);
        })
        .catch(() => fallback());
    } else fallback();
    function fallback() {
      try {
        const ta = document.createElement("textarea");
        ta.value = SHARE_URL;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setLabel("Copied");
        setTimeout(() => setLabel("Copy"), 1600);
      } catch (_) {
        setLabel("Copy failed");
        setTimeout(() => setLabel("Copy"), 2000);
      }
    }
  }
  return (
    <div style={{display:"flex", gap:8, alignItems:"center", background:"var(--paper-2)", border:"1px solid var(--chrome-b)", borderRadius:10, padding:"6px 8px 6px 12px"}}>
      <Icons.Globe size={14}/>
      <span style={{flex:1, fontFamily:"var(--mono)", fontSize:12, color:"var(--ink-2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
        {SHARE_URL.replace("https://","")}
      </span>
      <button type="button" onClick={copy} style={smallBtn}><Icons.Copy size={12}/> {label}</button>
    </div>
  );
}

function ShareModal({open, onClose}) {
  const [mode, setMode] = useStateM("read-annotate");
  return (
    <ModalShell open={open} onClose={onClose} width={620} title="Share with students" subtitle="Deep Learning — Fall ’26">
      <div style={{padding:"18px 22px 22px"}}>
        <div style={{fontSize:10.5, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"var(--ink-3)"}}>How can viewers interact?</div>
        <div style={{display:"flex", flexDirection:"column", gap:8, marginTop:10}}>
          {[
            {id:"read", Icon:Icons.Eye, t:"Read-only", s:"Like a shared PDF — nothing they do changes."},
            {id:"read-annotate", Icon:Icons.Copy, t:"Read + personal annotations", s:"Each student gets a private copy they can mark up."},
            {id:"live", Icon:Icons.Users, t:"Live collaboration", s:"Real-time board. Everyone sees every stroke."},
          ].map(r=>(
            <button key={r.id} onClick={()=>setMode(r.id)} style={{
              display:"flex", gap:12, padding:"12px 14px", textAlign:"left",
              background: mode===r.id ? "var(--accent-soft)" : "var(--paper-2)",
              border:`1px solid ${mode===r.id ? "var(--accent)" : "var(--chrome-b)"}`,
              borderRadius:10, cursor:"pointer", alignItems:"flex-start"
            }}>
              <div style={{width:32, height:32, borderRadius:8, background:"var(--paper)", border:"1px solid var(--chrome-b)", display:"grid", placeItems:"center"}}>
                <r.Icon size={16}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13, fontWeight:600, color:"var(--ink)"}}>{r.t}</div>
                <div style={{fontSize:11.5, color:"var(--ink-3)", marginTop:2}}>{r.s}</div>
              </div>
              <div style={{
                width:18, height:18, borderRadius:999, marginTop:2,
                border:`2px solid ${mode===r.id?"var(--accent)":"var(--rule)"}`,
                background: mode===r.id ? "var(--accent)" : "transparent",
                display:"grid", placeItems:"center", color:"#fff"
              }}>{mode===r.id && <Icons.Check size={10}/>}</div>
            </button>
          ))}
        </div>

        <div style={{fontSize:10.5, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"var(--ink-3)", margin:"22px 0 10px"}}>Invite link</div>
        <ShareLinkRow/>

        <div style={{fontSize:10.5, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"var(--ink-3)", margin:"22px 0 10px"}}>Class roster</div>
        <div style={{display:"flex", flexDirection:"column", gap:6}}>
          {[
            {n:"Priya Mehta",    e:"priya@uni.edu",    r:"can annotate"},
            {n:"Jae-won Park",   e:"jae@uni.edu",      r:"can annotate"},
            {n:"Aarav Shah",     e:"aarav@uni.edu",    r:"view only"},
            {n:"+ 31 students",  e:"",                 r:"can annotate"},
          ].map(r=>(
            <div key={r.n} style={{display:"flex", gap:10, alignItems:"center", padding:"7px 10px", background:"var(--paper-2)", border:"1px solid var(--chrome-b)", borderRadius:8}}>
              <span style={{width:24, height:24, borderRadius:999, background:"var(--accent-soft)", color:"var(--accent)", display:"grid", placeItems:"center", fontSize:10, fontWeight:700}}>
                {r.n.split(" ").map(x=>x[0]).slice(0,2).join("")}
              </span>
              <div style={{flex:1}}>
                <div style={{fontSize:12.5, color:"var(--ink)"}}>{r.n}</div>
                {r.e && <div style={{fontSize:10.5, color:"var(--ink-3)"}}>{r.e}</div>}
              </div>
              <span style={{fontSize:11, color:"var(--ink-3)"}}>{r.r}</span>
            </div>
          ))}
        </div>

        <div style={{marginTop:18, display:"flex", gap:8}}>
          <button style={primaryBtn}><Icons.Share size={14}/> Share & notify students</button>
          <button style={secondaryBtn}><Icons.Download size={14}/> Export as PDF</button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ---- Settings (page type picker / preferences) ---- */
function SettingsModal({open, onClose, theme, onThemeChange}) {
  return (
    <ModalShell open={open} onClose={onClose} width={620} title="Settings" subtitle="Preferences that apply to all new pages.">
      <div style={{padding:"18px 22px 22px", display:"flex", flexDirection:"column", gap:18}}>
        <SetBlock label="Default page background">
          <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            {["Plain","Ruled (tight)","Ruled (wide)","Graph 5mm","Graph 10mm","Dot grid","Cornell","Music staff"].map((t,i)=>(
              <Pill2 key={t} active={i===1}>{t}</Pill2>
            ))}
          </div>
        </SetBlock>
        <SetBlock label="Pen behavior">
          <Row2><span>Pressure sensitivity</span><Toggle2 on/></Row2>
          <Row2><span>Palm rejection</span><Toggle2 on/></Row2>
          <Row2><span>Auto-straighten lines drawn with a ruler</span><Toggle2 on/></Row2>
          <Row2><span>Shape recognition (wobbly → clean)</span><Toggle2 on/></Row2>
        </SetBlock>
        <SetBlock label="Handwriting">
          <Row2><span>Convert handwriting to text on double-tap</span><Toggle2/></Row2>
          <Row2><span>Language</span><span style={{fontSize:12.5, color:"var(--ink-2)"}}>English (US) ▾</span></Row2>
        </SetBlock>
        <SetBlock label="Appearance">
          <div style={{display:"flex", gap:8}}>
            {[{id:"paper", n:"Warm paper", c:"#efe8d9"},{id:"clean", n:"Clean light", c:"#eef0f3"},{id:"dark", n:"Night ink", c:"#1e1d21"}].map(t=>(
              <button key={t.id} type="button" onClick={()=>onThemeChange && onThemeChange(t.id)} style={{
                flex:1, padding:"12px", borderRadius:10, background:"var(--paper-2)",
                border: (theme||"paper")===t.id ? "2px solid var(--accent)" : "1px solid var(--chrome-b)",
                cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"stretch", gap:8
              }}>
                <div style={{height:30, borderRadius:4, background:t.c}}/>
                <span style={{fontSize:12, color:"var(--ink)"}}>{t.n}</span>
              </button>
            ))}
          </div>
        </SetBlock>
      </div>
    </ModalShell>
  );
}

function SetBlock({label, children}) {
  return (
    <div>
      <div style={{fontSize:10.5, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"var(--ink-3)", marginBottom:10}}>{label}</div>
      <div style={{display:"flex", flexDirection:"column", gap:2}}>{children}</div>
    </div>
  );
}
function Row2({children}) {
  return <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px dashed var(--rule-2)", fontSize:13, color:"var(--ink-2)"}}>{children}</div>;
}
function Toggle2({on}) {
  const [v,setV] = useStateM(!!on);
  return (
    <button onClick={()=>setV(!v)} style={{
      width:38, height:22, borderRadius:999, position:"relative", border:"none", cursor:"pointer",
      background: v ? "var(--accent)" : "var(--chrome-b)", padding:0
    }}>
      <span style={{
        position:"absolute", top:2, left: v ? 18 : 2, width:18, height:18, borderRadius:999,
        background:"#fff", transition:"left .15s", boxShadow:"0 1px 2px rgba(0,0,0,.2)"
      }}/>
    </button>
  );
}
function Pill2({children, active}) {
  return <button style={{
    padding:"6px 12px", borderRadius:999, fontSize:12,
    border:"1px solid " + (active?"var(--ink)":"var(--chrome-b)"),
    background: active ? "var(--ink)" : "var(--paper-2)",
    color: active ? "var(--paper)" : "var(--ink-2)",
    cursor:"pointer"
  }}>{children}</button>;
}

const primaryBtn = {
  display:"inline-flex", alignItems:"center", gap:6, padding:"9px 14px",
  background:"var(--ink)", color:"var(--paper)", border:"none", borderRadius:10,
  fontSize:12.5, fontWeight:600, cursor:"pointer"
};
const secondaryBtn = {
  display:"inline-flex", alignItems:"center", gap:6, padding:"9px 14px",
  background:"var(--paper-2)", color:"var(--ink)", border:"1px solid var(--chrome-b)", borderRadius:10,
  fontSize:12.5, fontWeight:600, cursor:"pointer"
};
const smallBtn = {
  display:"inline-flex", alignItems:"center", gap:6, padding:"5px 10px",
  background:"var(--paper)", color:"var(--ink)", border:"1px solid var(--chrome-b)", borderRadius:8,
  fontSize:11.5, cursor:"pointer"
};

window.LibraryModal = LibraryModal;
window.InsertModal = InsertModal;
window.ShareModal = ShareModal;
window.SettingsModal = SettingsModal;
