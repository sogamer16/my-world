import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import * as D from './data.js?v=51';
import { map as MAP } from './worldmap.js?v=51';

const TAU = Math.PI * 2;
const RING = 46;
const N = D.realms.length;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// The page fonts stylesheet loads without blocking paint (index.html), so text drawn into
// canvas textures waits for it first; otherwise document.fonts would report ready too early.
const pageFonts = new Promise((ok) => {
  const l = document.getElementById('page-fonts');
  if (!l || l.media === 'all') ok(); else { l.addEventListener('load', ok); l.addEventListener('error', ok); }
}).then(() => document.fonts.ready);

/* ================================================================== */
/*  Renderer, scene, camera                                            */
/* ================================================================== */
const canvas = document.getElementById('world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
let maxDpr = Math.min(devicePixelRatio, innerWidth <= 820 ? 1.75 : 2);
renderer.setPixelRatio(maxDpr);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0718, 0.006);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 900);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.45, 0.88);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const hemi = new THREE.HemisphereLight(0x8f7dff, 0x1a0f2e, 0.9);
scene.add(hemi);
// One sun (or moon) that follows whichever island you are looking at, so its shadows stay sharp.
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(innerWidth <= 820 ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 120 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 4;
scene.add(sun, sun.target);

/* ---------- sky ---------- */
// The light of each place: sky, clouds, sun, fog and ambient all drift toward the land you are in —
// golden afternoon over Makkah, overcast sea light over Swansea, blue hour over Melbourne.
const skyU = {
  low: { value: new THREE.Vector3() }, mid: { value: new THREE.Vector3() }, top: { value: new THREE.Vector3() },
  haze: { value: new THREE.Vector3() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() },
  cloudCol: { value: new THREE.Color() }, cloudAmt: { value: 0 }, disc: { value: 0 }, time: { value: 0 },
};
const keys = ['sunI', 'elev', 'side', 'hemiI', 'fogD', 'cloudAmt', 'disc', 'stars', 'exposure', 'below'];
const mood = { sky: [0, 1, 2, 3].map(() => new THREE.Vector3()), fog: new THREE.Color(), hs: new THREE.Color(), hg: new THREE.Color(), sun: new THREE.Color(), cloud: new THREE.Color() };
keys.forEach((k) => { mood[k] = 0; });
function moodOf(key) {
  const l = D.lands[key] || D.lands.neutral;
  return {
    sky: l.sky.map((c) => new THREE.Vector3(...c)), fog: new THREE.Color(l.fog[0]), hs: new THREE.Color(l.hemi[0]), hg: new THREE.Color(l.hemi[1]),
    sun: new THREE.Color(l.sun[0]), cloud: new THREE.Color(l.clouds[0]),
    sunI: l.sun[1], elev: THREE.MathUtils.degToRad(l.sun[2]), side: l.sun[3], hemiI: l.hemi[2], fogD: l.fog[1],
    cloudAmt: l.clouds[1], disc: l.disc, stars: l.stars, exposure: l.exposure, below: l.below,
  };
}
function applyMood(target, k) {
  mood.sky.forEach((v, i) => v.lerp(target.sky[i], k));
  ['fog', 'hs', 'hg', 'sun', 'cloud'].forEach((n) => mood[n].lerp(target[n], k));
  keys.forEach((n) => { mood[n] += (target[n] - mood[n]) * k; });
  ['low', 'mid', 'top', 'haze'].forEach((n, i) => skyU[n].value.copy(mood.sky[i]));
  skyU.sunCol.value.copy(mood.sun); skyU.cloudCol.value.copy(mood.cloud);
  skyU.cloudAmt.value = mood.cloudAmt; skyU.disc.value = mood.disc;
  scene.fog.color.copy(mood.fog); scene.fog.density = mood.fogD;
  hemi.color.copy(mood.hs); hemi.groundColor.copy(mood.hg); hemi.intensity = mood.hemiI;
  sun.color.copy(mood.sun); sun.intensity = lowPower ? mood.sunI * 0.8 : mood.sunI;
  renderer.toneMappingExposure = mood.exposure;
}
const GLSL_NOISE = `
  float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float n3(vec3 p){
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n3(p); p *= 2.03; a *= 0.5; } return s; }`;
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(600, 48, 24),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 p; uniform vec3 low, mid, top, haze, sunDir, sunCol, cloudCol; uniform float cloudAmt, disc, time;
      ${GLSL_NOISE}
      void main(){
        vec3 d = normalize(p); float h = d.y;
        vec3 c = mix(low, mid, smoothstep(-0.15, 0.18, h));
        c = mix(c, top, smoothstep(0.12, 0.8, h));
        float sd = max(dot(d, sunDir), 0.0);
        c += haze * (pow(sd, 5.0) * 0.55 + exp(-abs(h + 0.02) * 8.0) * 0.18);
        c += sunCol * 3.0 * smoothstep(0.9988, 0.9995, sd) * disc;
        if (h > -0.08) {
          vec2 uv = d.xz / (h + 0.22);
          float n = fbm(vec3(uv * 0.9 + vec2(time * 0.006, 0.0), time * 0.004));
          float m = smoothstep(0.62 - cloudAmt * 0.42, 0.82 - cloudAmt * 0.3, n) * smoothstep(-0.08, 0.1, h);
          vec3 cc = cloudCol * (0.62 + 0.45 * n + 0.6 * pow(sd, 3.0));
          c = mix(c, cc, m * 0.92);
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
  }),
));

// What lies far below each island: Hejaz dunes, the Swansea sea, Melbourne's lights, and dark night water.
const groundU = {
  time: { value: 0 }, fogCol: { value: new THREE.Color() }, fogD: { value: 0.006 },
  kind: { value: 0 }, angles: { value: [] }, kinds: { value: [] }, sunCol: { value: new THREE.Color() },
};
const below = new THREE.Mesh(new THREE.CircleGeometry(420, 96), new THREE.ShaderMaterial({
  uniforms: groundU, depthWrite: true,
  vertexShader: 'varying vec3 w; void main(){ vec4 q = modelMatrix * vec4(position,1.0); w = q.xyz; gl_Position = projectionMatrix * viewMatrix * q; }',
  fragmentShader: `varying vec3 w; uniform float time, fogD; uniform vec3 fogCol, sunCol; uniform float kind;
    ${GLSL_NOISE}
    vec3 kindColor(float k, vec2 q){
      if (k < 0.5) { // dunes
        float r = sin(q.x * 0.09 + q.y * 0.05 + fbm(vec3(q * 0.02, 1.0)) * 5.0);
        return mix(vec3(0.42, 0.24, 0.11), vec3(0.95, 0.62, 0.32), 0.5 + 0.5 * r) * (0.75 + 0.3 * fbm(vec3(q * 0.08, 2.0)));
      }
      if (k < 1.5) { // grey-green sea with slow swell
        float n = fbm(vec3(q * 0.035, time * 0.08));
        return mix(vec3(0.05, 0.11, 0.13), vec3(0.20, 0.30, 0.32), n) + vec3(0.5) * smoothstep(0.72, 0.8, n) * 0.25;
      }
      if (k < 2.5) { // the city at dusk: districts of window lights joined by winding lit roads
        float dist = fbm(vec3(q * 0.012, 5.0));
        float road = 1.0 - smoothstep(0.0, 0.012, abs(fbm(vec3(q * 0.008, 9.0)) - 0.5) * 1.6);
        road += 1.0 - smoothstep(0.0, 0.01, abs(fbm(vec3(q * 0.006 + 40.0, 2.0)) - 0.5) * 1.6);
        vec2 c2 = q * 0.55, cf = fract(c2) - 0.5, cid = floor(c2);
        float on = step(1.15 - dist * 0.75, h3(vec3(cid, 3.0)));
        float dotL = on * smoothstep(0.3, 0.0, length(cf));
        vec3 warm = mix(vec3(1.0, 0.6, 0.26), vec3(0.85, 0.9, 1.0), step(0.75, h3(vec3(cid, 7.0))));
        vec3 base = vec3(0.02, 0.022, 0.05) + vec3(0.35, 0.18, 0.08) * smoothstep(0.45, 0.8, dist) * 0.35;
        return base + road * vec3(1.0, 0.62, 0.3) * 0.32 + dotL * warm * 0.9;
      }
      float n = fbm(vec3(q * 0.03, time * 0.05)); // night water
      return mix(vec3(0.01, 0.01, 0.04), vec3(0.06, 0.05, 0.16), n) + vec3(0.6, 0.6, 1.0) * smoothstep(0.75, 0.8, n) * 0.15;
    }
    void main(){
      float k0 = floor(kind);
      vec3 c = mix(kindColor(k0, w.xz), kindColor(min(k0 + 1.0, 3.0), w.xz), kind - k0);
      float dist = length(w - cameraPosition);
      float f = 1.0 - exp(-pow(fogD * dist * 0.85, 2.0));
      gl_FragColor = vec4(mix(c, fogCol, clamp(f, 0.0, 1.0)), 1.0);
    }`,
}));
below.rotation.x = -Math.PI / 2; below.position.y = -46;
scene.add(below);

function points(count, place, size, color, opacity = 1) {
  const pos = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) { place(v, i); pos.set([v.x, v.y, v.z], i * 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({
    size, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, sizeAttenuation: size > 0.5 ? false : true,
  }));
}
const stars = points(2600, (v) => v.setFromSphericalCoords(520, Math.acos(THREE.MathUtils.randFloat(-0.5, 1)), Math.random() * TAU), 1.6, 0xffffff, 0.9);
scene.add(stars);
const motes = points(900, (v) => {
  const a = Math.random() * TAU, r = RING + THREE.MathUtils.randFloatSpread(44);
  v.set(Math.cos(a) * r, THREE.MathUtils.randFloat(-14, 26), Math.sin(a) * r);
}, 0.16, 0xffd9a0, 0.6);
scene.add(motes);

// a sea of soft cloud far below the islands, for depth
const cloudTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const clouds = new THREE.Group();
for (let i = 0; i < 70; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: cloudTex, color: 0xffffff, transparent: true, opacity: 0.12 + Math.random() * 0.12, depthWrite: false, fog: false,
  }));
  const a = Math.random() * TAU, r = 10 + Math.random() * 95;
  s.position.set(Math.cos(a) * r, -24 - Math.random() * 14, Math.sin(a) * r);
  s.scale.set(40 + Math.random() * 40, 14 + Math.random() * 10, 1);
  s.userData.base = s.material.opacity; clouds.add(s);
}
scene.add(clouds);

// a crescent (hilal) rather than a full moon over the night islands
const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.shadowColor = 'rgba(255,248,220,0.9)'; x.shadowBlur = 24; x.fillStyle = '#fff6dc';
  x.beginPath(); x.arc(128, 128, 84, 0, Math.PI * 2); x.fill();
  x.globalCompositeOperation = 'destination-out'; x.shadowBlur = 0;
  x.beginPath(); x.arc(162, 104, 78, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})(), transparent: true, fog: false, depthWrite: false }));
moon.scale.setScalar(70);
moon.position.set(-150, 150, -300);
scene.add(moon);

/* ================================================================== */
/*  Builders                                                           */
/* ================================================================== */
const spin = [];   // { o, x, y, z } rotated every frame
const bob = [];    // { o, y, amp, speed, phase }
const tick = [];   // fn(t, dt)
const skillNodes = new Map(); // 'bough-skill' -> { node, mat, r, base, bough, s }
const skillBoughs = [];
let skillLit = null;          // the skill being pointed at, in the panel or in the sky
function lightSkill(key) {
  skillLit = key && skillNodes.has(key) ? key : null;
  panel.querySelectorAll('.skill.lit').forEach((el) => el.classList.remove('lit'));
  if (skillLit) panel.querySelector(`.skill[data-skill="${skillLit}"]`)?.classList.add('lit');
}
tick.push((t, dt) => {
  if (!skillNodes.size) return;
  const k = 1 - Math.exp(-dt * 10), lit = skillLit && skillNodes.get(skillLit);
  for (const [key, n] of skillNodes) {
    const on = key === skillLit;
    const s = on ? 2.1 : lit ? 0.8 : 1;
    n.s += (s - n.s) * k; n.node.scale.setScalar(n.r * n.s);
    const e = on ? n.base * 2.4 : lit ? (lit.bough !== n.bough ? n.base * 0.35 : n.base) : n.bough === school ? n.base * 1.15 : n.base * 0.55;
    n.mat.emissiveIntensity += (e - n.mat.emissiveIntensity) * k;
  }
  skillBoughs.forEach((b, i) => {
    const e = lit ? (lit.bough === i ? 1.1 : 0.2) : i === school ? 0.95 : 0.3;
    b.mat.emissiveIntensity += (e - b.mat.emissiveIntensity) * k;
  });
});

const glow = (color, intensity = 1.6, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.35, metalness: 0.2, flatShading: true, ...opts });
const stone = (color = 0x3b3555) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true });

function jitter(geo, amt) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    const f = (n - Math.floor(n) - 0.5) * amt;
    p.setXYZ(i, x + f, y + f * 0.5, z - f);
  }
  geo.computeVertexNormals();
  return geo;
}

// small value-noise helpers for shaping islands
const hash3 = (x, y, z) => { const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return n - Math.floor(n); };
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const s = (t) => t * t * (3 - 2 * t), fx = s(x - xi), fy = s(y - yi), fz = s(z - zi);
  const L = THREE.MathUtils.lerp, h = (a, b, c) => hash3(xi + a, yi + b, zi + c);
  return L(L(L(h(0, 0, 0), h(1, 0, 0), fx), L(h(0, 1, 0), h(1, 1, 0), fx), fy), L(L(h(0, 0, 1), h(1, 0, 1), fx), L(h(0, 1, 1), h(1, 1, 1), fx), fy), fz);
}
const fbm = (x, y, z) => vnoise(x, y, z) * 0.57 + vnoise(x * 2.1, y * 2.1, z * 2.1) * 0.29 + vnoise(x * 4.3, y * 4.3, z * 4.3) * 0.14;

function island(color, landKey, seed = 0) {
  const land = D.lands[landKey] || D.lands.neutral;
  const g = new THREE.Group();
  // A sculpted floating island: an irregular grassy or sandy top over layered, tapering cliffs.
  const S = 72, K = 9, LV = 11, DEPTH = 7.8;
  const edge = (a) => 6.3 * (0.9 + 0.17 * fbm(Math.cos(a) * 1.4 + seed, Math.sin(a) * 1.4 + seed, seed * 0.7));
  const heightAt = (x, z, f) => 0.3 + 0.16 * (fbm(x * 0.32 + seed, seed, z * 0.32) - 0.5) - 0.3 * THREE.MathUtils.smoothstep(f, 0.84, 1);
  const gc = new THREE.Color(land.ground), rc = new THREE.Color(land.rock), dirt = gc.clone().lerp(rc, 0.5), c = new THREE.Color();
  const tp = [0, heightAt(0, 0, 0), 0], tc = [gc.r, gc.g, gc.b], ti = [];
  for (let k = 1; k <= K; k++) {
    const f = k / K;
    for (let i = 0; i < S; i++) {
      const a = (i / S) * TAU, r = edge(a) * f, x = Math.cos(a) * r, z = Math.sin(a) * r;
      tp.push(x, heightAt(x, z, f), z);
      c.copy(gc).multiplyScalar(0.84 + 0.3 * fbm(x * 0.55, seed + 3, z * 0.55)).lerp(dirt, THREE.MathUtils.smoothstep(f, 0.8, 1) * 0.75);
      tc.push(c.r, c.g, c.b);
    }
  }
  const v = (k, i) => (k === 0 ? 0 : 1 + (k - 1) * S + (i % S));
  for (let i = 0; i < S; i++) ti.push(0, v(1, i + 1), v(1, i));
  for (let k = 2; k <= K; k++) for (let i = 0; i < S; i++) ti.push(v(k - 1, i), v(k, i + 1), v(k, i), v(k - 1, i), v(k - 1, i + 1), v(k, i + 1));
  const topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
  topGeo.setAttribute('color', new THREE.Float32BufferAttribute(tc, 3));
  topGeo.setIndex(ti); topGeo.computeVertexNormals();
  const top = new THREE.Mesh(topGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  top.receiveShadow = true; top.castShadow = true;

  const up = [], uc = [], ui = [];
  for (let l = 0; l <= LV; l++) {
    const t = l / LV;
    for (let i = 0; i < S; i++) {
      const a = (i / S) * TAU, e = edge(a), x0 = Math.cos(a), z0 = Math.sin(a);
      const n = fbm(x0 * 2 + seed, t * 3.2, z0 * 2 + seed) - 0.5;
      const r = l === LV ? 0 : e * Math.pow(1 - t, 0.72) * (1 + n * 0.35 * Math.min(1, t * 5));
      const y = l === 0 ? heightAt(x0 * e, z0 * e, 1) : 0.05 - DEPTH * Math.pow(t, 1.15) + n * 0.5;
      up.push(x0 * r, y, z0 * r);
      const strata = 0.78 + 0.22 * Math.sin(y * 2.3 + n * 6);
      c.copy(rc).multiplyScalar(strata * (1 - 0.5 * t));
      if (t < 0.12) c.lerp(dirt, 0.7);
      if (landKey === 'gower' && n > 0.08 && t < 0.5) c.lerp(new THREE.Color(0x4f7a3e), 0.45); // moss on the cliffs
      uc.push(c.r, c.g, c.b);
    }
  }
  for (let l = 0; l < LV; l++) for (let i = 0; i < S; i++) {
    const a = l * S + i, b = l * S + ((i + 1) % S), d0 = (l + 1) * S + i, d1 = (l + 1) * S + ((i + 1) % S);
    ui.push(a, b, d0, b, d1, d0);
  }
  const rockGeo = new THREE.BufferGeometry();
  rockGeo.setAttribute('position', new THREE.Float32BufferAttribute(up, 3));
  rockGeo.setAttribute('color', new THREE.Float32BufferAttribute(uc, 3));
  rockGeo.setIndex(ui); rockGeo.computeVertexNormals();
  const rock = new THREE.Mesh(rockGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  rock.castShadow = true; rock.receiveShadow = true;
  g.add(top, rock);

  // ground cover: tufts, stones and, in Wales, yellow gorse
  const tuft = new THREE.InstancedMesh(new THREE.ConeGeometry(0.07, 0.38, 4), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), 90);
  const pebble = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.13, 0), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), 26);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
  const place = (mesh, i, minR, colorFn, scale) => {
    const a = hash3(i, seed, 1) * TAU, f = minR + (0.93 - minR) * Math.sqrt(hash3(i, seed, 2)), r = edge(a) * f;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    pv.set(x, heightAt(x, z, f) + 0.12 * scale, z);
    q.setFromEuler(new THREE.Euler((hash3(i, 5, seed) - 0.5) * 0.5, hash3(i, 6, seed) * TAU, (hash3(i, 7, seed) - 0.5) * 0.5));
    sc.setScalar(scale * (0.6 + 0.8 * hash3(i, 8, seed)));
    mesh.setMatrixAt(i, m4.compose(pv, q, sc)); mesh.setColorAt(i, colorFn(i));
  };
  const grass = landKey === 'hejaz' ? new THREE.Color(0x7d7a3a) : gc.clone().multiplyScalar(1.15);
  for (let i = 0; i < 90; i++) place(tuft, i, 0.32, (k) => (landKey === 'gower' && k % 6 === 0 ? new THREE.Color(0xe0b53a) : grass.clone().multiplyScalar(0.8 + 0.4 * hash3(k, 9, seed))), landKey === 'hejaz' ? 0.7 : 1);
  for (let i = 0; i < 26; i++) place(pebble, i + 200, 0.4, (k) => rc.clone().multiplyScalar(1.1 + 0.3 * hash3(k, 4, seed)), 1);
  [tuft, pebble].forEach((m) => { m.castShadow = true; m.receiveShadow = true; m.instanceMatrix.needsUpdate = true; g.add(m); });

  for (let i = 0; i < 4; i++) { // loose rocks drifting beneath
    const d = new THREE.Mesh(jitter(new THREE.DodecahedronGeometry(0.5 + (i % 2) * 0.4), 0.15), stone(new THREE.Color(land.rock).multiplyScalar(0.8).getHex()));
    const a = i * 1.7;
    d.position.set(Math.cos(a) * (7.5 + i), -2 - i * 1.3, Math.sin(a) * (7.5 + i));
    g.add(d); bob.push({ o: d, y: d.position.y, amp: 0.5, speed: 0.5 + i * 0.1, phase: i });
  }
  // stand-in trees in the local style; generated models replace them where they exist
  g.userData.trees = [[-3.3, -4.2, 1.15], [3.0, -4.5, 0.9], [-1.2, -5.2, 0.7], [4.6, -3.0, 0.65]].map(([x, z, k]) => {
    const tree = (localTree[landKey] || localTree.neutral)(color);
    tree.position.set(x, 0.25, z); tree.scale.setScalar(k); g.add(tree);
    return tree;
  });
  return g;
}

