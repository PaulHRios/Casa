/* ══════════════════════════════════════════════════════════
   VISOR 3D — Three.js (módulos ES) + OrbitControls + loaders
   - Carga automática de assets/models/dibujo-3d.glb
   - Escala el modelo a metros (origen en pulgadas)
   - Rotación / zoom / paneo, medición, vistas predefinidas
══════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader }     from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader }    from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const INCH_TO_M = 0.0254;            // el modelo SketchUp está en pulgadas
const MODEL_URL = 'assets/models/dibujo-3d.glb';

const container = document.getElementById('canvas-3d');
const loaderEl  = document.getElementById('model-loader');

/* ── Escena ── */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f1a);

const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 5000);
camera.position.set(12, 10, 16);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.appendChild(renderer.domElement);

/* ── Iluminación de entorno (PBR) ── */
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const hemi = new THREE.HemisphereLight(0xffffff, 0x33384d, 0.6);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(20, 35, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 200;
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
sun.shadow.bias = -0.0003;
scene.add(sun);

/* ── Piso + grid ── */
const groundMat = new THREE.ShadowMaterial({ opacity: 0.28 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(100, 100, 0x2e3350, 0x1a1d27);
grid.material.opacity = 0.35;
grid.material.transparent = true;
scene.add(grid);

/* ── Controles ── */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = false;
controls.maxPolarAngle = Math.PI / 2 + 0.05;
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

/* ── Loop ── */
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

/* ══════════════════════════════════════════
   CARGA DE MODELO
══════════════════════════════════════════ */
let currentModel = null;
let modelMeshes = [];
let modelRadius = 10;

const defaultMat = new THREE.MeshStandardMaterial({
  color: 0xcdbfa6, roughness: 0.75, metalness: 0.04, side: THREE.DoubleSide,
});

function clearModel() {
  if (currentModel) { scene.remove(currentModel); currentModel = null; }
  modelMeshes = [];
}

function processModel(object3d, scaleToMeters) {
  clearModel();

  if (scaleToMeters) object3d.scale.setScalar(INCH_TO_M);

  // material arquitectónico uniforme + sombras
  object3d.traverse(child => {
    if (child.isMesh) {
      child.material = defaultMat;
      child.castShadow = true;
      child.receiveShadow = true;
      if (!child.geometry.attributes.normal) child.geometry.computeVertexNormals();
      modelMeshes.push(child);
    }
  });

  // centrar y apoyar sobre el piso
  const box = new THREE.Box3().setFromObject(object3d);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  object3d.position.x -= center.x;
  object3d.position.z -= center.z;
  object3d.position.y -= box.min.y;

  scene.add(object3d);
  currentModel = object3d;

  // radio de la esfera envolvente (para encuadre y sombras)
  modelRadius = 0.5 * Math.hypot(size.x, size.y, size.z) || 10;

  // ajustar grid/piso al tamaño
  const gh = Math.max(size.x, size.z) * 2.2;
  grid.scale.setScalar(gh / 100);

  setView('iso');
  loaderEl.classList.add('hidden');
}

/* distancia de cámara que encuadra toda la escena */
function fitDistance() {
  const fov = camera.fov * Math.PI / 180;
  return (modelRadius / Math.sin(fov / 2)) * 1.15;
}

function loadGLB(url) {
  const loader = new GLTFLoader();
  loader.load(url,
    gltf => processModel(gltf.scene, true),
    xhr => {
      if (xhr.total) {
        const pct = Math.round((xhr.loaded / xhr.total) * 100);
        loaderEl.querySelector('p').textContent = `Cargando modelo 3D… ${pct}%`;
      }
    },
    err => {
      console.warn('No se pudo cargar GLB, intento OBJ…', err);
      loadOBJ('assets/models/dibujo-3d.obj');
    }
  );
}

function loadOBJ(url) {
  const loader = new OBJLoader();
  loader.load(url,
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
  const reader = new FileReader();
  loaderEl.classList.remove('hidden');
  loaderEl.querySelector('p').textContent = 'Cargando modelo…';

  if (name.endsWith('.obj')) {
    reader.onload = e => {
      const obj = new OBJLoader().parse(e.target.result);
      processModel(obj, false);
    };
    reader.readAsText(file);
  } else if (name.endsWith('.glb') || name.endsWith('.gltf')) {
    reader.onload = e => {
      new GLTFLoader().parse(e.target.result, '', gltf => processModel(gltf.scene, false));
    };
    reader.readAsArrayBuffer(file);
  }
}

document.getElementById('obj-upload').addEventListener('change', e => {
  if (e.target.files[0]) loadFromFile(e.target.files[0]);
});

// drag & drop
const sec3d = document.getElementById('section-3d');
sec3d.addEventListener('dragover', e => e.preventDefault());
sec3d.addEventListener('drop', e => {
  e.preventDefault();
  if (e.dataTransfer.files[0]) loadFromFile(e.dataTransfer.files[0]);
});

/* ══════════════════════════════════════════
   VISTAS PREDEFINIDAS
══════════════════════════════════════════ */
function setView(kind) {
  const r = fitDistance();
  const c = controls.target.clone();
  if (currentModel) {
    const box = new THREE.Box3().setFromObject(currentModel);
    box.getCenter(c);
  }
  controls.target.copy(c);
  switch (kind) {
    case 'top':   camera.position.set(c.x, c.y + r, c.z + 0.001); break;
    case 'front': camera.position.set(c.x, c.y + r * 0.25, c.z + r); break;
    case 'side':  camera.position.set(c.x + r, c.y + r * 0.25, c.z); break;
    default:      camera.position.set(c.x + r * 0.75, c.y + r * 0.6, c.z + r * 0.75); // iso
  }
  controls.update();
}

document.querySelectorAll('.preset-btn').forEach(b =>
  b.addEventListener('click', () => setView(b.dataset.view)));

document.getElementById('btn-reset').addEventListener('click', () => setView('iso'));

/* ── Toggle malla (wireframe) ── */
let wireOn = false;
document.getElementById('btn-wire').addEventListener('click', () => {
  wireOn = !wireOn;
  document.getElementById('btn-wire').classList.toggle('active', wireOn);
  modelMeshes.forEach(m => {
    if (Array.isArray(m.material)) m.material.forEach(mm => mm.wireframe = wireOn);
    else m.material.wireframe = wireOn;
  });
});

/* ══════════════════════════════════════════
   HERRAMIENTA DE MEDICIÓN
══════════════════════════════════════════ */
let measuring = false;
let measurePts = [];
let measureObjs = [];
const raycaster = new THREE.Raycaster();
const measureDisplay = document.getElementById('measure-display');
const measureValue = document.getElementById('measure-value');
const btnMeasure = document.getElementById('btn-measure');

btnMeasure.addEventListener('click', () => {
  measuring = !measuring;
  btnMeasure.classList.toggle('active', measuring);
  controls.enabled = !measuring ? true : true; // mantener navegación
  if (!measuring) clearMeasure();
  renderer.domElement.style.cursor = measuring ? 'crosshair' : '';
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
    new THREE.MeshBasicMaterial({ color: 0x4f8ef7 })
  );
  s.position.copy(p);
  scene.add(s);
  measureObjs.push(s);
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
  if (hits.length) pt = hits[0].point.clone();
  else {
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
      new THREE.LineBasicMaterial({ color: 0x4f8ef7 })
    );
    scene.add(line);
    measureObjs.push(line);
    measureValue.textContent = d.toFixed(2) + ' m';
    measureDisplay.classList.remove('hidden');
  }
}, true);

/* ── Arranque: cargar modelo del repo ── */
loadGLB(MODEL_URL);
