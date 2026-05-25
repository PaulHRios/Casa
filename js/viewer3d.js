/* ══════════════════════════════════════════════════════════
   VISOR 3D — Three.js + OrbitControls + GLTFLoader
   • Carga plano_light.glb (orientado, en metros)
   • Preserva materiales originales (colores + transparencia)
   • Parcha clippingPlanes para el slider de corte de sección
   • PointerLockControls para modo caminar (primera persona)
   • Pantalla completa, vistas extendidas, persistencia localStorage
══════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { OrbitControls }    from 'three/addons/controls/OrbitControls.js';
import { OBJLoader }        from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader }       from 'three/addons/loaders/GLTFLoader.js';
import { MTLLoader }        from 'three/addons/loaders/MTLLoader.js';
import { RoomEnvironment }  from 'three/addons/environments/RoomEnvironment.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const MODEL_URL    = 'assets/models/plano_light.glb';
const FALLBACK_URL = 'assets/models/dibujo-3d.glb';
const INCH_TO_M    = 0.0254;   // solo para el GLB de respaldo (en pulgadas)

/* ── localStorage helper ── */
const store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : def; } catch { return def; } },
  set(k, v)   { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const container  = document.getElementById('canvas-3d');
const loaderEl   = document.getElementById('model-loader');

/* ── Escena ── */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d1117);
scene.fog = new THREE.Fog(0x0d1117, 60, 180);

const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 1000);
camera.position.set(12, 10, 16);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.toneMapping       = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.localClippingEnabled = true;
container.appendChild(renderer.domElement);

/* ── Plano de corte horizontal (section cut) ── */
const sectionPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6);

/* ── Material de respaldo ── */
const defaultMat = new THREE.MeshStandardMaterial({
  color: 0xd0c8bb, roughness: 0.7, metalness: 0.04,
  side: THREE.DoubleSide,
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  clippingPlanes: [sectionPlane],
});

/* ── Iluminación ── */
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;

scene.add(new THREE.HemisphereLight(0xcce0ff, 0x334455, 0.7));

const sun = new THREE.DirectionalLight(0xfff8f0, 2.0);
sun.position.set(20, 30, 15);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera;
Object.assign(sc, { near: 0.5, far: 200, left: -50, right: 50, top: 50, bottom: -50 });
sun.shadow.bias = -0.0003;
scene.add(sun);

const fill = new THREE.DirectionalLight(0x8ab0d8, 0.5);
fill.position.set(-10, 3, 14);
scene.add(fill);