/* ---------- archery range ---------- */
const range = { center: new THREE.Vector3(0, 3.5, -0.6), radius: 1.6, group: null, color: 0xffffff, flights: [], stuck: [] };
function arrow(color) { // points along +z: tip at the origin, shaft trailing behind toward -z... flipped on use
  const a = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 5), stone(0xd9c7a0));
  shaft.rotation.x = Math.PI / 2; shaft.position.z = 0.75;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 5), stone(0x9aa3b5));
  tip.rotation.x = -Math.PI / 2; tip.position.z = -0.05;
  a.add(shaft, tip);
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.34), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, side: THREE.DoubleSide }));
    f.position.z = 1.32; f.rotation.set(Math.PI / 2, 0, 0); f.rotation.order = 'ZXY'; f.rotation.z = (i / 3) * TAU;
    f.translateX(0.07); a.add(f);
  }
  return a;
}
function stick(a, x, y) { // embed an arrow in the target face at offset (x, y) from the centre
  a.position.set(range.center.x + x, range.center.y + y, range.center.z + 0.12);
  a.rotation.set(-y * 0.12 + 0.05, x * 0.12, 0);
}
function shoot() {
  if (!range.group) return;
  // gaussian-ish spread; steadier hands land closer to gold
  const r = Math.min(range.radius * 0.98, Math.abs((Math.random() + Math.random() + Math.random() - 1.5) * 1.5));
  const th = Math.random() * TAU;
  const x = Math.cos(th) * r, y = Math.sin(th) * r;
  const a = arrow(range.color);
  range.group.add(a);
  range.flights.push({ a, x, y, t: 0, from: new THREE.Vector3(THREE.MathUtils.randFloatSpread(1.5), 2.4, 17) });
  return Math.max(1, 10 - Math.floor(r / (range.radius / 10)));
}
tick.push((t, dt) => {
  for (const f of range.flights) {
    f.t = Math.min(1, f.t + dt / 0.42);
    const to = new THREE.Vector3(range.center.x + f.x, range.center.y + f.y, range.center.z + 0.12);
    f.a.position.lerpVectors(f.from, to, f.t);
    f.a.position.y += Math.sin(f.t * Math.PI) * 1.1;
    f.a.rotation.set(-Math.cos(f.t * Math.PI) * 0.12, 0, 0);
    if (f.t === 1) { stick(f.a, f.x, f.y); range.stuck.push(f.a); }
  }
  range.flights = range.flights.filter((f) => f.t < 1);
  while (range.stuck.length > 9) range.group.remove(range.stuck.shift());
});

/* ---------- local trees ---------- */
const flat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true });
const localTree = {
  hejaz() { // date palm
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 2.6, 6), flat(0x6e4e30));
    trunk.position.y = 1.3; trunk.rotation.z = 0.08; t.add(trunk);
    const leaf = flat(0x5b7a2c);
    for (let i = 0; i < 7; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.7, 4), leaf);
      f.scale.z = 0.25; f.position.y = 2.55;
      f.rotation.set(0, (i / 7) * TAU, 1.15); f.translateY(0.75); t.add(f);
    }
    return t;
  },
  gower() { // dark pine with yellow gorse at its foot
    const t = localTree.neutral(0x1e4a35);
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), flat(0xd8b23a));
      b.position.set(Math.cos(i * 2.1) * 0.6, 0.25, Math.sin(i * 2.1) * 0.6); t.add(b);
    }
    return t;
  },
  melbourne() { // gum tree: pale trunk, loose grey-green crown
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 2.2, 6), flat(0xd9d2c3));
    trunk.position.y = 1.1; t.add(trunk);
    const leaf = flat(0x5d7562);
    [[0, 2.5, 0, 0.8], [0.5, 2.2, 0.2, 0.55], [-0.45, 2.3, -0.2, 0.6]].forEach(([x, y, z, r]) => {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leaf); b.position.set(x, y, z); t.add(b);
    });
    return t;
  },
  neutral(color = 0x0e2a26) {
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.9, 5), flat(0x3a2718));
    trunk.position.y = 0.45; t.add(trunk);
    const leaf = flat(new THREE.Color(color).multiplyScalar(0.3).add(new THREE.Color(0x0e2a26)));
    [[0.85, 1.3, 1.15], [0.62, 1.1, 1.85], [0.4, 0.9, 2.45]].forEach(([rad, h, y]) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 6), leaf);
      cone.position.y = y; cone.rotation.y = y; t.add(cone);
    });
    return t;
  },
};

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
    const bytes = fetch(`assets/models/${job.name}.glb?v=51`)
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

