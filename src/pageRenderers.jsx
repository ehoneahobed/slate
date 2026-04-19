// Page renderers — each page is a paper sheet with a background type and
// sample content. Content appears as a mix of handwriting, typed text,
// diagrams, code, embeds, and stickies — simulating a real teacher's notebook.

const { useMemo } = React;

/* -------- shared bits -------- */

const Stroke = ({d, color="var(--ink)", w=2.2, opacity=1, dash}) => (
  <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round"
        strokeLinejoin="round" opacity={opacity} strokeDasharray={dash}/>
);

const Hand = ({children, size=28, color="var(--ink)", rotate=0, style}) => (
  <span style={{
    fontFamily:"var(--hand)", fontSize:size, lineHeight:1.05, color,
    display:"inline-block", transform:`rotate(${rotate}deg)`, ...style
  }}>{children}</span>
);

const Highlight = ({children, color="var(--highlight)"}) => (
  <span style={{
    background:`linear-gradient(180deg, transparent 50%, ${color} 50%, ${color} 92%, transparent 92%)`,
    padding:"0 2px", boxDecorationBreak:"clone", WebkitBoxDecorationBreak:"clone",
  }}>{children}</span>
);

/* -------- page backgrounds -------- */

function PageBackground({ type }) {
  const common = { position:"absolute", inset:0, pointerEvents:"none" };
  if (type === "plain") return null;
  if (type === "ruled") {
    return (
      <svg style={common} width="100%" height="100%" preserveAspectRatio="none">
        <defs>
          <pattern id="ruled" width="100%" height="32" patternUnits="userSpaceOnUse">
            <line x1="0" y1="31.5" x2="2000" y2="31.5" stroke="var(--rule)" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ruled)"/>
        <line x1="70" y1="0" x2="70" y2="100%" stroke="var(--accent-2)" strokeWidth="1" opacity=".55"/>
      </svg>
    );
  }
  if (type === "grid") {
    return (
      <svg style={common} width="100%" height="100%" preserveAspectRatio="none">
        <defs>
          <pattern id="grid" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M22 0H0V22" fill="none" stroke="var(--rule-2)" strokeWidth="1"/>
          </pattern>
          <pattern id="grid5" width="110" height="110" patternUnits="userSpaceOnUse">
            <rect width="110" height="110" fill="url(#grid)"/>
            <path d="M110 0H0V110" fill="none" stroke="var(--rule)" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid5)"/>
      </svg>
    );
  }
  return null;
}

/* ---------------- page contents ---------------- */

