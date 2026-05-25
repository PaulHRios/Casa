/* ══════════════════════════════════════
   PLANOS VIEWER — PDF.js + image support
══════════════════════════════════════ */

(function () {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';

  const list        = document.getElementById('planos-list');
  const pdfCanvas   = document.getElementById('pdf-canvas');
  const imgViewer   = document.getElementById('img-viewer');
  const noMsg       = document.getElementById('no-plano-msg');
  const planoName   = document.getElementById('plano-name');
  const pageInfo    = document.getElementById('page-info');
  const scrollWrap  = document.getElementById('plano-scroll');

  let scale       = 1.5;
  let pdfDoc      = null;
  let currentPage = 1;
  let planos      = [];   // { name, type:'pdf'|'img', data:url|arrayBuffer }
  let activeIdx   = -1;
  let renderTask  = null;
  let resizeTimer = null;

  function prettify(filename) {
    return filename
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  function getCanvasFitWidth() {
    const style = getComputedStyle(scrollWrap);
    const padX =
      parseFloat(style.paddingLeft || 0) +
      parseFloat(style.paddingRight || 0);

    return Math.max(240, scrollWrap.clientWidth - padX - 6);
  }

  function fitPdfToWidth(page) {
    const vp = page.getViewport({ scale: 1 });
    const availableWidth = getCanvasFitWidth();
    const nextScale = availableWidth / vp.width;

    scale = Math.max(0.35, Math.min(nextScale, 3.5));
  }

  function isCompactLayout() {
    return window.matchMedia('(max-width: 820px)').matches;
  }

  /* ── Render PDF page ── */
  async function renderPage(num, options = {}) {
    if (!pdfDoc) return;

    currentPage = num;
    const page = await pdfDoc.getPage(num);

    if (options.fit || isCompactLayout()) {
      fitPdfToWidth(page);
    }

    const viewport = page.getViewport({ scale });
    const ctx = pdfCanvas.getContext('2d');

    if (renderTask) {
      try { renderTask.cancel(); } catch (_) {}
      renderTask = null;
    }

    pdfCanvas.width  = Math.floor(viewport.width);
    pdfCanvas.height = Math.floor(viewport.height);
    pageInfo.textContent = `p. ${num} / ${pdfDoc.numPages}`;

    renderTask = page.render({ canvasContext: ctx, viewport });

    try {
      await renderTask.promise;
    } catch (err) {
      if (!err || err.name !== 'RenderingCancelledException') {
        console.error(err);
      }
    } finally {
      renderTask = null;
    }
  }

  function rerenderCurrentPageAfterResize() {
    if (!pdfDoc) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      renderPage(currentPage, { fit: isCompactLayout() });
    }, 140);
  }

  /* ── Load entry ── */
  async function loadEntry(idx) {
    if (idx === activeIdx) return;
    activeIdx = idx;
    const entry = planos[idx];
    planoName.textContent = entry.label || entry.name;

    // reset UI
    pdfCanvas.style.display = 'none';
    imgViewer.style.display = 'none';
    noMsg.style.display     = 'none';

    // highlight list
    list.querySelectorAll('li').forEach((li, i) => li.classList.toggle('active', i === idx));

    if (entry.type === 'pdf') {
      pdfCanvas.style.display = 'block';

      /* FIX: pdf.js puede transferir/vaciar el ArrayBuffer original.
         Siempre pasamos una COPIA para que el entry.data quede intacto
         y se pueda reabrir el mismo plano múltiples veces. */
      const safeData = entry.data instanceof Uint8Array
        ? entry.data.slice()
        : new Uint8Array(entry.data.slice(0));

      pdfDoc = await pdfjsLib.getDocument({ data: safeData }).promise;
      currentPage = 1;
      await renderPage(1, { fit: true });
    } else {
      pdfDoc = null;
      imgViewer.src = entry.data;
      imgViewer.style.display = 'block';
      imgViewer.style.width = isCompactLayout() ? '100%' : '';
    }
  }

  /* ── Add item to list ── */
  function addToList(entry, idx) {
    const li = document.createElement('li');
    li.textContent = entry.label || entry.name;
    li.title = entry.label || entry.name;
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
    scale = Math.min(scale * 1.25, 8);
    if (pdfDoc) renderPage(currentPage);
  });

  document.getElementById('zoom-out').addEventListener('click', () => {
    scale = Math.max(scale / 1.25, 0.3);
    if (pdfDoc) renderPage(currentPage);
  });

  document.getElementById('zoom-fit').addEventListener('click', () => {
    if (pdfDoc) {
      pdfDoc.getPage(currentPage).then(page => {
        fitPdfToWidth(page);
        renderPage(currentPage);
      });
    } else if (imgViewer.style.display !== 'none') {
      imgViewer.style.width = '100%';
    }
  });

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

  window.addEventListener('resize', rerenderCurrentPageAfterResize, { passive: true });
  window.addEventListener('orientationchange', () => {
    setTimeout(rerenderCurrentPageAfterResize, 180);
    setTimeout(rerenderCurrentPageAfterResize, 450);
  }, { passive: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', rerenderCurrentPageAfterResize, { passive: true });
  }

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