const build = {
  hero(g) {
    meFigure(g, -0.3, 0.9, 0);
    prop(g, 'anvil', { h: 2.4, x: 3.3, z: 1.6, ry: -0.6 });
  },

  quests(g, color) {
    const pillared = D.quests.filter((q) => !(q.areas || []).includes('games')); // games have the Arcade
    pillared.forEach((q, i) => {
      const a = THREE.MathUtils.mapLinear(i, 0, pillared.length - 1, -1.5, 1.5) + Math.PI / 2;
      const h = 2.8 + (i % 2) * 0.9 + (i === 0 ? 1.2 : 0);
      const m = new THREE.Mesh(jitter(new THREE.BoxGeometry(0.95, h, 0.6, 2, 4, 2), 0.16), stone(0x8a8277));
      m.castShadow = true; m.receiveShadow = true;
      m.position.set(Math.cos(a) * 4.4, h / 2 + 0.2, -Math.sin(a) * 4.4 + 2.4);
      m.rotation.y = a - Math.PI / 2;
      const rune = new THREE.Mesh(new THREE.BoxGeometry(0.16, h * 0.5, 0.04), glow(q.status === 'Active' ? 0x8dffb0 : color, 0.9));
      rune.position.set(0, 0, 0.31); m.add(rune);
      g.add(m);
      prop(g, 'pillar', { h: h * 1.35, x: m.position.x, z: m.position.z, ry: m.rotation.y, replace: [m] }); // the pillars of Iram
    });
    // one pillar has fallen: the whole stands until one part gives way
    prop(g, 'pillar', { h: 3.2, x: 2.2, z: 4.0, ry: -0.25, onLoad: (holder) => {
      holder.rotation.order = 'YXZ'; holder.rotation.z = Math.PI / 2 - 0.06; holder.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(holder), lo = g.worldToLocal(bb.min.clone());
      holder.position.y += 0.3 - lo.y;
    } });
    [[2.6, 4.6], [-1.1, 4.4], [1.1, 4.7]].forEach(([x, z], k) => { // broken pieces
      const r = new THREE.Mesh(jitter(new THREE.DodecahedronGeometry(0.22 + k * 0.05), 0.08), stone(0xc0895a));
      r.position.set(x, 0.42, z); r.castShadow = true; g.add(r);
    });
    const sword = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 0.08), glow(0xdfe8ff, 0.9, { metalness: 0.9 }));
    blade.position.y = 2.2;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.2), glow(0xe3b866, 1));
    guard.position.y = 3.6;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.8), stone(0x2a1d14));
    grip.position.y = 4.05;
    sword.add(blade, guard, grip); sword.position.set(0, 0, 1.2); sword.rotation.z = 0.08;
    g.add(sword);
    prop(g, 'sword', { h: 5, z: 1.3, replace: [sword] });
  },

  skills(g) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.5, 3.4, 6), stone(0x4d4168));
    trunk.position.y = 1.9; g.add(trunk);
    prop(g, 'tree', { h: 5, replace: [trunk] });
    // Three glowing boughs fan out of the crown, one per school (left, up, right), in the colours of the panel's tabs.
    // Along each bough the strongest skills sit nearest the heart; novice ones are hollow.
    const heartAt = new THREE.Vector3(0, 4.7, -0.4);
    const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), glow(0xffffff, 0.9));
    heart.position.copy(heartAt); g.add(heart); spin.push({ o: heart, y: 0.8, x: 0.4 });
    const nb = D.skillTree.length;
    const solid = new THREE.IcosahedronGeometry(1, 1), hollow = new THREE.TorusGeometry(1, 0.2, 6, 18), hitGeo = new THREE.SphereGeometry(0.42, 8, 6);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    D.skillTree.forEach((b, bi) => {
      const lean = (bi - (nb - 1) / 2) * 0.66; // radians from straight up
      const order = b.skills.map((s, si) => ({ s, si })).sort((p, q) => q.s.rank - p.s.rank || p.si - q.si);
      const pts = [heartAt.clone()];
      order.forEach(({ s, si }, k) => {
        const along = 0.85 + k * 0.45;
        const a = lean + Math.sign(lean) * k * 0.025 + Math.sin(k * 1.4 + bi) * 0.06; // the bough curls outward as it grows
        const p = new THREE.Vector3(Math.sin(a) * along, heartAt.y + Math.cos(a) * along * 0.9, heartAt.z + Math.sin(k * 1.7 + bi) * 0.3);
        pts.push(p);
        const r = 0.11 + s.rank * 0.05;
        // novice skills are empty rings, not yet filled in. Thin shapes skip flat shading: their
        // screen-space normals can be zero-length, and the resulting NaN is smeared black by the bloom.
        const mat = s.rank > 1 ? glow(b.color, 0.6 + s.rank * 0.35) : glow(b.color, 1.1, { flatShading: false });
        const node = new THREE.Mesh(s.rank > 1 ? solid : hollow, mat);
        node.scale.setScalar(r); node.position.copy(p);
        const hit = new THREE.Mesh(hitGeo, hitMat); hit.userData.skill = `${bi}-${si}`; node.add(hit); hit.scale.setScalar(1 / r);
        g.add(node);
        skillNodes.set(`${bi}-${si}`, { node, mat, r, base: mat.emissiveIntensity, bough: bi, s: 1 });
        bob.push({ o: node, y: p.y, amp: 0.08, speed: 1.1, phase: k * 0.7 + bi * 2 });
      });
      const curve = new THREE.CatmullRomCurve3(pts);
      const boughMat = glow(b.color, 0.55, { transparent: true, opacity: 0.8, flatShading: false });
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 10, 0.04, 6), boughMat);
      g.add(tube);
      skillBoughs.push({ mat: boughMat, base: 0.55 });
    });
    abqarWisps(g, heartAt);
  },

  trophies(g, color) {
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.8, 0.22, 90, 10), new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.35 }));
    knot.position.y = 2; g.add(knot);
    prop(g, 'trophy', { h: 3.6, z: 0.6, replace: [knot] });
  },

  pursuits(g, color) {
    const T = range.center;
    const leg = (x, z) => {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.6, 5), stone(0x6b5a44));
      l.position.set(x, 1.9, z - 0.5); l.rotation.x = z ? 0.35 : -0.12; l.rotation.z = -x * 0.14; g.add(l);
    };
    leg(-0.9, 0); leg(0.9, 0); leg(0, -1.1);
    const butt = new THREE.Mesh(new THREE.CylinderGeometry(range.radius + 0.25, range.radius + 0.25, 0.35, 28), stone(0x5a4a2c));
    butt.rotation.x = Math.PI / 2; butt.position.set(T.x, T.y, T.z - 0.2); g.add(butt);
    // standard target face: gold, red, blue, black, white — two scoring rings each
    [[0xe8e8ea, 0], [0x1a1a20, 0], [0x2a6fd0, 0], [0xd2382c, 0], [0xf2c230, 0.05]].forEach(([c, e], i) => {
      const ring = new THREE.Mesh(new THREE.CircleGeometry(range.radius * (1 - i / 5), 40),
        new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: e, roughness: 1 }));
      ring.position.set(T.x, T.y, T.z + i * 0.004); g.add(ring);
    });
    // a compound bow standing on its stand beside the target, side-on so its shape reads:
    // a riser that bows forward, short split limbs swept back, eccentric cams, string, cables,
    // a sight and a front stabiliser. Archer's side is -x, target side +x.
    const bow = new THREE.Group();
    const riserMat = new THREE.MeshStandardMaterial({ color: 0x4a5560, metalness: 0.55, roughness: 0.35 });
    const limbMat = new THREE.MeshStandardMaterial({ color: 0x2bb3a6, metalness: 0.2, roughness: 0.4, emissive: 0x0d4a45, emissiveIntensity: 0.6 });
    const camMat = new THREE.MeshStandardMaterial({ color: 0xd2a75a, metalness: 0.85, roughness: 0.3 });
    const stringMat = new THREE.MeshStandardMaterial({ color: 0xfff6e0, roughness: 0.6, emissive: 0x6a6458, emissiveIntensity: 0.6 });
    const rod = (a, b, r, mat, z = 0) => { // a cylinder from point a to point b (x, y)
      const va = new THREE.Vector3(a[0], a[1], z), vb = new THREE.Vector3(b[0], b[1], z), len = va.distanceTo(vb);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
      m.position.copy(va).add(vb).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
      bow.add(m); return m;
    };
    for (const sy of [1, -1]) {
      rod([0, 0.13 * sy], [0.07, 0.38 * sy], 0.045, riserMat); // riser
      rod([0.07, 0.38 * sy], [0.12, 0.62 * sy], 0.04, riserMat);
      for (const z of [-0.035, 0.035]) rod([0.12, 0.62 * sy], [-0.04, 1.02 * sy], 0.022, limbMat, z); // split limbs
      const cam = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 24), camMat);
      cam.position.set(-0.07, 1.05 * sy, 0); cam.scale.set(1, 1.25, 1); bow.add(cam);
      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 8), riserMat);
      axle.rotation.x = Math.PI / 2; axle.position.copy(cam.position); bow.add(axle);
    }
    rod([0, -0.14], [0, 0.14], 0.06, new THREE.MeshStandardMaterial({ color: 0x3a2718, roughness: 0.8 })); // grip
    rod([-0.17, 1.05], [-0.17, -1.05], 0.012, stringMat); // string
    rod([-0.02, 0.98], [0.01, -0.98], 0.006, stringMat, 0.03); // cables
    rod([0.01, 0.98], [-0.02, -0.98], 0.006, stringMat, -0.03);
    rod([0.03, 0.2], [-0.08, 0.2], 0.012, riserMat); // cable guard
    rod([0.06, 0.3], [0.26, 0.3], 0.012, riserMat); // sight bar
    const pin = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 16), riserMat);
    pin.rotation.y = Math.PI / 2; pin.position.set(0.28, 0.3, 0); bow.add(pin);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), glow(0x6dff8a, 1.5)); dot.position.set(0.28, 0.3, 0); bow.add(dot);
    rod([0.04, -0.1], [0.72, -0.1], 0.018, riserMat); // stabiliser
    rod([0.72, -0.1], [0.8, -0.1], 0.045, riserMat);
    const rest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.05), camMat); rest.position.set(0.02, 0.16, 0.03); bow.add(rest);
    // a simple stand: base plate and post with a cradle under the grip
    const standMat = new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.5, roughness: 0.5 });
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.06, 16), standMat); plate.position.y = -1.2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.04, 8), standMat); post.position.set(-0.3, -0.68, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.06), standMat); arm.position.set(-0.15, -0.16, 0);
    bow.add(plate, post, arm);
    bow.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    bow.scale.setScalar(1.7); bow.position.set(-3.2, 0.3 + 1.23 * 1.7, 2.7); bow.rotation.y = 0.15;
    g.add(bow);
    // quiver
    const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 1.5, 7), stone(0x4a2f1c));
    quiver.position.set(3.4, 0.95, 1.6); quiver.rotation.z = -0.2; g.add(quiver);
    for (let i = 0; i < 4; i++) {
      const a = arrow(color); a.rotation.x = -Math.PI / 2 + (i - 1.5) * 0.08; a.rotation.z = -0.2 + (i - 1.5) * 0.06;
      a.position.set(3.55 + (i - 1.5) * 0.09, 1.5, 1.6); g.add(a);
    }
    lanterns(g, [[-4.4, 2.6, -1.6], [4.4, 2.6, -1.4]], 0xffb060);
    verseTablet(g, { x: 1.4, z: 3.9, ry: -0.15 });
    andalusArch(g, { x: -2.9, z: -3.4, ry: 0.5 });
    strategyTable(g, { x: 2.9, z: -3.0, ry: -0.5 });
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    range.group = g; range.color = color;
    [[0.5, 0.42], [-0.62, -0.2]].forEach(([x, y]) => { const a = arrow(color); stick(a, x, y); g.add(a); });
  },

  guilds(g, color) {
    [[-2.6, 0x1f8f5f, 5.4, 'unimelb.svg', '#000f46'], [2.6, 0xffffff, 4.6, null, '#ffffff']].forEach(([x, c, h, logo, bg], i) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, h, 6), stone(0x6b5a44));
      pole.position.set(x, h / 2 + 0.2, -1.2);
      const geo = new THREE.PlaneGeometry(1.7, 2.6, 8, 8);
      geo.translate(0.85, 0, 0);
      const map = logo ? logoTexture(logo, { w: 340, h: 520, bg, pad: 0.1 }) : ssamBanner();
      const flag = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, side: THREE.DoubleSide, roughness: 0.9 }));
      flag.castShadow = true; pole.castShadow = true;
      flag.position.set(x + 0.05, h - 1.2, -1.2);
      const base = geo.attributes.position.array.slice();
      tick.push((t) => {
        const p = geo.attributes.position;
        for (let k = 0; k < p.count; k++) {
          const px = base[k * 3];
          p.setZ(k, Math.sin(px * 3 - t * 3 + i) * 0.16 * px);
        }
        p.needsUpdate = true;
      });
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd9b064, metalness: 0.8, roughness: 0.3 }));
      cap.position.set(x, h + 0.25, -1.2);
      g.add(pole, flag, cap);
    });
    const old = [];
    for (let i = 0; i < 5; i++) { // campfire logs + flame
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.3, 5), stone(0x3a2718));
      log.rotation.set(Math.PI / 2.4, (i / 5) * TAU, 0); log.position.set(0, 0.45, 1.6);
      g.add(log); old.push(log);
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 6), glow(0xff8a3c, 3));
    flame.position.set(0, 1.2, 1.6);
    const fire = new THREE.PointLight(0xff8a3c, 40, 16, 2); fire.position.set(0, 1.8, 1.6);
    g.add(flame, fire); old.push(flame);
    tick.push((t) => {
      const f = 1 + Math.sin(t * 11) * 0.08 + Math.sin(t * 17.3) * 0.06;
      flame.scale.set(f, 1 + Math.sin(t * 9) * 0.18, f); fire.intensity = 40 * f;
    });
    [[-3.6, 2.6], [3.7, 2.4]].forEach(([x, z]) => {
      const tent = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.9, 4), stone(0x5d5078));
      tent.position.set(x, 1.2, z); tent.rotation.y = Math.PI / 4; g.add(tent); old.push(tent);
    });
    prop(g, 'camp', { w: 6.4, z: 1.7, ry: -0.5, replace: old });
    // a kashta: a Sadu rug and a dallah of Arabic coffee by the fire
    saduRug(g, { x: -3.3, z: 3.6, w: 2.2, d: 1.4, ry: 0.5 });
    prop(g, 'dallah', { w: 0.8, x: -3.2, y: 0.36, z: 3.6, ry: -0.3, onLoad: brass });
    void color;
  },

  portal(g, color) {
    const gate = new THREE.Group(); gate.position.y = 4.4; g.add(gate);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.28, 8, 48), stone(0x4a4466));
    gate.add(ring);
    const oldGate = [ring];
    const inner = new THREE.Mesh(new THREE.TorusGeometry(2.72, 0.07, 6, 64), glow(color, 2.6));
    gate.add(inner); oldGate.push(inner);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { t: { value: 0 }, c: { value: new THREE.Color(color) } },
      vertexShader: 'varying vec2 u; void main(){ u = uv - 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec2 u; uniform float t; uniform vec3 c;
        void main(){
          float r = length(u) * 2.0, a = atan(u.y, u.x);
          float s = sin(a * 5.0 + r * 9.0 - t * 2.2) * 0.5 + 0.5;
          float s2 = sin(a * 3.0 - r * 14.0 + t * 1.3) * 0.5 + 0.5;
          float m = smoothstep(1.0, 0.75, r);
          vec3 col = mix(c, vec3(0.45, 0.75, 1.0), s2) * (0.35 + s * 0.9) + vec3(1.0) * pow(1.0 - r, 4.0);
          gl_FragColor = vec4(col * m, m);
        }`,
    });
    gate.add(new THREE.Mesh(new THREE.CircleGeometry(2.7, 48), mat));
    tick.push((t) => { mat.uniforms.t.value = t; });
    const sparks = points(160, (v, i) => {
      const a = (i / 160) * TAU * 3, r = 3.1 + Math.random() * 1.4;
      v.set(Math.cos(a) * r, Math.sin(a) * r, THREE.MathUtils.randFloatSpread(1.2));
    }, 0.16, color, 1);
    gate.add(sparks); spin.push({ o: sparks, z: 0.5 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, 0.5), glow(0xe3b866, 2));
      r.position.set(Math.cos(a) * 3, Math.sin(a) * 3, 0); r.rotation.z = a;
      gate.add(r); oldGate.push(r);
    }
    prop(g, 'gate', { h: 6.8, lit: 0.12, replace: oldGate, onLoad: () => { gate.position.y = 3.75; gate.scale.setScalar(0.95); } });
    gate.userData.face = true;
  },
};

/* ---------- logos, signs and banners ---------- */
// Draws an organisation's logo onto a canvas texture once it has loaded.
// Oswald and Graduate are painted only into two textures (the CISSA banner and the hoodie print),
// so they load here, after the page, instead of holding up the first paint.
let texFonts = null;
const textureFonts = () => texFonts || (texFonts = new Promise((done) => {
  const l = document.createElement('link'); l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Graduate&family=Oswald:wght@500;600&display=swap';
  l.onload = () => Promise.all(['600px Graduate', '600 112px Oswald', '500 40px Oswald'].map((f) => document.fonts.load(f))).then(done, done);
  l.onerror = done; document.head.append(l);
}));
function logoTexture(file, { w = 512, h = 512, bg = '#ffffff', pad = 0.12, box, extra, fonts } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const img = new Image();
  img.onload = () => Promise.resolve(fonts).then(() => {
    const [bx, by, bw, bh] = box || [w * pad, h * pad, w * (1 - 2 * pad), h * (1 - 2 * pad)];
    const iw = img.naturalWidth || 300, ih = img.naturalHeight || 150, k = Math.min(bw / iw, bh / ih);
    x.drawImage(img, bx + (bw - iw * k) / 2, by + (bh - ih * k) / 2, iw * k, ih * k);
    if (extra) extra(x, w, h);
    tex.needsUpdate = true;
  });
  img.src = `assets/logos/${file}?v=51`;
  return tex;
}
const wood = () => flat(0x6b4a2e);
function signboard(g, { x, z, ry = 0, w = 1.6, h = 0.7, y = 1.1, logo, bg = '#ffffff', pad = 0.1 }) {
  const s = new THREE.Group();
  [-1, 1].forEach((side) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, y + h / 2, 6), wood());
    post.position.set(side * (w / 2 - 0.08), (y + h / 2) / 2, -0.04); post.castShadow = true; s.add(post);
  });
  const face = new THREE.MeshStandardMaterial({ map: logoTexture(logo, { w: 1024, h: Math.round(1024 * h / w), bg, pad }), roughness: 0.8 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), [wood(), wood(), wood(), wood(), face, wood()]);
  board.position.y = y; board.castShadow = true; board.receiveShadow = true; s.add(board);
  s.position.set(x, 0.3, z); s.rotation.y = ry; g.add(s);
  return s;
}
// The Saudi Students Association in Melbourne: its full logo on a white banner.
function ssamBanner() {
  return logoTexture('ssam-full.webp', { w: 340, h: 520, bg: '#ffffff', box: [26, 40, 288, 440], extra: (x) => {
    x.strokeStyle = '#1b6136'; x.lineWidth = 6; x.strokeRect(10, 10, 320, 500);
  } });
}
// A roll-up banner, like the CISSA one at Codebrew.
function rollup(g, { x, z, ry = 0 }) {
  const b = new THREE.Group();
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.09, 0.28), flat(0x2a2a2e)); foot.position.y = 0.05;
  const tex = logoTexture('cissa.svg', { w: 512, h: 1280, bg: '#0b0b0e', box: [96, 150, 320, 320], fonts: textureFonts(), extra: (c, w) => {
    c.textAlign = 'center'; c.fillStyle = '#ffffff'; c.font = '600 132px Oswald, Arial, sans-serif'; c.fillText('CISSA', w / 2, 640);
    c.fillStyle = '#4fc3dc'; c.font = '500 40px Oswald, Arial, sans-serif'; c.fillText('COMPUTING AND INFORMATION', w / 2, 730); c.fillText('SYSTEMS STUDENT ASSOCIATION', w / 2, 782);
    c.fillStyle = '#ffffff'; c.font = '600 44px Oswald, Arial, sans-serif'; c.fillText('CODEBREW 2026', w / 2, 980);
  } });
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 2.15), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
  banner.position.set(0, 1.18, 0); banner.castShadow = true;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 2.15), flat(0x111114)); back.rotation.y = Math.PI; back.position.copy(banner.position);
  b.add(foot, banner, back); b.position.set(x, 0.3, z); b.rotation.y = ry; g.add(b);
}

// The back print of my leavers hoodie, redrawn: "Sohaib the great" over a big varsity 23.
function hoodiePrint() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const draw = () => {
    const x = c.getContext('2d'); x.clearRect(0, 0, 1024, 1024);
    x.fillStyle = '#ffffff'; x.font = '600 118px Oswald, "Arial Narrow", Arial, sans-serif'; x.textBaseline = 'middle';
    const text = [...'Sohaib the great'], R = 1300, cx = 512, cy = 250 + R;
    const ws = text.map((ch) => x.measureText(ch).width), total = ws.reduce((a, b) => a + b, 0);
    let ang = -total / 2 / R;
    text.forEach((ch, i) => {
      const a = ang + ws[i] / 2 / R;
      x.save(); x.translate(cx + Math.sin(a) * R, cy - Math.cos(a) * R); x.rotate(a); x.fillText(ch, -ws[i] / 2, 0); x.restore();
      ang += ws[i] / R;
    });
    // the 23 is filled with tiny lines, like the leavers' names printed inside it
    const o = document.createElement('canvas'); o.width = o.height = 1024; const q = o.getContext('2d');
    q.font = '520px Graduate, "Arial Black", sans-serif'; q.textAlign = 'center'; q.fillStyle = '#fff'; q.fillText('23', 512, 800);
    q.globalCompositeOperation = 'source-in'; q.fillStyle = '#8d8a84'; q.fillRect(0, 0, 1024, 1024);
    q.fillStyle = 'rgba(245, 242, 235, 0.95)';
    for (let yy = 380; yy < 820; yy += 7) for (let xx = 30; xx < 1000;) { const len = 12 + Math.random() * 40; q.fillRect(xx, yy, len, 4); xx += len + 5 + Math.random() * 6; }
    x.drawImage(o, 0, 0);
    x.font = q.font; x.textAlign = 'center'; x.lineJoin = 'round';
    x.lineWidth = 16; x.strokeStyle = '#ffffff'; x.strokeText('23', 512, 800);
    x.textAlign = 'start';
    tex.needsUpdate = true;
  };
  draw();
  textureFonts().then(draw);
  return tex;
}
function applyHoodiePrint(holder, g) {
  g.updateMatrixWorld(true);
  const meshes = []; holder.traverse((o) => o.isMesh && meshes.push(o));
  const box = new THREE.Box3().setFromObject(holder), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  const back = new THREE.Vector3(0, 0, -1).applyQuaternion(holder.getWorldQuaternion(new THREE.Quaternion()));
  const origin = ctr.clone().addScaledVector(back, size.length()); origin.y = box.min.y + size.y * 0.52;
  const hit = new THREE.Raycaster(origin, back.clone().negate()).intersectObjects(meshes, false)[0];
  if (!hit) return;
  const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  const aim = new THREE.Object3D(); aim.position.copy(hit.point); aim.lookAt(hit.point.clone().add(n));
  const w = Math.max(size.x, size.z) * 0.95;
  const geo = new DecalGeometry(hit.object, hit.point, aim.rotation, new THREE.Vector3(w, w, size.length()));
  geo.applyMatrix4(g.matrixWorld.clone().invert());
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: hoodiePrint(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.9 }));
  m.receiveShadow = true; g.add(m);
}
function hoodieStand(g, x, z, ry) {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.12, 20), wood()); base.position.set(x, 0.36, z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8), flat(0x2b2b30)); pole.position.set(x, 1.0, z);
  [base, pole].forEach((o) => { o.castShadow = true; o.receiveShadow = true; g.add(o); });
  prop(g, 'hoodie', { h: 3.0, x, y: 1.3, z, ry, onLoad: (holder) => applyHoodiePrint(holder, g) });
}

// The Duke of Edinburgh Bronze Award: a cast bronze medal on a ribbon, hanging from a little
// wooden stand. The face shows the official logo once its file is supplied (medalLogo in data.js);
// until then a laurel ring and lettering drawn in code.
function medalFace(top, mid, bottom, logo, onLogo) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const draw = () => {
    const x = c.getContext('2d'), R = 256;
    const gr = x.createRadialGradient(R * 0.8, R * 0.7, 20, R, R, R);
    gr.addColorStop(0, '#f6c896'); gr.addColorStop(0.6, '#cf8a4e'); gr.addColorStop(1, '#8a4c22');
    x.fillStyle = gr; x.fillRect(0, 0, 512, 512);
    x.lineWidth = 10; x.strokeStyle = 'rgba(60, 30, 10, 0.55)';
    x.beginPath(); x.arc(R, R, R - 18, 0, Math.PI * 2); x.stroke();
    if (logoImg) { // the official badge fills the face; the medal itself takes the badge's shape (see onLogo)
      x.drawImage(logoImg, 0, 0, 512, 512);
      tex.needsUpdate = true; return;
    }
    x.lineWidth = 3; x.beginPath(); x.arc(R, R, R - 92, 0, Math.PI * 2); x.stroke();
    // laurel: two branches of leaves curving up each side of the centre
    x.fillStyle = 'rgba(70, 36, 12, 0.7)';
    for (const side of [-1, 1]) for (let k = 0; k < 9; k++) {
      const a = Math.PI / 2 + side * (0.35 + k * 0.27), r = R - 122;
      x.save(); x.translate(R + Math.cos(a) * r, R + Math.sin(a) * r); x.rotate(a + side * 0.6);
      x.beginPath(); x.ellipse(0, 0, 15, 6, 0, 0, Math.PI * 2); x.fill(); x.restore();
    }
    // lettering around the top edge, then the centre
    x.fillStyle = '#2e1405'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '700 34px Cinzel, Georgia, serif';
    const letters = top.toUpperCase().split(''), span = 2.3, r = R - 55;
    letters.forEach((ch, k) => {
      const a = -Math.PI / 2 - span / 2 + (k + 0.5) * (span / letters.length);
      x.save(); x.translate(R + Math.cos(a) * r, R + Math.sin(a) * r); x.rotate(a + Math.PI / 2); x.fillText(ch, 0, 0); x.restore();
    });
    x.font = '900 92px Cinzel, Georgia, serif'; x.fillText(mid.toUpperCase(), R, R - 8);
    x.font = '700 50px Cinzel, Georgia, serif'; x.fillText(bottom, R, R + 70);
    tex.needsUpdate = true;
  };
  let logoImg = null;
  if (logo) {
    const img = new Image();
    img.onload = () => { logoImg = img; draw(); if (onLogo) onLogo(img.naturalWidth / img.naturalHeight); };
    img.src = `assets/logos/${logo}?v=51`;
  }
  draw(); pageFonts.then(() => document.fonts.load('900 70px Cinzel')).then(draw).catch(() => {});
  return tex;
}
function bronzeMedal(g, { x, z, ry = 0, scale = 1 }) {
  const stand = new THREE.Group(); stand.position.set(x, 0.3, z); stand.rotation.y = ry; stand.scale.setScalar(scale); g.add(stand);
  const w = wood();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.14, 0.5), w); base.position.y = 0.07;
  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.2, 0.09), w); postL.position.set(-0.55, 1.17, 0);
  const postR = postL.clone(); postR.position.x = 0.55;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.1, 0.12), w); bar.position.y = 2.25;
  [base, postL, postR, bar].forEach((o) => { o.castShadow = true; o.receiveShadow = true; stand.add(o); });
  // the medal swings from the bar
  const hang = new THREE.Group(); hang.position.y = 2.2; stand.add(hang);
  const ribbonTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 8;
    const k = c.getContext('2d');
    [['#7a1420', 0, 64], ['#d9a441', 22, 6], ['#d9a441', 36, 6]].forEach(([col, at, wd]) => { k.fillStyle = col; k.fillRect(at, 0, wd, 8); });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.9, 0.02), new THREE.MeshStandardMaterial({ map: ribbonTex, roughness: 0.8 }));
  ribbon.position.y = -0.45; ribbon.castShadow = true; hang.add(ribbon);
  const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.05), new THREE.MeshStandardMaterial({ color: 0xc8844a, metalness: 0.4, roughness: 0.35 }));
  clasp.position.y = -0.9; hang.add(clasp);
  // only half metallic: there is no environment map, so a fully metallic medal would look nearly black
  const bronze = new THREE.MeshStandardMaterial({ color: 0xc8844a, metalness: 0.4, roughness: 0.38 });
  // with the official badge supplied, the disc and its rim become the badge's oval
  // (the disc is turned a quarter about its axis, so its local z is the medal's width)
  const shape = (aspect) => { disc.scale.z = aspect; ring.scale.x = aspect; };
  const face = new THREE.MeshStandardMaterial({ map: medalFace("Duke of Edinburgh's", 'Bronze', '2023', D.trophies.find((t) => t.name === 'Duke of Edinburgh')?.medalLogo, (a) => shape(a)), metalness: 0.3, roughness: 0.45, emissive: 0x3a1c08, emissiveIntensity: 0.25 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.07, 48), [bronze, face, face]);
  disc.rotation.set(Math.PI / 2, Math.PI / 2, 0); // face the viewer, lettering upright
  disc.position.y = -1.41; disc.castShadow = true; hang.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 8, 48), bronze); ring.position.copy(disc.position); hang.add(ring);
  tick.push((t) => { if (!reduceMotion) hang.rotation.z = Math.sin(t * 1.1 + x) * 0.06; });
}

// Me, generated with Meshy from a full-length photo of me in a suit.
function meFigure(g, x, z, ry) {
  prop(g, 'me', { h: 3.6, x, z, ry });
}

/* ---------- Saudi touches ---------- */
// Al Sadu: the Bedouin weave of bands, triangles and diamonds in red, black, white and natural wool.
function saduTexture(w = 512, h = 512) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  const red = '#9e1b1b', black = '#1a1412', white = '#efe6d2', wool = '#c79a5b', green = '#1b6136';
  const bands = [[black, 14], [white, 4], [red, 40], [white, 4], [black, 10], [wool, 36], [black, 10], [white, 4], [red, 40], [white, 4], [black, 14], [green, 12]];
  let y = 0, k = 0;
  while (y < h) {
    const [col, bh] = bands[k % bands.length]; x.fillStyle = col; x.fillRect(0, y, w, bh);
    if (bh >= 36) { // a row of motifs inside the wide bands
      const tw = bh, alt = col === red ? white : black;
      for (let i = 0; i * tw < w; i++) {
        x.fillStyle = alt; const cx = i * tw + tw / 2, cy = y + bh / 2, s = bh * 0.36;
        x.beginPath(); x.moveTo(cx, cy - s); x.lineTo(cx + s, cy); x.lineTo(cx, cy + s); x.lineTo(cx - s, cy); x.fill();
        x.fillStyle = col === red ? black : red;
        x.beginPath(); x.moveTo(cx, cy - s * 0.4); x.lineTo(cx + s * 0.4, cy); x.lineTo(cx, cy + s * 0.4); x.lineTo(cx - s * 0.4, cy); x.fill();
        x.fillStyle = alt;
        x.beginPath(); x.moveTo(i * tw, y); x.lineTo(i * tw + tw * 0.18, y); x.lineTo(i * tw, y + bh * 0.25); x.fill();
        x.beginPath(); x.moveTo(i * tw, y + bh); x.lineTo(i * tw + tw * 0.18, y + bh); x.lineTo(i * tw, y + bh * 0.75); x.fill();
      }
    } else if (bh >= 10) { // small teeth
      x.fillStyle = col === black ? white : black;
      for (let i = 0; i * 12 < w; i++) { x.beginPath(); x.moveTo(i * 12, y + bh); x.lineTo(i * 12 + 6, y + 2); x.lineTo(i * 12 + 12, y + bh); x.fill(); }
    }
    y += bh; k++;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
const brass = (h) => h.traverse((o) => { if (o.isMesh) { o.material.color.setRGB(1.0, 0.82, 0.5); o.material.metalness = 0.75; o.material.roughness = 0.32; } });
function saduRug(g, { x, z, w = 2.6, d = 1.6, ry = 0 }) {
  const rug = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), [flat(0x9e1b1b), flat(0x9e1b1b), new THREE.MeshStandardMaterial({ map: saduTexture(), roughness: 1 }), flat(0x1a1412), flat(0x9e1b1b), flat(0x9e1b1b)]);
  rug.position.set(x, 0.33, z); rug.rotation.y = ry; rug.receiveShadow = true; g.add(rug);
  return rug;
}

/* ---------- things I watch ---------- */
// A horseshoe arch of red brick and cream stone voussoirs, as in the Great Mosque of Córdoba.
function andalusArch(g, { x, z, ry = 0 }) {
  const a = new THREE.Group(), R = 1.05, n = 17, red = flat(0x8a3a28), cream = flat(0xd6c49c), col = flat(0x9a8f80);
  const span = Math.PI * 1.3, start = -Math.PI * 0.15;
  for (let i = 0; i < n; i++) {
    const t0 = start + (i / n) * span, t1 = start + ((i + 1) / n) * span;
    const seg = new THREE.Mesh(new THREE.TorusGeometry(R, 0.2, 6, 3, t1 - t0), i % 2 ? cream : red);
    seg.rotation.z = t0; seg.scale.z = 1.6; a.add(seg);
  }
  const endY = Math.sin(start) * R; // the arch's feet sit below its centre
  a.position.y = 1.85 - endY;
  [-1, 1].forEach((sd) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 1.85, 10), col);
    c.position.set(sd * Math.cos(start) * R, endY - 0.925, 0); a.add(c);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.38), cream); cap.position.set(sd * Math.cos(start) * R, endY - 0.02, 0); a.add(cap);
  });
  a.children.forEach((o) => { o.castShadow = true; o.receiveShadow = true; });
  const holder = new THREE.Group(); holder.add(a); holder.position.set(x, 0.3, z); holder.rotation.y = ry; g.add(holder);
}
// A small table with a chess game in progress, and a black notebook beside a red apple.
function strategyTable(g, { x, z, ry = 0 }) {
  const t = new THREE.Group(), wood2 = flat(0x5a3b22);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.9), wood2); top.position.y = 0.82; t.add(top);
  [[-0.6, -0.36], [0.6, -0.36], [-0.6, 0.36], [0.6, 0.36]].forEach(([lx, lz]) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.8, 0.07), wood2); l.position.set(lx, 0.41, lz); t.add(l);
  });
  const c = document.createElement('canvas'); c.width = c.height = 128; const q = c.getContext('2d');
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { q.fillStyle = (i + j) % 2 ? '#2a2420' : '#e6dcc6'; q.fillRect(i * 16, j * 16, 16, 16); }
  const bt = new THREE.CanvasTexture(c); bt.colorSpace = THREE.SRGBColorSpace; bt.magFilter = THREE.NearestFilter;
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.04, 0.62), [wood2, wood2, new THREE.MeshStandardMaterial({ map: bt, roughness: 0.6 }), wood2, wood2, wood2]);
  board.position.set(-0.28, 0.88, 0); t.add(board);
  const piece = (px, pz, black, h, crown) => {
    const m = flat(black ? 0x1c1a1e : 0xf0ead8), p = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.05, h, 10), m); body.position.y = h / 2; p.add(body);
    const head = crown ? new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.02), m) : new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), m);
    head.position.y = h + 0.03; p.add(head);
    if (crown) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.02), m); bar.position.y = h + 0.04; p.add(bar); }
    p.position.set(-0.28 + px * 0.0775, 0.9, pz * 0.0775); t.add(p);
  };
  piece(-0.5, 1.5, true, 0.16, true); piece(1.5, -2.5, false, 0.16, true); piece(0.5, 0.5, true, 0.1); piece(2.5, -0.5, false, 0.1);
  piece(-1.5, 2.5, true, 0.08); piece(-2.5, -1.5, false, 0.08); piece(3.5, 1.5, false, 0.08);
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.42), [flat(0xe8e0cc), flat(0x101012), flat(0x101012), flat(0x101012), flat(0x101012), flat(0x101012)]);
  book.position.set(0.38, 0.89, 0.05); book.rotation.y = 0.25; t.add(book);
  const apple = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10), new THREE.MeshStandardMaterial({ color: 0xb3121b, roughness: 0.35 }));
  apple.scale.y = 0.9; apple.position.set(0.5, 0.93, -0.28); t.add(apple);
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 4), flat(0x4a3220)); stalk.position.set(0.5, 1.02, -0.28); t.add(stalk);
  t.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  t.position.set(x, 0.3, z); t.rotation.y = ry; g.add(t);
}

/* ---------- Arab folklore ---------- */
// A stone tablet carved with a line of poetry.
function verseTablet(g, { x, z, ry = 0, w = 1.9, h = 1.15 }) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const draw = () => {
    const x = c.getContext('2d'), W = c.width, H = c.height, v = D.folklore.antarah;
    x.fillStyle = '#b89a72'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${90 + Math.random() * 60},${70 + Math.random() * 40},40,0.08)`; x.fillRect(Math.random() * W, Math.random() * H, 3 + Math.random() * 9, 2 + Math.random() * 6); }
    x.strokeStyle = 'rgba(70,45,20,0.6)'; x.lineWidth = 8; x.strokeRect(22, 22, W - 44, H - 44);
    x.textAlign = 'center'; x.direction = 'rtl'; x.fillStyle = '#3b2412'; x.font = '700 74px "Aref Ruqaa", serif';
    x.fillText(v.ar[0], W / 2, H * 0.34); x.fillText(v.ar[1], W / 2, H * 0.58);
    x.font = '700 46px "Aref Ruqaa", serif'; x.fillStyle = '#5c3a1c'; x.fillText('— ' + v.byAr, W / 2, H * 0.84);
    tex.needsUpdate = true;
  };
  draw(); pageFonts.then(() => document.fonts.load('700 74px "Aref Ruqaa"', 'عنترة')).then(draw).catch(() => {});
  const stoneM = flat(0x9c8462);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.18), [stoneM, stoneM, stoneM, stoneM, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }), stoneM]);
  slab.position.set(x, 0.3 + h / 2 + 0.25, z); slab.rotation.set(-0.12, ry, 0); slab.castShadow = true; slab.receiveShadow = true;
  const foot = new THREE.Mesh(new THREE.BoxGeometry(w * 1.1, 0.28, 0.5), stoneM); foot.position.set(x, 0.42, z); foot.rotation.y = ry; foot.castShadow = true;
  g.add(slab, foot);
}

