/* game.js — steps-aligned track & ticks */

const el = (id) => document.getElementById(id);

/* ===== Config ===== */
const TOTAL_QUESTIONS   = 10;  // 一轮题目数
const USE_TIMER         = true;
const TIME_LIMIT_MS     = 8000;
const START_GAP_STEPS   = 3;   // 开场 Hero 比 Monster 领先 3 格
const STEP_HERO         = 1;   // 答对后 hero 前进步数
const STEP_MONSTER      = 1;   // 答错/超时怪物前进一步

/* ===== State ===== */
let qIndex = 0;
let correct = 0;
let currentAnswer = null;
let gameOver = false;

let heroSteps = START_GAP_STEPS;   // 以“步数”为单位
let monsterSteps = 0;

let timerId = null;
let timerStart = 0;

/* ===== DOM ===== */
const btnStart   = el('btnStartGame') || document.querySelector('#btnStartGame');
const btnSubmit  = el('btnSubmit');
const btnClear   = el('btnGameClear');
const problemEl  = el('problemText');
const slotsEl    = el('answerSlots');
const scoreEl    = el('gameScore');
const timerBar   = el('timerBar');
const heroEl     = el('hero');
const monsterEl  = el('monster');
const trackEl    = document.querySelector('.track');

/* ===== Helpers for equation row ===== */
// ✅ 显示/隐藏 “= 与答案槽” 整行（用 visibility，不改变布局）
function setAnswerRowVisible(visible) {
  // 优先寻找带 .eq 的等号；若没有则取第二个 span
  const eqEl =
    document.querySelector('.equation .expr .eq') ||
    document.querySelector('.equation .expr > span:nth-child(2)');
  [eqEl, slotsEl].forEach((n) => {
    if (!n) return;
    n.style.visibility = visible ? 'visible' : 'hidden';
  });
}

/* ===== Derived ===== */
function totalTicks() { return TOTAL_QUESTIONS + START_GAP_STEPS; }

/* 轨道可用宽度（扣掉左右内边距） */
function usableTrackWidth() {
  if (!trackEl) return 0;
  const pad = parseFloat(getComputedStyle(trackEl).getPropertyValue('--track-pad')) || 36;
  return Math.max(0, trackEl.clientWidth - pad * 2);
}

/* 步长像素 */
function stepPx() {
  const ticks = totalTicks();
  return ticks > 0 ? usableTrackWidth() / ticks : 0;
}

/* ===== 轨道刻度（与逻辑严格一致） ===== */
function buildTicks() {
  if (!trackEl) return;
  // 清除旧的
  trackEl.querySelectorAll('.ticks,.rail').forEach(n => n.remove());

  // rail
  const rail = document.createElement('div');
  rail.className = 'rail';
  trackEl.appendChild(rail);

  // ticks
  const ticksBox = document.createElement('div');
  ticksBox.className = 'ticks';
  const count = totalTicks();
  for (let i = 0; i <= count; i++) {
    const t = document.createElement('div');
    t.className = 'tick';
    ticksBox.appendChild(t);
  }
  trackEl.appendChild(ticksBox);
}

/* 将“步数” -> px 并应用到 transform */
function applyActorPositions() {
  const base = parseFloat(getComputedStyle(trackEl).getPropertyValue('--track-pad')) || 36;
  const pxPerStep = stepPx();
  if (monsterEl) monsterEl.style.transform = `translateX(${base + monsterSteps * pxPerStep}px)`;
  if (heroEl)    heroEl.style.transform    = `translateX(${base + heroSteps    * pxPerStep}px)`;
}

/* ===== 题目生成（结果保证 0..9） ===== */
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function genProblem() {
  const ops = ['+','-','×','÷'];
  const op = ops[randInt(0, ops.length-1)];

  let a, b, ans;
  if (op === '+') {
    a = randInt(0,9); b = randInt(0,9);
    ans = a + b; if (ans > 9) return genProblem();
  } else if (op === '-') {
    a = randInt(0,9); b = randInt(0,9);
    ans = a - b; if (ans < 0) return genProblem();
  } else if (op === '×') {
    a = randInt(0,9); b = randInt(0,9);
    ans = a * b; if (ans > 9) return genProblem();
  } else { // ÷
    b = randInt(1,9);
    ans = randInt(0,9);
    a = ans * b;
  }
  return { a, b, op, ans };
}

function renderProblemText(p) {
  if (problemEl) problemEl.textContent = `${p.a} ${p.op} ${p.b}`;
}

function setSlotState(state) {
  const slot = slotsEl?.querySelector('.slot');
  if (!slot) return;
  slot.classList.remove('done','wrong','hint');
  if (state === 'done')  slot.classList.add('done');
  if (state === 'wrong') slot.classList.add('wrong');
}
function resetSlot() {
  const slot = slotsEl?.querySelector('.slot');
  if (!slot) return;
  slot.textContent = '_';
  slot.classList.remove('done','wrong','hint');
}

