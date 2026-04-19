// Canvas ink overlay — normalized stroke coordinates so ink survives layout resize.
const { useRef, useEffect, useCallback } = React;

/**
 * @typedef {{ tool: "pen"|"hl"|"erase", color: string, width: number, pts: [number, number][] }} InkStroke
 */

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Remove strokes if any point on the stroke is within radius (px) of the eraser polyline. */
function eraseStrokes(strokes, eraserPts, radiusPx, w, h) {
  if (!eraserPts.length) return strokes;
  const r2 = radiusPx * radiusPx;
  const toPx = (nx, ny) => [nx * w, ny * h];

  function nearEraser(px, py) {
    for (let i = 0; i < eraserPts.length; i++) {
      const [ex, ey] = eraserPts[i];
      if (dist2(px, py, ex, ey) <= r2) return true;
    }
    for (let i = 1; i < eraserPts.length; i++) {
      const [x1, y1] = eraserPts[i - 1];
      const [x2, y2] = eraserPts[i];
      const d = pointSegDist2(px, py, x1, y1, x2, y2);
      if (d <= r2) return true;
    }
    return false;
  }

  return strokes.filter((st) => {
    for (let i = 0; i < st.pts.length; i++) {
      const [px, py] = toPx(st.pts[i][0], st.pts[i][1]);
      if (nearEraser(px, py)) return false;
    }
    return true;
  });
}

function pointSegDist2(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = px - x1;
  const wy = py - y1;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return dist2(px, py, x1, y1);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return dist2(px, py, x2, y2);
  const t = c1 / c2;
  const projx = x1 + t * vx;
  const projy = y1 + t * vy;
  return dist2(px, py, projx, projy);
}

function drawStrokes(ctx, strokes, cw, ch) {
  ctx.clearRect(0, 0, cw, ch);
  for (let s = 0; s < strokes.length; s++) {
    const stroke = strokes[s];
    if (!stroke.pts || stroke.pts.length < 2) continue;
    const pts = stroke.pts.map(([nx, ny]) => [nx * cw, ny * ch]);
    const scale = Math.max(0.6, cw / 900);
    const lw = Math.max(0.8, stroke.width * scale);

    ctx.save();
    if (stroke.tool === "hl") {
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = 0.42;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.tool === "hl" ? lw * 2.8 : lw;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const [x, y] = pts[i];
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Full-bleed drawing surface on top of page content.
 * @param {{ strokes: InkStroke[], onCommit: (next: InkStroke[]) => void, tool: string, color: string, width: number, readOnly: boolean }} props
 */
function DrawingOverlay({ strokes, onCommit, tool, color, width, readOnly }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const strokesRef = useRef(strokes);
  const drawingRef = useRef(null);
  const eraserBufRef = useRef(null);

  strokesRef.current = strokes;

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = wrap.clientWidth;
    const ch = wrap.clientHeight;
    if (cw < 2 || ch < 2) return;
    const wPx = Math.floor(cw * dpr);
    const hPx = Math.floor(ch * dpr);
    if (canvas.width !== wPx || canvas.height !== hPx) {
      canvas.width = wPx;
      canvas.height = hPx;
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawStrokes(ctx, strokesRef.current, cw, ch);

    const cur = drawingRef.current;
    if (cur && cur.pts.length > 1) {
      drawStrokes(ctx, [cur], cw, ch);
    }

    if (tool === "eraser" && eraserBufRef.current && eraserBufRef.current.length > 1) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "#c45d20";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      const e = eraserBufRef.current;
      ctx.moveTo(e[0][0], e[0][1]);
      for (let i = 1; i < e.length; i++) ctx.lineTo(e[i][0], e[i][1]);
      ctx.stroke();
      ctx.restore();
    }
  }, [tool]);

  useEffect(() => {
    paint();
  }, [strokes, paint]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => paint());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [paint]);

  const canInk = !readOnly && (tool === "pen" || tool === "hl");
  const canErase = !readOnly && tool === "eraser";

  function norm(e, wrap) {
    const r = wrap.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    return [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))];
  }

  function onPointerDown(e) {
    if (readOnly) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (canInk) {
      wrap.setPointerCapture(e.pointerId);
      const [nx, ny] = norm(e, wrap);
      drawingRef.current = { tool: tool === "hl" ? "hl" : "pen", color, width, pts: [[nx, ny]] };
      paint();
    } else if (canErase) {
      wrap.setPointerCapture(e.pointerId);
      const r = wrap.getBoundingClientRect();
      eraserBufRef.current = [[e.clientX - r.left, e.clientY - r.top]];
      paint();
    }
  }

  function onPointerMove(e) {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (drawingRef.current) {
      const [nx, ny] = norm(e, wrap);
      const last = drawingRef.current.pts[drawingRef.current.pts.length - 1];
      if (dist2(nx, ny, last[0], last[1]) < 1e-6) return;
      drawingRef.current.pts.push([nx, ny]);
      paint();
    } else if (eraserBufRef.current) {
      const r = wrap.getBoundingClientRect();
      eraserBufRef.current.push([e.clientX - r.left, e.clientY - r.top]);
      paint();
    }
  }

  function onPointerUp(e) {
    const wrap = wrapRef.current;
    if (wrap && wrap.hasPointerCapture(e.pointerId)) {
      try {
        wrap.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
    if (drawingRef.current && drawingRef.current.pts.length > 1) {
      const next = strokesRef.current.concat([drawingRef.current]);
      drawingRef.current = null;
      onCommit(next);
    } else {
      drawingRef.current = null;
    }

    if (eraserBufRef.current && eraserBufRef.current.length > 0) {
      const cw = wrap ? wrap.clientWidth : 1;
      const ch = wrap ? wrap.clientHeight : 1;
      const radius = Math.max(14, width * 4);
      const next = eraseStrokes(strokesRef.current, eraserBufRef.current, radius, cw, ch);
      eraserBufRef.current = null;
      if (next.length !== strokesRef.current.length) {
        onCommit(next);
      } else {
        paint();
      }
    }
    paint();
  }

  const capture = canInk || canErase;
  return (
    <div
      ref={wrapRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 6,
        touchAction: "none",
        pointerEvents: capture ? "auto" : "none",
        cursor: canInk ? "crosshair" : canErase ? "cell" : "default",
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
    </div>
  );
}

window.DrawingOverlay = DrawingOverlay;