// The jinn of Wadi Abqar: wisps that spiral round the skill tree. When a skill is pointed at,
// the first of them flies over and circles it.
function abqarWisps(g, heartAt) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,240,210,0.65)'); gr.addColorStop(1, 'rgba(255,220,180,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const TRAIL = 16, tints = [0xffe2a8, 0xc9b5ff, 0xa8e8ff];
  const wisps = tints.map((tint, w) => {
    const dots = [...Array(TRAIL)].map((_, j) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: tint, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 * (1 - j / TRAIL) }));
      sp.scale.setScalar(0.42 * (1 - j / TRAIL) + 0.06); g.add(sp); return sp;
    });
    return { dots, trail: [], at: new THREE.Vector3(), w, visit: 0 };
  });
  const spot = new THREE.Vector3();
  tick.push((t, dt) => {
    const time = reduceMotion ? 2 : t;
    for (const s of wisps) {
      const a = time * (0.55 + s.w * 0.12) + s.w * 2.1, rise = (Math.sin(time * 0.23 + s.w * 1.7) + 1) / 2;
      spot.set(Math.cos(a) * (1.7 + rise * 1.4), 1.0 + rise * (heartAt.y + 1.5), Math.sin(a) * (1.7 + rise * 1.4) - 0.3);
      const lit = s.w === 0 && skillLit && skillNodes.get(skillLit);
      s.visit += ((lit ? 1 : 0) - s.visit) * (1 - Math.exp(-dt * 3));
      if (lit) {
        const p = lit.node.position, b = time * 4;
        s.target = (s.target || new THREE.Vector3()).set(p.x + Math.cos(b) * 0.38, p.y + Math.sin(b * 0.7) * 0.15, p.z + Math.sin(b) * 0.38);
      }
      if (s.target) spot.lerp(s.target, s.visit);
      s.at.copy(spot);
      s.trail.unshift(s.at.clone()); if (s.trail.length > TRAIL * 2) s.trail.pop();
      s.dots.forEach((d, j) => d.position.copy(s.trail[Math.min(j * 2, s.trail.length - 1)]));
    }
  });
}

// A boulder at the mouth of the valley, carved with its name.
function nameStone(g, { x, z, ry = 0, ar, en }) {
  const c = document.createElement('canvas'); c.width = 768; c.height = 320;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const draw = () => {
    const k = c.getContext('2d'), W = c.width, H = c.height;
    k.fillStyle = '#a58a66'; k.fillRect(0, 0, W, H);
    for (let i = 0; i < 700; i++) { k.fillStyle = `rgba(${80 + Math.random() * 60},${60 + Math.random() * 40},36,0.09)`; k.fillRect(Math.random() * W, Math.random() * H, 3 + Math.random() * 9, 2 + Math.random() * 6); }
    k.textAlign = 'center'; k.direction = 'rtl'; k.fillStyle = '#3b2412'; k.font = '700 120px "Aref Ruqaa", serif';
    k.fillText(ar, W / 2, H * 0.55);
    k.direction = 'ltr'; k.font = '700 40px Cinzel, Georgia, serif'; k.fillStyle = '#5c3a1c'; k.fillText(en.toUpperCase(), W / 2, H * 0.86);
    tex.needsUpdate = true;
  };
  draw(); pageFonts.then(() => document.fonts.load('700 120px "Aref Ruqaa"', ar)).then(draw).catch(() => {});
  const stoneM = flat(0x8f7656);
  const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.62, 0.34), [stoneM, stoneM, stoneM, stoneM, face, stoneM]);
  slab.position.set(x, 0.72, z); slab.rotation.set(-0.28, ry, 0.04);
  const rock = new THREE.Mesh(jitter(new THREE.DodecahedronGeometry(0.62, 0), 0.12), stoneM);
  rock.scale.set(1.35, 0.6, 0.8); rock.position.set(x, 0.4, z - 0.12); rock.rotation.y = ry;
  [slab, rock].forEach((o) => { o.castShadow = true; o.receiveShadow = true; g.add(o); });
}

/* ---------- landmarks of the places I have lived ---------- */
const landmarks = {
  hero(g) { // Makkah: a Hejazi house with roshan balconies, date palms, and the farm AquaFlow was built for
    prop(g, 'roshan', { h: 4.8, x: 2.6, z: -4.1, ry: -0.45, replace: g.userData.trees });
    prop(g, 'palms', { h: 3.6, x: -4.3, z: -2.4, ry: 0.6 });
    prop(g, 'palms', { h: 3.1, x: -1.2, z: -5.0, ry: 2.2 });
    prop(g, 'farm', { w: 2.7, x: -2.4, z: 3.1, ry: 0.35 });
    lanterns(g, [[-2.4, 2.6, -2.2], [0.6, 2.4, -3.6]], 0xffb050);
    saduRug(g, { x: 1.7, z: 3.4, w: 2.8, d: 1.7, ry: -0.2 });
    prop(g, 'majlis', { w: 2.6, x: 1.75, y: 0.35, z: 3.2, ry: -0.2 + Math.PI });
    prop(g, 'dallah', { w: 0.9, x: 1.5, y: 0.36, z: 3.75, ry: 0.4, onLoad: brass });
    prop(g, 'camel', { w: 2.6, x: -4.6, z: 0.4, ry: 1.1 });
    prop(g, 'falcon', { h: 1.7, x: 4.7, z: -0.9, ry: -1.1 });
  },
  trophies(g) { // Swansea: a lighthouse, a castle ruin, the red dragon, and Welsh drizzle
    prop(g, 'lighthouse', { h: 5.4, x: -4.1, z: -3.5, ry: 0.5, replace: g.userData.trees });
    prop(g, 'castle', { h: 3.8, x: 4.0, z: -3.6, ry: -0.6 });
    prop(g, 'dragon', { h: 2.1, x: 5.0, z: 2.3, ry: -1.0 });
    hoodieStand(g, -3.4, 2.2, Math.PI + 0.45); // back to the viewer, so the print shows
    signboard(g, { x: -1.6, z: 3.9, ry: 0.15, w: 1.5, h: 0.5, y: 0.55, logo: 'olchfa.svg', pad: 0.08 });
    bronzeMedal(g, { x: 2.3, z: 3.9, ry: -0.3, scale: 1.35 }); // Duke of Edinburgh Bronze Award, 2023
    rain(g);
  },
  quests(g) { // Melbourne: the city tram and a laneway lamp
    prop(g, 'tram', { w: 4.6, x: 3.3, z: -4.2, ry: -0.55 });
    rollup(g, { x: -2.3, z: 3.6, ry: 0.3 });
    prop(g, 'lamp', { h: 2.6, x: -4.7, z: 3.2, ry: 0.8 });
    lampLight(g, -4.85, 2.5, 3.1);
    prop(g, 'gum', { h: 4.2, x: -3.9, z: -3.9, replace: g.userData.trees });
  },
  skills(g) { // Melbourne: the sandstone university arch, at the mouth of Wadi Abqar
    prop(g, 'arch', { h: 4.6, x: 0, z: -4.9, replace: g.userData.trees });
    signboard(g, { x: 2.6, z: 3.4, ry: -0.25, w: 1.9, h: 0.75, y: 0.9, logo: 'trinity.png', pad: 0.07 });
    nameStone(g, { x: -2.5, z: 3.6, ry: 0.3, ar: D.folklore.abqar.ar[0], en: 'Wadi Abqar' });
    prop(g, 'gum', { h: 4.2, x: -4.5, z: -2.6, ry: 1.2 });
    prop(g, 'gum', { h: 3.6, x: 4.6, z: -2.2, ry: 2.6 });
  },
  guilds(g) { // Melbourne: gum trees and a lamp by the camp
    prop(g, 'gum', { h: 4.2, x: -4.3, z: -3.3, replace: g.userData.trees });
    prop(g, 'gum', { h: 3.5, x: -1.2, z: -5.0, ry: 2 });
    // my silver 2005 Holden Astra CD (AH hatchback), which has taken me and its share of mud around the bush outside Melbourne
    prop(g, 'car', { w: 3.6, x: 3.7, z: 3.3, ry: -0.75, onLoad: (holder) => holder.traverse((o) => {
      if (!o.isMesh) return; // the generated paint came out white; tone it to the Astra's metallic silver
      o.material.color.setRGB(0.52, 0.535, 0.55); o.material.metalness = 0.45; o.material.roughness = 0.38;
    }) });
    prop(g, 'lamp', { h: 2.4, x: -4.8, z: 1.6, ry: 0.9 });
    lampLight(g, -4.95, 2.3, 1.5);
  },
};
function lampLight(g, x, y, z) {
  const l = new THREE.PointLight(0xffb468, 9, 9, 2); l.position.set(x, y, z); g.add(l);
}
function lanterns(g, spots, color) { // hanging fanous lanterns
  spots.forEach(([x, y, z], i) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, y + 0.6, 5), flat(0x4a3424));
    post.position.set(x, (y + 0.6) / 2 + 0.25, z);
    const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.26), glow(color, 2.2));
    lamp.scale.y = 1.4; lamp.position.set(x, y, z + 0.3);
    const l = new THREE.PointLight(color, 8, 7, 2); l.position.copy(lamp.position);
    g.add(post, lamp, l); bob.push({ o: lamp, y, amp: 0.05, speed: 1.6, phase: i });
  });
}
function rain(g) {
  const n = 260, drops = new Float32Array(n * 6);
  const seed = () => { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * 6.5; return [Math.cos(a) * r, Math.random() * 10 + 0.5, Math.sin(a) * r]; };
  const set = (i, [x, y, z]) => drops.set([x, y, z, x + 0.04, y - 0.45, z], i * 6);
  for (let i = 0; i < n; i++) set(i, seed());
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(drops, 3));
  g.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.32, depthWrite: false })));
  tick.push((t, dt) => {
    if (reduceMotion) return;
    for (let i = 0; i < n; i++) {
      const y = drops[i * 6 + 1] - dt * 9;
      if (y < 0.4) set(i, seed()); else { drops[i * 6 + 1] = y; drops[i * 6 + 4] = y - 0.45; }
    }
    geo.attributes.position.needsUpdate = true;
  });
}