/* ===== Timer ===== */
function startTimer() {
  if (!USE_TIMER || !timerBar) return;
  stopTimer();
  // 起始为满格
  timerBar.style.transform = 'scaleX(1)';
  timerStart = performance.now();
  timerId = requestAnimationFrame(tick);
}
function stopTimer() {
  if (timerId) cancelAnimationFrame(timerId);
  timerId = null;
  if (timerBar) timerBar.style.transform = `scaleX(0)`;
}
function tick() {
  const elapsed = performance.now() - timerStart;
  const ratio = Math.max(0, Math.min(1, 1 - elapsed / TIME_LIMIT_MS));
  if (timerBar) timerBar.style.transform = `scaleX(${ratio})`;
  if (elapsed >= TIME_LIMIT_MS) {
    onJudge(false, true);
    return;
  }
  timerId = requestAnimationFrame(tick);
}

/* ===== 流程 ===== */
function nextQuestion() {
  if (qIndex >= TOTAL_QUESTIONS || gameOver) return;

  const p = genProblem();
  currentAnswer = p.ans;
  renderProblemText(p);
  resetSlot();

  // ✅ 出题时确保“= 与答案槽”可见
  setAnswerRowVisible(true);

  window.clearCanvas && window.clearCanvas();

  if (scoreEl) scoreEl.textContent = `${qIndex}/${TOTAL_QUESTIONS}`;
  if (USE_TIMER) startTimer();
}

async function judgeOnce() {
  if (qIndex >= TOTAL_QUESTIONS || gameOver) return;
  const pred = await window.getDigitPrediction?.();
  if (!pred) return;

  const slot = slotsEl?.querySelector('.slot');
  if (slot) slot.textContent = String(pred.digit);

  const isCorrect = pred.digit === currentAnswer;
  onJudge(isCorrect, false);
}

function onJudge(isCorrect /*, timeout */) {
  stopTimer();

  if (isCorrect) {
    setSlotState('done');
    correct++;
    heroSteps += STEP_HERO;
  } else {
    setSlotState('wrong');
    monsterSteps += STEP_MONSTER;
  }

  // 应用位移（与步数一致）
  applyActorPositions();

  // 是否被追上
  if (monsterSteps >= heroSteps) {
    gameOver = true;
    if (problemEl) problemEl.textContent = `Caught! Correct ${correct}/${TOTAL_QUESTIONS} — press "Start" to try again`;
    qIndex = TOTAL_QUESTIONS;
    if (scoreEl) scoreEl.textContent = `${qIndex}/${TOTAL_QUESTIONS}`;
    resetSlot();                 // 先把槽重置
    setAnswerRowVisible(false);  // ✅ 再隐藏“= 与答案槽”
    return;
  }

  qIndex++;
  if (scoreEl) scoreEl.textContent = `${qIndex}/${TOTAL_QUESTIONS}`;

  if (qIndex >= TOTAL_QUESTIONS) {
    const msg = (correct === TOTAL_QUESTIONS)
      ? 'Stage clear! 10/10 — press "Start" to replay'
      : `Finished! Correct ${correct}/${TOTAL_QUESTIONS} — press "Start" to replay`;
    if (problemEl) problemEl.textContent = msg;
    resetSlot();                 // 先把槽重置
    setAnswerRowVisible(false);  // ✅ 再隐藏“= 与答案槽”
    return;
  }

  nextQuestion();
}

/* ===== Start / Reset ===== */
function resetGame() {
  qIndex   = 0;
  correct  = 0;
  currentAnswer = null;
  gameOver = false;

  heroSteps = START_GAP_STEPS;
  monsterSteps = 0;

  stopTimer();
  resetSlot();
  window.clearCanvas && window.clearCanvas();

  // 先确保 ticks 存在，再放置角色
  buildTicks();
  applyActorPositions();

  // ✅ 重置时默认显示“= 与答案槽”，防止上局隐藏后不再出现
  setAnswerRowVisible(true);

  if (scoreEl) scoreEl.textContent = `0/${TOTAL_QUESTIONS}`;
}
function startGame() {
  resetGame();
  nextQuestion();
}

/* ===== Events ===== */
btnStart?.addEventListener('click', startGame);
btnSubmit?.addEventListener('click', judgeOnce);
btnClear?.addEventListener('click', () => {
  window.clearCanvas && window.clearCanvas();
});

/* 窗口缩放：重建刻度并根据最新宽度换算像素 */
window.addEventListener('resize', () => {
  buildTicks();
  applyActorPositions();
});

/* 模型就绪解锁按钮 */
window.addEventListener('model-ready', () => {
  btnStart && (btnStart.disabled = false);
  btnSubmit && (btnSubmit.disabled = false);
  if (problemEl && /Model loading|点击|Click/.test(problemEl.textContent)) {
    problemEl.textContent = 'Click "Start"';
  }
});

/* 首次进入也建好 ticks + 位置 */
document.addEventListener('DOMContentLoaded', () => {
  buildTicks();
  applyActorPositions();
  // ✅ 初始也确保可见（防止从缓存恢复时被隐藏）
  setAnswerRowVisible(true);
});