/* ── Suelo + grid ── */
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 500),
  new THREE.ShadowMaterial({ opacity: 0.18 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(100, 100, 0x2e3350, 0x1a1d27);
grid.material.opacity = 0.35;
grid.material.transparent = true;
scene.add(grid);

/* ── OrbitControls ── */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping    = true;
controls.dampingFactor    = 0.07;
controls.screenSpacePanning = false;
controls.maxPolarAngle    = Math.PI / 2 + 0.08;
controls.target.set(0, 1.5, 0);

/* ── PointerLockControls para modo caminar ── */
const walkControls = new PointerLockControls(camera, renderer.domElement);
scene.add(walkControls.getObject());

/* ── Estado de modo caminar ── */
let walkMode = false;
const walkKeys = { w: false, a: false, s: false, d: false,
                   ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
const walkVelocity = new THREE.Vector3();
const WALK_SPEED = 5.0;

/* (room labels removed — coordinates unreliable without measured model) */

/* ── Resize ── */
function resize() {
  const w = container.clientWidth, h = container.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

/* ── Render loop ── */
let prevTime = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const time = performance.now();
  const delta = (time - prevTime) / 1000;
  prevTime = time;

  if (walkMode) {
    // ── Always enforce eye height and horizontal-only rotation ──
    camera.position.y = 1.65;
    camera.rotation.order = 'YXZ';
    camera.rotation.x = 0;   // no pitch
    camera.rotation.z = 0;   // no roll

    if (walkControls.isLocked) {
      // ── Desktop: PointerLock + WASD ──
      walkVelocity.x -= walkVelocity.x * 10 * delta;
      walkVelocity.z -= walkVelocity.z * 10 * delta;
      const speed = WALK_SPEED;
      if (walkKeys.w || walkKeys.ArrowUp)    walkVelocity.z -= speed * delta;
      if (walkKeys.s || walkKeys.ArrowDown)  walkVelocity.z += speed * delta;
      if (walkKeys.a || walkKeys.ArrowLeft)  walkVelocity.x -= speed * delta;
      if (walkKeys.d || walkKeys.ArrowRight) walkVelocity.x += speed * delta;
      walkControls.moveRight(walkVelocity.x * delta * 10);
      walkControls.moveForward(-walkVelocity.z * delta * 10);
    }

    // ── Joysticks (mobile + desktop fallback) ──
    if (joystickLeft.active) {
      const moveDir = new THREE.Vector3();
      camera.getWorldDirection(moveDir);
      moveDir.y = 0; moveDir.normalize();
      const sideDir = new THREE.Vector3(-moveDir.z, 0, moveDir.x);
      camera.position.addScaledVector(moveDir, -joystickLeft.deltaY * WALK_SPEED * delta);
      camera.position.addScaledVector(sideDir,  joystickLeft.deltaX * WALK_SPEED * delta);
    }
    if (joystickRight.active) {
      // Yaw only — no pitch
      camera.rotation.y -= joystickRight.deltaX * 0.04;
    }
  } else {
    controls.update();
  }

  renderer.render(scene, camera);
}
animate();

/* ══════════════════════════════════════
   MODELO
══════════════════════════════════════ */
let currentModel = null;
let modelMeshes  = [];
let modelRadius  = 15;

function clearModel() {
  if (currentModel) { scene.remove(currentModel); currentModel = null; }
  modelMeshes = [];
}

function patchMat(m) {
  m.clippingPlanes  = [sectionPlane];
  m.polygonOffset   = true;
  m.polygonOffsetFactor = 1;
  m.polygonOffsetUnits  = 1;
  m.side = THREE.DoubleSide;
  if (m.opacity !== undefined && m.opacity < 0.99) {
    m.transparent = true;
    m.depthWrite  = false;
  }
  m.needsUpdate = true;
}

function processModel(object3d, scaleToMeters) {
  clearModel();
  if (scaleToMeters) object3d.scale.setScalar(INCH_TO_M);

  object3d.traverse(child => {
    if (!child.isMesh) return;

    if (!child.material) {
      child.material = defaultMat;
    } else if (Array.isArray(child.material)) {
      child.material.forEach(patchMat);
    } else {
      patchMat(child.material);
    }

    child.castShadow    = true;
    child.receiveShadow = true;
    if (child.geometry.attributes.position && !child.geometry.attributes.normal) {
      child.geometry.computeVertexNormals();
    }
    modelMeshes.push(child);
  });

  const box    = new THREE.Box3().setFromObject(object3d);
  const center = box.getCenter(new THREE.Vector3());
  const size   = box.getSize(new THREE.Vector3());

  object3d.position.x -= center.x;
  object3d.position.z -= center.z;
  object3d.position.y -= box.min.y;

  scene.add(object3d);
  currentModel = object3d;

  modelRadius = 0.5 * Math.hypot(size.x, size.y, size.z) || 15;
  grid.scale.setScalar(Math.max(size.x, size.z) * 2.4 / 100);

  const maxH = +(size.y * 1.05).toFixed(2);
  sectionSlider.max   = maxH;
  sectionSlider.value = maxH;
  sectionPlane.constant = maxH;
  updateSectionLabel(maxH, maxH);
  document.getElementById('section-bar').style.display = 'flex';

  // Restore camera state from localStorage
  const savedCam = store.get('cam_state', null);
  if (savedCam) {
    camera.position.set(savedCam.px, savedCam.py, savedCam.pz);
    controls.target.set(savedCam.tx, savedCam.ty, savedCam.tz);
    controls.update();
  } else {
    setView('iso');
  }

  loaderEl.classList.add('hidden');
}

function loadGLB(url, scaleToMeters = false) {
  new GLTFLoader().load(
    url,
    gltf => processModel(gltf.scene, scaleToMeters),
    xhr => {
      if (xhr.total)
        loaderEl.querySelector('p').textContent =
          `Cargando… ${Math.round(xhr.loaded / xhr.total * 100)}%`;
    },
    err => {
      console.warn('GLB falló, cargando respaldo…', err);
      if (url !== FALLBACK_URL) {
        loadGLB(FALLBACK_URL, true);
      } else {
        const p = loaderEl.querySelector('p');
        p.textContent = 'No se pudo cargar el modelo.';
        p.style.color = '#ff6b6b';
        p.style.fontWeight = '600';
        loaderEl.querySelector('.spinner').style.display = 'none';
      }
    }
  );
}

function loadFromFile(file) {
  loaderEl.classList.remove('hidden');
  loaderEl.querySelector('p').textContent = 'Cargando…';
  const name = file.name.toLowerCase();
  const reader = new FileReader();
  if (name.endsWith('.obj')) {
    reader.onload = e => processModel(new OBJLoader().parse(e.target.result), false);
    reader.readAsText(file);
  } else {
    reader.onload = e =>
      new GLTFLoader().parse(e.target.result, '', gltf => processModel(gltf.scene, false));
    reader.readAsArrayBuffer(file);
  }
}

document.getElementById('obj-upload').addEventListener('change', e => {
  if (e.target.files[0]) loadFromFile(e.target.files[0]);
});
const sec3d = document.getElementById('section-3d');
sec3d.addEventListener('dragover', e => e.preventDefault());
sec3d.addEventListener('drop', e => {
  e.preventDefault();
  if (e.dataTransfer.files[0]) loadFromFile(e.dataTransfer.files[0]);
});

/* ══════════════════════════════════════
   CORTE DE SECCIÓN (slider)
══════════════════════════════════════ */
const sectionSlider  = document.getElementById('section-slider');
const sectionValueEl = document.getElementById('section-value');

function updateSectionLabel(val, max) {
  const atMax = parseFloat(val) >= parseFloat(max) * 0.98;
  sectionValueEl.textContent = atMax ? 'completo' : `${parseFloat(val).toFixed(1)} m`;
}

sectionSlider.addEventListener('input', () => {
  const h = parseFloat(sectionSlider.value);
  sectionPlane.constant = h;
  updateSectionLabel(h, sectionSlider.max);
});

/* ══════════════════════════════════════
   VISTAS PREDEFINIDAS
══════════════════════════════════════ */
function fitDist() {
  return (modelRadius / Math.sin((camera.fov / 2) * Math.PI / 180)) * 1.1;
}

function setView(kind) {
  const r = fitDist();
  const c = new THREE.Vector3(0, modelRadius * 0.3, 0);
  if (currentModel) {
    const box = new THREE.Box3().setFromObject(currentModel);
    box.getCenter(c);
  }
  controls.target.copy(c);
  switch (kind) {
    case 'top':      camera.position.set(c.x, c.y + r,          c.z + 0.001); break;
    case 'front':    camera.position.set(c.x, c.y + r * 0.18,   c.z + r);     break;
    case 'side':     camera.position.set(c.x + r, c.y + r * 0.18, c.z);       break;
    case 'left':     camera.position.set(c.x - r, c.y + r * 0.18, c.z);       break;
    case 'interior':
      exitWalkMode();
      camera.position.set(0, 1.7, 0);
      controls.target.set(0, 1.7, -3);
      break;
    default:         camera.position.set(c.x + r * 0.7, c.y + r * 0.5, c.z + r * 0.7);
  }
  controls.update();
}

document.querySelectorAll('.preset-btn').forEach(b =>
  b.addEventListener('click', () => setView(b.dataset.view)));

/* ── Toolbar tabs (Vistas / Herramientas) ── */
document.querySelectorAll('.tb-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tb-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tb-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const panel = document.getElementById(tab.dataset.panel);
    if (panel) panel.classList.add('active');
  });
});

