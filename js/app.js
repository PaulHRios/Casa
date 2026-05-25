/* ══════════════════════════════════════
   App shell: tabs + mobile viewport handling
══════════════════════════════════════ */

(function () {
  const root = document.documentElement;

  function setViewportVars() {
    const vv = window.visualViewport;
    const height = vv ? vv.height : window.innerHeight;
    const width = vv ? vv.width : window.innerWidth;

    root.style.setProperty('--app-height', `${Math.round(height)}px`);
    root.style.setProperty('--app-width', `${Math.round(width)}px`);
  }

  function refreshLayout() {
    setViewportVars();
    window.dispatchEvent(new Event('resize'));
  }

  function activateSection(targetId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.target === targetId);
    });

    document.querySelectorAll('.section').forEach(section => {
      section.classList.toggle('active', section.id === targetId);
    });

    requestAnimationFrame(refreshLayout);
    setTimeout(refreshLayout, 120);
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => activateSection(btn.dataset.target));
  });

  setViewportVars();

  window.addEventListener('resize', setViewportVars, { passive: true });
  window.addEventListener('orientationchange', () => {
    setTimeout(refreshLayout, 80);
    setTimeout(refreshLayout, 300);
  }, { passive: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', setViewportVars, { passive: true });
    window.visualViewport.addEventListener('scroll', setViewportVars, { passive: true });
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) requestAnimationFrame(refreshLayout);
  });
})();