/* ---------- the Projects islets: Hardware, Software and Games around the Pillars of Iram ---------- */
// In the hub's own frame: +z faces the camera, x runs along the ring. The islets sit behind and to the sides,
// clear of the stepping stones, and are joined by rope bridges.
// islets are small islands, scaled down; the Arcade holds the most, so it is the biggest
const isletScale = { hardware: 0.7, software: 0.62, games: 0.95 };
const isletAt = {
  hardware: new THREE.Vector3(-11, 1.6, -10),
  software: new THREE.Vector3(-2, 4.8, -19),
  games: new THREE.Vector3(12.5, 1.0, -12.5),
};
const isletGroups = {}; // area id → group, for the camera and the landmarks
// where each project stands on its islet, in islet units (radius about 5.5)
function slotsFor(n) {
  if (n === 1) return [[0, 0.8]];
  if (n <= 4) return Array.from({ length: n }, (_, k) => { // an arc across the front half
    const a = Math.PI * (0.15 + 0.7 * (k / (n - 1)));
    return [-Math.cos(a) * 3.4, Math.sin(a) * 2.2 + 0.3];
  });
  // more than four: one in the middle, the rest in a ring, the first of them at the front
  return [[0, 0], ...Array.from({ length: n - 1 }, (_, k) => {
    const a = Math.PI / 2 + (k / (n - 1)) * TAU;
    return [Math.cos(a) * 3.7, Math.sin(a) * 3.7];
  })];
}
// which projects stand on which islet: ABAAD is on the Workshop, and its robot crosses to the Observatory
const isletProjects = (id) => D.quests.filter((q) => (id === 'hardware' && q.experience) || (q.areas || [])[0] === id);
function isletSign(text, sub, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(14, 11, 28, 0.82)'; x.fillRect(0, 0, 512, 160);
  x.strokeStyle = color; x.lineWidth = 6; x.strokeRect(6, 6, 500, 148);
  x.textAlign = 'center'; x.fillStyle = color; x.font = '700 50px Cinzel, Georgia, serif'; x.fillText(text.toUpperCase(), 256, 72);
  x.fillStyle = '#efe6d2'; x.font = 'italic 36px Spectral, Georgia, serif'; x.fillText(sub, 256, 124);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(4.2, 1.31, 1);
  pageFonts.then(() => { // redraw once the fonts are in
    x.clearRect(0, 0, 512, 160); x.fillStyle = 'rgba(14, 11, 28, 0.82)'; x.fillRect(0, 0, 512, 160);
    x.strokeRect(6, 6, 500, 148); x.fillStyle = color; x.font = '700 50px Cinzel, Georgia, serif'; x.fillText(text.toUpperCase(), 256, 72);
    x.fillStyle = '#efe6d2'; x.font = 'italic 36px Spectral, Georgia, serif'; x.fillText(sub, 256, 124); tex.needsUpdate = true;
  });
  return sp;
}
// a rope bridge: planks hanging between two points, with a rope either side
function ropeBridge(g, a, b, sag = 0.9) {
  const n = Math.max(8, Math.round(a.distanceTo(b) / 0.42)), dir = b.clone().sub(a), side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
  const at = (t, lift = 0) => a.clone().lerp(b, t).add(new THREE.Vector3(0, -Math.sin(t * Math.PI) * sag + lift, 0));
  const plank = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.07, 1.1), flat(0x7a5232), n - 1);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), tmp = new THREE.Object3D();
  for (let k = 1; k < n; k++) {
    const t = k / n, p = at(t), p2 = at(t + 0.01);
    tmp.position.copy(p); tmp.lookAt(p.clone().add(side)); tmp.rotateZ(Math.atan2(p2.y - p.y, p2.clone().setY(0).distanceTo(p.clone().setY(0))) * 0);
    tmp.updateMatrix(); plank.setMatrixAt(k - 1, tmp.matrix);
  }
  plank.castShadow = true; g.add(plank);
  [-0.55, 0.55].forEach((o) => {
    const pts = Array.from({ length: 13 }, (_, k) => at(k / 12, 0.55).addScaledVector(side, o));
    const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.03, 4), flat(0xc9a66b));
    g.add(rope);
    [0, 1].forEach((e) => { // posts at each end
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 5), flat(0x5a3b22));
      post.position.copy((e ? b : a).clone().addScaledVector(side, o)).add(new THREE.Vector3(0, 0.3, 0)); g.add(post);
    });
  });
}

/* ---------- a landmark for each project on its islet ---------- */
// Each builder gets the project's spot (a group on the islet, in islet units; +z faces the camera).
// Generated models load through spotProp; everything else is drawn here. Animations respect reduced motion.
function spotProp(spot, name, opts = {}) {
  prop(spot, name, { ...opts, onLoad: (h) => {
    spot.traverse((o) => { o.userData.project = spot.userData.project; o.userData.area = spot.userData.area; o.userData.realm = spot.userData.realm; });
    if (opts.onLoad) opts.onLoad(h);
  } });
}
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
const see = (color, opacity) => new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.15, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
function textTex(lines, { w = 256, h = 128, bg = null, fg = '#efe6d2', font = '600 40px Spectral, Georgia, serif', dir = 'ltr' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const draw = () => {
    const x = c.getContext('2d'); x.clearRect(0, 0, w, h);
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = dir;
    const fs = [].concat(font);
    lines.forEach((t, k) => { x.font = fs[Math.min(k, fs.length - 1)]; x.fillText(t, w / 2, (h / (lines.length + 1)) * (k + 1)); });
    tex.needsUpdate = true;
  };
  draw(); pageFonts.then(draw);
  return tex;
}
// a little blocky figure for the pixel stage: legs, body, head
function voxelFigure(body, head = 0xe0b48a, k = 0.12) {
  const f = new THREE.Group();
  const cube = (c, x, y, sx = 1, sy = 1) => { const m = mesh(new THREE.BoxGeometry(k * sx, k * sy, k), flat(c)); m.position.set(x * k, y * k, 0); f.add(m); };
  cube(0x3b2a1e, -0.5, 0.5); cube(0x3b2a1e, 0.5, 0.5); // legs
  cube(body, 0, 1.75, 2, 1.5); cube(body, -1.25, 1.9, 0.5, 1.2); cube(body, 1.25, 1.9, 0.5, 1.2); // body and arms
  cube(head, 0, 3.1, 1.2, 1.2); // head
  return f;
}
// a soft round glow for star sprites
const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();
const landmarkOf = {
  // a ruined station four floors deep, the chimera ant on its roof and a lone hunter at the door
  'Chimera Ants'(spot) {
    spotProp(spot, 'chimera-tower', { h: 4.4, onLoad: (h) => { h.scale.x *= 2; h.scale.z *= 2; } }); // the model is a thin shaft: give it some body
    spotProp(spot, 'chimera-ant', { h: 1.2, y: 4.3, ry: 0.4 });
    spotProp(spot, 'hunter', { h: 0.95, x: 0.9, z: 1.45, ry: Math.PI + 0.5 });
    const hatch = mesh(new THREE.PlaneGeometry(0.5, 0.6), glow(0xff5a1f, 1.4), 0, 0.35, 1.02); spot.add(hatch);
    tick.push((t) => { hatch.material.emissiveIntensity = 1.1 + Math.sin(t * 7) * 0.25 * (reduceMotion ? 0 : 1); });
  },
  // an ant nest: a mound, ants marching round it and power-ups hovering, waiting to be taken
  'Creep Crawlers'(spot) {
    const mound = mesh(jitter(new THREE.ConeGeometry(1.15, 1.1, 9, 3), 0.12), flat(0x7a5530), 0, 0.55, 0); spot.add(mound);
    spot.add(mesh(new THREE.CircleGeometry(0.22, 10), flat(0x1a120c), 0, 0.42, 0.83));
    spot.children.at(-1).rotation.x = -0.75;
    const ants = Array.from({ length: 9 }, (_, k) => {
      const a = new THREE.Group();
      [0, 0.14, 0.27].forEach((dx, j) => a.add(mesh(new THREE.SphereGeometry(j === 1 ? 0.06 : 0.08, 6, 5), flat(0x1b1210), dx - 0.13, 0.08, 0)));
      spot.add(a); return { a, r: 1.25 + (k % 3) * 0.12, speed: 0.35 + (k % 4) * 0.05, phase: (k / 9) * TAU };
    });
    const ups = [0xff4a4a, 0x56ff9a, 0x52d4ff].map((c, k) => { const o = mesh(new THREE.IcosahedronGeometry(0.17, 0), glow(c, 1.6), -0.6 + k * 0.6, 1.55, 0.2); spot.add(o); spin.push({ o, y: 1.2, x: 0.6 }); return o; });
    tick.push((t) => {
      const m = reduceMotion ? 0 : 1;
      ants.forEach(({ a, r, speed, phase }) => { const ang = phase + t * speed * m; a.position.set(Math.cos(ang) * r, 0.02, Math.sin(ang) * r); a.rotation.y = -ang; });
      ups.forEach((o, k) => { o.position.y = 1.55 + Math.sin(t * 1.6 + k * 2) * 0.12 * m; });
    });
  },
  // نار القِرى, the fire of hospitality: a fire on the sand by a Bedouin tent, and stones for Antarah and Hatim
  'Riyma'(spot) {
    const dune = mesh(new THREE.SphereGeometry(1.6, 16, 8), flat(0xd9b77a), 0, -0.55, 0); dune.scale.set(1, 0.42, 0.9); spot.add(dune);
    spotProp(spot, 'bedouin-tent', { w: 2.0, x: -0.25, z: -0.55, y: 0.05, ry: 0.15 });
    [[-0.2, 0.3], [0.2, -0.3]].forEach(([r, o]) => { const log = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 6), flat(0x4a2f1c), 0.75, 0.1, 0.85); log.rotation.set(Math.PI / 2, 0, r + o); spot.add(log); });
    const flames = [0xffd34a, 0xff8a1f, 0xff4a1a].map((c, k) => { const f = mesh(new THREE.ConeGeometry(0.2 - k * 0.04, 0.6 - k * 0.1, 6), glow(c, 2), 0.75 + (k - 1) * 0.08, 0.38, 0.85); f.castShadow = false; spot.add(f); return f; });
    tick.push((t) => { const m = reduceMotion ? 0 : 1; flames.forEach((f, k) => { const s = 1 + Math.sin(t * (9 + k * 3) + k) * 0.18 * m; f.scale.set(1, s, 1); }); });
    [['عنترة', 'Antarah', -0.95], ['حاتم الطائي', 'Hatim al-Ta\'i', 1.55]].forEach(([ar, en, x]) => {
      const tex = textTex([ar, en], { w: 160, h: 256, bg: '#8f7458', fg: '#2a1c10', font: ['700 40px "Aref Ruqaa", serif', 'italic 26px Spectral, serif'], dir: 'rtl' });
      const st = mesh(new THREE.BoxGeometry(0.42, 1.05, 0.2), [flat(0x8f7458), flat(0x8f7458), flat(0x8f7458), flat(0x8f7458), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }), flat(0x8f7458)], x, 0.5, 0.35);
      st.rotation.y = x < 0 ? 0.35 : -0.35; spot.add(st);
    });
  },
  // a world in a glass jar: gravel, weed, fish, a snail and rising bubbles
  'JarBound'(spot) {
    const H = 1.8, R0 = 0.78;
    spot.add(mesh(new THREE.CylinderGeometry(R0 * 1.02, R0 * 1.02, 0.08, 28), see(0xcfe8ff, 0.35), 0, 0.04, 0));
    const water = mesh(new THREE.CylinderGeometry(R0 * 0.97, R0 * 0.97, H * 0.72, 28), see(0x3d8fd6, 0.32), 0, H * 0.36 + 0.08, 0); water.castShadow = false; spot.add(water);
    const glass = mesh(new THREE.CylinderGeometry(R0, R0, H, 28, 1, true), see(0xdff2ff, 0.18), 0, H / 2 + 0.04, 0); glass.castShadow = false; spot.add(glass);
    spot.add(mesh(new THREE.TorusGeometry(R0 * 0.82, 0.07, 6, 24), see(0xdff2ff, 0.4), 0, H + 0.04, 0)); spot.children.at(-1).rotation.x = Math.PI / 2;
    spot.add(mesh(new THREE.CylinderGeometry(R0 * 0.72, R0 * 0.78, 0.22, 16), flat(0xb08355), 0, H + 0.16, 0)); // cork
    const gravel = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.07, 0), flat(0xffffff), 60), m4 = new THREE.Matrix4();
    for (let k = 0; k < 60; k++) { const a = hash3(k, 1, 7) * TAU, r = Math.sqrt(hash3(k, 2, 7)) * R0 * 0.88; m4.makeTranslation(Math.cos(a) * r, 0.12 + hash3(k, 3, 7) * 0.08, Math.sin(a) * r); gravel.setMatrixAt(k, m4); gravel.setColorAt(k, new THREE.Color().setHSL(0.08, 0.25, 0.4 + hash3(k, 4, 7) * 0.3)); }
    spot.add(gravel);
    const weeds = [[-0.35, -0.2], [0.3, -0.35], [0.05, 0.3]].map(([x, z], k) => { const w = mesh(new THREE.ConeGeometry(0.08, 0.7 + k * 0.15, 5), flat(0x2f9a4a), x, 0.5 + k * 0.07, z); spot.add(w); return w; });
    const fish = [0xff8a2a, 0xffd23a, 0xff5a7a].map((c, k) => { const f = new THREE.Group(); const b = mesh(new THREE.SphereGeometry(0.1, 8, 6), flat(c)); b.scale.set(1.6, 1, 0.7); const tail = mesh(new THREE.ConeGeometry(0.07, 0.14, 4), flat(c), -0.2, 0, 0); tail.rotation.z = Math.PI / 2; f.add(b, tail); spot.add(f); return f; });
    const snail = mesh(new THREE.TorusGeometry(0.07, 0.04, 6, 10), flat(0xc98c4a), R0 * 0.93, 0.6, 0.15); snail.rotation.y = Math.PI / 2; spot.add(snail);
    const bubbles = Array.from({ length: 7 }, (_, k) => { const b = mesh(new THREE.SphereGeometry(0.035, 6, 4), see(0xffffff, 0.6), 0, 0, 0); b.castShadow = false; spot.add(b); return { b, x: (hash3(k, 9, 2) - 0.5) * 0.9, z: (hash3(k, 8, 2) - 0.5) * 0.9, sp: 0.25 + hash3(k, 7, 2) * 0.2, off: hash3(k, 6, 2) }; });
    tick.push((t) => {
      const m = reduceMotion ? 0 : 1;
      fish.forEach((f, k) => { const a = t * (0.5 + k * 0.15) * m + k * 2.1, r = 0.38 + k * 0.08; f.position.set(Math.cos(a) * r, 0.65 + k * 0.22 + Math.sin(t * 1.3 + k) * 0.05 * m, Math.sin(a) * r); f.rotation.y = -a - Math.PI / 2; });
      weeds.forEach((w, k) => { w.rotation.z = Math.sin(t * 1.2 + k) * 0.12 * m; });
      bubbles.forEach((q) => { const y = ((t * q.sp + q.off) % 1) * m; q.b.position.set(q.x, 0.25 + y * 1.0, q.z); q.b.visible = m === 1; });
      snail.position.y = 0.6 + Math.sin(t * 0.2) * 0.25 * m;
    });
  },
  // a reactor running hot and a robot ferrying charged batteries to it from the charger
  'Nuclear Robot'(spot) {
    spotProp(spot, 'reactor', { h: 1.7, x: -0.55, z: -0.1 });
    const ring = mesh(new THREE.TorusGeometry(0.85, 0.05, 6, 28), glow(0xff5a2a, 1.5), -0.55, 0.06, -0.1); ring.rotation.x = Math.PI / 2; spot.add(ring);
    const pad = mesh(new THREE.BoxGeometry(0.55, 0.08, 0.55), glow(0x5aff8a, 0.9), 1.25, 0.04, 0.35); spot.add(pad);
    let bot = null; spotProp(spot, 'battery-robot', { h: 0.7, x: 1.2, z: 0.35, ry: -Math.PI / 2, onLoad: (h) => { bot = h; } });
    const hot = new THREE.Color(0xff3a1a), cool = new THREE.Color(0x3affb0);
    tick.push((t) => {
      const m = reduceMotion ? 0 : 1, u = (Math.sin(t * 0.5) + 1) / 2; // the robot shuttles; the reactor cools when it arrives
      if (bot && m) { bot.position.x = THREE.MathUtils.lerp(1.2, 0.35, u); bot.rotation.y = Math.cos(t * 0.5) > 0 ? -Math.PI / 2 : Math.PI / 2; }
      ring.material.emissive.copy(hot).lerp(cool, m ? u : 0.5); ring.material.color.copy(ring.material.emissive);
    });
  },
  // Much Ado About Nothing on a little stage: a side-on, pixel-built garden; Benedick hides while three friends patrol
  'Much Ado About Nothing'(spot) {
    spot.add(mesh(new THREE.BoxGeometry(2.7, 0.4, 1.5), flat(0x5a3a22), 0, 0.2, 0));
    const back = mesh(new THREE.PlaneGeometry(2.5, 1.5), new THREE.MeshStandardMaterial({ color: 0x8cc4e8, roughness: 1 }), 0, 1.15, -0.7); back.castShadow = false; spot.add(back);
    [[-1.3, 1], [1.3, -1]].forEach(([x]) => spot.add(mesh(new THREE.BoxGeometry(0.22, 1.75, 0.3), flat(0x9e1b2a), x, 1.25, 0.55)));
    spot.add(mesh(new THREE.BoxGeometry(2.8, 0.3, 0.3), flat(0x9e1b2a), 0, 2.05, 0.55));
    spot.add(mesh(new THREE.BoxGeometry(2.9, 0.08, 0.34), glow(0xe3b866, 0.5), 0, 2.22, 0.55));
    const v = 0.14, hedge = (x0, z, n, h = 3) => { for (let i = 0; i < n; i++) for (let j = 0; j < h - (i % 2); j++) spot.add(mesh(new THREE.BoxGeometry(v, v, v), flat(j === h - 1 ? 0x4caa4c : 0x2f7a35), x0 + i * v, 0.47 + j * v, z)); };
    hedge(-1.05, -0.45, 15, 4); hedge(-0.95, 0.35, 5, 3); hedge(0.35, 0.35, 5, 3);
    const ben = voxelFigure(0x2d5aa8); ben.scale.y = 0.75; ben.position.set(-0.55, 0.4, 0.15); spot.add(ben); // crouched behind the front hedge
    const walkers = [[0xa8322d, -0.1], [0x7a3aa8, -0.25], [0xc9963f, 0.05]].map(([c, z], k) => {
      const f = voxelFigure(c); f.position.set(0, 0.4, z); spot.add(f);
      const cone = mesh(new THREE.ConeGeometry(0.28, 0.9, 3), see(0xfff19a, 0.28), 0, 0.85, 0); cone.rotation.z = -Math.PI / 2; cone.castShadow = false; f.add(cone); cone.position.x = 0.55;
      return { f, cone, sp: 0.35 + k * 0.12, ph: k * 2 };
    });
    tick.push((t) => {
      const m = reduceMotion ? 0 : 1;
      walkers.forEach(({ f, cone, sp, ph }) => { const u = Math.sin(t * sp * m + ph); f.position.x = u * 0.95; const dir = Math.cos(t * sp * m + ph) >= 0 ? 1 : -1; cone.position.x = 0.55 * dir; cone.rotation.z = -Math.PI / 2 * dir; });
    });
  },
  // a small gallery for Saudi National Day: a VR headset on a plinth under a green banner, opening soon
  'Saudi National Day VR Museum'(spot) {
    spot.add(mesh(new THREE.BoxGeometry(2.3, 0.16, 1.7), flat(0xf1ece2), 0, 0.08, 0));
    [[-1, -0.7], [1, -0.7], [-1, 0.7], [1, 0.7]].forEach(([x, z]) => spot.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.7, 8), flat(0xf1ece2), x, 0.95, z)));
    spot.add(mesh(new THREE.BoxGeometry(2.4, 0.14, 1.8), flat(0xf1ece2), 0, 1.85, 0));
    const banner = textTex(['اليوم الوطني', 'Saudi National Day'], { w: 512, h: 256, bg: '#0b6b3a', fg: '#ffffff', font: ['700 74px "Aref Ruqaa", serif', '600 40px Spectral, serif'] });
    spot.add(mesh(new THREE.PlaneGeometry(1.9, 0.95), new THREE.MeshStandardMaterial({ map: banner, roughness: 1, side: THREE.DoubleSide }), 0, 1.05, -0.78));
    spotProp(spot, 'vr-headset', { h: 1.0, y: 0.16 });
    const soon = textTex(['Coming soon'], { w: 256, h: 64, bg: '#0e0b1c', fg: '#e3b866', font: 'italic 34px Spectral, serif' });
    spot.add(mesh(new THREE.PlaneGeometry(0.8, 0.2), new THREE.MeshBasicMaterial({ map: soon }), 0, 0.32, 0.86));
  },

  /* the Workshop */
  // the HVAC outdoor unit commissioned in Canberra, wired to a Raspberry Pi cabinet on Modbus
  'Totex Energy'(spot) {
    spotProp(spot, 'hvac-unit', { h: 1.15, x: -0.35, ry: 0.2 });
    const cab = mesh(new THREE.BoxGeometry(0.5, 0.75, 0.32), flat(0x9aa0a6), 0.85, 0.38, 0.25); spot.add(cab);
    spot.add(mesh(new THREE.BoxGeometry(0.34, 0.24, 0.02), flat(0x1e7a3a), 0.85, 0.5, 0.42)); // the Pi's green board behind the door
    const led = mesh(new THREE.SphereGeometry(0.035, 6, 4), glow(0x5aff7a, 2), 0.95, 0.66, 0.43); spot.add(led);
    const cable = new THREE.CatmullRomCurve3([new THREE.Vector3(0.62, 0.25, 0.25), new THREE.Vector3(0.35, 0.05, 0.35), new THREE.Vector3(0.1, 0.25, 0.3)]);
    spot.add(mesh(new THREE.TubeGeometry(cable, 12, 0.025, 5), flat(0x2a2a2a)));
    tick.push((t) => { led.visible = reduceMotion || Math.sin(t * 6) > -0.3; });
  },
  // a crop bed with drip lines: water pulses along each branch, and a blocked branch is caught and flagged red
  'AquaFlow'(spot) {
    spot.add(mesh(new THREE.BoxGeometry(2.0, 0.22, 1.3), flat(0x5b3a22), 0, 0.11, 0.1));
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) spot.add(mesh(new THREE.ConeGeometry(0.07, 0.28, 5), flat(0x4fae46), -0.8 + c * 0.32, 0.36, -0.28 + r * 0.38));
    spotProp(spot, 'solar-panel', { h: 0.9, x: 0.15, z: -0.85, ry: 0 });
    const lines = [0, 1, 2].map((r) => {
      const z = -0.17 + r * 0.38;
      const pipe = mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.9, 6), flat(0x1f1f24), 0, 0.25, z); pipe.rotation.z = Math.PI / 2; spot.add(pipe);
      spot.add(mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), glow(0x52d4ff, 0.8), -1.0, 0.26, z)); // a flow-sensor node at the head of each branch
      const drops = [0, 1, 2].map(() => { const d = mesh(new THREE.SphereGeometry(0.045, 6, 4), glow(0x52b4ff, 2)); d.castShadow = false; spot.add(d); return d; });
      return { z, pipe, drops };
    });
    tick.push((t) => {
      const m = reduceMotion ? 0 : 1, blocked = Math.floor(t / 6) % 3; // every few seconds a different branch is blocked
      lines.forEach(({ z, pipe, drops }, r) => {
        const bad = r === blocked;
        pipe.material.color.setHex(bad && Math.sin(t * 8) > 0 ? 0xff3a2a : 0x1f1f24);
        drops.forEach((d, k) => { const u = ((t * 0.35 * m + k / 3) % 1); d.position.set(-0.95 + u * (bad ? 0.6 : 1.9), 0.27, z); d.visible = !bad || u < 0.95; });
      });
    });
  },
  // Al-Anqa, the course's robot, driving laps of a practice mat
  'ABAAD Robotics'(spot) {
    const mat = textTex(['', 'ABAAD · أبعاد', ''], { w: 256, h: 256, bg: '#173a5e', fg: '#e3b866', font: '600 26px Spectral, serif' });
    const ctx = mat.image.getContext('2d'); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(128, 128, 96, 72, 0, 0, TAU); ctx.stroke(); mat.needsUpdate = true;
    pageFonts.then(() => { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(128, 128, 96, 72, 0, 0, TAU); ctx.stroke(); mat.needsUpdate = true; });
    const base = mesh(new THREE.BoxGeometry(1.8, 0.05, 1.8), [flat(0x173a5e), flat(0x173a5e), new THREE.MeshStandardMaterial({ map: mat, roughness: 1 }), flat(0x173a5e), flat(0x173a5e), flat(0x173a5e)], 0, 0.03, 0); spot.add(base);
    let bot = null; spotProp(spot, 'anqa-robot', { h: 0.38, x: 0.68, onLoad: (h) => { bot = h; } });
    tick.push((t) => {
      if (!bot) return;
      const a = t * 0.45 * (reduceMotion ? 0 : 1);
      bot.position.set(Math.cos(a) * 0.68, 0.06, Math.sin(a) * 0.5); bot.rotation.y = -a; // nose along the track
    });
  },
  // a see-through duct with streamlines bending round a cylinder, blue where slow and red where fast, like a CFD plot
  'The Flow Trials'(spot) {
    const L = 2.2, D0 = 0.75;
    spot.add(mesh(new THREE.BoxGeometry(L, D0, D0), see(0xcfe8ff, 0.16), 0, 0.55, 0));
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([y, z]) => { const e = mesh(new THREE.BoxGeometry(L, 0.03, 0.03), flat(0x8a8f99), 0, 0.55 + y * D0 / 2, z * D0 / 2); spot.add(e); });
    const cyl = mesh(new THREE.CylinderGeometry(0.16, 0.16, D0, 14), flat(0x6a6f7a), 0, 0.55, 0); cyl.rotation.x = Math.PI / 2; spot.add(cyl);
    [-1, 1].forEach((sx) => spot.add(mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), flat(0x55565e), sx * 0.9, 0.0, 0)));
    const N2 = 42, dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 5, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), N2);
    dots.castShadow = false; spot.add(dots);
    const lanes = Array.from({ length: N2 }, (_, k) => ({ y0: -0.28 + (k % 7) * (0.56 / 6), z: -0.25 + Math.floor(k / 7) % 3 * 0.25, off: hash3(k, 3, 3) }));
    const m4 = new THREE.Matrix4(), col = new THREE.Color(), slow = new THREE.Color(0x3a7bff), fast = new THREE.Color(0xff3a2a);
    tick.push((t) => {
      const m = reduceMotion ? 0.05 : 1;
      lanes.forEach((l, k) => {
        const u = (t * 0.22 * m + l.off) % 1, x = -L / 2 + u * L;
        const near = Math.exp(-((x / 0.35) ** 2)); // the flow squeezes round the cylinder and speeds up
        const y = l.y0 + Math.sign(l.y0 || 0.01) * near * Math.max(0, 0.2 - Math.abs(l.y0) * 0.5);
        m4.makeTranslation(x, 0.55 + y, l.z); dots.setMatrixAt(k, m4);
        dots.setColorAt(k, col.copy(slow).lerp(fast, Math.min(1, near * (1.3 - Math.abs(l.y0) * 2))));
      });
      dots.instanceMatrix.needsUpdate = true; dots.instanceColor.needsUpdate = true;
    });
  },
  /* the Observatory */
  // a guard for a substation: commands arrive as pulses; good ones pass, bad ones hit the shield and are quarantined
  'Sentinel'(spot) {
    spotProp(spot, 'transformer', { h: 1.3, z: -0.05 });
    for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU; spot.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), flat(0x8a8f99), Math.cos(a) * 1.25, 0.25, Math.sin(a) * 1.25)); }
    const fence = mesh(new THREE.TorusGeometry(1.25, 0.015, 4, 40), flat(0x8a8f99), 0, 0.45, 0); fence.rotation.x = Math.PI / 2; spot.add(fence);
    const shield = mesh(new THREE.SphereGeometry(1.1, 24, 12, 0, TAU, 0, Math.PI / 2), see(0x52d4ff, 0.14), 0, 0.02, 0); shield.castShadow = false; spot.add(shield);
    const pulse = mesh(new THREE.SphereGeometry(0.08, 8, 6), glow(0x52ff9a, 2), 0, 0, 0); pulse.castShadow = false; spot.add(pulse);
    const ok = new THREE.Color(0x52ff9a), bad = new THREE.Color(0xff3a2a), calm = new THREE.Color(0x52d4ff);
    let flash = 0;
    tick.push((t, dt) => {
      const m = reduceMotion ? 0 : 1, n = Math.floor(t / 2.5), u = (t / 2.5) % 1, isBad = n % 3 === 2, a = n * 2.3;
      const r = isBad ? Math.max(1.12, 2.4 - u * 2.4) : 2.4 - u * 2.4, h = 0.15 + Math.max(0, r) * 0.25;
      pulse.visible = m === 1 && r > 0.2; pulse.position.set(Math.cos(a) * r, h, Math.sin(a) * r);
      pulse.material.emissive.copy(isBad ? bad : ok); pulse.material.color.copy(pulse.material.emissive);
      if (isBad && r <= 1.12 && u < 0.6) flash = 1;
      flash = Math.max(0, flash - dt * 1.5);
      shield.material.color.copy(calm).lerp(bad, flash); shield.material.opacity = 0.14 + flash * 0.3;
    });
  },
  // a telescope on a small dome; now and then the star it points at brightens with the moment its light left Earth
  'Sirius'(spot) {
    spot.add(mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.5, 20), flat(0xe8e2d6), 0, 0.25, 0));
    spot.add(mesh(new THREE.SphereGeometry(0.75, 20, 10, 0, TAU, 0, Math.PI / 2), flat(0xf1ece2), 0, 0.5, 0));
    spotProp(spot, 'telescope', { h: 1.2, x: 0.85, z: 0.5, ry: -0.6 });
    const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xcfe4ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    star.position.set(-0.3, 3.0, -0.4); star.scale.setScalar(0.5); spot.add(star);
    const moments = ['1969 · Moon landing', '1687 · Newton\'s Principia', '1905 · Einstein\'s miracle year', '1492 · Columbus sails'];
    const tags = moments.map((m) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex([m], { w: 512, h: 96, fg: '#cfe4ff', font: 'italic 44px Spectral, serif' }), transparent: true, depthWrite: false })); sp.scale.set(2.2, 0.41, 1); sp.position.set(-0.3, 3.55, -0.4); sp.material.opacity = 0; spot.add(sp); return sp; });
    tick.push((t) => {
      const k = Math.floor(t / 5) % tags.length, u = (t / 5) % 1, b = reduceMotion ? 0.6 : Math.sin(u * Math.PI);
      star.scale.setScalar(0.4 + b * 0.5); star.material.opacity = 0.5 + b * 0.5;
      tags.forEach((s, j) => { s.material.opacity = j === k ? b : 0; });
    });
  },
};
// The Arcade's ring, by place: the middle, then the front and round. The tall tower stands in the middle and the
// least-finished project goes at the back, where the tower hides it most.
const arcadeOrder = ['Chimera Ants', 'Much Ado About Nothing', 'Riyma', 'Creep Crawlers', 'Saudi National Day VR Museum', 'Nuclear Robot', 'JarBound'];
function buildIslets(g, hubIndex) {
  D.areas.forEach((A, ai) => {
    const pos = isletAt[A.id], col = new THREE.Color(A.color);
    const isle = island(A.color, A.id === 'games' ? 'neutral' : 'melbourne', 40 + ai * 9);
    const ISLET = isletScale[A.id];
    isle.scale.setScalar(ISLET); isle.position.copy(pos);
    isle.rotation.y = Math.atan2(-pos.x, -pos.z) * 0.25; // turned a little toward the hub
    // the islet's name floats above it
    const sign = isletSign(A.name, A.fx, A.color); sign.position.set(0, 7.2, 0); sign.scale.multiplyScalar(1 / ISLET); isle.add(sign);
    // a stand-in for each project until its landmark is built: a plinth and a glowing crystal
    let list = isletProjects(A.id);
    if (A.id === 'games') { // its ring is full: no trees, and the projects in their set places
      isle.userData.trees.forEach((t) => isle.remove(t)); isle.userData.trees = [];
      list = [...arcadeOrder.map((n) => list.find((q) => q.name === n)).filter(Boolean), ...list.filter((q) => !arcadeOrder.includes(q.name))];
    }
    slotsFor(list.length).forEach(([x, z], k) => {
      const q = list[k], spot = new THREE.Group(); spot.position.set(x, 0.3, z); spot.name = `spot:${q.name}`;
      Object.assign(spot.userData, { project: q.name, area: ai, realm: hubIndex });
      spot.scale.setScalar({ hardware: 1.15, software: 1.5 }[A.id] || 1); // fewer projects, bigger landmarks
      isle.add(spot);
      if (landmarkOf[q.name]) landmarkOf[q.name](spot);
      else { // a stand-in: a plinth and a glowing crystal
        const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.5, 6), stone(0x6f6878)); plinth.position.y = 0.25;
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), glow(col, 1.2)); gem.position.y = 1.15;
        spin.push({ o: gem, y: 0.8 });
        spot.add(plinth, gem);
      }
      spot.traverse((o) => { o.userData.project = q.name; });
    });
    isle.traverse((o) => { o.userData.area = ai; });
    isletGroups[A.id] = isle;
    g.add(isle);
  });
  // bridges from the hub's rim to each islet, and from the Workshop up to the Observatory
  const rim = (to, r) => to.clone().setY(0).normalize().multiplyScalar(r).setY(0.32);
  const edgeOf = (id, toward) => isletAt[id].clone().add(toward.clone().sub(isletAt[id]).setY(0).normalize().multiplyScalar(5.6 * isletScale[id])).setY(isletAt[id].y + 0.32 * isletScale[id]);
  ['hardware', 'games'].forEach((id) => ropeBridge(g, rim(isletAt[id], 5.4), edgeOf(id, new THREE.Vector3())));
  ropeBridge(g, rim(isletAt.software, 5.2), edgeOf('software', new THREE.Vector3()), 0.6);
  ropeBridge(g, edgeOf('hardware', isletAt.software), edgeOf('software', isletAt.hardware), 0.5);
}

