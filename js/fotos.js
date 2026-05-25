/* ══════════════════════════════════════════════════════════
   GALERÍAS — Diseño (renders) + Avance de Obra
   Lightbox compartido, dos instancias independientes
══════════════════════════════════════════════════════════ */

(function () {

  /* ── Lightbox compartido ── */
  const lightbox  = document.getElementById('lightbox');
  const lbImg     = document.getElementById('lb-img');
  const lbCaption = document.getElementById('lb-caption');
  let lbPhotos = [];   // foto array de la galería activa
  let lbIndex  = 0;

  function openLb(photos, idx) {
    lbPhotos = photos; lbIndex = idx;
    lbImg.src = photos[idx].src;
    lbCaption.textContent = photos[idx].name;
    lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  function closeLb() {
    lightbox.classList.add('hidden');
    document.body.style.overflow = '';
  }
  function nextLb() { openLb(lbPhotos, (lbIndex + 1) % lbPhotos.length); }
  function prevLb() { openLb(lbPhotos, (lbIndex - 1 + lbPhotos.length) % lbPhotos.length); }

  document.getElementById('lb-close').addEventListener('click', closeLb);
  document.getElementById('lb-next').addEventListener('click', nextLb);
  document.getElementById('lb-prev').addEventListener('click', prevLb);
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLb(); });
  document.addEventListener('keydown', e => {
    if (lightbox.classList.contains('hidden')) return;
    if (e.key === 'Escape')     closeLb();
    if (e.key === 'ArrowRight') nextLb();
    if (e.key === 'ArrowLeft')  prevLb();
  });

  /* ── Etiquetas legibles ── */
  function prettify(filename) {
    return filename
      .replace(/\.[^.]+$/, '')
      .replace(/^render-/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  /* ══════════════════════════════════════
     Fábrica de galerías
  ══════════════════════════════════════ */
  function createGallery({ gridId, uploadId, countId, manifestUrl, emptyMsg }) {
    const grid     = document.getElementById(gridId);
    const countEl  = document.getElementById(countId);
    const photos   = [];

    function updateCount() {
      if (countEl) countEl.textContent =
        photos.length ? `${photos.length} foto${photos.length !== 1 ? 's' : ''}` : '';
    }

    function removePlaceholder() {
      const ph = grid.querySelector('.fotos-empty, .fotos-empty-obra');
      if (ph) ph.remove();
    }

    function addCard(src, name, idx) {
      removePlaceholder();
      const card = document.createElement('div');
      card.className = 'foto-card';
      card.innerHTML = `<img src="${src}" alt="${name}" loading="lazy" /><div class="foto-label">${name}</div>`;
      card.addEventListener('click', () => openLb(photos, idx));
      grid.appendChild(card);
      updateCount();
    }

    /* Subida manual desde el navegador */
    const uploadEl = document.getElementById(uploadId);
    if (uploadEl) {
      uploadEl.addEventListener('change', e => {
        Array.from(e.target.files).forEach(file => {
          const reader = new FileReader();
          reader.onload = ev => {
            const idx = photos.length;
            const label = prettify(file.name);
            photos.push({ src: ev.target.result, name: label });
            addCard(ev.target.result, label, idx);
          };
          reader.readAsDataURL(file);
        });
        e.target.value = '';
      });
    }

    /* Carga desde manifest del repositorio */
    async function loadFromManifest() {
      try {
        const resp = await fetch(manifestUrl + '?t=' + Date.now());
        if (!resp.ok) return;
        const files = await resp.json();
        const base  = manifestUrl.replace('manifest.json', '');
        for (const f of files) {
          const src = base + f;
          const idx = photos.length;
          const label = prettify(f);
          photos.push({ src, name: label });
          addCard(src, label, idx);
        }
        // Ocultar instrucciones (placeholder) si hay fotos — sólo dentro de ESTE grid
        if (photos.length > 0) {
          const inst = grid.querySelector('#obra-instrucciones');
          if (inst) inst.remove();
        }
      } catch (_) {}
    }

    loadFromManifest();
    return photos;
  }

  /* ── Galería DISEÑO ── */
  createGallery({
    gridId:      'diseno-grid',
    uploadId:    'diseno-upload',
    countId:     'diseno-count',
    manifestUrl: 'assets/photos/diseno/manifest.json',
    emptyMsg:    'No hay renders de diseño cargados.',
  });

  /* ── Galería OBRA ── */
  createGallery({
    gridId:      'obra-grid',
    uploadId:    'obra-upload',
    countId:     'obra-count',
    manifestUrl: 'assets/photos/obra/manifest.json',
    emptyMsg:    '',   // usa el bloque HTML obra-instrucciones
  });

})();
