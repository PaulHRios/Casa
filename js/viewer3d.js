/* ══════════════════════════════════════════════════════════
   VISOR 3D — Three.js + OrbitControls + loaders
   FIX: FrontSide + polygonOffset → sin artefactos SketchUp
   FIX: clipping plane para corte de sección (slider)
══════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { OrbitControls }   from 'three/addons/controls/OrbitControls.js';
import { OBJLoader }       from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader }      from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const INCH_TO_M  = 0.0254;
const MODEL_URL  = 'assets/models/dibujo-3d.glb';

const container  = document.getElementById('canvas-3d');
const loaderEl   = document.getElementById('model-loader');

/* ── Escena ── */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f1a);

const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 5000);
camera.position.set(12, 10, 16);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.toneMapping       = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
/* ← habilitar clipping por material */
renderer.localClippingEnabled = true;
container.appendChild(renderer.domElement);

/* ── Plano de corte (section cut) ── */
/* Plane(normal, constant): mantiene puntos donde normal·p + constant ≥ 0
   Con normal (0,-1,0) y constant h → mantiene y ≤ h (todo lo que está BAJO h) */
const sectionPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6);

/* ── Material arquitectónico ──────────────────────────────
   FrontSide: solo renderiza caras con normal apuntando al
   observador; evita el z-fighting de las dobles caras de
   SketchUp (que exporta frente + reverso de cada superficie).
   polygonOffset: separa ligeramente coplanares residuales.   */
const defaultMat = new THREE.MeshStandardMaterial({
  color:         0xd9cfc0,
  roughness:     0.72,
  metalness:     0.03,
  side:          THREE.FrontSide,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits:  1,
  clippingPlanes: [sectionPlane],
});

/* ── Iluminación ── */
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

scene.add(new THREE.HemisphereLight(0xffffff, 0x33384d, 0.55));

const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(18, 30, 16);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near   = 0.5;
sun.shadow.camera.far    = 200;
sun.shadow.camera.left   = -40;
sun.shadow.camera.right  = 40;
sun.shadow.camera.top    = 40;
sun.shadow.camera.bottom = -40;
sun.shadow.bias = -0.0003;
scene.add(sun);

/* fill desde frente-abajo para iluminar interiores al cortar */
const fill = new THREE.DirectionalLight(0x8aa4c8, 0.7);
fill.position.set(-8, 2, 12);
scene.add(fill);