/* ---------- place realms on the ring ---------- */
const realms = D.realms.map((r, i) => {
  const angle = (i / N) * TAU;
  const y = Math.sin(i * 1.7) * 3;
  const g = island(r.color, r.land, i * 3.7 + 1);
  g.position.set(Math.cos(angle) * RING, y, Math.sin(angle) * RING);
  g.rotation.y = -angle + Math.PI / 2; // local +z faces outward, toward the camera
  g.userData.realm = i;
  build[r.id](g, r.color);
  if (r.id === 'quests') buildIslets(g, i);
  if (landmarks[r.id]) landmarks[r.id](g);
  g.traverse((o) => { o.userData.realm = i; });
  scene.add(g);
  bob.push({ o: g, y, amp: 0.45, speed: 0.45, phase: i * 1.3 });
  return { ...r, angle, y, group: g };
});

// glowing path of stepping stones between islands
for (let i = 0; i < N; i++) {
  const a0 = realms[i].angle, y0 = realms[i].y, y1 = realms[(i + 1) % N].y;
  for (let k = 1; k < 8; k++) {
    const f = k / 8, a = a0 + f * (TAU / N);
    if (f < 0.2 || f > 0.8) continue;
    const s = new THREE.Mesh(jitter(new THREE.CylinderGeometry(0.7, 0.3, 0.5, 6), 0.2), stone(0x6a6070));
    const y = THREE.MathUtils.lerp(y0, y1, f) - 0.6 + Math.sin(f * Math.PI) * 1.2;
    s.position.set(Math.cos(a) * RING, y, Math.sin(a) * RING);
    scene.add(s); bob.push({ o: s, y, amp: 0.3, speed: 0.8, phase: k + i });
  }
}

