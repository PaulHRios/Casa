/* ══════════════════════════════════════
   3D VIEWER — Three.js + OBJLoader
══════════════════════════════════════ */

(function () {
  const container = document.getElementById('canvas-3d');
  const dropZone  = document.getElementById('drop-zone');
  const section3d = document.getElementById('section-3d');

  /* ── Scene setup ── */
  const scene    = new THREE.Scene();
  scene.background = new THREE.Color(0x070a14);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 10000);
  camera.position.set(5, 5, 10);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  /* ── Grid ── */
  const grid = new THREE.GridHelper(50, 50, 0x2e3350, 0x1a1d27);
  scene.add(grid);

  /* ── Lights ── */
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(10, 20, 10);
  dirLight.castShadow = true;
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0x4f8ef7, 0.3);
  fillLight.position.set(-10, 5, -10);
  scene.add(fillLight);

  /* ── Resize ── */
  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  /* ── OrbitControls (inline minimal impl) ── */
  let isOrbit = false, isPan = false;
  let lastX = 0, lastY = 0;
  let spherical = { theta: Math.PI / 4, phi: Math.PI / 4, r: 15 };
  let target = new THREE.Vector3(0, 0, 0);

  function updateCamera() {
    camera.position.x = target.x + spherical.r * Math.sin(spherical.phi) * Math.sin(spherical.theta);
    camera.position.y = target.y + spherical.r * Math.cos(spherical.phi);
    camera.position.z = target.z + spherical.r * Math.sin(spherical.phi) * Math.cos(spherical.theta);
    camera.lookAt(target);
  }
  updateCamera();

  renderer.domElement.addEventListener('mousedown', e => {
    if (e.button === 0) { isOrbit = true; }
    if (e.button === 2) { isPan = true; }
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => { isOrbit = false; isPan = false; });

  window.addEventListener('mousemove', e => {
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;

    if (isOrbit && !measuringMode) {
      spherical.theta -= dx * 0.01;
      spherical.phi   = Math.max(0.05, Math.min(Math.PI - 0.05, spherical.phi + dy * 0.01));
      updateCamera();
    }
    if (isPan) {
      const panSpeed = spherical.r * 0.001;
      const right = new THREE.Vector3();
      const up    = new THREE.Vector3();
      camera.getWorldDirection(up);
      right.crossVectors(up, camera.up).normalize();
      camera.getWorldDirection(up).negate();
      target.addScaledVector(right, -dx * panSpeed);
      target.y += dy * panSpeed;
      updateCamera();
    }
  });

  renderer.domElement.addEventListener('wheel', e => {
    spherical.r = Math.max(0.5, Math.min(5000, spherical.r * (1 + e.deltaY * 0.001)));
    updateCamera();
    e.preventDefault();
  }, { passive: false });

  renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

  /* ── Animation loop ── */
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();

  /* ── Reset button ── */
  document.getElementById('btn-reset').addEventListener('click', () => {
    spherical = { theta: Math.PI / 4, phi: Math.PI / 4, r: 15 };
    target.set(0, 0, 0);
    updateCamera();
  });

  /* ══════════════════════════════
     MEASURE TOOL
  ══════════════════════════════ */
  let measuringMode  = false;
  let measurePoints  = [];
  let measureLine    = null;
  let measureSpheres = [];
  const measureDisplay = document.getElementById('measure-display');
  const measureValue   = document.getElementById('measure-value');
  const btnMeasure     = document.getElementById('btn-measure');
  const raycaster      = new THREE.Raycaster();

  btnMeasure.addEventListener('click', () => {
    measuringMode = !measuringMode;
    btnMeasure.classList.toggle('active', measuringMode);
    if (!measuringMode) { clearMeasure(); }
  });

  function clearMeasure() {
    measurePoints = [];
    if (measureLine)  { scene.remove(measureLine); measureLine = null; }
    measureSpheres.forEach(s => scene.remove(s));
    measureSpheres = [];
    measureDisplay.classList.add('hidden');
  }

  renderer.domElement.addEventListener('click', e => {
    if (!measuringMode) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width)  * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);

    // intersect loaded objects first, fallback to ground plane
    const targets = currentModel ? [currentModel] : [];
    let intersects = raycaster.intersectObjects(targets, true);
    let pt;

    if (intersects.length > 0) {
      pt = intersects[0].point.clone();
    } else {
      const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      pt = new THREE.Vector3();
      raycaster.ray.intersectPlane(ground, pt);
      if (!pt) return;
    }

    // marker
    const geo = new THREE.SphereGeometry(0.06, 12, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0x4f8ef7 });
    const sphere = new THREE.Mesh(geo, mat);
    sphere.position.copy(pt);
    scene.add(sphere);
    measureSpheres.push(sphere);
    measurePoints.push(pt);

    if (measurePoints.length === 2) {
      const dist = measurePoints[0].distanceTo(measurePoints[1]);
      measureValue.textContent = dist.toFixed(3) + ' m';
      measureDisplay.classList.remove('hidden');

      // draw line
      const geo2 = new THREE.BufferGeometry().setFromPoints(measurePoints);
      const mat2  = new THREE.LineBasicMaterial({ color: 0x4f8ef7, linewidth: 2 });
      measureLine  = new THREE.Line(geo2, mat2);
      scene.add(measureLine);

      // auto-reset for next measurement
      setTimeout(() => { measurePoints = []; }, 100);
    }
  });

  /* ══════════════════════════════
     OBJ / GLB LOADER
  ══════════════════════════════ */
  let currentModel = null;

  function clearModel() {
    if (currentModel) { scene.remove(currentModel); currentModel = null; }
  }

  function fitModelInView(model) {
    const box    = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    model.position.sub(center);
    grid.position.y = -box.getSize(new THREE.Vector3()).y / 2 - 0.01;
    target.set(0, 0, 0);
    spherical.r = maxDim * 2.5;
    updateCamera();
  }

  function loadOBJText(text, filename) {
    clearModel();
    dropZone.classList.add('hidden');

    // Parse OBJ manually (basic: vertices + faces)
    const lines    = text.split('\n');
    const verts    = [];
    const indices  = [];
    const normals  = [];
    const normIdx  = [];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts[0] === 'v') {
        verts.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
      } else if (parts[0] === 'vn') {
        normals.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
      } else if (parts[0] === 'f') {
        // faces can be v/vt/vn — extract vertex index (1-based)
        const faceVerts = parts.slice(1).map(p => parseInt(p.split('/')[0]) - 1);
        const faceNorms = parts.slice(1).map(p => {
          const n = p.split('/')[2];
          return n ? parseInt(n) - 1 : -1;
        });
        // triangulate polygon
        for (let i = 1; i < faceVerts.length - 1; i++) {
          indices.push(faceVerts[0], faceVerts[i], faceVerts[i + 1]);
          normIdx.push(faceNorms[0], faceNorms[i], faceNorms[i + 1]);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    const posArr = new Float32Array(indices.length * 3);
    const nrmArr = new Float32Array(indices.length * 3);

    for (let i = 0; i < indices.length; i++) {
      const vi = indices[i];
      posArr[i * 3]     = verts[vi * 3];
      posArr[i * 3 + 1] = verts[vi * 3 + 1];
      posArr[i * 3 + 2] = verts[vi * 3 + 2];

      const ni = normIdx[i];
      if (ni >= 0 && normals.length > 0) {
        nrmArr[i * 3]     = normals[ni * 3];
        nrmArr[i * 3 + 1] = normals[ni * 3 + 1];
        nrmArr[i * 3 + 2] = normals[ni * 3 + 2];
      }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    if (normals.length > 0) {
      geo.setAttribute('normal', new THREE.BufferAttribute(nrmArr, 3));
    } else {
      geo.computeVertexNormals();
    }

    const mat = new THREE.MeshStandardMaterial({
      color: 0xd4c5a9,
      roughness: 0.7,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    currentModel = new THREE.Group();
    currentModel.add(mesh);
    scene.add(currentModel);
    fitModelInView(currentModel);
  }

  function loadGLB(buffer) {
    clearModel();
    dropZone.classList.add('hidden');

    // Use THREE GLTFLoader if available, otherwise show message
    if (!THREE.GLTFLoader) {
      alert('El archivo .glb requiere el GLTFLoader de Three.js. Por favor usa un archivo .obj.');
      return;
    }
    const loader = new THREE.GLTFLoader();
    loader.parse(buffer, '', gltf => {
      currentModel = gltf.scene;
      scene.add(currentModel);
      fitModelInView(currentModel);
    });
  }

  function handleFile(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.obj')) {
      const reader = new FileReader();
      reader.onload = e => loadOBJText(e.target.result, file.name);
      reader.readAsText(file);
    } else if (name.endsWith('.glb') || name.endsWith('.gltf')) {
      const reader = new FileReader();
      reader.onload = e => loadGLB(e.target.result);
      reader.readAsArrayBuffer(file);
    }
  }

  // button upload
  document.getElementById('obj-upload').addEventListener('change', e => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });

  // drag-and-drop
  section3d.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  section3d.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  section3d.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

})();