/* ── Piso + grid ── */
const groundMat = new THREE.ShadowMaterial({ opacity: 0.22 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(100, 100, 0x2e3350, 0x1a1d27);
grid.material.opacity     = 0.35;
grid.material.transparent = true;
scene.add(grid);

/* ── OrbitControls ── */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping    = true;
controls.dampingFactor    = 0.08;
controls.screenSpacePanning = false;
controls.maxPolarAngle    = Math.PI / 2 + 0.06;
controls.target.set(0, 1, 0);

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
let currentModel  = null;
let modelMeshes   = [];
let modelRadius   = 10;
let modelHeight   = 4;    // se actualiza tras carga

function clearModel() {
  if (currentModel) { scene.remove(currentModel); currentModel = null; }
  modelMeshes = [];
}

function processModel(object3d, scaleToMeters) {
  clearModel();
  if (scaleToMeters) object3d.scale.setScalar(INCH_TO_M);

  object3d.traverse(child => {
    if (!child.isMesh) return;
    child.material     = defaultMat;
    child.castShadow   = true;
    child.receiveShadow = true;
    if (!child.geometry.attributes.normal) child.geometry.computeVertexNormals();
    modelMeshes.push(child);
  });

  /* centrar y apoyar sobre el piso */
  const box    = new THREE.Box3().setFromObject(object3d);
  const center = box.getCenter(new THREE.Vector3());
  const size   = box.getSize(new THREE.Vector3());

  object3d.position.x -= center.x;
  object3d.position.z -= center.z;
  object3d.position.y -= box.min.y;

  scene.add(object3d);
  currentModel = object3d;

  modelRadius = 0.5 * Math.hypot(size.x, size.y, size.z) || 10;
  grid.scale.setScalar(Math.max(size.x, size.z) * 2.2 / 100);

  /* ── configurar slider de corte ── */
  modelHeight = size.y;
  const maxH  = +(modelHeight * 1.05).toFixed(2);
  sectionSlider.max   = maxH;
  sectionSlider.value = maxH;
  sectionPlane.constant = maxH;   /* sin corte al arrancar */
  updateSectionLabel(maxH, maxH);
  document.getElementById('section-bar').style.display = 'flex';

  setView('iso');
  loaderEl.classList.add('hidden');
}

/* distancia de cámara para encuadrar el modelo */
function fitDistance() {
  return (modelRadius / Math.sin(camera.fov * Math.PI / 360)) * 1.15;
}

/* ── Carga GLB ── */
function loadGLB(url) {
  new GLTFLoader().load(url,
    gltf => processModel(gltf.scene, true),
    xhr => {
      if (xhr.total) loaderEl.querySelector('p').textContent =
        `Cargando modelo 3D… ${Math.round(xhr.loaded / xhr.total * 100)}%`;
    },
    err => { console.warn('GLB falló, intentando OBJ…', err); loadOBJ(url.replace('.glb','.obj')); }
  );
}

function loadOBJ(url) {
  new OBJLoader().load(url,
    obj => processModel(obj, true),
    undefined,
    err => {
      console.error('Error cargando modelo:', err);
      loaderEl.querySelector('p').textContent = 'No se pudo cargar el modelo.';
    }
  );
}

function loadFromFile(file) {
  const name = file.name.toLowerCase();
  loaderEl.classList.remove('hidden');
  loaderEl.querySelector('p').textContent = 'Cargando modelo…';
  const reader = new FileReader();
  if (name.endsWith('.obj')) {
    reader.onload = e => processModel(new OBJLoader().parse(e.target.result), false);
    reader.readAsText(file);
  } else {
    reader.onload = e => new GLTFLoader().parse(e.target.result, '',
      gltf => processModel(gltf.scene, false));
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
   SECCIÓN (CORTE)
══════════════════════════════════════ */
const sectionSlider = document.getElementById('section-slider');
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
function setView(kind) {
  const r = fitDistance();
  const c = new THREE.Vector3(0, modelHeight / 2, 0);
  if (currentModel) {
    const box = new THREE.Box3().setFromObject(currentModel);
    box.getCenter(c);
  }
  controls.target.copy(c);
  switch (kind) {
    case 'top':   camera.position.set(c.x, c.y + r,         c.z + 0.001); break;
    case 'front': camera.position.set(c.x, c.y + r * 0.22,  c.z + r);     break;
    case 'side':  camera.position.set(c.x + r, c.y + r * 0.22, c.z);      break;
    default:      camera.position.set(c.x + r * 0.72, c.y + r * 0.55, c.z + r * 0.72); // iso
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
  modelMeshes.forEach(m => { m.material.wireframe = wireOn; });
});

/* ══════════════════════════════════════
   MEDICIÓN
══════════════════════════════════════ */
let measuring    = false;
let measurePts   = [];
let measureObjs  = [];
const raycaster  = new THREE.Raycaster();
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
    new THREE.SphereGeometry(modelRadius * 0.008, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x4f8ef7, depthTest: false })
  );
  s.position.copy(p);
  s.renderOrder = 999;
  scene.add(s);
  measureObjs.push(s);
}

renderer.domElement.addEventListener('pointerdown', ev => {
  if (!measuring || ev.button !== 0) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((ev.clientX - rect.left) / rect.width)  * 2 - 1,
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
  addMarker(pt);
  measurePts.push(pt);

  if (measurePts.length === 2) {
    const d = measurePts[0].distanceTo(measurePts[1]);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(measurePts),
      new THREE.LineBasicMaterial({ color: 0x4f8ef7, depthTest: false })
    );
    line.renderOrder = 999;
    scene.add(line);
    measureObjs.push(line);
    measureValue.textContent = d.toFixed(2) + ' m';
    measureDisplay.classList.remove('hidden');
  }
}, true);

/* ── Arranque ── */
loadGLB(MODEL_URL);
