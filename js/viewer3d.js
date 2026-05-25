/* ══════════════════════════════════════════════════════════
   VISOR 3D — Three.js + OrbitControls + GLTFLoader
   • Carga plano_light.glb (orientado, en metros)
   • Preserva materiales originales (colores + transparencia)
   • Parcha clippingPlanes para el slider de corte de sección
══════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { OrbitControls }   from 'three/addons/controls/OrbitControls.js';
import { OBJLoader }       from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader }      from 'three/addons/loaders/GLTFLoader.js';
import { MTLLoader }       from 'three/addons/loaders/MTLLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const MODEL_URL     = 'assets/models/plano_light.glb';
const FALLBACK_URL  = 'assets/models/dibujo-3d.glb';
const INCH_TO_M     = 0.0254;   // solo para el GLB de respaldo (en pulgadas)

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
/* normal (0,-1,0): mantiene lo que esté POR DEBAJO del valor constant */
const sectionPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6);

/* ── Material de respaldo (solo si el mesh no tiene material) ── */
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
function animate() {
  requestAnimationFrame(animate);
  controls.update();
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

/* Parchear material preservando colores y transparencia originales */
function patchMat(m) {
  m.clippingPlanes  = [sectionPlane];
  m.polygonOffset   = true;
  m.polygonOffsetFactor = 1;
  m.polygonOffsetUnits  = 1;
  /* Mantener DoubleSide para vidrios y cerramientos; en materiales
     completamente opacos podrías usar FrontSide, pero DoubleSide
     funciona bien con el modelo exportado correctamente. */
  m.side = THREE.DoubleSide;
  /* Asegurar que materiales con alpha < 1 tengan transparent=true */
  if (m.opacity !== undefined && m.opacity < 0.99) {
    m.transparent = true;
    m.depthWrite  = false;   // sin artefactos de transparencia
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

  /* Centrar horizontalmente y apoyar en Y=0 */
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

  /* ── Slider de corte ── */
  const maxH = +(size.y * 1.05).toFixed(2);
  sectionSlider.max   = maxH;
  sectionSlider.value = maxH;
  sectionPlane.constant = maxH;
  updateSectionLabel(maxH, maxH);
  document.getElementById('section-bar').style.display = 'flex';

  setView('iso');
  loaderEl.classList.add('hidden');
}

/* ── Carga del modelo principal ── */
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
      if (url !== FALLBACK_URL) loadGLB(FALLBACK_URL, true);
      else loaderEl.querySelector('p').textContent = 'No se pudo cargar el modelo.';
    }
  );
}

/* ── Subida manual de archivo ── */
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
    case 'top':   camera.position.set(c.x, c.y + r,          c.z + 0.001); break;
    case 'front': camera.position.set(c.x, c.y + r * 0.18,   c.z + r);     break;
    case 'side':  camera.position.set(c.x + r, c.y + r * 0.18, c.z);       break;
    default:      camera.position.set(c.x + r * 0.7, c.y + r * 0.5, c.z + r * 0.7);
  }
  controls.update();
}

document.querySelectorAll('.preset-btn').forEach(b =>
  b.addEventListener('click', () => setView(b.dataset.view)));

document.getElementById('btn-reset').addEventListener('click', () => {
  sectionSlider.value = sectionSlider.max;
  sectionPlane.constant = parseFloat(sectionSlider.max);
  updateSectionLabel(sectionSlider.max, sectionSlider.max);
  setView('iso');
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

/* ── Iniciar ── */
loadGLB(MODEL_URL);
