/* ══════════════════════════════════════
   FOTOS GALLERY + LIGHTBOX
══════════════════════════════════════ */

(function () {
  const grid       = document.getElementById('fotos-grid');
  const lightbox   = document.getElementById('lightbox');
  const lbImg      = document.getElementById('lb-img');
  const lbCaption  = document.getElementById('lb-caption');
  const countLabel = document.getElementById('fotos-count');

  let photos   = [];   // { src, name }
  let lbIndex  = 0;

  function prettify(filename) {
    return filename
      .replace(/\.[^.]+$/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  function openLightbox(idx) {
    lbIndex = idx;
    lbImg.src = photos[idx].src;
    lbCaption.textContent = photos[idx].name;
    lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function nextLb() { openLightbox((lbIndex + 1) % photos.length); }
  function prevLb() { openLightbox((lbIndex - 1 + photos.length) % photos.length); }

  document.getElementById('lb-close').addEventListener('click', closeLightbox);
  document.getElementById('lb-next').addEventListener('click', nextLb);
  document.getElementById('lb-prev').addEventListener('click', prevLb);
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

  document.addEventListener('keydown', e => {
    if (lightbox.classList.contains('hidden')) return;
    if (e.key === 'Escape')      closeLightbox();
    if (e.key === 'ArrowRight')  nextLb();
    if (e.key === 'ArrowLeft')   prevLb();
  });

  /* ── Add photo card ── */
  function addCard(src, name, idx) {
    // remove empty placeholder
    const empty = grid.querySelector('.fotos-empty');
    if (empty) empty.remove();

    const card = document.createElement('div');
    card.className = 'foto-card';
    card.innerHTML = `<img src="${src}" alt="${name}" loading="lazy" />
                      <div class="foto-label">${name}</div>`;
    card.addEventListener('click', () => openLightbox(idx));
    grid.appendChild(card);

    countLabel.textContent = `${photos.length} foto${photos.length !== 1 ? 's' : ''}`;
  }

  /* ── Upload handler ── */
  document.getElementById('fotos-upload').addEventListener('change', e => {
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const idx = photos.length;
        photos.push({ src: ev.target.result, name: file.name });
        addCard(ev.target.result, file.name, idx);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  });

  /* ── Load prebuilt assets ── */
  async function loadPrebuiltPhotos() {
    try {
      const resp = await fetch('assets/photos/manifest.json');
      if (!resp.ok) return;
      const files = await resp.json();
      for (const f of files) {
        const url = 'assets/photos/' + f;
        const idx = photos.length;
        const label = prettify(f);
        photos.push({ src: url, name: label });
        addCard(url, label, idx);
      }
    } catch (_) {}
  }

  loadPrebuiltPhotos();

})();
