console.log('[app.js] script executing...');

import { initPad, getRGBAFromPad, undoStroke, clearPad } from './drawing.js';
import { preprocessToMNIST, tensorFrom28x28 } from './processing.js';
import { softmax, argTopK, renderBars } from './utils.js';

const MODEL_PATH = './mnist_tfjs_model/model.json';

const backendEl = document.getElementById('backend');
const modelStatusEl = document.getElementById('modelStatus');
const latencyEl = document.getElementById('latency');
const predDigitEl = document.getElementById('predDigit');
const barsEl = document.getElementById('bars');
const topkEl = document.getElementById('topk');
const preview28 = document.getElementById('preview28');
const debugEl = document.getElementById('debug');

const pad = document.getElementById('pad');
const blurToggle = document.getElementById('blurToggle');
const centerToggle = document.getElementById('centerToggle');
const brushSize = document.getElementById('brushSize');
const eraserToggle = document.getElementById('eraserToggle');
const clearBtn = document.getElementById('clearBtn');
const undoBtn = document.getElementById('undoBtn');
const inferBtn = document.getElementById('inferBtn');
const uploadInput = document.getElementById('uploadInput');

let model = null;

async function setupBackend() {
  try { await tf.setBackend('wasm'); }
  catch {}
  if (tf.getBackend() !== 'wasm') {
    try { await tf.setBackend('webgl'); }
    catch {}
  }
  if (tf.getBackend() !== 'wasm' && tf.getBackend() !== 'webgl') {
    await tf.setBackend('cpu');
  }

  await tf.ready();
  backendEl.textContent = `Backend: ${tf.getBackend()}`;
}


async function loadModel() {
  try {
    console.log('[loadModel] start loading', MODEL_PATH);
    model = await tf.loadGraphModel(MODEL_PATH);
    console.log('[loadModel] model loaded OK', model);
    modelStatusEl.textContent = 'Model: Loaded ✅';
  } catch (e) {
    console.error('[loadModel] ERROR:', e);
    modelStatusEl.innerHTML = `❌ Failed to load model<br>
      <code>${MODEL_PATH}</code><br>${e.message || e}`;
  }
}

// 智能 I/O 名称尝试，兼容不同导出签名
async function runGraphModel(model, x) {
  const inCandidates = ['keras_tensor','serving_default_input_1','serving_default_input','x','input_0','args_0'];
  const outCandidates = ['output_0','Identity','StatefulPartitionedCall:0','Identity_0','Identity_1','dense/Sigmoid'];
  for (const inName of inCandidates) {
    for (const outName of outCandidates) {
      try {
        const y = await model.executeAsync({ [inName]: x }, outName);
        return Array.isArray(y) ? y[0] : y;
      } catch(_) {}
    }
  }
  const y = model.predict(x);
  return Array.isArray(y) ? y[0] : y;
}

function drawPreview(img28) {
  const pctx = preview28.getContext('2d');
  const prev = pctx.createImageData(28, 28);
  for (let i=0;i<28*28;i++){
    const v = Math.round(img28[i]*255);
    prev.data[i*4+0]=v; prev.data[i*4+1]=v; prev.data[i*4+2]=v; prev.data[i*4+3]=255;
  }
  const tmp = document.createElement('canvas');
  tmp.width=28; tmp.height=28;
  const tctx = tmp.getContext('2d');
  tctx.putImageData(prev,0,0);
  pctx.imageSmoothingEnabled = false;
  pctx.clearRect(0,0,112,112);
  pctx.drawImage(tmp,0,0,112,112);
}

async function inferOnce() {
  if (!model) return;
  const rgba = getRGBAFromPad();
  const { img28, debug } = preprocessToMNIST(rgba, { srcW: 280, srcH: 280, blur: !!blurToggle?.checked, center: !!centerToggle?.checked });
  drawPreview(img28);
  debugEl.textContent = debug;

  const x = tensorFrom28x28(img28);
  const t0 = performance.now();
  const y = await runGraphModel(model, x);
  const t1 = performance.now();
  latencyEl.textContent = `Latency: ${(t1-t0).toFixed(1)} ms`;

  const raw = Array.from(await y.data());
  const probs = (raw.every(v => v >= 0) && Math.abs(raw.reduce((a,b)=>a+b,0) - 1) < 1e-3)
    ? raw : softmax(raw);

  const top = argTopK(probs, 10);
  renderBars(barsEl, probs, top[0].i);
  predDigitEl.textContent = String(top[0].i);
  topkEl.innerHTML = top.slice(0,3).map(t => `<li>#${t.i} : ${(t.p*100).toFixed(2)}%</li>`).join('');

  tf.dispose([x,y]);
}

function bindUI() {
  initPad(pad, { brushSizeInput: brushSize, eraserToggle });
  clearBtn.onclick = () => { clearPad(); predDigitEl.textContent='—'; barsEl.innerHTML=''; topkEl.innerHTML=''; };
  undoBtn.onclick = () => undoStroke();
  inferBtn.onclick = inferOnce;
  uploadInput.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const ctx = pad.getContext('2d');
      clearPad();
      const temp = document.createElement('canvas');
      temp.width = img.width; temp.height = img.height;
      temp.getContext('2d').drawImage(img, 0, 0);
      ctx.drawImage(temp, 0, 0, pad.width, pad.height);
    };
    img.src = URL.createObjectURL(file);
    e.target.value = '';
  };
}

(async function main(){
  await setupBackend();
  await loadModel();
  bindUI();
})();
