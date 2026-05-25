/* ══════════════════════════════════════════════════════════
   GALERÍAS — Diseño · Fotorrealistas · Avance de Obra
   Masonry, categorías, línea de tiempo por fecha, lightbox+filmstrip
══════════════════════════════════════════════════════════ */

(function () {

  /* ══════════════════════════════════════════════════════════
     LIGHTBOX MEJORADO  (filmstrip + contador)
  ══════════════════════════════════════════════════════════ */
  const lightbox    = document.getElementById('lightbox');
  const lbImg       = document.getElementById('lb-img');
  const lbCaption   = document.getElementById('lb-caption');
  const lbCounter   = document.getElementById('lb-counter');
  const lbFilmstrip = document.getElementById('lb-filmstrip');

  let lbPhotos = [];
  let lbIndex  = 0;
  let filmBuilt = false;   // rebuild filmstrip only when gallery changes

  function openLb(photos, idx) {
    if (lbPhotos !== photos) { lbPhotos = photos; filmBuilt = false; }
    lbIndex = idx;
    renderSlide();
    lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function renderSlide() {
    const p = lbPhotos[lbIndex];
    lbImg.src       = p.src;
    lbCaption.textContent = p.name;
    if (lbCounter) lbCounter.textContent = `${lbIndex + 1} / ${lbPhotos.length}`;
    buildFilmstrip();
    scrollThumb();
  }

  function buildFilmstrip() {
    if (filmBuilt || !lbFilmstrip) return;
    filmBuilt = true;
    lbFilmstrip.innerHTML = '';
    lbPhotos.forEach((p, i) => {
      const t = document.createElement('div');
      t.className = 'lb-thumb';
      t.innerHTML = `<img src="${p.src}" alt="" loading="lazy" />`;
      t.addEventListener('click', () => { lbIndex = i; renderSlide(); });
      lbFilmstrip.appendChild(t);
    });
  }

  function scrollThumb() {
    if (!lbFilmstrip) return;
    lbFilmstrip.querySelectorAll('.lb-thumb').forEach((t, i) =>
      t.classList.toggle('active', i === lbIndex));
    const active = lbFilmstrip.children[lbIndex];
    if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  function closeLb() {
    lightbox.classList.add('hidden');
    document.body.style.overflow = '';
  }
  function nextLb() { lbIndex = (lbIndex + 1) % lbPhotos.length; renderSlide(); }
  function prevLb() { lbIndex = (lbIndex - 1 + lbPhotos.length) % lbPhotos.length; renderSlide(); }

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

  /* ══════════════════════════════════════════════════════════
     CATEGORÍAS  (para galería Diseño)
  ══════════════════════════════════════════════════════════ */
  const CAT_RULES = [
    [/jardin|jacuzzi/i,             'Jardín'],
    [/garaje/i,                     'Garaje'],
    [/cocina/i,                     'Cocina'],
    [/sala|comedor/i,               'Sala / Comedor'],
    [/ba[nñ]o|marmol/i,            'Baños'],
    [/cine/i,                       'Entretenimiento'],
    [/closet/i,                     'Closet'],
    [/entrada|acceso|puerta/i,      'Acceso'],
    [/exterior|fachada|planta|isometrico|general|cuarto/i, 'Exteriores'],
  ];

  /* Orden preferido de categorías en la UI */
  const CAT_ORDER = [
    'Exteriores', 'Jardín', 'Garaje', 'Acceso',
    'Cocina', 'Sala / Comedor', 'Baños', 'Closet', 'Entretenimiento', 'General',
  ];

  function getCategory(filename) {
    const s = filename.toLowerCase();
    for (const [re, label] of CAT_RULES) if (re.test(s)) return label;
    return 'General';
  }

  /* ══════════════════════════════════════════════════════════
     FECHA (para línea de tiempo en Obra)
  ══════════════════════════════════════════════════════════ */
  function parseMonthKey(filename) {
    const m = filename.match(/^(\d{4})[-_](\d{2})[-_](\d{2})/);
    return m ? `${m[1]}-${m[2]}` : null;
  }

  function formatMonth(key) {
    const [y, m] = key.split('-');
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return `${MESES[parseInt(m) - 1]} ${y}`;
  }

  /* ══════════════════════════════════════════════════════════
     PRETTIFY
  ══════════════════════════════════════════════════════════ */
  function prettify(filename) {
    const name = filename
      .replace(/\.[^.]+$/, '')
      .replace(/^\d{4}[-_]\d{2}[-_]\d{2}[-_]?/, '')   // quita prefijo de fecha
      .replace(/^(render|foto|fotorrealista|fotorealista)[-_]?/i, '')
      .replace(/[-_]+/g, ' ')
      .trim();
    return name.replace(/\b\w/g, c => c.toUpperCase()) || filename;
  }

  /* ══════════════════════════════════════════════════════════
     FÁBRICA DE GALERÍAS
  ══════════════════════════════════════════════════════════ */
  function createGallery({ bodyId, uploadId, countId, manifestUrl,
                            filtersId, categorize, groupByDate }) {
    const body    = document.getElementById(bodyId);
    const countEl = document.getElementById(countId);
    if (!body) return;

    const photos  = [];                // array global para el lightbox
    const groupMap = new Map();        // key → { wrapper, masonry }
    let flatMasonry = null;            // cuando no hay agrupación

    /* ── Contador ── */
    function updateCount() {
      if (!countEl) return;
      countEl.textContent = photos.length
        ? `${photos.length} foto${photos.length !== 1 ? 's' : ''}`
        : '';
    }

    /* ── Eliminar placeholder ── */
    function removePlaceholder() {
      const ph = body.querySelector('.gallery-empty-state');
      if (ph) ph.remove();
    }

    /* ── Obtener o crear grupo (categoría / mes) ── */
    function getOrCreateGroup(key, label) {
      if (groupMap.has(key)) return groupMap.get(key).masonry;
      const wrapper = document.createElement('div');
      wrapper.className = 'gallery-group';
      wrapper.dataset.group = key;
      if (label) {
        const lbl = document.createElement('div');
        lbl.className = 'gallery-group-label';
        lbl.textContent = label;
        wrapper.appendChild(lbl);
      }
      const masonry = document.createElement('div');
      masonry.className = 'fotos-masonry';
      wrapper.appendChild(masonry);
      body.appendChild(wrapper);
      groupMap.set(key, { wrapper, masonry });
      return masonry;
    }

    /* ── Tarjeta de foto ── */
    function makeCard(src, label, idx) {
      const card = document.createElement('div');
      card.className = 'foto-card';
      card.innerHTML = `<img src="${src}" alt="${label}" loading="lazy" /><div class="foto-label">${label}</div>`;
      card.addEventListener('click', () => openLb(photos, idx));
      return card;
    }

    /* ── Renderizar en masonry plano (sin grupos) ── */
    function renderFlat(allPhotos, startIdx) {
      removePlaceholder();
      if (!flatMasonry) {
        flatMasonry = document.createElement('div');
        flatMasonry.className = 'fotos-masonry';
        body.appendChild(flatMasonry);
      }
      allPhotos.forEach((p, i) =>
        flatMasonry.appendChild(makeCard(p.src, p.label, startIdx + i)));
      updateCount();
    }

    /* ── Renderizar agrupado por categoría ── */
    function renderCategorized(allPhotos, startIdx) {
      removePlaceholder();
      // Agrupar
      const catMap = new Map();
      allPhotos.forEach((p, i) => {
        const cat = getCategory(p.filename);
        if (!catMap.has(cat)) catMap.set(cat, []);
        catMap.get(cat).push({ ...p, gi: startIdx + i });
      });
      // Renderizar en orden preferido
      CAT_ORDER.forEach(cat => {
        if (!catMap.has(cat)) return;
        const masonry = getOrCreateGroup(cat, cat);
        catMap.get(cat).forEach(p => masonry.appendChild(makeCard(p.src, p.label, p.gi)));
        catMap.delete(cat);
      });
      // Categorías restantes
      catMap.forEach((items, cat) => {
        const masonry = getOrCreateGroup(cat, cat);
        items.forEach(p => masonry.appendChild(makeCard(p.src, p.label, p.gi)));
      });
      updateCount();
    }

    /* ── Renderizar agrupado por fecha (línea de tiempo) ── */
    function renderByDate(allPhotos, startIdx) {
      removePlaceholder();
      const dateMap = new Map();
      const undated = [];
      allPhotos.forEach((p, i) => {
        const key = parseMonthKey(p.filename);
        if (key) {
          if (!dateMap.has(key)) dateMap.set(key, []);
          dateMap.get(key).push({ ...p, gi: startIdx + i });
        } else {
          undated.push({ ...p, gi: startIdx + i });
        }
      });
      // Ordenar cronológicamente (más antiguo primero = progreso visible)
      [...dateMap.keys()].sort().forEach(key => {
        const masonry = getOrCreateGroup(key, formatMonth(key));
        dateMap.get(key).forEach(p => masonry.appendChild(makeCard(p.src, p.label, p.gi)));
      });
      if (undated.length > 0) {
        const masonry = getOrCreateGroup('sin-fecha', 'Sin fecha');
        undated.forEach(p => masonry.appendChild(makeCard(p.src, p.label, p.gi)));
      }
      updateCount();
    }

    /* ── Chips de filtro ── */
    function buildFilters(filtersEl, allPhotos) {
      const usedCats = new Set(allPhotos.map(p => getCategory(p.filename)));
      const ordered  = CAT_ORDER.filter(c => usedCats.has(c));

      filtersEl.innerHTML = '';

      function makeChip(label, isAll) {
        const btn = document.createElement('button');
        btn.className = 'filter-chip' + (isAll ? ' active' : '');
        btn.textContent = label;
        btn.addEventListener('click', () => {
          filtersEl.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          body.querySelectorAll('.gallery-group').forEach(g => {
            g.style.display = (isAll || g.dataset.group === label) ? '' : 'none';
          });
        });
        filtersEl.appendChild(btn);
      }

      makeChip('Todos', true);
      ordered.forEach(c => makeChip(c, false));
    }

    /* ── Subida manual ── */
    const uploadEl = document.getElementById(uploadId);
    if (uploadEl) {
      uploadEl.addEventListener('change', e => {
        Array.from(e.target.files).forEach(file => {
          const reader = new FileReader();
          reader.onload = ev => {
            const idx   = photos.length;
            const label = prettify(file.name);
            photos.push({ src: ev.target.result, name: label });
            const p = { src: ev.target.result, filename: file.name, label };
            const ms = flatMasonry || (flatMasonry = (() => {
              removePlaceholder();
              const el = document.createElement('div');
              el.className = 'fotos-masonry';
              body.appendChild(el);
              return el;
            })());
            ms.appendChild(makeCard(p.src, p.label, idx));
            updateCount();
          };
          reader.readAsDataURL(file);
        });
        e.target.value = '';
      });
    }

    /* ── Carga desde manifest ── */
    async function loadFromManifest() {
      try {
        const resp = await fetch(manifestUrl + '?t=' + Date.now());
        if (!resp.ok) return;
        const files = await resp.json();
        if (!files.length) return;

        const base = manifestUrl.replace('manifest.json', '');
        const startIdx = photos.length;

        const allPhotos = files.map(f => ({
          src:      base + f,
          filename: f,
          label:    prettify(f),
        }));
        // Agregar al array global en orden de manifest
        allPhotos.forEach(p => photos.push({ src: p.src, name: p.label }));

        if (categorize)    renderCategorized(allPhotos, startIdx);
        else if (groupByDate) renderByDate(allPhotos, startIdx);
        else               renderFlat(allPhotos, startIdx);

        if (filtersId && categorize) {
          const filtersEl = document.getElementById(filtersId);
          if (filtersEl) buildFilters(filtersEl, allPhotos);
        }
      } catch (_) {}
    }

    loadFromManifest();
    return photos;
  }

  /* ══════════════════════════════════════════════════════════
     INSTANCIAS
  ══════════════════════════════════════════════════════════ */

  /* Galería DISEÑO — agrupada por categoría con filtros */
  createGallery({
    bodyId:      'diseno-body',
    uploadId:    'diseno-upload',
    countId:     'diseno-count',
    manifestUrl: 'assets/photos/diseno/manifest.json',
    filtersId:   'diseno-filters',
    categorize:  true,
    groupByDate: false,
  });

  /* Galería FOTORREALISTAS — masonry plano */
  createGallery({
    bodyId:      'fotorrealistas-body',
    uploadId:    'fotorrealistas-upload',
    countId:     'fotorrealistas-count',
    manifestUrl: 'assets/photos/fotorrealistas/manifest.json',
    filtersId:   null,
    categorize:  false,
    groupByDate: false,
  });

  /* Galería OBRA — línea de tiempo por mes */
  createGallery({
    bodyId:      'obra-body',
    uploadId:    'obra-upload',
    countId:     'obra-count',
    manifestUrl: 'assets/photos/obra/manifest.json',
    filtersId:   null,
    categorize:  false,
    groupByDate: true,
  });

})();