/* The "active" page — gradient descent intuition, ruled */
function Page_GradientDescent() {
  return (
    <>
      {/* Title, as if handwritten */}
      <div style={{position:"absolute", left:92, top:24, display:"flex", alignItems:"baseline", gap:18}}>
        <Hand size={48} color="var(--ink)">Gradient descent</Hand>
        <Hand size={24} color="var(--ink-3)" rotate={-2}>— the whole idea in one picture</Hand>
      </div>
      <div style={{position:"absolute", left:92, top:84, color:"var(--ink-3)", fontFamily:"var(--mono)", fontSize:11}}>
        Lec 04 · Tue Apr 14 · 10:05 AM
      </div>

      {/* Left column — written explanation */}
      <div style={{position:"absolute", left:92, top:128, width:380, fontFamily:"var(--hand)", fontSize:22, lineHeight:"32px", color:"var(--ink)"}}>
        We want to minimize a loss <Highlight>L(θ)</Highlight>.
        Imagine standing on a hill in fog — you can feel the slope under your feet but not see the valley.<br/>
        <span style={{color:"var(--ink-2)"}}>So: take a small step <b style={{fontFamily:"var(--mono)", fontSize:18}}>downhill</b>, repeat.</span>
      </div>

      {/* the update rule as LaTeX-ish */}
      <div style={{
        position:"absolute", left:92, top:300, padding:"14px 18px",
        background:"var(--paper-2)", border:"1px dashed var(--rule)",
        borderRadius:8, fontFamily:"var(--mono)", fontSize:18, color:"var(--ink)",
      }}>
        θ<sub>t+1</sub> = θ<sub>t</sub> − η · ∇<sub>θ</sub>L(θ<sub>t</sub>)
        <div style={{fontFamily:"var(--hand)", fontSize:18, color:"var(--ink-3)", marginTop:6}}>
          η = learning rate · ∇L = slope
        </div>
      </div>

      {/* Annotation arrow pointing to η */}
      <svg style={{position:"absolute", left:260, top:360, width:170, height:110, overflow:"visible", pointerEvents:"none"}}>
        <Stroke d="M10 10 C 40 60, 90 80, 150 85" color="var(--accent)" w={2}/>
        <Stroke d="M140 78 L 152 86 L 142 92" color="var(--accent)" w={2}/>
      </svg>
      <Hand size={22} rotate={-4} color="var(--accent)" style={{position:"absolute", left:120, top:360}}>
        tiny → safe but slow
      </Hand>
      <Hand size={22} rotate={-4} color="var(--accent)" style={{position:"absolute", left:120, top:388}}>
        big → fast, may overshoot
      </Hand>

      {/* Middle: loss landscape diagram */}
      <svg viewBox="0 0 420 320" style={{position:"absolute", left:500, top:120, width:420, height:320}}>
        {/* axes */}
        <Stroke d="M40 280 L 400 280" color="var(--ink-3)" w={1.4}/>
        <Stroke d="M40 280 L 40 40"   color="var(--ink-3)" w={1.4}/>
        <text x="200" y="305" fontFamily="var(--mono)" fontSize="12" fill="var(--ink-3)" textAnchor="middle">θ</text>
        <text x="22"  y="50"  fontFamily="var(--mono)" fontSize="12" fill="var(--ink-3)">L(θ)</text>
        {/* loss curve */}
        <Stroke d="M60 70 C 120 260, 200 300, 260 200 S 360 80, 395 150"
                color="var(--ink)" w={2.4}/>
        {/* ball trajectory */}
        {[
          {x:80,  y:95,  r:6 },
          {x:120, y:175, r:6 },
          {x:170, y:245, r:6 },
          {x:215, y:280, r:6 },
          {x:250, y:258, r:6 },
          {x:268, y:232, r:7, final:true},
        ].map((p,i,arr)=> (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={p.r} fill={p.final? "var(--accent)":"var(--ink)"} opacity={p.final?1:0.25 + i*0.12}/>
            {i<arr.length-1 && <Stroke
              d={`M${p.x} ${p.y} Q ${(p.x+arr[i+1].x)/2} ${Math.min(p.y,arr[i+1].y)-15}, ${arr[i+1].x} ${arr[i+1].y}`}
              color="var(--accent)" w={1.6} dash="4 4" opacity={0.6}/>}
          </g>
        ))}
        {/* minimum marker */}
        <Stroke d="M268 232 L 268 280" color="var(--accent)" w={1.2} dash="3 3"/>
        <text x="274" y="228" fontFamily="var(--hand)" fontSize="18" fill="var(--accent)">θ*</text>
        {/* label */}
        <text x="80"  y="78"  fontFamily="var(--hand)" fontSize="20" fill="var(--ink-2)">start</text>
        <text x="195" y="300" fontFamily="var(--hand)" fontSize="18" fill="var(--ink-3)">each arrow ≈ one step of size η</text>
      </svg>

      {/* A sticky note */}
      <div style={{
        position:"absolute", right:60, top:90, width:220, padding:"14px 16px",
        background:"#fff2b0", color:"#4a3d10", borderRadius:3,
        boxShadow:"0 8px 16px -8px rgba(0,0,0,.25), 0 2px 3px rgba(0,0,0,.08)",
        transform:"rotate(2.2deg)", fontFamily:"var(--hand)", fontSize:20, lineHeight:1.2,
      }}>
        <b>exam tip ✶</b><br/>
        if loss oscillates, <u>halve η</u>.<br/>
        if loss plateaus, try a momentum term.
      </div>

      {/* Code embed */}
      <div style={{
        position:"absolute", left:500, top:470, width:440, borderRadius:8,
        background:"#1c1a17", color:"#e9e4d6", fontFamily:"var(--mono)", fontSize:12.5,
        padding:"10px 14px 12px", boxShadow:"var(--shadow-2)",
      }}>
        <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:6, color:"#8a8677", fontSize:10.5}}>
          <span style={{width:9,height:9,borderRadius:9,background:"#e56a5a"}}/>
          <span style={{width:9,height:9,borderRadius:9,background:"#e6b74d"}}/>
          <span style={{width:9,height:9,borderRadius:9,background:"#7db36a"}}/>
          <span style={{marginLeft:8}}>gd.py</span>
          <span style={{marginLeft:"auto"}}>Python</span>
        </div>
<pre style={{margin:0, whiteSpace:"pre-wrap"}}>
<span style={{color:"#c98a5e"}}>def</span> <span style={{color:"#e9d28a"}}>step</span>(theta, grad_fn, lr=<span style={{color:"#b7d08a"}}>0.05</span>):
    g = grad_fn(theta)
    <span style={{color:"#c98a5e"}}>return</span> theta - lr * g
