// Model loading: Draco + GLTF, a small queue that fetches the island in view first, and prop() to place a model.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { N } from './props.js?v=58';
import { current } from './main.js?v=58';

/* ---------- generated models ---------- */
// Each prop loads on top of a hand-built stand-in, which it replaces once ready.
// If a model fails to load, the stand-in simply stays.
// The models are Draco-compressed; the decoder (wasm) is vendored next to three.js.
const draco = new DRACOLoader().setDecoderPath('vendor/three/addons/libs/draco/').setDecoderConfig({ type: 'wasm' });
draco.preload(); // fetch the decoder now, alongside the first models
const gltf = new GLTFLoader().setDRACOLoader(draco);
// Staged loading: models are fetched a few at a time, those for the island in view
// (and its neighbours) first. `where` is a realm index, or { hops } for things that
// are not on one island (the Rukh).
const models = {}, wants = {}, queue = [];
const LOAD_AT_ONCE = 3;
let active = 0, done = 0, pumpSoon = 0;
const loadBar = document.getElementById('loading');
const hops = (w) => {
  if (typeof w !== 'number') return w.hops;
  const here = Math.max(current, 0), d = Math.abs(w - here);
  return Math.min(d, N - d);
};
const priority = (name) => Math.min(...[...wants[name]].map(hops));
function showProgress() {
  if (!loadBar) return;
  const total = Object.keys(models).length;
  loadBar.style.setProperty('--p', total ? done / total : 0);
  loadBar.setAttribute('aria-valuenow', String(Math.round((done / Math.max(total, 1)) * 100)));
  if (total && done === total) loadBar.classList.add('done');
}
function pump() {
  pumpSoon = 0;
  queue.sort((a, b) => priority(a.name) - priority(b.name));
  while (active < LOAD_AT_ONCE && queue.length) {
    const job = queue.shift(); active++;
    // The next download starts as soon as this one arrives, while it is still being decoded.
    const bytes = fetch(`assets/models/${job.name}.glb?v=58`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
      .finally(() => { active--; pump(); });
    bytes.then((buf) => gltf.parseAsync(buf, 'assets/models/'))
      .then(job.resolve, (err) => { console.warn(`model ${job.name} failed to load; keeping its stand-in`, err); job.reject(err); })
      .finally(() => { done++; showProgress(); });
  }
}
// Re-sort the queue (e.g. after travelling) on the next tick; also defers the first
// fetch until the whole scene, and `current`, exist.
const schedulePump = () => { pumpSoon ||= setTimeout(pump, 0); };
function loadModel(name, where = { hops: 2 }) {
  (wants[name] ||= new Set()).add(where);
  models[name] ||= new Promise((resolve, reject) => queue.push({ name, resolve, reject }));
  schedulePump();
  return models[name];
}
const blobTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
function prop(g, name, { h, w, x = 0, y = 0.3, z = 0, ry = 0, lit = 0, replace = [], onLoad } = {}) {
  loadModel(name, g.userData.realm).then((res) => {
    const m = res.scene.clone();
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const holder = new THREE.Group();
    m.position.set(-c.x, -box.min.y, -c.z);
    holder.add(m);
    holder.scale.setScalar(h ? h / size.y : w / Math.max(size.x, size.z));
    holder.position.set(x, y, z); holder.rotation.y = ry;
    m.traverse((o) => {
      o.userData.realm = g.userData.realm;
      if (o.isMesh) { // lit by the scene like everything else
        const mt = o.material;
        mt.metalness = 0; mt.roughness = 0.9;
        if (lit) { mt.emissive = new THREE.Color(0xffffff); mt.emissiveMap = mt.map; mt.emissiveIntensity = lit; }
        o.castShadow = true; o.receiveShadow = true;
      }
    });
    replace.forEach((o) => o.parent && o.parent.remove(o));
    const foot = Math.max(size.x, size.z) * holder.scale.x;
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(foot * 1.15, foot * 1.15), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.set(x, y + 0.03, z);
    g.add(holder, blob);
    if (onLoad) onLoad(holder);
  }).catch(() => { /* keep the stand-in */ });
}

export { hops, loadModel, prop, schedulePump };
