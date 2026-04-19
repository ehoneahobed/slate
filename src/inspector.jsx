// Right-side inspector — page type picker + AI panel
const { useState: useStateIn } = React;

function Inspector({ pageType, onPageTypeChange, aiEnabled, aiOpen, setAiOpen }) {
  return (
    <aside style={{
      width:300, borderLeft:"1px solid var(--chrome-b)", background:"var(--chrome)",
      display:"flex", flexDirection:"column", minHeight:0
    }}>
      {/* tabs */}
      <div style={{display:"flex", gap:2, padding:"8px 10px 0", borderBottom:"1px solid var(--chrome-b)"}}>
        <Tab active={!aiOpen} onClick={()=>setAiOpen(false)}>Page</Tab>
        {aiEnabled && <Tab active={aiOpen} onClick={()=>setAiOpen(true)}><span style={{display:"inline-flex", alignItems:"center", gap:6}}><Icons.Sparkles size={12}/> Ask</span></Tab>}
        <div style={{flex:1}}/>
      </div>

      {!aiOpen && <PageInspector pageType={pageType} onPageTypeChange={onPageTypeChange}/>}
      {aiOpen && aiEnabled && <AIPanel/>}
    </aside>
  );
}

function Tab({children, active, onClick}) {
  return (
    <button onClick={onClick} style={{
      padding:"8px 12px", border:"none", background:"transparent", cursor:"pointer",
      fontSize:12.5, fontWeight:600,
      color: active ? "var(--ink)" : "var(--ink-3)",
      borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
      marginBottom:-1
    }}>{children}</button>
  );
}

function PageInspector({ pageType, onPageTypeChange }) {
  return (
    <div style={{padding:"14px 14px 18px", overflow:"auto"}}>
      <SectionLbl>Page background</SectionLbl>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginTop:8}}>
        {[
          {id:"plain", label:"Plain",  preview:<BgPreview type="plain"/>},
          {id:"ruled", label:"Ruled",  preview:<BgPreview type="ruled"/>},
          {id:"grid",  label:"Grid",   preview:<BgPreview type="grid"/>},
        ].map(opt=>(
          <button key={opt.id} onClick={()=>onPageTypeChange(opt.id)} style={{
            background:"var(--paper)", border: pageType===opt.id ? "2px solid var(--accent)" : "1px solid var(--chrome-b)",
            padding: pageType===opt.id ? 5 : 6, borderRadius:8, cursor:"pointer",
            display:"flex", flexDirection:"column", alignItems:"stretch", gap:6
          }}>
            {opt.preview}
            <span style={{fontSize:11.5, color:"var(--ink-2)", fontWeight:500}}>{opt.label}</span>
          </button>
        ))}
      </div>

      <SectionLbl style={{marginTop:18}}>Paper size</SectionLbl>
      <div style={{display:"flex", gap:6, flexWrap:"wrap", marginTop:8}}>
        {["16:10", "A4", "Letter", "Infinite"].map((s,i)=>(
          <Pill key={s} active={i===0}>{s}</Pill>
        ))}
      </div>

      <SectionLbl style={{marginTop:18}}>Page options</SectionLbl>
      <Row><span>Snap to grid</span><Toggle on/></Row>
      <Row><span>Show rulers</span><Toggle/></Row>
      <Row><span>Page number</span><Toggle on/></Row>
      <Row><span>Lock page</span><Toggle/></Row>

      <SectionLbl style={{marginTop:18}}>Activity</SectionLbl>
      <div style={{display:"flex", flexDirection:"column", gap:6, marginTop:8, fontSize:12}}>
        <ActItem who="You" what="drew a diagram" when="2m ago" color="var(--accent)"/>
        <ActItem who="Priya M." what="added a sticky" when="1h ago" color="#5a7f4a"/>
        <ActItem who="Jae-won" what="viewed the page" when="3h ago" color="#6b5aa6"/>
      </div>
    </div>
  );
}