</pre>
      </div>

      {/* Linked-page chip — bottom right */}
      <div style={{position:"absolute", right:60, bottom:80, display:"flex", gap:8, alignItems:"center",
        background:"var(--paper-2)", border:"1px solid var(--rule)", padding:"6px 10px", borderRadius:999,
        fontSize:12, color:"var(--ink-2)"}}>
        <Icons.Link size={14}/> continues on <b style={{color:"var(--accent)", marginLeft:4}}>p15 · Assignment 1</b>
      </div>

      {/* Laser pointer dot (simulated) */}
      <div style={{position:"absolute", left:720, top:300, width:16, height:16, borderRadius:16,
        background:"radial-gradient(circle, #ff3b30 0%, rgba(255,59,48,0) 70%)",
        boxShadow:"0 0 16px 6px rgba(255,59,48,.35)"}}/>
    </>
  );
}

/* Secondary sample pages (shorter, still richly content-filled) */

function Page_WhatIsLearning() {
  return (
    <>
      <div style={{position:"absolute", left:92, top:24}}>
        <Hand size={40}>What is “learning”?</Hand>
      </div>
      <div style={{position:"absolute", left:92, top:90, width:720, fontFamily:"var(--hand)", fontSize:22, lineHeight:"30px", color:"var(--ink-2)"}}>
        A system <Highlight>learns</Highlight> if its performance on a task <b>improves with experience</b>.
        <div style={{marginTop:14}}>formally <span style={{fontFamily:"var(--mono)", fontSize:16}}>(T, P, E)</span> — Mitchell, 1997</div>
      </div>

      <div style={{position:"absolute", left:92, top:220, display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:16, width:820}}>
        {[
          {h:"Task T",       d:"predict house price from features"},
          {h:"Performance P",d:"mean squared error on held-out data"},
          {h:"Experience E", d:"1000 past sales, labelled"},
        ].map(c=>(
          <div key={c.h} style={{background:"var(--paper-2)", border:"1px solid var(--rule)", borderRadius:10, padding:"14px 16px"}}>
            <div style={{fontFamily:"var(--mono)", fontSize:11, color:"var(--ink-3)"}}>{c.h}</div>
            <div style={{fontFamily:"var(--hand)", fontSize:22, marginTop:4, lineHeight:1.2}}>{c.d}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function Page_LinearRegression() {
  // A graph-paper page with a scatter + fit line
  return (
    <>
      <div style={{position:"absolute", left:92, top:24}}>
        <Hand size={40}>Linear regression, by hand</Hand>
      </div>
      <svg viewBox="0 0 500 340" style={{position:"absolute", left:92, top:100, width:500, height:340}}>
        <Stroke d="M30 310 L 480 310" color="var(--ink-3)" w={1.4}/>
        <Stroke d="M30 310 L 30 20"   color="var(--ink-3)" w={1.4}/>
        {[{x:70,y:270},{x:110,y:250},{x:150,y:240},{x:190,y:215},{x:230,y:190},{x:270,y:180},{x:310,y:150},{x:350,y:140},{x:390,y:110},{x:430,y:95}].map((p,i)=>
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="var(--ink)"/>
        )}
        <Stroke d="M50 285 L 455 75" color="var(--accent)" w={2.4}/>
        <text x="440" y="65" fontFamily="var(--hand)" fontSize="22" fill="var(--accent)">ŷ = wx + b</text>
        <text x="210" y="335" fontFamily="var(--mono)" fontSize="11" fill="var(--ink-3)" textAnchor="middle">x — sqft / 100</text>
        <text x="12" y="170" fontFamily="var(--mono)" fontSize="11" fill="var(--ink-3)" transform="rotate(-90 12 170)">price (k$)</text>
      </svg>
      <div style={{position:"absolute", right:70, top:110, width:260, fontFamily:"var(--hand)", fontSize:22, lineHeight:1.3, color:"var(--ink-2)"}}>
        fit the line that minimizes the <u>sum of squared residuals</u>. closed-form solution exists:
        <div style={{marginTop:10, fontFamily:"var(--mono)", fontSize:14, background:"var(--paper-2)", border:"1px dashed var(--rule)", padding:"10px 12px", borderRadius:6, color:"var(--ink)"}}>
          w = (XᵀX)⁻¹ Xᵀy
        </div>
      </div>
    </>
  );
}

function Page_Neurons() {
  return (
    <>
      <div style={{position:"absolute", left:92, top:24}}>
        <Hand size={40}>Neurons & activations</Hand>
      </div>
      {/* Neuron diagram */}
      <svg viewBox="0 0 700 360" style={{position:"absolute", left:92, top:100, width:700, height:360}}>
        {[80,170,260].map((y,i)=>(
          <g key={i}>
            <circle cx="80" cy={y} r="22" fill="var(--paper-2)" stroke="var(--ink)" strokeWidth="1.6"/>
            <text x="80" y={y+5} fontFamily="var(--mono)" fontSize="13" textAnchor="middle" fill="var(--ink)">x{i+1}</text>
            <Stroke d={`M102 ${y} L 330 170`} color="var(--ink-2)" w={1.6}/>
            <text x={200} y={y<170?y+20:y-8} fontFamily="var(--mono)" fontSize="12" fill="var(--accent)">w{i+1}</text>
          </g>
        ))}
        <circle cx="360" cy="170" r="34" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2"/>
        <text x="360" y="175" fontFamily="var(--mono)" fontSize="13" textAnchor="middle" fill="var(--accent)">Σ + b</text>
        <Stroke d="M394 170 L 480 170" color="var(--ink)" w={2}/>
        <rect x="480" y="140" width="80" height="60" rx="6" fill="var(--paper-2)" stroke="var(--ink)" strokeWidth="1.6"/>
        <text x="520" y="175" fontFamily="var(--mono)" fontSize="13" textAnchor="middle" fill="var(--ink)">σ(·)</text>
        <Stroke d="M560 170 L 640 170" color="var(--ink)" w={2}/>
        <text x="650" y="175" fontFamily="var(--hand)" fontSize="24" fill="var(--ink)">ŷ</text>
        <text x="520" y="220" fontFamily="var(--hand)" fontSize="18" textAnchor="middle" fill="var(--ink-3)">activation</text>
      </svg>
      <Hand size={22} rotate={-2} color="var(--ink-3)" style={{position:"absolute", left:120, top:480}}>
        σ options: <span style={{fontFamily:"var(--mono)", fontSize:16}}>ReLU · tanh · sigmoid · GELU</span>
      </Hand>
    </>
  );
}

function Page_AttentionEmbed() {
  return (
    <>
      <div style={{position:"absolute", left:92, top:24}}>
        <Hand size={40}>Attention is matrix math</Hand>
      </div>
      {/* YouTube embed placeholder */}
      <div style={{position:"absolute", left:92, top:110, width:560, aspectRatio:"16/9",
        background:"linear-gradient(135deg, #1a1a1e 0%, #2b2b33 100%)", borderRadius:10,
        boxShadow:"var(--shadow-2)", display:"grid", placeItems:"center", color:"#fff", overflow:"hidden"}}>
        <div style={{position:"absolute", inset:0, backgroundImage:"repeating-linear-gradient(135deg, rgba(255,255,255,.02) 0 8px, transparent 8px 16px)"}}/>
        <div style={{width:72, height:72, borderRadius:999, background:"#e63a2b", display:"grid", placeItems:"center", boxShadow:"0 10px 30px rgba(230,58,43,.5)"}}>
          <svg width="28" height="28" viewBox="0 0 20 20" fill="#fff"><path d="M6 4l10 6-10 6z"/></svg>
        </div>
        <div style={{position:"absolute", left:14, bottom:12, right:14, display:"flex", justifyContent:"space-between", fontFamily:"var(--mono)", fontSize:11, opacity:.85}}>
          <span>Transformers explained — 18:42</span><span>YouTube embed</span>
        </div>
      </div>
      {/* Formula + note */}
      <div style={{position:"absolute", right:60, top:120, width:280}}>
        <div style={{fontFamily:"var(--mono)", fontSize:14, background:"var(--paper-2)", border:"1px dashed var(--rule)", padding:"14px 16px", borderRadius:8}}>
          Attention(Q,K,V) = softmax( QKᵀ / √d<sub>k</sub> ) V
        </div>
        <Hand size={22} style={{marginTop:14, display:"block", color:"var(--ink-2)"}}>
          Q = what I'm looking for<br/>
          K = what's on offer<br/>
          V = the thing I'll take home
        </Hand>
      </div>
    </>
  );
}

function Page_Plain_Default({ title }) {
  return (
    <>
      <div style={{position:"absolute", left:92, top:24}}>
        <Hand size={40}>{title}</Hand>
        <div style={{fontFamily:"var(--mono)", fontSize:11, color:"var(--ink-3)", marginTop:6}}>blank — drop anything here</div>
      </div>
      <div style={{position:"absolute", left:92, top:120, right:80, bottom:80,
        border:"2px dashed var(--rule)", borderRadius:14, display:"grid", placeItems:"center",
        color:"var(--ink-3)"}}>
        <div style={{textAlign:"center", fontFamily:"var(--hand)", fontSize:26}}>
          start writing, drop files, or press <kbd style={{fontFamily:"var(--mono)", fontSize:13, background:"var(--paper-2)", padding:"2px 6px", borderRadius:4, border:"1px solid var(--rule)"}}>/</kbd> for insert menu
        </div>
      </div>
    </>
  );
}

/* ---------------- Page shell ---------------- */

const PAGES = {
  "p11": { title:"What is learning?",               type:"ruled", render:<Page_WhatIsLearning/>, section:"01 · Foundations"},
  "p12": { title:"Linear regression, by hand",      type:"grid",  render:<Page_LinearRegression/>, section:"01 · Foundations"},
  "p13": { title:"Loss landscapes",                 type:"plain", render:<Page_Plain_Default title="Loss landscapes"/>, section:"01 · Foundations"},
  "p14": { title:"Gradient descent — intuition",    type:"ruled", render:<Page_GradientDescent/>, section:"01 · Foundations"},
  "p15": { title:"Assignment 1",                    type:"ruled", render:<Page_Plain_Default title="Assignment 1"/>, section:"01 · Foundations"},
  "p21": { title:"Neurons & activations",           type:"grid",  render:<Page_Neurons/>, section:"02 · Neural Networks"},
  "p22": { title:"Backprop, step by step",          type:"plain", render:<Page_Plain_Default title="Backprop, step by step"/>, section:"02 · Neural Networks"},
  "p23": { title:"Building an MLP in PyTorch",      type:"ruled", render:<Page_Plain_Default title="Building an MLP in PyTorch"/>, section:"02 · Neural Networks"},
  "p41": { title:"Attention is matrix math",        type:"grid",  render:<Page_AttentionEmbed/>, section:"04 · Transformers"},
};

function PageCard({ page, idx, total, active, readOnly, sectionTitle, strokes, onStrokesCommit, tool, penColor, penSize }) {
  const base = PAGES[page.id] || {
    title: page.title,
    type: page.type,
    render: <Page_Plain_Default title={page.title} />,
    section: "",
  };
  const p = { ...base, type: page.type, title: page.title || base.title, section: base.section || sectionTitle || "" };
  return (
    <div id={`page-${page.id}`} data-page-id={page.id} style={{
      position:"relative",
      width:"min(1180px, 96%)",
      margin:"0 auto 36px",
      background:"var(--paper)",
      borderRadius:6,
      boxShadow: active ? "0 0 0 2px var(--accent), 0 24px 60px -30px rgba(60,40,10,.35), 0 3px 10px rgba(40,30,10,.10)"
                        : "0 1px 0 rgba(50,40,20,.05), 0 18px 40px -26px rgba(40,30,10,.25)",
      aspectRatio:"16 / 10",
      overflow:"hidden",
      transition:"box-shadow .2s ease",
    }}>
      <PageBackground type={p.type}/>
      {/* page number header */}
      <div style={{position:"absolute", top:12, right:18, display:"flex", gap:10, alignItems:"center",
        fontFamily:"var(--mono)", fontSize:11, color:"var(--ink-3)", zIndex:3}}>
        <span>{p.section}</span>
        <span style={{opacity:.5}}>·</span>
        <span>p. {String(idx+1).padStart(2,"0")} / {total}</span>
      </div>
      {/* content */}
      <div style={{position:"absolute", inset:0, zIndex:2}}>
        {p.render}
      </div>
      <DrawingOverlay
        strokes={strokes || []}
        onCommit={onStrokesCommit}
        tool={tool}
        color={penColor}
        width={penSize}
        readOnly={!!readOnly}
      />
      {readOnly && (
        <div style={{position:"absolute", left:18, top:12, zIndex:4,
          display:"flex", gap:6, alignItems:"center", padding:"4px 10px",
          background:"var(--paper-2)", border:"1px solid var(--rule)", borderRadius:999,
          fontFamily:"var(--mono)", fontSize:10.5, color:"var(--ink-3)"}}>
          <Icons.Eye size={12}/> read-only
        </div>
      )}
    </div>
  );
}

window.PageCard = PageCard;
window.PAGES = PAGES;
