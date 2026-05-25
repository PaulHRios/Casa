/* ══════════════════════════════════════
   PLANOS VIEWER — PDF.js + image support
══════════════════════════════════════ */

(function () {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

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

  /* ── Render PDF page ── */
  async function renderPage(num) {
    if (!pdfDoc) return;
    currentPage = num;
    const page    = await pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale });
    const ctx     = pdfCanvas.getContext('2d');
    pdfCanvas.width  = viewport.width;
    pdfCanvas.height = viewport.height;
    pageInfo.textContent = `p. ${num} / ${pdfDoc.numPages}`;
    await page.render({ canvasContext: ctx, viewport }).promise;
  }

  /* ── Load entry ── */
  async function loadEntry(idx) {
    if (idx === activeIdx) return;
    activeIdx = idx;
    const entry = planos[idx];
    planoName.textContent = entry.name;

    // reset UI
    pdfCanvas.style.display = 'none';
    imgViewer.style.display = 'none';
    noMsg.style.display     = 'none';

    // highlight list
    list.querySelectorAll('li').forEach((li, i) => li.classList.toggle('active', i === idx));

    if (entry.type === 'pdf') {
      pdfCanvas.style.display = 'block';
      const buffer = entry.data;
      pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
      currentPage = 1;
      renderPage(1);
    } else {
      imgViewer.src = entry.data;
      imgViewer.style.display = 'block';
    }
  }

  /* ── Add item to list ── */
  function addToList(entry, idx) {
    const li = document.createElement('li');
    li.textContent = entry.name;
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
          planos.push({ name, type: 'pdf', data: ev.target.result });
          addToList(planos[idx], idx);
          if (idx === 0) loadEntry(0);
        };
        reader.readAsArrayBuffer(file);
      } else if (isImg) {
        const reader = new FileReader();
        reader.onload = ev => {
          const idx = planos.length;
          planos.push({ name, type: 'img', data: ev.target.result });
          addToList(planos[idx], idx);
          if (planos.length === 1) loadEntry(0);
        };
        reader.readAsDataURL(file);
      } else if (isDXF) {
        // DXF → show info message (conversion happens server-side or via tool)
        alert(`Archivo DXF detectado: "${name}"\n\nPara visualizar archivos .dxf como plano interactivo, exporta desde tu programa CAD a PDF y cárgalo aquí. El visualizador soporta PDF, PNG y JPG.`);
      }
    });
    // prebuilt planos from assets/drawings are loaded at init
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
      // fit to container width
      const wrap = scrollWrap.clientWidth - 48;
      pdfDoc.getPage(currentPage).then(page => {
        const vp = page.getViewport({ scale: 1 });
        scale = wrap / vp.width;
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

  /* ── Load prebuilt assets ── */
  async function loadPrebuiltPlanos() {
    // Files listed in assets/drawings/manifest.json
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
          planos.push({ name: f, type: 'img', data: url });
          addToList(planos[idx], idx);
          if (idx === 0) loadEntry(0);
        } else {
          const buf  = await r.arrayBuffer();
          const idx  = planos.length;
          planos.push({ name: f, type: 'pdf', data: buf });
          addToList(planos[idx], idx);
          if (idx === 0) loadEntry(0);
        }
      }
    } catch (_) {}
  }

  loadPrebuiltPlanos();

})();