document.getElementById('btn-reset').addEventListener('click', () => {
  sectionSlider.value = sectionSlider.max;
  sectionPlane.constant = parseFloat(sectionSlider.max);
  updateSectionLabel(sectionSlider.max, sectionSlider.max);
  setView('iso');
  store.set('cam_state', null);
});

/* ── Wireframe ── */
let wireOn = false;
document.getElementById('btn-wire').addEventListener('click', () => {
  wireOn = !wireOn;
  document.getElementById('btn-wire').classList.toggle('active', wireOn);
  modelMeshes.forEach(m => {
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach(mat => { mat.wireframe = wireOn; });
  });
});

/* (room labels removed — coordinates unreliable without measured model) */

/* ══════════════════════════════════════
   MODO CAMINAR (primera persona)
══════════════════════════════════════ */
const walkOverlay = document.getElementById('walk-overlay');
const btnWalkExit = document.getElementById('btn-walk-exit');
const btnWalk     = document.getElementById('btn-walk');

/* Virtual joystick state */
const joystickLeft  = { active: false, startX: 0, startY: 0, deltaX: 0, deltaY: 0 };
const joystickRight = { active: false, startX: 0, startY: 0, deltaX: 0, deltaY: 0 };

const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches;

function enterWalkMode() {
  walkMode = true;
  controls.enabled = false;

  // Eye height 1.65 m, POV field of view
  camera.position.y = 1.65;
  camera.fov = 70;
  camera.updateProjectionMatrix();

  if (!isTouchDevice()) {
    // Desktop: request pointer lock (click to start looking around)
    walkControls.lock();
  }
  // Mobile: no PointerLock — joysticks handle movement + rotation
  if (walkOverlay) walkOverlay.classList.remove('hidden');
  if (btnWalk) btnWalk.classList.add('active');
}