// The Rukh of Sinbad's voyages circles high above the islands.
const rukh = new THREE.Group(); scene.add(rukh);
const flapT = { value: 0 };
loadModel('roc', { hops: 3 }).then((res) => {
  const m = res.scene.clone(), box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
  m.position.sub(box.getCenter(new THREE.Vector3()));
  m.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone(); o.material.metalness = 0; o.material.roughness = 0.9;
    // flap: bend the wings up and down around the body, more strongly towards the tips
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox, sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    const alongX = sz.x >= sz.z, half = (alongX ? sz.x : sz.z) / 2, mid = alongX ? c.x : c.z;
    o.material.onBeforeCompile = (sh) => {
      sh.uniforms.flapT = flapT;
      sh.vertexShader = 'uniform float flapT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float d = (transformed.${alongX ? 'x' : 'z'} - ${mid.toFixed(4)}) / ${half.toFixed(4)};
        float w = smoothstep(0.12, 1.0, abs(d));
        transformed.y += sin(flapT * 4.2) * w * w * ${(half * 0.55).toFixed(4)} + w * ${(half * 0.06).toFixed(4)};`);
    };
  });
  const k = 9 / Math.max(size.x, size.z); m.scale.setScalar(k); rukh.add(m);
}).catch(() => {});
tick.push((t) => {
  const a = t * 0.045;
  rukh.position.set(Math.cos(a) * 30, 14 + Math.sin(t * 0.4) * 1.5, Math.sin(a) * 30);
  rukh.rotation.set(0, -a, 0.25);
  flapT.value = reduceMotion ? 0 : t;
  rukh.position.y += Math.sin(t * 4.2 + 1.2) * 0.25;
});

let best = 0, shots = 0;
try { best = +localStorage.getItem('best-shot') || 0; } catch { /* storage unavailable */ }
function loose() {
  const score = shoot();
  if (!score) return;
  shots++;
  if (score > best) { best = score; try { localStorage.setItem('best-shot', best); } catch { /* ignore */ } }
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setTimeout(() => { set('s-last', score === 10 ? '10 ✦' : score); set('s-best', best); set('s-n', shots); }, 420);
}

/* ================================================================== */
/*  Panels                                                             */
/* ================================================================== */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const motto = (t) => `<blockquote class="verse"><p lang="ar" dir="rtl">${t.ar.map(esc).join('<br>')}</p><p>${esc(t.en)}</p></blockquote>`;
const head = (r, title) => {
  const where = (D.lands[r.land] || {}).short;
  const idx = D.realms.findIndex((x) => x.id === r.id);
  const ch = ['الفصل الأول', 'الفصل الثاني', 'الفصل الثالث', 'الفصل الرابع', 'الفصل الخامس', 'الفصل السادس', 'الفصل السابع'][idx] || '';
  return `<p class="chapter"><span lang="ar">${ch}</span> · Chapter ${idx + 1} of ${D.realms.length}</p><p class="kicker">${esc(r.place)}${where ? ` · ${esc(where)}` : ''}<span class="kicker-ar" lang="ar">${esc(r.placeAr || '')}</span></p><h2>${esc(r.heading)}</h2><p class="fx-title">${esc(title)}</p>`;
};
// a plain label first, its fantasy name after it, smaller
const dual = (plain, fx) => `${esc(plain)} <span class="fx">${esc(fx)}</span>`;
function journeyMap() { // a real map: the three places I have lived, joined in the order I lived there
  const { W, H, land, at } = MAP;
  const lab = { Makkah: [10, 16, 'start'], Swansea: [10, -2, 'start'], Melbourne: [-10, -22, 'end'] };
  const pts = D.hero.journey.map((j) => at[j.place]);
  const arcs = pts.slice(1).map((b, i) => {
    const a = pts[i], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.28;
    return `<path d="M${a[0]} ${a[1]} Q${mx} ${my} ${b[0]} ${b[1]}" />`;
  }).join('');
  const dots = D.hero.journey.map((j, i) => {
    const [x, y] = pts[i], [dx, dy, anchor] = lab[j.place] || [10, 0, 'start'];
    return `<g class="jm-${j.land}"><circle class="halo" cx="${x}" cy="${y}" r="9" /><circle cx="${x}" cy="${y}" r="4.5" />
      <text x="${x + dx}" y="${y + dy}" text-anchor="${anchor}"><tspan class="n">${i + 1}</tspan> ${esc(j.place)} <tspan class="ar">${esc(j.ar)}</tspan></text>
      <text class="sub" x="${x + dx}" y="${y + dy + 13}" text-anchor="${anchor}">${esc(j.note)}</text></g>`;
  }).join('');
  return `<svg class="journey-map" viewBox="0 0 ${W} ${H}" role="img" aria-label="A map: Makkah, then Swansea, then Melbourne">
    <rect class="sea" width="${W}" height="${H}" rx="4" /><path class="land" d="${land}" />
    <g class="arcs">${arcs}</g>${dots}</svg>`;
}

// One school of the skill tree, grown downward through its tiers: Seasoned, Adept, Novice.
let school = 0;
const findable = (u) => (D.quests.some((q) => q.name === u) ? 'quests' : D.pursuits.some((q) => q.name === u) ? 'pursuits' : '');
function schoolPanel(bi) {
  const b = D.skillTree[bi];
  const proven = new Set(b.skills.flatMap((s) => s.used || []));
  const top = b.skills.filter((s) => s.rank === 3).length;
  const tile = (s) => `<div class="skill" data-skill="${bi}-${b.skills.indexOf(s)}" tabindex="0">
      <span class="s-name">${esc(s.name)}</span>${s.used ? `<span class="s-used">${s.used.map((u) => {
        const where = findable(u);
        return where ? `<button type="button" data-goto="${where}" data-find="${esc(u)}">${esc(u)}</button>` : esc(u);
      }).join(' · ')}</span>` : ''}</div>`;
  return `<div class="school" style="--c:${b.color}">
    <p class="school-sum">${b.skills.length} skills${top ? ` · ${top} seasoned` : ''}${proven.size ? ` · put to work in ${proven.size} ${proven.size === 1 ? 'project' : 'projects'}` : ''}</p>
    <ol class="tiers">${[3, 2, 1].filter((rank) => b.skills.some((s) => s.rank === rank)).map((rank) => `
      <li class="tier t${rank}"><h4><span class="pips">${[1, 2, 3].map((n) => `<i class="${n <= rank ? 'on' : ''}"></i>`).join('')}</span>${D.rankNames[rank]}</h4>
        <div class="tiles">${b.skills.filter((s) => s.rank === rank).map(tile).join('')}</div></li>`).join('')}</ol>
    <p class="school-hint">${matchMedia('(hover: hover)').matches ? 'Hover' : 'Tap'} a skill to find it in the tree; tap a project to see the proof.</p>
  </div>`;
}
function pickSchool(bi, focus = false) {
  school = ((bi % D.skillTree.length) + D.skillTree.length) % D.skillTree.length;
  const body = panel.querySelector('#school');
  if (!body) return;
  body.innerHTML = schoolPanel(school);
  body.setAttribute('aria-labelledby', `school-tab-${school}`);
  panel.querySelectorAll('[data-school]').forEach((t) => {
    const on = +t.dataset.school === school;
    t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
    if (on && focus) t.focus();
  });
  lightSkill(null);
}
// The Character panel's attributes: the six scores as one shape on a hexagon web (scaled 8-20 so the
// differences show), with the evidence for each listed beneath.
const attributesSection = () => {
  const A = D.hero.attributes, n = A.length, C = 130, R = 92, lo = 8, hi = 20;
  const pt = (i, r) => { const a = -Math.PI / 2 + (i / n) * TAU; return [C + Math.cos(a) * r, C + Math.sin(a) * r]; };
  const ring = (f) => A.map((_, i) => pt(i, R * f).map((v) => v.toFixed(1)).join(',')).join(' ');
  const shape = A.map((a, i) => pt(i, R * (a.value - lo) / (hi - lo)).map((v) => v.toFixed(1)).join(',')).join(' ');
  return `<section><h3>${dual('Strengths', 'Attributes')}</h3>
    <svg class="radar" viewBox="0 0 260 260" role="img" aria-label="Strengths: ${A.map((a) => a.label).join(', ')}">
      ${[0.25, 0.5, 0.75, 1].map((f) => `<polygon class="r-ring" points="${ring(f)}"/>`).join('')}
      ${A.map((_, i) => { const [x, y] = pt(i, R); return `<line class="r-axis" x1="${C}" y1="${C}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }).join('')}
      <polygon class="r-shape" points="${shape}"/>
      ${A.map((a, i) => { const [x, y] = pt(i, R * (a.value - lo) / (hi - lo)); return `<circle class="r-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2"/>`; }).join('')}
      ${A.map((a, i) => { const [x, y] = pt(i, R + 22); return `<text class="r-key" x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}">${esc(a.key)}</text>`; }).join('')}
    </svg>
    <dl class="r-list">${A.map((a) => `<dt><abbr>${esc(a.key)}</abbr> ${esc(a.label)}</dt><dd>${esc(a.note)}</dd>`).join('')}</dl></section>`;
};

// a project line: plain text, or a game whose name opens it to play
const objective = (o) => (typeof o === 'string' ? esc(o)
  : `<a class="play" href="${esc(o.play)}" target="_blank" rel="noopener" title="Play ${esc(o.game)} in your browser">▶ ${esc(o.game)}</a> ${esc(o.text)}`);
// The Quests panel lists paid work apart from projects, so an employer sees the job first.
const questCards = (list, openFirst) => list.map((q, i) => `
      <details class="quest${q.featured ? ' featured' : ''}" data-name="${esc(q.name)}"${i === 0 && openFirst ? ' open' : ''}>
        <summary>
          ${q.featured || q.award || q.play ? `<span class="badges">${q.featured ? '<span class="start-here">★ Start here</span>' : ''}${q.award ? `<span class="start-here award">♛ ${esc(q.award)}</span>` : ''}${q.play ? '<span class="start-here playable">▶ Playable</span>' : ''}</span>` : ''}<span class="q-kind">${esc(q.plain)}${q.when ? ` · ${esc(q.when)}` : ''} <span class="fx">${esc(q.kind)}</span></span>
          <span class="q-status ${q.status === 'Active' ? 'active' : ''}">${esc(q.status)}</span>
          <span class="q-name">${esc(q.name)}</span><span class="q-role">${esc(q.role)}</span>
        </summary>
        <div class="q-body">${q.logo ? `<img class="q-logo" src="assets/logos/${esc(q.logo)}?v=51" alt="${esc(q.name)} logo">` : ''}${q.play ? `<p class="q-play"><a class="play-btn" href="${esc(q.play)}" target="_blank" rel="noopener">▶ Play ${esc(q.name)} in your browser</a></p>` : ''}<p>${esc(q.summary)}</p>
          <ul>${q.objectives.map((o) => `<li>${objective(o)}</li>`).join('')}</ul>
          ${q.flow ? `<div class="flow" aria-label="How it works">${q.flow.map((f) => `<span>${esc(f)}</span>`).join('<i>→</i>')}</div>` : ''}
          <p class="chips-label">Tools &amp; skills</p><div class="chips">${q.loot.map((l) => `<span class="chip">${esc(l)}</span>`).join('')}</div>
          ${q.links ? `<p class="q-links">${q.links.map((l) => `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('')}</p>` : ''}
        </div>
      </details>`).join('');
const questGroup = (title, list, first) => (list.length ? `<section class="q-group"><h3>${title}</h3>${questCards(list, first === 0)}</section>` : '');

// Projects split three ways, one tab per islet: Hardware (the Workshop), Software (the Observatory), Games (the Arcade).
let area = 0;
const inArea = (ai) => D.quests.filter((q) => (q.areas || []).includes(D.areas[ai].id));
function areaPanel(ai) {
  const a = D.areas[ai], list = inArea(ai);
  return `<p class="area-sum"><b>${esc(a.fx)}</b> · ${esc(a.sub)} · ${list.length} ${list.length === 1 ? 'project' : 'projects'}</p>${questCards(list, false)}`;
}
function pickArea(ai, focus = false) {
  area = ((ai % D.areas.length) + D.areas.length) % D.areas.length;
  const body = panel.querySelector('#area');
  if (!body) return;
  body.innerHTML = areaPanel(area);
  body.setAttribute('aria-labelledby', `area-tab-${area}`);
  panel.querySelectorAll('[data-area]').forEach((t) => {
    const on = +t.dataset.area === area;
    t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
    if (on && focus) t.focus();
  });
  if (playing) history.replaceState(null, '', `#quests/${D.areas[area].id}`);
  onArea(area);
}
// the scene hooks in here to fly the camera to the islet (set once the islets exist)
let onArea = () => {};
// find a project's card, switching to the tab it lives under if need be
function findCard(test) {
  let el = [...panel.querySelectorAll('[data-name]')].find(test);
  if (el || !panel.querySelector('#area')) return el;
  const q = D.quests.find((x) => x.areas && test({ dataset: { name: x.name } }));
  if (!q) return null;
  pickArea(D.areas.findIndex((a) => a.id === q.areas[0]));
  return [...panel.querySelectorAll('[data-name]')].find(test);
}

// The first thing on the Character panel: who I am in two lines, for someone hiring.
function glance() {
  const job = D.quests.find((q) => q.experience), study = D.academies[0], mail = D.email.join('@');
  return `<div class="glance">
    <p class="glance-sum">${esc(D.hero.summary)}</p>
    <dl>
      <dt>Studying</dt><dd>${esc(study.what)}, ${esc(study.name)} <span>${esc(study.when)}</span></dd>
      ${job ? `<dt>Experience</dt><dd>${esc(job.role.split(' · ')[0])}, ${esc(job.name)} <span>${esc(job.when)}</span></dd>` : ''}
      <dt>Looking for</dt><dd>Learning opportunities: internships and placements</dd>
    </dl>
    <p class="glance-actions"><a href="mailto:${esc(mail)}">Email me</a><button type="button" data-open-summary>View CV</button><button type="button" data-go="quests">See my work</button></p>
  </div>`;
}

const panels = {
  hero: (r) => `${head(r, D.hero.title)}
    ${glance()}
    <p class="lore">${esc(D.hero.lore)}</p>
    <dl class="meta">
      <dt>${dual('Degree', 'Class')}</dt><dd>${esc(D.hero.klass)}</dd>
      <dt>${dual('University', 'Guild')}</dt><dd>${esc(D.hero.guild)}</dd>
      <dt>${dual('Based in', 'Realm')}</dt><dd>${esc(D.hero.realm)}</dd>
    </dl>
    ${attributesSection()}
    <section><h3>Journey</h3>${journeyMap()}</section>
    <section><h3>${dual('Languages', 'Tongues')}</h3><div class="chips">${D.hero.tongues.map((t) => `<span class="chip"><b>${esc(t.name)}</b> · ${esc(t.rank)} · <i${t.name === 'Arabic' ? ' lang="ar"' : t.name === 'Welsh' ? ' lang="cy"' : ''}>${esc(t.hello)}</i></span>`).join('')}</div></section>`,

  quests: (r) => `${head(r, 'Quest Log')}
    <p class="lore">Campaigns fought, raids survived and two epics still unfolding.</p>
    ${motto(D.mottos.quests)}
    ${questGroup('Experience', D.quests.filter((q) => q.experience), 0)}
    <section class="q-group"><h3>Projects</h3>
    <div class="schools areas" role="tablist" aria-label="Kinds of project">${D.areas.map((a, ai) => `
      <button type="button" role="tab" id="area-tab-${ai}" data-area="${ai}" aria-controls="area" aria-selected="${ai === area}" tabindex="${ai === area ? 0 : -1}" style="--c:${a.color}">
        <b>${esc(a.name)}</b><span>${esc(a.fx)} · ${inArea(ai).length}</span></button>`).join('')}</div>
    <div id="area" role="tabpanel" aria-labelledby="area-tab-${area}">${areaPanel(area)}</div></section>`,

  skills: (r) => `${head(r, 'Skill Tree')}
    <blockquote class="verse abqar"><p lang="ar" dir="rtl"><b>${esc(D.folklore.abqar.ar[0])}</b><br>${esc(D.folklore.abqar.ar[1])}</p><p>${esc(D.folklore.abqar.en)}</p></blockquote>
    <div class="schools" role="tablist" aria-label="Schools of skill">${D.skillTree.map((b, bi) => `
      <button type="button" role="tab" id="school-tab-${bi}" data-school="${bi}" aria-controls="school" aria-selected="${bi === school}" tabindex="${bi === school ? 0 : -1}" style="--c:${b.color}">
        <b>${esc(b.branch)}</b><span>${esc(b.sub)}</span></button>`).join('')}</div>
    <div id="school" role="tabpanel" aria-labelledby="school-tab-${school}">${schoolPanel(school)}</div>`,

  trophies: (r) => `${head(r, 'Deeds & Honours')}
    <section>${D.trophies.map((t) => `
      <div class="trophy"><span class="medal ${t.tier}">♛</span>
        <div><strong>${t.plain ? dual(t.plain, t.name) : esc(t.name)}</strong><span>${esc(t.detail)}</span></div><time>${esc(t.when)}</time></div>`).join('')}</section>
    <section><h3>${dual('Certifications', 'Scrolls')}</h3><ul class="scrolls">${D.scrolls.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></section>`,

  pursuits: (r) => `${head(r, 'Beyond the Workshop')}
    <blockquote class="verse"><p lang="ar" dir="rtl">${D.folklore.antarah.ar.map(esc).join('<br>')}</p>
      <p>${esc(D.folklore.antarah.en)}</p><cite>${esc(D.folklore.antarah.by)} · <span lang="ar">${esc(D.folklore.antarah.byAr)}</span></cite></blockquote>
    <p class="lore">What I do when nobody is marking it.</p>
    <div class="range">
      <button type="button" id="loose">Loose an arrow</button>
      <div class="score"><span>Last <b id="s-last">–</b></span><span>Best <b id="s-best">${best || '–'}</b></span><span>Shots <b id="s-n">${shots}</b></span></div>
    </div>
    <section style="margin-top:18px">${D.pursuits.map((p) => `
      <div class="pursuit" data-name="${esc(p.name)}"><span class="pg">${esc(p.glyph)}</span>${p.flag ? `<span class="chequer" role="img" title="${esc(p.flag)}" aria-label="${esc(p.flag)}"></span>` : ''}
        <div><strong>${esc(p.name)}</strong><p>${esc(p.detail)}</p>${p.extra ? `<p class="extra">${esc(p.extra)}</p>` : ''}</div></div>`).join('')}</section>`,

  guilds: (r) => `${head(r, 'Guilds & Academies')}
    ${motto(D.mottos.guilds)}
    <section><h3>Where I belong</h3><div class="logo-wall">${D.badges.map((b) => `
      <a class="logo-tile" href="${esc(b.href)}" target="_blank" rel="noopener" title="${esc(b.name)}"${b.bg ? ` style="background:${esc(b.bg)}"` : ''}>
        ${b.logo ? `<img src="assets/logos/${esc(b.logo)}?v=51" alt="${esc(b.name)} logo" loading="lazy">` : `<b class="name-badge"><i lang="ar">${esc(b.ar)}</i>${esc(b.name)}</b>`}<span>${esc(b.note)}</span></a>`).join('')}</div></section>
    <section><h3>${dual('Clubs & leadership', 'Banners carried')}</h3>${D.guilds.map((g) => `
      <div class="card">${g.logo ? `<img class="card-logo" src="assets/logos/${esc(g.logo)}?v=51" alt=""${g.logoBg ? ` style="background:${esc(g.logoBg)}"` : ''}>` : ''}<time>${esc(g.when)}</time><strong>${esc(g.name)}</strong>
        <span class="sub">${esc(g.role)} · ${esc(g.place)}</span><p>${esc(g.detail)}</p></div>`).join('')}</section>
    <section><h3>${dual('Education', 'Academies')}</h3>${D.academies.map((a) => `
      <div class="card">${a.logo ? `<img class="card-logo" src="assets/logos/${esc(a.logo)}?v=51" alt="">` : ''}<time>${esc(a.when)}</time><strong>${esc(a.name)}</strong><p>${esc(a.what)}</p></div>`).join('')}</section>`,

  portal: (r) => `${head(r, 'Open a Gate')}
    <p class="lore">Looking for an engineer who is ready to be useful from day one? Step through.</p>
    <p class="seeking">${esc(D.hero.seeking)}</p>
    <section style="margin-top:20px">
      <a class="gate" href="mailto:${esc(D.email.join('@'))}"><div><strong>Email</strong><br><span>${esc(D.email.join('@'))}</span></div></a>${D.portals.map((p) => `
      <a class="gate" href="${esc(p.href)}" target="_blank" rel="noopener"><div><strong>${esc(p.name)}</strong><br><span>${esc(p.hint)}</span></div></a>`).join('')}
      <button class="gate" type="button" data-open-summary><div><strong>One-page summary</strong><br><span>Plain version you can print or save as a PDF</span></div></button></section>`,
};

/* ================================================================== */
/*  Navigation                                                         */
/* ================================================================== */
const panel = document.getElementById('panel');
const hotbar = document.getElementById('hotbar');
const place = document.getElementById('place');
let current = -1;
let targetAngle = realms[0].angle;

hotbar.innerHTML = realms.map((r, i) =>
  `<button type="button" data-i="${i}" style="--c:${r.color}"><kbd>${i + 1}</kbd><span class="g">${r.glyph}</span>${esc(r.short)}</button>`).join('');
hotbar.querySelectorAll('button').forEach((b, k) => { b.title = `${realms[k].short} · ${realms[k].name}`; });
hotbar.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) go(+b.dataset.i); });
panel.addEventListener('click', (e) => { if (e.target.closest('#loose')) loose(); });
panel.addEventListener('keydown', (e) => {
  const tab = e.target.closest('[data-school], [data-area]');
  if (!tab || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault(); e.stopPropagation();
  const isArea = 'area' in tab.dataset, n = isArea ? D.areas.length : D.skillTree.length, at = isArea ? area : school;
  const to = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : at + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1);
  if (isArea) pickArea(to, true); else pickSchool(to, true);
});
// header buttons that travel, e.g. Contact -> the Portal
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (b) { start(); go(realms.findIndex((r) => r.id === b.dataset.go)); }
});