function AIPanel() {
  const [messages, setMessages] = useStateIn([]);
  const [draft, setDraft] = useStateIn("");

  function pushAssistant(text) {
    setMessages((m) => m.concat([{ role: "assistant", text }]));
  }

  function send(text) {
    const q = (text || "").trim();
    if (!q) return;
    setMessages((m) => m.concat([{ role: "user", text: q }]));
    setDraft("");
    const canned =
      "This demo runs fully in your browser — no API keys are sent anywhere. On a real build, this would call your model with the current page as context. For now: try shrinking η if your loss oscillates, and increase it carefully if learning is too slow.";
    window.setTimeout(() => pushAssistant(canned), 280);
  }

  return (
    <div style={{padding:"14px 14px", overflow:"auto", display:"flex", flexDirection:"column", gap:14}}>
      <div style={{
        padding:"12px 14px", borderRadius:10,
        background:"linear-gradient(135deg, var(--accent-soft), transparent)",
        border:"1px solid var(--chrome-b)", fontSize:12.5, color:"var(--ink-2)"
      }}>
        I've read the current page. Here's a <b>quick summary</b>:
        <ul style={{margin:"8px 0 0 16px", padding:0, lineHeight:1.55}}>
          <li>Gradient descent iteratively minimizes a loss <span style={{fontFamily:"var(--mono)"}}>L(θ)</span>.</li>
          <li>Step size <span style={{fontFamily:"var(--mono)"}}>η</span> controls speed vs. stability.</li>
          <li>Linked to the Assignment 1 page.</li>
        </ul>
      </div>

      <SectionLbl>Suggested actions</SectionLbl>
      <div style={{display:"flex", flexDirection:"column", gap:6}}>
        <AISug onClick={()=>send("Generate a short quiz from this page.")}>✨ Generate a 5-question quiz from this page</AISug>
        <AISug onClick={()=>send("Turn my handwriting into typed notes.")}>📝 Clean up my handwriting → typed notes</AISug>
        <AISug onClick={()=>send("Explain the loss landscape diagram to a beginner.")}>📊 Explain the loss landscape diagram to a beginner</AISug>
        <AISug onClick={()=>send("Find related pages in this notebook.")}>🔗 Find related pages in this notebook</AISug>
      </div>

      {messages.length > 0 && (
        <div style={{display:"flex", flexDirection:"column", gap:8}}>
          <SectionLbl>Conversation</SectionLbl>
          {messages.map((msg, i) => (
            <div key={i} style={{
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              maxWidth:"92%",
              padding:"8px 10px",
              borderRadius:10,
              fontSize:12.5,
              lineHeight:1.45,
              background: msg.role === "user" ? "var(--paper-2)" : "var(--chrome-2)",
              border:"1px solid var(--chrome-b)",
              color:"var(--ink-2)",
            }}>{msg.text}</div>
          ))}
        </div>
      )}

      <SectionLbl>Ask anything</SectionLbl>
      <div style={{
        border:"1px solid var(--chrome-b)", background:"var(--paper)", borderRadius:10,
        padding:"10px 12px", display:"flex", flexDirection:"column", gap:6
      }}>
        <textarea value={draft} onChange={(e)=>setDraft(e.target.value)} placeholder="e.g. why is choosing η hard?" rows={3} style={{
          border:"none", background:"transparent", outline:"none", resize:"none",
          fontSize:13, color:"var(--ink)", fontFamily:"var(--ui)"
        }}/>
        <div style={{display:"flex", alignItems:"center", gap:6}}>
          <span style={{fontSize:10.5, color:"var(--ink-4)"}}>answers use <b>this page</b> as context</span>
          <div style={{flex:1}}/>
          <button type="button" onClick={()=>send(draft)} style={{
            background:"var(--ink)", color:"var(--paper)", border:"none", borderRadius:8,
            padding:"6px 12px", fontSize:12, fontWeight:600, cursor:"pointer"
          }}>Ask →</button>
        </div>
      </div>
    </div>
  );
}

function AISug({children, onClick}) {
  return (
    <button type="button" onClick={onClick} style={{
      textAlign:"left", background:"var(--paper)", border:"1px solid var(--chrome-b)",
      borderRadius:8, padding:"8px 10px", fontSize:12.5, cursor:"pointer",
      color:"var(--ink-2)"
    }}>{children}</button>
  );
}

function SectionLbl({children, style}) {
  return <div style={{fontSize:10.5, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"var(--ink-3)", ...style}}>{children}</div>;
}

function BgPreview({type}) {
  return (
    <div style={{height:44, background:"var(--paper)", borderRadius:4, position:"relative", overflow:"hidden", border:"1px solid var(--chrome-b)"}}>
      {type==="ruled" && <div style={{position:"absolute", inset:0, backgroundImage:"repeating-linear-gradient(transparent 0 8px, var(--rule) 8px 9px)"}}/>}
      {type==="grid" && <div style={{position:"absolute", inset:0,
        backgroundImage:"linear-gradient(var(--rule-2) 1px, transparent 1px), linear-gradient(90deg, var(--rule-2) 1px, transparent 1px)",
        backgroundSize:"7px 7px"}}/>}
    </div>
  );
}

function Pill({children, active}) {
  return (
    <button style={{
      padding:"5px 10px", borderRadius:999, fontSize:11.5,
      border:"1px solid " + (active?"var(--ink)":"var(--chrome-b)"),
      background: active ? "var(--ink)" : "var(--paper)",
      color: active ? "var(--paper)" : "var(--ink-2)",
      cursor:"pointer"
    }}>{children}</button>
  );
}

function Row({children}) {
  return <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 0", fontSize:12.5, color:"var(--ink-2)"}}>{children}</div>;
}

function Toggle({on}) {
  const [v,setV] = useStateIn(!!on);
  return (
    <button onClick={()=>setV(!v)} style={{
      width:34, height:20, borderRadius:999, position:"relative", border:"none", cursor:"pointer",
      background: v ? "var(--ink)" : "var(--chrome-b)", transition:"background .15s",
      padding:0
    }}>
      <span style={{
        position:"absolute", top:2, left: v ? 16 : 2, width:16, height:16, borderRadius:999,
        background:"var(--paper)", transition:"left .15s", boxShadow:"0 1px 2px rgba(0,0,0,.2)"
      }}/>
    </button>
  );
}

function ActItem({who, what, when, color}) {
  return (
    <div style={{display:"flex", alignItems:"center", gap:8}}>
      <span style={{width:20, height:20, borderRadius:999, background:color, color:"#fff",
        display:"grid", placeItems:"center", fontSize:9.5, fontWeight:700}}>{who[0]}</span>
      <span style={{flex:1, color:"var(--ink-2)"}}><b style={{color:"var(--ink)"}}>{who}</b> {what}</span>
      <span style={{color:"var(--ink-4)", fontSize:11}}>{when}</span>
    </div>
  );
}

window.Inspector = Inspector;