function exitWalkMode() {
  walkMode = false;
  controls.enabled = true;
  if (walkControls.isLocked) walkControls.unlock();
  if (walkOverlay) walkOverlay.classList.add('hidden');
  if (btnWalk) btnWalk.classList.remove('active');
  walkVelocity.set(0, 0, 0);
  // Restore original FOV and rotation order
  camera.fov = 42;
  camera.rotation.order = 'XYZ';
  camera.updateProjectionMatrix();
  store.set('walk_mode', false);
}

if (btnWalk) {
  btnWalk.addEventListener('click', () => {
    if (walkMode) exitWalkMode();
    else enterWalkMode();
  });
}

if (btnWalkExit) {
  btnWalkExit.addEventListener('click', exitWalkMode);
}

walkControls.addEventListener('unlock', () => {
  // Only exit on desktop — mobile never uses PointerLock
  if (walkMode && !isTouchDevice()) exitWalkMode();
});

/* ── WASD / Arrow keys ── */
document.addEventListener('keydown', e => {
  if (e.key in walkKeys) { walkKeys[e.key] = true; e.preventDefault(); }
  if (e.key === 'Escape' && walkMode) exitWalkMode();
});
document.addEventListener('keyup', e => {
  if (e.key in walkKeys) walkKeys[e.key] = false;
});

/* ── Virtual joystick touch handlers ── */
function setupJoystick(el, joy) {
  if (!el) return;
  el.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.touches[0];
    joy.active = true;
    joy.startX = t.clientX;
    joy.startY = t.clientY;
    joy.deltaX = 0;
    joy.deltaY = 0;
  }, { passive: false });
  el.addEventListener('touchmove', e => {
    e.preventDefault();
    const t = e.touches[0];
    const dx = (t.clientX - joy.startX) / 50;
    const dy = (t.clientY - joy.startY) / 50;
    joy.deltaX = Math.max(-1, Math.min(1, dx));
    joy.deltaY = Math.max(-1, Math.min(1, dy));
    // Move knob visually
    const knob = el.querySelector('.walk-joystick-knob');
    if (knob) {
      knob.style.transform = `translate(calc(-50% + ${joy.deltaX * 25}px), calc(-50% + ${joy.deltaY * 25}px))`;
    }
  }, { passive: false });
  el.addEventListener('touchend', e => {
    e.preventDefault();
    joy.active = false;
    joy.deltaX = 0;
    joy.deltaY = 0;
    const knob = el.querySelector('.walk-joystick-knob');
    if (knob) knob.style.transform = 'translate(-50%, -50%)';
  }, { passive: false });
}