// One-time hints for things that are easy to miss. Remembered per browser where storage allows.
const hintEl = document.getElementById('hint');
const touch = matchMedia('(hover: none)').matches;
const hints = {
  pursuits: touch ? 'Tap the target on the island to loose an arrow.' : 'Click the target on the island, or press Space, to loose an arrow.',
};
let hintTimer = 0;
function showHint(id) {
  if (!hintEl || !hints[id] || !playing) return;
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem('hints-seen') || '{}'); } catch { /* storage blocked: show it anyway */ }
  if (seen[id]) return;
  seen[id] = 1;
  try { localStorage.setItem('hints-seen', JSON.stringify(seen)); } catch { /* fine */ }
  hintEl.textContent = hints[id]; hintEl.classList.add('on');
  clearTimeout(hintTimer); hintTimer = setTimeout(() => hintEl.classList.remove('on'), 6500);
}

// Skills panel: pointing at a skill lights its node in the tree; "Used in" jumps to the proof.
const skillOf = (e) => e.target.closest?.('.skill')?.dataset.skill;
panel.addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse') lightSkill(skillOf(e) || null); });
panel.addEventListener('pointerleave', () => { if (!panel.contains(document.activeElement)) lightSkill(null); });
// keyboard focus lights a skill; a tap is handled by the click below (so it doesn't toggle twice)
let tapping = false;
panel.addEventListener('pointerdown', () => { tapping = true; });
panel.addEventListener('focusin', (e) => { if (!tapping) lightSkill(skillOf(e) || null); });
panel.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-school]');
  if (tab) return pickSchool(+tab.dataset.school);
  const at = e.target.closest('[data-area]');
  if (at) return pickArea(+at.dataset.area);
  const jump = e.target.closest('[data-goto]');
  if (jump) return showIn(jump.dataset.goto, jump.dataset.find);
  const k = skillOf(e); tapping = false;
  if (k) lightSkill(k === skillLit ? null : k);
});
function showIn(realmId, name) {
  go(realms.findIndex((r) => r.id === realmId));
  reveal(findCard((x) => x.dataset.name === name));
}
const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function reveal(el) {
  if (!el) return;
  if (el.tagName === 'DETAILS') el.open = true;
  el.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}
// opening a quest puts its own link in the address bar, e.g. #quests/sentinel, ready to share
panel.addEventListener('toggle', (e) => {
  const d = e.target;
  if (playing && d.matches?.('details[data-name]') && d.open) history.replaceState(null, '', `#${realms[current].id}/${slug(d.dataset.name)}`);
}, true);
panel.addEventListener('click', (e) => { if (e.target.closest('[data-next]')) go(current + 1); });

function go(i) {
  i = ((i % N) + N) % N;
  if (i === current) return;
  const r = realms[i];
  // travel the short way around the ring
  let d = r.angle - (targetAngle % TAU);
  d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
  targetAngle += d;
  current = i; schedulePump(); skillLit = null; areaFocus = -1;
  document.documentElement.style.setProperty('--accent', r.color);
  place.innerHTML = `${esc(r.place)} <i lang="ar">${esc(r.placeAr || '')}</i>`;
  panel.classList.remove('swap');
  const nx = realms[(i + 1) % N];
  panel.innerHTML = panels[r.id](r) + `<button type="button" class="next-ch" data-next>${i < N - 1 ? `Next chapter · ${esc(nx.short)} <i>${esc(nx.place)}</i>` : 'Back to chapter one'} →</button>`;
  panel.scrollTop = 0;
  void panel.offsetWidth;
  panel.classList.add('swap');
  hotbar.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-current', k === i));
  if (playing) {
    history.replaceState(null, '', `#${r.id}`);
    try { localStorage.setItem('last-realm', r.id); } catch { /* storage blocked */ }
  }
  hintEl?.classList.remove('on');
  setTimeout(() => { if (current === i) showHint(r.id); }, 1200);
}

document.getElementById('xp-year').textContent = `${D.hero.year} of ${D.hero.years}`;
let playing = false;
function start() {
  if (playing) return;
  playing = true;
  document.getElementById('title-screen').classList.add('gone');
  document.body.classList.add('playing');
  document.getElementById('xp-fill').style.width = `${((D.hero.year - 0.15) / D.hero.years) * 100}%`;
  layout();
  if (current > 0 && !location.hash) history.replaceState(null, '', `#${realms[current].id}`);
}
document.getElementById('start').addEventListener('click', start);

// Title screen: who I am, what I build and how to reach me, before anyone has to play.
const mail = D.email.join('@');
const contacts = [
  { label: 'Email', href: `mailto:${mail}`, detail: mail },
  ...D.portals.map((p) => ({ label: p.name, href: p.href, detail: p.href.replace(/^https?:\/\/(www\.)?/, ''), ext: true })),
];
const ext = (c) => (c.ext ? ' target="_blank" rel="noopener"' : '');
document.getElementById('pitch').innerHTML =
  `${esc(D.hero.pitch)} <span class="seeking-tag">${esc(D.hero.seeking.split(':')[0])}</span>`;
document.getElementById('contact-strip').innerHTML =
  contacts.map((c) => `<a href="${esc(c.href)}"${ext(c)}>${esc(c.label)}</a>`).join('<i aria-hidden="true">·</i>');

// Contact in the header: email, LinkedIn and GitHub in one click, from any realm
const contactBtn = document.getElementById('contact-btn');
const contactPop = document.getElementById('contact-pop');
contactPop.innerHTML = contacts.map((c) => `<a href="${esc(c.href)}"${ext(c)}><strong>${esc(c.label)}</strong><span>${esc(c.detail)}</span></a>`).join('') +
  `<button type="button" id="copy-mail">Copy email address</button>`;
const setContact = (on) => { contactPop.hidden = !on; contactBtn.setAttribute('aria-expanded', String(on)); };
contactBtn.addEventListener('click', () => setContact(contactPop.hidden));
document.addEventListener('click', (e) => { if (!e.target.closest('.contact-menu')) setContact(false); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !contactPop.hidden) { setContact(false); contactBtn.focus(); } });
document.getElementById('copy-mail').addEventListener('click', async (e) => {
  const b = e.currentTarget;
  try { await navigator.clipboard.writeText(mail); b.textContent = 'Copied'; } catch { b.textContent = mail; }
  setTimeout(() => { b.textContent = 'Copy email address'; }, 2000);
});

// a tale of Juha, the folk trickster, on the title screen, changing every few seconds
const juhaEl = document.getElementById('juha');
if (juhaEl) {
  let ji = Math.floor(Math.random() * D.folklore.juha.length);
  const showJuha = () => {
    const j = D.folklore.juha[ji % D.folklore.juha.length]; ji++;
    juhaEl.classList.remove('in'); void juhaEl.offsetWidth;
    juhaEl.innerHTML = `<b><span lang="ar">حكاية جحا</span> · A tale of Juha</b>${esc(j.tale)}<em>${esc(j.moral)}</em>`;
    juhaEl.classList.add('in');
  };
  showJuha(); setInterval(() => { if (!playing) showJuha(); }, 11000);
}

const toggle = document.getElementById('panel-toggle');
toggle.addEventListener('click', () => {
  const min = document.body.classList.toggle('panel-min');
  toggle.textContent = min ? '▴ Show' : '▾ Hide';
  toggle.setAttribute('aria-expanded', String(!min));
  layout();
});

addEventListener('keydown', (e) => {
  if (document.body.classList.contains('summary-open')) return;
  if (!playing) { if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('button')) start(); return; }
  if (e.key >= '1' && e.key <= String(N)) go(+e.key - 1);
  else if ((e.key === ' ' || e.key === 'Enter') && realms[current].id === 'pursuits' && !e.target.closest('button, a, summary')) loose();
  else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(current + 1);
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(current - 1);
});

let wheelLock = 0;
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (!playing || performance.now() < wheelLock || Math.abs(e.deltaY) + Math.abs(e.deltaX) < 12) return;
  wheelLock = performance.now() + 750;
  go(current + ((e.deltaY || e.deltaX) > 0 ? 1 : -1));
}, { passive: false });

// pointer: parallax, swipe and click-to-travel
const pointer = new THREE.Vector2();
const ray = new THREE.Raycaster();
let down = null;
const pickHit = (e) => {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(pointer, camera);
  return ray.intersectObjects(realms.map((r) => r.group), true)[0];
};
const pick = (e) => { const hit = pickHit(e); return hit ? hit.object.userData.realm : -1; };
// a skill node in the tree, if the pointer is on one of the island in view
const skillAt = (hit) => (hit && hit.object.userData.realm === current && hit.object.userData.skill) || null;
let skyLit = false;
const tip = document.createElement('div'); tip.id = 'tip'; tip.hidden = true; tip.setAttribute('aria-hidden', 'true'); document.body.append(tip);
canvas.addEventListener('pointerleave', () => { tip.hidden = true; });
canvas.addEventListener('pointermove', (e) => {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  if (e.pointerType !== 'mouse' || !playing) return;
  const hit = pickHit(e), h = hit ? hit.object.userData.realm : -1, k = skillAt(hit);
  const isle = hit && h === current && hit.object.userData.area !== undefined;
  canvas.style.cursor = k || isle || (h >= 0 && h !== current) ? 'pointer' : '';
  // name what is under the pointer on the islets: a project, or the islet itself
  const label = isle ? (hit.object.userData.project || `${D.areas[hit.object.userData.area].name} · ${D.areas[hit.object.userData.area].fx}`) : '';
  if (label) { tip.textContent = label; tip.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 12}px)`; tip.hidden = false; } else tip.hidden = true;
  if (k) { if (k !== skillLit) lightSkill(k); skyLit = true; } else if (skyLit) { lightSkill(null); skyLit = false; }
});
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', (e) => {
  if (!down || !playing) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y; down = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) return go(current + (dx < 0 ? 1 : -1));
  if (Math.abs(dx) + Math.abs(dy) < 8) {
    const hit = pickHit(e), h = hit ? hit.object.userData.realm : -1, k = skillAt(hit);
    if (k) { // show that skill in the panel
      if (+k.split('-')[0] !== school) pickSchool(+k.split('-')[0]);
      lightSkill(k); skyLit = e.pointerType === 'mouse';
      if (document.body.classList.contains('panel-min')) toggle.click();
      panel.querySelector(`.skill[data-skill="${k}"]`)?.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    } else if (h >= 0 && h === current && hit.object.userData.area !== undefined) { // an islet, or a project on it
      const { area: ai, project } = hit.object.userData;
      if (ai !== area || !panel.querySelector('#area')) pickArea(ai); else onArea(ai);
      if (document.body.classList.contains('panel-min')) toggle.click();
      if (project) reveal(findCard((x) => x.dataset.name === project));
      else panel.querySelector('#area')?.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
    } else if (h >= 0 && h === current && realms[h].id === 'pursuits') loose();
    else if (h >= 0) go(h);
  }
});

/* ================================================================== */
/*  Layout + loop                                                      */
/* ================================================================== */
let dist = 19;
function layout() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  renderer.setPixelRatio(maxDpr);
  composer.setPixelRatio(maxDpr);
  camera.aspect = w / h;
  const mobile = w <= 820;
  dist = mobile ? (document.body.classList.contains('panel-min') ? 30 : 36) : 21;
  // keep the island clear of the panel: shift the view rather than the camera
  if (!playing) camera.clearViewOffset();
  else if (mobile) camera.setViewOffset(w, h, 0, h * (document.body.classList.contains('panel-min') ? 0.06 : 0.27), w, h);
  else camera.setViewOffset(w, h, Math.min(440, w * 0.42) / 2 + 10, h * 0.02, w, h);
  camera.updateProjectionMatrix();
}
addEventListener('resize', layout);

let camAngle = realms[0].angle - 0.9;
// the Projects tabs fly the camera over to an islet; -1 is the hub itself
let areaFocus = -1, focusLift = 0;
const focusOff = new THREE.Vector3(), focusTo = new THREE.Vector3();
onArea = (ai) => { areaFocus = ai; };
let camY = 10;
const look = new THREE.Vector3();
const clock = new THREE.Clock();
const motePos = motes.geometry.attributes.position;

let lowPower = false;
const moods = Object.fromEntries(Object.keys(D.lands).map((k) => [k, moodOf(k)]));
applyMood(moods[D.realms[0].land], 1);
const sunDir = new THREE.Vector3();
// scratch vectors reused every frame, so the loop allocates nothing
const camOut = new THREE.Vector3(), fLook = new THREE.Vector3(), fCam = new THREE.Vector3();
const perf = { n: 0, sum: 0 };
function frame() {
  const raw = clock.getDelta();
  const dt = Math.min(raw, 0.05);
  // if the device cannot hold ~20fps, trade the glow and sharpness for smoothness
  if (!lowPower && playing && document.visibilityState === 'visible') {
    perf.n++; perf.sum += raw;
    if (perf.n === 80) {
      if (perf.sum / perf.n > 0.05) { lowPower = true; maxDpr = 1; bloom.enabled = false; sun.castShadow = false; layout(); }
      perf.n = 0; perf.sum = 0;
    }
  }
  const t = clock.elapsedTime;
  const m = reduceMotion ? 0 : 1;

  for (const s of spin) { s.o.rotation.x += (s.x || 0) * dt * m; s.o.rotation.y += (s.y || 0) * dt * m; s.o.rotation.z += (s.z || 0) * dt * m; }
  for (const b of bob) b.o.position.y = b.y + Math.sin(t * b.speed + b.phase) * b.amp * m;
  for (const f of tick) f(t, dt);
  for (let i = 0; i < motePos.count; i++) {
    let y = motePos.getY(i) + dt * (0.5 + (i % 7) * 0.12) * m;
    if (y > 26) y = -14;
    motePos.setY(i, y);
  }
  motePos.needsUpdate = true;
  stars.rotation.y = t * 0.004;
  clouds.rotation.y = t * 0.006 * m;

  // camera rides a wider ring around the islands
  const idle = playing ? 0 : t * 0.05;
  const ease = 1 - Math.exp(-dt * (reduceMotion ? 30 : 2.6));
  camAngle += (targetAngle + idle - camAngle) * ease;
  const r = realms[Math.max(current, 0)];
  camY += (r.y + 6.5 - camY) * ease;
  applyMood(moods[r.land] || moods.neutral, 1 - Math.exp(-dt * 1.4));
  const d = playing ? dist : 30;
  // focused on an islet: the camera eases from its usual place to a view of that islet from above and in front
  let lift = 0;
  if (areaFocus >= 0 && r.id === 'quests') { isletGroups[D.areas[areaFocus].id].getWorldPosition(focusTo).sub(r.group.position); lift = 1; }
  focusOff.lerp(focusTo, ease); focusLift += (lift - focusLift) * ease;
  camera.position.set(Math.cos(camAngle) * (RING + d) - Math.sin(camAngle) * pointer.x * 1.2, camY + pointer.y * 0.8 + (playing ? 0 : 5), Math.sin(camAngle) * (RING + d) + Math.cos(camAngle) * pointer.x * 1.2);
  look.set(Math.cos(camAngle) * RING, camY - 3, Math.sin(camAngle) * RING);
  if (focusLift > 0.001) {
    camOut.set(Math.cos(camAngle), 0, Math.sin(camAngle));
    fLook.copy(r.group.position).add(focusOff); fLook.y += 0.8;
    fCam.copy(fLook).addScaledVector(camOut, dist * 0.62);
    fCam.x -= Math.sin(camAngle) * pointer.x * 0.8; fCam.y += 6 + pointer.y * 0.5; fCam.z += Math.cos(camAngle) * pointer.x * 0.8;
    camera.position.lerp(fCam, focusLift); look.lerp(fLook, focusLift);
  }
  camera.lookAt(look);
  camera.updateMatrixWorld();

  // the sun sits off to one side of the view and slightly behind the island, so shapes read in 3D
  camOut.set(Math.cos(camAngle), 0, Math.sin(camAngle));
  sunDir.set(-camOut.z, 0, camOut.x).multiplyScalar(mood.side).addScaledVector(camOut, 0.35).normalize()
    .multiplyScalar(Math.cos(mood.elev));
  sunDir.y += Math.sin(mood.elev); sunDir.normalize();
  skyU.sunDir.value.copy(sunDir);
  sun.position.copy(look).addScaledVector(sunDir, 60); sun.target.position.copy(look); sun.target.updateMatrixWorld();
  skyU.time.value = t; groundU.time.value = t;
  groundU.fogCol.value.copy(scene.fog.color); groundU.fogD.value = scene.fog.density; groundU.kind.value = mood.below;
  stars.material.opacity = 0.9 * mood.stars; moon.material.opacity = mood.stars;
  motes.material.opacity = 0.15 + 0.45 * mood.stars;
  clouds.children.forEach((c) => {
    c.material.color.copy(mood.cloud);
    c.material.opacity = c.userData.base * (0.25 + mood.cloudAmt);
  });

  composer.render();
  requestAnimationFrame(frame);
}

layout();
// links like #quests or #quests/sentinel open a realm, and optionally one quest or pursuit in it
const [hashRealm, hashItem] = decodeURIComponent(location.hash.slice(1)).split('/');
// a returning visitor with no link picks up where they left off; the title screen still comes first
let lastRealm = null;
try { lastRealm = localStorage.getItem('last-realm'); } catch { /* storage blocked */ }
const resumeAt = !hashRealm && lastRealm ? realms.findIndex((r) => r.id === lastRealm) : -1;
if (resumeAt > 0) document.getElementById('start').textContent = `Continue · ${realms[resumeAt].short}`;
go(Math.max(0, realms.findIndex((r) => r.id === hashRealm), resumeAt));
if (hashRealm && (current > 0 || hashItem)) start();
if (hashItem) {
  const ai = D.areas.findIndex((a) => a.id === hashItem);
  if (ai >= 0 && hashRealm === 'quests') pickArea(ai);
  else reveal(findCard((x) => slug(x.dataset.name) === hashItem));
}
frame();
