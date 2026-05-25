/* ── Tab navigation ── */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.target).classList.add('active');
    // Save active tab to localStorage
    try { localStorage.setItem('activeTab', btn.dataset.target); } catch {}
    // trigger resize for three.js
    window.dispatchEvent(new Event('resize'));
  });
});

/* ── Restore last active tab ── */
(function () {
  const lastTab = (() => { try { return localStorage.getItem('activeTab'); } catch { return null; } })();
  if (lastTab) {
    const btn = document.querySelector(`[data-target="${lastTab}"]`);
    if (btn) btn.click();
  }
})();
