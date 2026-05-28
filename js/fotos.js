/* ══════════════════════════════════════════════════════════
   GALERÍAS — Diseño · Fotorrealistas · Avance de Obra
   Masonry, categorías, línea de tiempo por fecha, lightbox+filmstrip
   • parsePhotoDate: maneja formato upload_date_capture
   • Swipe lightbox, sort/year filter para obra
   • createElement (sin innerHTML XSS), IntersectionObserver lazy load
   • Error handling con console.warn
══════════════════════════════════════════════════════════ */

(function () {

  /* ── localStorage helper ── */
  const store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : def; } catch { return def; } },
    set(k, v)   { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  /* ══════════════════════════════════════════════════════════
     LIGHTBOX MEJORADO  (filmstrip + contador + swipe)
  ══════════════════════════════════════════════════════════ */
  const lightbox    = document.getElementById('lightbox');
  const lbImg       = document.getElementById('lb-img');
  const lbCaption   = document.getElementById('lb-caption');
  const lbCounter   = document.getElementById('lb-counter');
  const lbFilmstrip = document.getElementById('lb-filmstrip');

  let lbPhotos  = [];
  let lbIndex   = 0;
  let filmBuilt = false;

  /* Swipe state */
  let lbTouchStartX = 0;
  let lbTouchStartY = 0;

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
      const img = document.createElement('img');
      img.src = p.src;
      img.alt = '';
      img.loading = 'lazy';
      t.appendChild(img);
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

  /* Swipe to navigate lightbox */
  const lbMain = lightbox.querySelector('.lb-main');
  if (lbMain) {
    lbMain.addEventListener('touchstart', e => {
      lbTouchStartX = e.touches[0].clientX;
      lbTouchStartY = e.touches[0].clientY;
    }, { passive: true });
    lbMain.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - lbTouchStartX;
      const dy = e.changedTouches[0].clientY - lbTouchStartY;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 50)  prevLb();
        if (dx < -50) nextLb();
      } else {
        if (dy > 200) closeLb();   // swipe down to close
      }
    }, { passive: true });
  }

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
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const MS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  /* Exported to window for testing */
  function parsePhotoDate(filename) {
    const seqMatch = filename.match(/[_\s](\d+)\.[^.]+$/);
    const seqNum = seqMatch ? parseInt(seqMatch[1]) : 0;

    // FORMAT 1: UPLOAD_DATE_CAPTURE-DATE-HH-MM-SS
    // e.g. 2026-05-25_2022-10-29-21-44-44.jpg
    let m = filename.match(/^\d{4}-\d{2}-\d{2}_(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/);
    if (m) return _mkDate(m[1],m[2],m[3],m[4],m[5],m[6],seqNum);

    // FORMAT 1b: with space separator (e.g. "2026-05-25_2022-12-17-12-43-39 2.jpg")
    m = filename.match(/^\d{4}-\d{2}-\d{2}_(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/);
    if (m) return _mkDate(m[1],m[2],m[3],m[4],m[5],m[6],seqNum);

    // FORMAT 2: PHOTO/IMG prefix YYYY-MM-DD-HH-MM-SS
    m = filename.match(/^(?:PHOTO|IMG|DSC|foto|image)[-_](\d{4})[-_](\d{2})[-_](\d{2})[-_](\d{2})[-_](\d{2})[-_](\d{2})/i);
    if (m) return _mkDate(m[1],m[2],m[3],m[4],m[5],m[6],seqNum);

    // FORMAT 3: plain YYYY-MM-DD-HH-MM-SS
    m = filename.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/);
    if (m) return _mkDate(m[1],m[2],m[3],m[4],m[5],m[6],seqNum);

    // FORMAT 4: YYYY-MM-DD only
    m = filename.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return _mkDate(m[1],m[2],m[3],'00','00','00',seqNum);

    return null;
  }
  window.parsePhotoDate = parsePhotoDate;

  function _mkDate(y, mo, d, h, min, s, seq) {
    return {
      monthKey: `${y}-${mo}`,
      year:     y,
      label:    `${parseInt(d)} ${MS_SHORT[parseInt(mo)-1]} ${y}  ${h}:${min}`,
      sortKey:  `${y}${mo}${d}${h}${min}${s}${String(seq).padStart(3,'0')}`,
    };
  }

  function parseMonthKey(filename) {
    const d = parsePhotoDate(filename);
    return d ? d.monthKey : null;
  }

  function formatMonth(key) {
    const [y, m] = key.split('-');
    return `${MESES[parseInt(m) - 1]} ${y}`;
  }

  /* ══════════════════════════════════════════════════════════
     PRETTIFY
  ══════════════════════════════════════════════════════════ */
  function prettify(filename) {
    // New format: 2026-05-25_2022-10-29-21-44-44.jpg → use capture date
    const d = parsePhotoDate(filename);
    if (d) return d.label;

    const name = filename
      .replace(/\.[^.]+$/, '')
      .replace(/^\d{4}[-_]\d{2}[-_]\d{2}[-_]?/, '')
      .replace(/^(render|foto|fotorrealista|fotorealista)[-_]?/i, '')
      .replace(/[-_]+/g, ' ')
      .trim();
    return name.replace(/\b\w/g, c => c.toUpperCase()) || filename;
  }

  /* ══════════════════════════════════════════════════════════
     IntersectionObserver for lazy loading
  ══════════════════════════════════════════════════════════ */
  const imgObserver = (typeof IntersectionObserver !== 'undefined')
    ? new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const img = entry.target;
          const src = img.dataset.src;
          if (src) { img.src = src; delete img.dataset.src; }
          obs.unobserve(img);
        });
      }, { rootMargin: '200px' })
    : null;

  /* ══════════════════════════════════════════════════════════
     FÁBRICA DE GALERÍAS
  ══════════════════════════════════════════════════════════ */
  function createGallery({ bodyId, uploadId, countId, manifestUrl,
                            filtersId, categorize, groupByDate, isObra }) {
    const body    = document.getElementById(bodyId);
    const countEl = document.getElementById(countId);
    if (!body) return;

    const photos   = [];
    const groupMap = new Map();
    let flatMasonry = null;

    /* Obra sort/year filter state */
    let obraSortAsc = store.get('obra_sort', true);
    let obraYearFilter = store.get('obra_year_filter', 'all');
    let obraAllPhotos = [];  // store for re-filtering

    function updateCount() {
      if (!countEl) return;
      countEl.textContent = photos.length
        ? `${photos.length} foto${photos.length !== 1 ? 's' : ''}`
        : '';
    }

    function removePlaceholder() {
      const ph = body.querySelector('.gallery-empty-state');
      if (ph) ph.remove();
    }

    function getOrCreateGroup(key, label, count) {
      if (groupMap.has(key)) return groupMap.get(key).masonry;
      const wrapper = document.createElement('div');
      wrapper.className = 'gallery-group';
      wrapper.dataset.group = key;
      if (label) {
        const lbl = document.createElement('div');
        lbl.className = 'gallery-group-label';
        const labelSpan = document.createElement('span');
        labelSpan.textContent = label;
        lbl.appendChild(labelSpan);
        if (count !== undefined) {
          const countSpan = document.createElement('span');
          countSpan.className = 'group-count';
          countSpan.textContent = ` · ${count} foto${count !== 1 ? 's' : ''}`;
          lbl.appendChild(countSpan);
        }
        wrapper.appendChild(lbl);
      }
      const masonry = document.createElement('div');
      masonry.className = 'fotos-masonry';
      wrapper.appendChild(masonry);
      body.appendChild(wrapper);
      groupMap.set(key, { wrapper, masonry });
      return masonry;
    }

    /* ── Tarjeta de foto (createElement, no innerHTML) ── */
    function makeCard(src, label, idx) {
      const card = document.createElement('div');
      card.className = 'foto-card';
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', label);
      card.tabIndex = 0;
      // Stagger entrance (Emil Kowalski skill): cap at 12 so late items don't lag
      card.style.setProperty('--stagger-i', Math.min(idx, 12));

      const img = document.createElement('img');
      if (imgObserver) {
        img.dataset.src = src;
        img.alt = label;
        imgObserver.observe(img);
      } else {
        img.src = src;
        img.alt = label;
      }
      img.loading = 'lazy';

      const lbl = document.createElement('div');
      lbl.className = 'foto-label';
      lbl.textContent = label;

      card.appendChild(img);
      card.appendChild(lbl);
      card.addEventListener('click', () => openLb(photos, idx));
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') openLb(photos, idx);
      });
      return card;
    }

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

    function renderCategorized(allPhotos, startIdx) {
      removePlaceholder();
      const catMap = new Map();
      allPhotos.forEach((p, i) => {
        const cat = getCategory(p.filename);
        if (!catMap.has(cat)) catMap.set(cat, []);
        catMap.get(cat).push({ ...p, gi: startIdx + i });
      });
      CAT_ORDER.forEach(cat => {
        if (!catMap.has(cat)) return;
        const masonry = getOrCreateGroup(cat, cat);
        catMap.get(cat).forEach(p => masonry.appendChild(makeCard(p.src, p.label, p.gi)));
        catMap.delete(cat);
      });
      catMap.forEach((items, cat) => {
        const masonry = getOrCreateGroup(cat, cat);
        items.forEach(p => masonry.appendChild(makeCard(p.src, p.label, p.gi)));
      });
      updateCount();
    }

    /* ── Renderizar agrupado por fecha (línea de tiempo) ── */
    function renderByDate(allPhotos, startIdx, sortAsc, yearFilter) {
      removePlaceholder();

      // Clear existing groups
      groupMap.forEach(({ wrapper }) => wrapper.remove());
      groupMap.clear();

      const dateMap = new Map();
      const undated = [];

      allPhotos.forEach((p, i) => {
        const parsed = parsePhotoDate(p.filename);
        const key = parsed ? parsed.monthKey : null;
        const sortKey = parsed ? parsed.sortKey : '99999999999999';
        const yearStr = parsed ? parsed.year : null;

        if (yearFilter !== 'all' && yearStr !== yearFilter) return;

        const entry = { ...p, gi: startIdx + i, sortKey, yearStr };
        if (key) {
          if (!dateMap.has(key)) dateMap.set(key, []);
          dateMap.get(key).push(entry);
        } else {
          undated.push(entry);
        }
      });

      const sortedKeys = [...dateMap.keys()].sort();
      if (!sortAsc) sortedKeys.reverse();

      sortedKeys.forEach(key => {
        const items = dateMap.get(key).sort((a, b) => {
          return sortAsc
            ? a.sortKey.localeCompare(b.sortKey)
            : b.sortKey.localeCompare(a.sortKey);
        });
        const masonry = getOrCreateGroup(key, formatMonth(key), items.length);
        items.forEach(p => masonry.appendChild(makeCard(p.src, p.label, p.gi)));
      });

      if (undated.length > 0) {
        const masonry = getOrCreateGroup('sin-fecha', 'Sin fecha', undated.length);
        undated.forEach(p => masonry.appendChild(makeCard(p.src, p.label, p.gi)));
      }
      updateCount();
    }

    /* ── Sort toggle and Year filter for obra ── */
    function buildObraControls(allPhotos) {
      const sortBtn = document.getElementById('obra-sort-btn');
      const sortIcon = document.getElementById('obra-sort-icon');
      const sortLabel = document.getElementById('obra-sort-label');
      const yearFiltersEl = document.getElementById('obra-year-filters');

      // Extract unique years
      const years = new Set();
      allPhotos.forEach(p => {
        const d = parsePhotoDate(p.filename);
        if (d) years.add(d.year);
      });
      const sortedYears = [...years].sort();

      // Build year filter chips
      if (yearFiltersEl) {
        yearFiltersEl.innerHTML = '';
        function makeYearChip(label, val, isAll) {
          const btn = document.createElement('button');
          btn.className = 'filter-chip' + ((isAll && obraYearFilter === 'all') || (!isAll && obraYearFilter === val) ? ' active' : '');
          btn.textContent = label;
          btn.addEventListener('click', () => {
            obraYearFilter = val;
            store.set('obra_year_filter', val);
            yearFiltersEl.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            rerenderObra();
          });
          yearFiltersEl.appendChild(btn);
        }
        makeYearChip('Todos', 'all', true);
        sortedYears.forEach(y => makeYearChip(y, y, false));
      }

      // Sort button
      function updateSortBtn() {
        if (sortIcon)  sortIcon.textContent  = obraSortAsc ? '↑' : '↓';
        if (sortLabel) sortLabel.textContent = obraSortAsc ? 'Más antiguas primero' : 'Más nuevas primero';
      }
      updateSortBtn();

      if (sortBtn) {
        sortBtn.addEventListener('click', () => {
          obraSortAsc = !obraSortAsc;
          store.set('obra_sort', obraSortAsc);
          updateSortBtn();
          rerenderObra();
        });
      }

      function rerenderObra() {
        renderByDate(obraAllPhotos, 0, obraSortAsc, obraYearFilter);
      }
    }

    /* ── Chips de filtro (categorías) ── */
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

        const allPhotos = files.map(f => {
          const parsed = parsePhotoDate(f);
          return {
            src:      base + encodeURIComponent(f),
            filename: f,
            label:    prettify(f),
          };
        });
        allPhotos.forEach(p => photos.push({ src: p.src, name: p.label }));

        if (categorize) {
          renderCategorized(allPhotos, startIdx);
          if (filtersId) {
            const filtersEl = document.getElementById(filtersId);
            if (filtersEl) buildFilters(filtersEl, allPhotos);
          }
        } else if (groupByDate) {
          obraAllPhotos = allPhotos;
          renderByDate(allPhotos, startIdx, obraSortAsc, obraYearFilter);
          if (isObra) buildObraControls(allPhotos);
        } else {
          renderFlat(allPhotos, startIdx);
        }
      } catch (err) {
        console.warn('[gallery]', err);
        // Show error state
        const errDiv = document.createElement('div');
        errDiv.className = 'gallery-error-state';
        errDiv.innerHTML = '<div class="ges-icon">⚠️</div><p>No se pudo cargar la galería. Verifica tu conexión.</p>';
        body.appendChild(errDiv);
      }
    }

    loadFromManifest();
    return photos;
  }

  /* ══════════════════════════════════════════════════════════
     INSTANCIAS
  ══════════════════════════════════════════════════════════ */

  createGallery({
    bodyId:      'diseno-body',
    uploadId:    'diseno-upload',
    countId:     'diseno-count',
    manifestUrl: 'assets/photos/diseno/manifest.json',
    filtersId:   'diseno-filters',
    categorize:  true,
    groupByDate: false,
    isObra:      false,
  });

  createGallery({
    bodyId:      'fotorrealistas-body',
    uploadId:    'fotorrealistas-upload',
    countId:     'fotorrealistas-count',
    manifestUrl: 'assets/photos/fotorrealistas/manifest.json',
    filtersId:   null,
    categorize:  false,
    groupByDate: false,
    isObra:      false,
  });

  createGallery({
    bodyId:      'obra-body',
    uploadId:    'obra-upload',
    countId:     'obra-count',
    manifestUrl: 'assets/photos/obra/manifest.json',
    filtersId:   null,
    categorize:  false,
    groupByDate: true,
    isObra:      true,
  });

})();
