// 画板交互（Pointer Events 统一鼠标/触控/触笔） + HiDPI 适配
let ctx, pad, strokes = [], current = null;
let dpr = Math.max(1, window.devicePixelRatio || 1);

export function initPad(canvas, { brushSizeInput, eraserToggle, onDraw } = {}) {
  pad = canvas;
  const cssW = Number(pad.getAttribute('width') || 280);
  const cssH = Number(pad.getAttribute('height') || 280);

  pad.width  = Math.round(cssW * dpr);
  pad.height = Math.round(cssH * dpr);
  pad.style.width  = cssW + 'px';
  pad.style.height = cssH + 'px';

  ctx = pad.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  resetCanvas();

  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pad.setPointerCapture(e.pointerId);
    const [x,y] = getPos(e);
    current = {
      eraser: !!eraserToggle?.checked,
      size: parseInt(brushSizeInput?.value || '24', 10),
      points: [[x,y]]
    };
  });

  pad.addEventListener('pointermove', (e) => {
    if (!current) return;
    e.preventDefault();
    const [x,y] = getPos(e);
    const last = current.points[current.points.length - 1];
    current.points.push([x,y]);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = current.size;
    ctx.strokeStyle = current.eraser ? '#000' : '#fff';
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath();
    ctx.moveTo(last[0], last[1]);
    ctx.lineTo(x, y);
    ctx.stroke();

    onDraw?.();
  });

  const end = (e) => {
    if (!current) return;
    pad.releasePointerCapture?.(e.pointerId);
    strokes.push(current);
    current = null;
  };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
}

function getPos(e){
  const r = pad.getBoundingClientRect();
  return [ (e.clientX - r.left) * (pad.width / dpr / r.width),
           (e.clientY - r.top)  * (pad.height / dpr / r.height) ];
}

export function clearPad() {
  strokes = [];
  resetCanvas();
}

export function undoStroke() {
  if (strokes.length === 0) return;
  strokes.pop();
  redrawAll();
}

function resetCanvas() {
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0,0, pad.width / dpr, pad.height / dpr);
  ctx.restore();
}

function redrawAll() {
  resetCanvas();
  for (const s of strokes) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = s.size;
    ctx.strokeStyle = s.eraser ? '#000' : '#fff';
    ctx.globalCompositeOperation = 'source-over';
    for (let i=1;i<s.points.length;i++){
      const [x0,y0] = s.points[i-1], [x1,y1] = s.points[i];
      ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();
    }
  }
}

export function getRGBAFromPad() {
  // 导出为 CSS 尺寸分辨率（非 DPR 放大）
  const tmp = document.createElement('canvas');
  tmp.width  = pad.width;
  tmp.height = pad.height;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(pad, 0, 0);

  const out = document.createElement('canvas');
  out.width = Math.round(pad.width / dpr);
  out.height = Math.round(pad.height / dpr);
  const octx = out.getContext('2d');
  octx.drawImage(tmp, 0, 0, out.width, out.height);
  return octx.getImageData(0,0,out.width,out.height).data;
}