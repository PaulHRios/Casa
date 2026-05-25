/* ══════════════════════════════════════
   PLANOS VIEWER — PDF.js + image support
   • Pinch-to-zoom, userHasZoomed state
   • Zoom indicator, rotate, download, fullscreen
   • Mobile sidebar toggle
   • localStorage persistence
══════════════════════════════════════ */

(function () {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';

  /* ── localStorage helper ── */
  const store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : def; } catch { return def; } },
    set(k, v)   { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  const list        = document.getElementById('planos-list');
  const pdfCanvas   = document.getElementById('pdf-canvas');
  const imgViewer   = document.getElementById('img-viewer');
  const noMsg       = document.getElementById('no-plano-msg');
  const planoName   = document.getElementById('plano-name');
  const pageInfo    = document.getElementById('page-info');
  const scrollWrap  = document.getElementById('plano-scroll');
  const zoomIndicator = document.getElementById('zoom-indicator');

  let scale       = 1.5;
  let userHasZoomed = false;
  let pdfDoc      = null;
  let currentPage = 1;
  let planos      = [];
  let activeIdx   = -1;
  let rotation    = 0;
  let renderTask  = null;
  let currentObjectURL = null;

  function prettify(filename) {
    return filename
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  function updateZoomIndicator() {
    if (zoomIndicator) zoomIndicator.textContent = Math.round(scale * 100) + '%';
  }

  function updatePageButtons() {
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    if (!pdfDoc) {
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      return;
    }
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= pdfDoc.numPages;
  }

  /* ── Render PDF page ── */
  async function renderPage(num, opts = {}) {
    if (!pdfDoc) return;
    currentPage = num;

    if (renderTask) {
      try { renderTask.cancel(); } catch (_) {}
      renderTask = null;
    }

    const page = await pdfDoc.getPage(num);

    if (opts.fit === true) {
      const vpBase = page.getViewport({ scale: 1 });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const wrap = scrollWrap.clientWidth - 48;
      scale = Math.max(0.3, wrap / vpBase.width);
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = page.getViewport({ scale: scale * dpr });
    const ctx = pdfCanvas.getContext('2d');
    pdfCanvas.width  = viewport.width;
    pdfCanvas.height = viewport.height;
    pdfCanvas.style.width  = (viewport.width  / dpr) + 'px';
    pdfCanvas.style.height = (viewport.height / dpr) + 'px';

    pageInfo.textContent = `p. ${num} / ${pdfDoc.numPages}`;
    updatePageButtons();
    updateZoomIndicator();

    // Save zoom per plano
    if (activeIdx >= 0) {
      store.set('plano_zoom_' + (planos[activeIdx] && planos[activeIdx].name), scale);
    }

    renderTask = page.render({ canvasContext: ctx, viewport });
    try {
      await renderTask.promise;
    } catch (err) {
      if (err && err.name !== 'RenderingCancelledException') console.warn('[planos] render error:', err);
    }
    renderTask = null;
  }

  async function fitAndRender() {
    if (!pdfDoc) return;
    userHasZoomed = false;
    await renderPage(currentPage, { fit: true });
  }

  /* ── Load entry ── */
  async function loadEntry(idx) {
    if (idx === activeIdx) return;
    activeIdx = idx;
    const entry = planos[idx];
    planoName.textContent = entry.label || entry.name;

    pdfCanvas.style.display = 'none';
    imgViewer.style.display = 'none';
    noMsg.style.display     = 'none';
    rotation = 0;
    pdfCanvas.style.transform = '';

    list.querySelectorAll('li').forEach((li, i) => li.classList.toggle('active', i === idx));

    // Restore zoom for this plano
    const savedZoom = store.get('plano_zoom_' + entry.name, null);
    if (savedZoom !== null) {
      scale = savedZoom;
      userHasZoomed = true;
    } else {
      userHasZoomed = false;
    }

    if (entry.type === 'pdf') {
      pdfCanvas.style.display = 'block';
      const safeData = entry.data instanceof Uint8Array
        ? entry.data.slice()
        : new Uint8Array(entry.data.slice(0));
      pdfDoc = await pdfjsLib.getDocument({ data: safeData }).promise;
      currentPage = 1;
      await renderPage(1, { fit: !userHasZoomed });
    } else {
      imgViewer.src = entry.data;
      imgViewer.style.display = 'block';
      imgViewer.style.width = '100%';
      updatePageButtons();
    }
  }

  /* ── Add item to list ── */
  function addToList(entry, idx) {
    const li = document.createElement('li');
    li.textContent = entry.label || entry.name;
    li.addEventListener('click', () => loadEntry(idx));
    list.appendChild(li);
  }

  /* ── Upload ── */
  document.getElementById('plano-upload').addEventListener('change', e => {
    Array.from(e.target.files).forEach(file => {
      const name = file.name;
      const isImg = /\.(png|jpe?g|webp|svg)$/i.test(name);
      const isPDF = /\.pdf$/i.test(name);
      const isDXF = /\.dxf$/i.test(name);

      if (isPDF) {
        const reader = new FileReader();
        reader.onload = ev => {
          const idx = planos.length;
          planos.push({ name, label: prettify(name), type: 'pdf', data: ev.target.result });
          addToList(planos[idx], idx);
          if (idx === 0) loadEntry(0);
        };
        reader.readAsArrayBuffer(file);
      } else if (isImg) {
        const reader = new FileReader();
        reader.onload = ev => {
          const idx = planos.length;
          planos.push({ name, label: prettify(name), type: 'img', data: ev.target.result });
          addToList(planos[idx], idx);
          if (planos.length === 1) loadEntry(0);
        };
        reader.readAsDataURL(file);
      } else if (isDXF) {
        alert(`Archivo DXF detectado: "${name}"\n\nPara visualizar archivos .dxf como plano interactivo, exporta desde tu programa CAD a PDF y cárgalo aquí. El visualizador soporta PDF, PNG y JPG.`);
      }
    });
    e.target.value = '';
  });

  /* ── Zoom buttons ── */
  document.getElementById('zoom-in').addEventListener('click', () => {
    userHasZoomed = true;
    scale = Math.min(scale * 1.25, 8);
    if (pdfDoc) renderPage(currentPage);
    updateZoomIndicator();
  });
  document.getElementById('zoom-out').addEventListener('click', () => {
    userHasZoomed = true;
    scale = Math.max(scale / 1.25, 0.3);
    if (pdfDoc) renderPage(currentPage);
    updateZoomIndicator();
  });
  document.getElementById('zoom-fit').addEventListener('click', () => {
    userHasZoomed = false;
    if (pdfDoc) {
      fitAndRender();
    } else if (imgViewer.style.display !== 'none') {
      imgViewer.style.width = '100%';
    }
  });

  /* ── Zoom reset button ── */
  const zoomReset = document.getElementById('zoom-reset');
  if (zoomReset) {
    zoomReset.addEventListener('click', () => {
      userHasZoomed = false;
      if (pdfDoc) fitAndRender();
    });
  }

  /* ── Rotate button ── */
  const btnRotate = document.getElementById('btn-rotate-plano');
  if (btnRotate) {
    btnRotate.addEventListener('click', () => {
      rotation = (rotation + 90) % 360;
      pdfCanvas.style.transform = `rotate(${rotation}deg)`;
      if (imgViewer.style.display !== 'none') {
        imgViewer.style.transform = `rotate(${rotation}deg)`;
      }
    });
  }

  /* ── Download button ── */
  const btnDownload = document.getElementById('btn-download-plano');
  if (btnDownload) {
    btnDownload.addEventListener('click', () => {
      if (activeIdx < 0) return;
      const entry = planos[activeIdx];
      if (!entry) return;

      if (entry.type === 'pdf') {
        const blob = new Blob([entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data)],
          { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = entry.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } else if (entry.type === 'img') {
        const a = document.createElement('a');
        a.href = entry.data;
        a.download = entry.name;
        a.click();
      }
    });
  }

  /* ── Fullscreen button (planos) ── */
  const btnFullscreenPlano = document.getElementById('btn-fullscreen-plano');
  if (btnFullscreenPlano) {
    btnFullscreenPlano.addEventListener('click', () => {
      const planoSection = document.getElementById('section-planos');
      if (!document.fullscreenElement) {
        (planoSection || document.documentElement).requestFullscreen().catch(e => console.warn(e));
        btnFullscreenPlano.textContent = '✕';
      } else {
        document.exitFullscreen();
        btnFullscreenPlano.textContent = '⛶';
      }
    });
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        btnFullscreenPlano.textContent = '⛶';
      }
    });
  }

  /* ── Mobile sidebar toggle ── */
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const planosSidebar = document.querySelector('.planos-sidebar');
  if (btnToggleSidebar && planosSidebar) {
    btnToggleSidebar.addEventListener('click', () => {
      planosSidebar.classList.toggle('open');
    });
  }

  /* ── Page navigation ── */
  document.getElementById('prev-page').addEventListener('click', () => {
    if (pdfDoc && currentPage > 1) renderPage(currentPage - 1);
  });
  document.getElementById('next-page').addEventListener('click', () => {
    if (pdfDoc && currentPage < pdfDoc.numPages) renderPage(currentPage + 1);
  });

  /* ── Keyboard navigation ── */
  document.addEventListener('keydown', e => {
    const sec = document.getElementById('section-planos');
    if (!sec.classList.contains('active')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      document.getElementById('next-page').click();
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      document.getElementById('prev-page').click();
    } else if (e.key === '+' || e.key === '=') {
      document.getElementById('zoom-in').click();
    } else if (e.key === '-') {
      document.getElementById('zoom-out').click();
    }
  });

  /* ── Pinch-to-zoom ── */
  let pinchStartDist = 0;
  let pinchStartScale = 1;

  scrollWrap.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist = Math.hypot(dx, dy);
      pinchStartScale = scale;
    }
  }, { passive: false });

  scrollWrap.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (pinchStartDist > 0) {
        const newScale = Math.max(0.3, Math.min(8, pinchStartScale * (dist / pinchStartDist)));
        scale = newScale;
        userHasZoomed = true;
        updateZoomIndicator();
        if (pdfDoc) renderPage(currentPage);
      }
    }
  }, { passive: false });

  scrollWrap.addEventListener('touchend', e => {
    if (e.touches.length < 2) {
      pinchStartDist = 0;
    }
  });

  /* ── Prevent Safari page zoom ── */
  document.addEventListener('gesturestart', e => e.preventDefault());

  /* ── Debounced resize ── */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!userHasZoomed && pdfDoc) fitAndRender();
    }, 150);
  });

  window.addEventListener('orientationchange', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!userHasZoomed && pdfDoc) fitAndRender();
    }, 300);
  });

  /* ── Load prebuilt assets ── */
  async function loadPrebuiltPlanos() {
    try {
      const resp = await fetch('assets/drawings/manifest.json');
      if (!resp.ok) return;
      const files = await resp.json();
      for (const f of files) {
        const r = await fetch('assets/drawings/' + f);
        if (!r.ok) continue;
        const isImg = /\.(png|jpe?g|webp)$/i.test(f);
        if (isImg) {
          const blob = await r.blob();
          const url  = URL.createObjectURL(blob);
          const idx  = planos.length;
          planos.push({ name: f, label: prettify(f), type: 'img', data: url });
          addToList(planos[idx], idx);
          if (idx === 0) loadEntry(0);
        } else {
          const buf  = await r.arrayBuffer();
          const idx  = planos.length;
          planos.push({ name: f, label: prettify(f), type: 'pdf', data: new Uint8Array(buf) });
          addToList(planos[idx], idx);
          if (idx === 0) loadEntry(0);
        }
      }
    } catch (_) {}
  }

  loadPrebuiltPlanos();

})();
