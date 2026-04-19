// Tweaks panel (in-design controls + editmode bridge)
const { useState: useStateTw, useEffect: useEffectTw } = React;

function TweaksPanel({ tweaks, setTweaks, visible }) {
  useEffectTw(()=>{
    function onMsg(e){
      const d = e.data;
      if (!d || typeof d!=="object") return;
    }
    window.addEventListener("message", onMsg);
    return ()=> window.removeEventListener("message", onMsg);
  }, []);

  const update = (k, v) => {
    setTweaks(t => {
      const n = { ...t, [k]: v };
      try { window.parent.postMessage({type:"__edit_mode_set_keys", edits:{[k]:v}}, "*"); } catch(_){}
      return n;
    });
  };

  if (!visible) return null;
  return (
    <div style={{
      position:"fixed", right:16, bottom:16, zIndex:200, width:280,
      background:"var(--paper)", border:"1px solid var(--chrome-b)", borderRadius:14,
      boxShadow:"var(--shadow-3)", padding:"14px 14px 12px",
      fontFamily:"var(--ui)"
    }}>
      <div style={{display:"flex", alignItems:"baseline", gap:8, marginBottom:10}}>
        <span style={{fontFamily:"var(--serif)", fontSize:18}}>Tweaks</span>
        <span style={{fontSize:10.5, color:"var(--ink-3)"}}>live previews</span>
      </div>

      <TweakGroup label="Theme">
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6}}>
          {[{id:"paper",n:"Paper"},{id:"clean",n:"Clean"},{id:"dark",n:"Night"}].map(o=>(
            <button key={o.id} onClick={()=>update("theme", o.id)} style={miniPill(tweaks.theme===o.id)}>{o.n}</button>
          ))}
        </div>
      </TweakGroup>

      <TweakGroup label="Spine style">
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:6}}>
          {[{id:"stacked",n:"Sections + pages"},{id:"linear",n:"Just pages"}].map(o=>(
            <button key={o.id} onClick={()=>update("spineStyle", o.id)} style={miniPill(tweaks.spineStyle===o.id)}>{o.n}</button>
          ))}
        </div>
      </TweakGroup>

      <TweakGroup label="Density">
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:6}}>
          {[{id:"cozy",n:"Cozy"},{id:"compact",n:"Compact"}].map(o=>(
            <button key={o.id} onClick={()=>update("density", o.id)} style={miniPill(tweaks.density===o.id)}>{o.n}</button>
          ))}
        </div>
      </TweakGroup>

      <TweakGroup label="Handwriting font">
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:6}}>
          {[{id:"Caveat",n:"Caveat"},{id:"Kalam",n:"Kalam"}].map(o=>(
            <button key={o.id} onClick={()=>update("handwritingFont", o.id)} style={{...miniPill(tweaks.handwritingFont===o.id), fontFamily:`"${o.id}", cursive`}}>{o.n}</button>
          ))}
        </div>
      </TweakGroup>

      <div style={{display:"flex", gap:10, alignItems:"center", marginTop:10, padding:"8px 0", borderTop:"1px dashed var(--rule-2)"}}>
        <span style={{flex:1, fontSize:12, color:"var(--ink-2)"}}>AI panel</span>
        <MiniToggle on={tweaks.aiEnabled} onChange={v=>update("aiEnabled", v)}/>
      </div>
      <div style={{display:"flex", gap:10, alignItems:"center", padding:"6px 0"}}>
        <span style={{flex:1, fontSize:12, color:"var(--ink-2)"}}>Paper grain</span>
        <MiniToggle on={tweaks.showGrain} onChange={v=>update("showGrain", v)}/>
      </div>
    </div>
  );
}

function TweakGroup({label, children}) {
  return (
    <div style={{marginBottom:10}}>
      <div style={{fontSize:10, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"var(--ink-3)", marginBottom:6}}>{label}</div>
      {children}
    </div>
  );
}

function miniPill(active) {
  return {
    padding:"6px 8px", borderRadius:8, fontSize:11.5, cursor:"pointer",
    border:"1px solid " + (active?"var(--ink)":"var(--chrome-b)"),
    background: active ? "var(--ink)" : "var(--paper-2)",
    color: active ? "var(--paper)" : "var(--ink-2)",
  };
}

function MiniToggle({on, onChange}) {
  return (
    <button onClick={()=>onChange(!on)} style={{
      width:32, height:18, borderRadius:999, position:"relative", border:"none", cursor:"pointer",
      background: on ? "var(--accent)" : "var(--chrome-b)", padding:0
    }}>
      <span style={{position:"absolute", top:2, left: on ? 16 : 2, width:14, height:14, borderRadius:999, background:"#fff", transition:"left .15s"}}/>
    </button>
  );
}

window.TweaksPanel = TweaksPanel;