setupJoystick(document.getElementById('walk-joystick-left'), joystickLeft);
setupJoystick(document.getElementById('walk-joystick-right'), joystickRight);

/* ══════════════════════════════════════
   PANTALLA COMPLETA
══════════════════════════════════════ */
const btnFullscreen3d = document.getElementById('btn-fullscreen-3d');
if (btnFullscreen3d) {
  btnFullscreen3d.addEventListener('click', () => {
    const viewerSection = document.getElementById('section-3d');
    if (!document.fullscreenElement) {
      (viewerSection || container).requestFullscreen().catch(e => console.warn('Fullscreen error:', e));
      btnFullscreen3d.textContent = '✕';
    } else {
      document.exitFullscreen();
      btnFullscreen3d.textContent = '⛶';
    }
  });
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      btnFullscreen3d.textContent = '⛶';
    }
  });
}

/* ══════════════════════════════════════
   MEDICIÓN
══════════════════════════════════════ */
let measuring   = false;
let measurePts  = [];
let measureObjs = [];
const raycaster = new THREE.Raycaster();
const measureDisplay = document.getElementById('measure-display');
const measureValue   = document.getElementById('measure-value');

document.getElementById('btn-measure').addEventListener('click', () => {
  measuring = !measuring;
  document.getElementById('btn-measure').classList.toggle('active', measuring);
  renderer.domElement.style.cursor = measuring ? 'crosshair' : '';
  if (!measuring) clearMeasure();
});

function clearMeasure() {
  measurePts = [];
  measureObjs.forEach(o => scene.remove(o));
  measureObjs = [];
  measureDisplay.classList.add('hidden');
}

function addMarker(p) {
  const s = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(0.08, modelRadius * 0.006), 14, 14),
    new THREE.MeshBasicMaterial({ color: 0x4f8ef7, depthTest: false })
  );
  s.position.copy(p); s.renderOrder = 999;
  scene.add(s); measureObjs.push(s);
}

renderer.domElement.addEventListener('pointerdown', ev => {
  if (!measuring || ev.button !== 0) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((ev.clientX - rect.left) / rect.width) * 2 - 1,
    -((ev.clientY - rect.top) / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(modelMeshes, true);
  let pt;
  if (hits.length) {
    pt = hits[0].point.clone();
  } else {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    pt = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, pt)) return;
  }

  if (measurePts.length === 2) clearMeasure();
  addMarker(pt); measurePts.push(pt);

  if (measurePts.length === 2) {
    const d = measurePts[0].distanceTo(measurePts[1]);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(measurePts),
      new THREE.LineBasicMaterial({ color: 0x4f8ef7, depthTest: false })
    );
    line.renderOrder = 999; scene.add(line); measureObjs.push(line);
    measureValue.textContent = d.toFixed(2) + ' m';
    measureDisplay.classList.remove('hidden');
  }
}, true);

/* ── Guardar estado de cámara periódicamente ── */
let camSaveTimer = null;
controls.addEventListener('change', () => {
  clearTimeout(camSaveTimer);
  camSaveTimer = setTimeout(() => {
    store.set('cam_state', {
      px: camera.position.x, py: camera.position.y, pz: camera.position.z,
      tx: controls.target.x, ty: controls.target.y, tz: controls.target.z,
    });
  }, 500);
});

/* ── Iniciar ── */
loadGLB(MODEL_URL);
