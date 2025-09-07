// 画板交互：黑底白字，支持撤销/橡皮擦/笔宽
let ctx, pad, strokes = [], current = null;

export function initPad(canvas, { brushSizeInput, eraserToggle, onDraw } = {}) {
  pad = canvas;
  ctx = pad.getContext('2d');
  resetCanvas();

  const getPos = (e) => {
    const r = pad.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return [ (t.clientX - r.left) * (pad.width / r.width),
             (t.clientY - r.top)  * (pad.height / r.height) ];
  };

  const start = (e) => {
    e.preventDefault();
    const [x,y] = getPos(e);
    current = { eraser: !!eraserToggle?.checked, size: parseInt(brushSizeInput?.value || '24', 10), points: [[x,y]] };
  };
  const move = (e) => {
    if (!current) return;
    e.preventDefault();
    const [x,y] = getPos(e);
    const last = current.points[current.points.length-1];
    current.points.push([x,y]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = current.size;
    ctx.strokeStyle = current.eraser ? '#000' : '#fff';
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(x,y); ctx.stroke();
    onDraw?.();
  };
  const end = () => { if (!current) return; strokes.push(current); current = null; };

  pad.addEventListener('mousedown', start);
  pad.addEventListener('touchstart', start, {passive:false});
  window.addEventListener('mousemove', move);
  window.addEventListener('touchmove', move, {passive:false});
  window.addEventListener('mouseup', end);
  window.addEventListener('touchend', end);
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
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,pad.width,pad.height);
}

function redrawAll() {
  resetCanvas();
  for (const s of strokes) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
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
  return ctx.getImageData(0,0,pad.width,pad.height).data; // Uint8ClampedArray
}
