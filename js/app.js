import { initPad, getRGBAFromPad, undoStroke, clearPad } from './drawing.js';
import { preprocessToMNIST, tensorFrom28x28 } from './processing.js';
import { softmax, argTopK, renderBars } from './utils.js';

window.__APP_BUILD__ = 'app-en-1';
window.__MODEL_READY__ = false;

// global clear for game.js
window.clearCanvas = function() {
  clearPad();
  const pd = document.getElementById('predDigit'); if (pd) pd.textContent = '—';
  const b  = document.getElementById('bars');      if (b)  b.innerHTML = '';
  const t  = document.getElementById('topk');      if (t)  t.innerHTML = '';
};

const MODEL_PATH = new URL('./mnist_tfjs_model/model.json', window.location.href).toString();
const $ = (id) => document.getElementById(id);

/* -------- Backend -------- */
async function setupBackend() {
  try { await tf.setBackend('wasm'); } catch {}
  if (tf.getBackend() !== 'wasm') { try { await tf.setBackend('webgl'); } catch {} }
  if (tf.getBackend() !== 'wasm' && tf.getBackend() !== 'webgl') { await tf.setBackend('cpu'); }
  await tf.ready();
  const be = $('backend'); if (be) be.textContent = `Backend: ${tf.getBackend()}`;
}

/* -------- Model -------- */
let model = null;

async function loadModel() {
  try {
    model = await tf.loadGraphModel(MODEL_PATH);
    const ms = $('modelStatus'); if (ms) ms.textContent = 'Model: Loaded ✅';

    window.__MODEL_READY__ = true;
    window.dispatchEvent(new Event('model-ready'));

    $('btnStartGame')?.removeAttribute('disabled');
    $('btnSubmit')?.removeAttribute('disabled');

    const prob = $('problemText');
    if (prob && prob.textContent.includes('Model loading')) prob.textContent = 'Click "Start"';
  } catch (e) {
    console.error('[app] model load error:', e);
    const ms = $('modelStatus');
    if (ms) ms.innerHTML = `❌ Failed to load model<br><code>${MODEL_PATH}</code><br>${e.message || e}`;
  }
}

/* -------- Inference -------- */
async function runGraphModel(x) {
  const inNames  = ['keras_tensor','serving_default_input_1','serving_default_input','x','input_0','args_0'];
  const outNames = ['output_0','Identity','StatefulPartitionedCall:0','Identity_0','Identity_1','dense/Sigmoid'];
  for (const iName of inNames) {
    for (const oName of outNames) {
      try {
        const y = await model.executeAsync({ [iName]: x }, oName);
        return Array.isArray(y) ? y[0] : y;
      } catch {}
    }
  }
  const y = model.predict(x);
  return Array.isArray(y) ? y[0] : y;
}

async function getDigitPrediction() {
  if (!model) return null;

  const rgba = getRGBAFromPad();
  const { img28, debug } = preprocessToMNIST(rgba, { srcW: 280, srcH: 280, blur: false, center: true });

  // (optional preview & debug)
  const preview = document.getElementById('preview28');
  if (preview) {
    const pctx = preview.getContext('2d');
    const prev = pctx.createImageData(28,28);
    for (let i=0;i<28*28;i++){
      const v = Math.round(img28[i]*255);
      prev.data[i*4+0]=v; prev.data[i*4+1]=v; prev.data[i*4+2]=v; prev.data[i*4+3]=255;
    }
    const tmp = document.createElement('canvas'); tmp.width=28; tmp.height=28;
    tmp.getContext('2d').putImageData(prev,0,0);
    pctx.imageSmoothingEnabled = false;
    pctx.clearRect(0,0,preview.width,preview.height);
    pctx.drawImage(tmp,0,0,preview.width,preview.height);
  }
  const dbg = document.getElementById('debug'); if (dbg) dbg.textContent = debug;

  const x  = tensorFrom28x28(img28);
  const t0 = performance.now();
  const y  = await runGraphModel(x);
  const t1 = performance.now();
  const lt = $('latency'); if (lt) lt.textContent = `Latency: ${(t1-t0).toFixed(1)} ms`;

  const raw   = Array.from(await y.data());
  const probs = (raw.every(v => v >= 0) && Math.abs(raw.reduce((a,b)=>a+b,0) - 1) < 1e-3)
    ? raw : softmax(raw);

  const top = argTopK(probs, 10);

  const barsEl = document.getElementById('bars'); if (barsEl) renderBars(barsEl, probs, top[0].i);
  const pd = document.getElementById('predDigit'); if (pd) pd.textContent = String(top[0].i);
  const tk = document.getElementById('topk'); if (tk) tk.innerHTML = top.slice(0,3).map(t => `<li>#${t.i} : ${(t.p*100).toFixed(2)}%</li>`).join('');

  tf.dispose([x,y]);
  return { digit: top[0].i, conf: top[0].p, probs };
}
window.getDigitPrediction = getDigitPrediction;

/* -------- UI Binding -------- */
function bindUI() {
  const pad          = $('pad');
  const brushSize    = $('brushSize');
  const eraserToggle = $('eraserToggle');
  const clearBtn     = $('clearBtn');      // hidden legacy
  const undoBtn      = $('undoBtn');
  const uploadInput  = $('uploadInput');
  const gameClearBtn = $('btnGameClear');  // visible button

  if (pad) initPad(pad, { brushSizeInput: brushSize, eraserToggle });

  // both entries clear the canvas
  clearBtn?.addEventListener('click', window.clearCanvas);
  gameClearBtn?.addEventListener('click', window.clearCanvas);

  undoBtn?.addEventListener('click', () => undoStroke());

  uploadInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file || !pad) return;
    const img = new Image();
    img.onload = () => {
      const ctx = pad.getContext('2d');
      window.clearCanvas();
      const temp = document.createElement('canvas');
      temp.width = img.width; temp.height = img.height;
      temp.getContext('2d').drawImage(img, 0, 0);
      ctx.drawImage(temp, 0, 0, pad.width, pad.height);
    };
    img.src = URL.createObjectURL(file);
    e.target.value = '';
  });
}

/* -------- Entry -------- */
document.addEventListener('DOMContentLoaded', async () => {
  await setupBackend();
  await loadModel();
  bindUI();
});