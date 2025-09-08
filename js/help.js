// js/help.js — onboarding modal (always shows on refresh)
(() => {
  const overlay   = document.getElementById('helpOverlay');
  const btnHelp   = document.getElementById('btnHelp');
  const btnGotIt  = document.getElementById('helpGotIt');

  if (!overlay || !btnHelp || !btnGotIt) return;

  let lastFocused = null;

  function openHelp() {
    lastFocused = document.activeElement;
    overlay.hidden = false;
    btnGotIt.focus();
    document.documentElement.style.overflow = 'hidden'; // 防止背景滚动
  }
  function closeHelp() {
    overlay.hidden = true;
    document.documentElement.style.overflow = '';
    lastFocused?.focus?.();
  }

  // ⭐ 每次刷新页面都自动弹出
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(openHelp, 150);
  });

  // Help 按钮
  btnHelp.addEventListener('click', openHelp);

  // “Got it” 关闭
  btnGotIt.addEventListener('click', closeHelp);

  // 点击遮罩关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeHelp();
  });

  // Esc 关闭
  document.addEventListener('keydown', (e) => {
    if (!overlay.hidden && e.key === 'Escape') closeHelp();
  });
})();