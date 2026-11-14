import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as D from './data.js?v=4';

const TAU = Math.PI * 2;
const RING = 46;
const N = D.realms.length;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================================================================== */
/*  Renderer, scene, camera                                            */
/* ================================================================== */
const canvas = document.getElementById('world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
let maxDpr = Math.min(devicePixelRatio, innerWidth <= 820 ? 1.75 : 2);
renderer.setPixelRatio(maxDpr);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0718, 0.006);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 900);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.55, 0.62);
composer.addPass(bloom);
composer.addPass(new OutputPass());

scene.add(new THREE.HemisphereLight(0x8f7dff, 0x1a0f2e, 0.9));
const moonLight = new THREE.DirectionalLight(0xcfd8ff, 1.3);
moonLight.position.set(-40, 60, -20);
scene.add(moonLight);

/* ---------- sky ---------- */
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(600, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 p;
      void main(){
        float h = normalize(p).y;
        vec3 low = vec3(0.075,0.035,0.16), mid = vec3(0.035,0.025,0.09), top = vec3(0.012,0.01,0.035);
        vec3 c = mix(low, mid, smoothstep(-0.35, 0.12, h));
        c = mix(c, top, smoothstep(0.1, 0.8, h));
        c += vec3(0.20,0.07,0.22) * exp(-abs(h + 0.15) * 6.0) * 0.35;
        gl_FragColor = vec4(c, 1.0);
      }`,
  }),
));

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
    map: cloudTex, color: i % 3 ? 0x6a4fc4 : 0xc46ab0, transparent: true, opacity: 0.1 + Math.random() * 0.1, depthWrite: false, fog: false,
  }));
  const a = Math.random() * TAU, r = 10 + Math.random() * 95;
  s.position.set(Math.cos(a) * r, -24 - Math.random() * 14, Math.sin(a) * r);
  s.scale.set(40 + Math.random() * 40, 14 + Math.random() * 10, 1);
  clouds.add(s);
}
scene.add(clouds);

const moon = new THREE.Mesh(new THREE.SphereGeometry(26, 32, 32), new THREE.MeshBasicMaterial({ color: 0xe9e2ff, fog: false }));
moon.position.set(-150, 150, -300);
scene.add(moon);

/* ================================================================== */
/*  Builders                                                           */
/* ================================================================== */
const spin = [];   // { o, x, y, z } rotated every frame
const bob = [];    // { o, y, amp, speed, phase }
const tick = [];   // fn(t, dt)

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

function island(color) {
  const g = new THREE.Group();
  const rock = new THREE.Mesh(jitter(new THREE.CylinderGeometry(6, 1, 7, 10, 4), 0.9), stone());
  rock.position.y = -3.6;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6, 0.5, 10), new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).multiplyScalar(0.22).add(new THREE.Color(0x16202a)), roughness: 1, flatShading: true,
  }));
  g.add(rock, top);
  for (let i = 0; i < 5; i++) { // small shards hanging beneath and crystals on the rim
    const a = (i / 5) * TAU + 0.4;
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.4, 5), glow(color, 0.8));
    c.position.set(Math.cos(a) * 5.3, 0.9, Math.sin(a) * 5.3);
    c.rotation.set(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3);
    g.add(c);
  }
  for (let i = 0; i < 4; i++) {
    const d = new THREE.Mesh(jitter(new THREE.DodecahedronGeometry(0.5 + (i % 2) * 0.4), 0.15), stone(0x2c2744));
    const a = i * 1.7;
    d.position.set(Math.cos(a) * (7.5 + i), -2 - i * 1.3, Math.sin(a) * (7.5 + i));
    g.add(d); bob.push({ o: d, y: d.position.y, amp: 0.5, speed: 0.5 + i * 0.1, phase: i });
  }
  const leaf = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.3).add(new THREE.Color(0x0e2a26)), roughness: 1, flatShading: true });
  [[-3.3, -4.2, 1.15], [3.0, -4.5, 0.9], [-1.2, -5.2, 0.7], [4.6, -3.0, 0.65]].forEach(([x, z, k]) => {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.9, 5), stone(0x3a2718));
    trunk.position.y = 0.45;
    tree.add(trunk);
    [[0.85, 1.3, 1.15], [0.62, 1.1, 1.85], [0.4, 0.9, 2.45]].forEach(([rad, h, y]) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 6), leaf);
      cone.position.y = y; cone.rotation.y = y; tree.add(cone);
    });
    tree.position.set(x, 0.25, z); tree.scale.setScalar(k); g.add(tree);
  });
  const light = new THREE.PointLight(color, 34, 26, 1.8);
  light.position.y = 5;
  g.add(light);
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
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.34), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4, side: THREE.DoubleSide }));
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

const build = {
  hero(g, color) {
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.9, 0), glow(color, 0.9, { transparent: true, opacity: 0.94 }));
    crystal.scale.y = 1.7; crystal.position.y = 5.4;
    g.add(crystal); spin.push({ o: crystal, y: 0.5 }); bob.push({ o: crystal, y: 5.4, amp: 0.35, speed: 1, phase: 0 });
    [3.2, 4.1, 5].forEach((r, i) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.045, 6, 80), glow(i === 1 ? 0xe3b866 : color, 1.5));
      ring.position.y = 5.4; ring.rotation.set(1.2 + i * 0.5, i, 0);
      g.add(ring); spin.push({ o: ring, x: 0.25 * (i % 2 ? -1 : 1), y: 0.35 + i * 0.12 });
    });
    const shards = new THREE.Group(); shards.position.y = 5.2;
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), glow(0xe3b866, 2));
      const a = (i / 7) * TAU; s.position.set(Math.cos(a) * 3.6, Math.sin(i * 2) * 1.2, Math.sin(a) * 3.6);
      shards.add(s);
    }
    g.add(shards); spin.push({ o: shards, y: -0.4 });
  },

  quests(g, color) {
    D.quests.forEach((q, i) => {
      const a = THREE.MathUtils.mapLinear(i, 0, D.quests.length - 1, -1.5, 1.5) + Math.PI / 2;
      const h = 2.8 + (i % 2) * 0.9 + (i === 0 ? 1.2 : 0);
      const m = new THREE.Mesh(jitter(new THREE.BoxGeometry(0.95, h, 0.6, 1, 3, 1), 0.14), stone(0x4a4466));
      m.position.set(Math.cos(a) * 4.4, h / 2 + 0.2, -Math.sin(a) * 4.4 + 2.4);
      m.rotation.y = a - Math.PI / 2;
      const rune = new THREE.Mesh(new THREE.BoxGeometry(0.42, h * 0.55, 0.06), glow(q.status === 'Active' ? 0x8dffb0 : color, 1.8));
      rune.position.set(0, 0, 0.31); m.add(rune);
      const mark = new THREE.Mesh(new THREE.OctahedronGeometry(0.34), glow(q.status === 'Active' ? 0x8dffb0 : 0xe3b866, 2.4));
      mark.position.set(m.position.x, h + 1.1, m.position.z);
      g.add(m, mark); spin.push({ o: mark, y: 1.4 }); bob.push({ o: mark, y: h + 1.1, amp: 0.22, speed: 1.6, phase: i });
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
  },

  skills(g) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.5, 3.4, 6), stone(0x4d4168));
    trunk.position.y = 1.9; g.add(trunk);
    const linePts = [];
    const root = new THREE.Vector3(0, 3.6, 0);
    const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), glow(0xffffff, 0.9));
    heart.position.copy(root); g.add(heart); spin.push({ o: heart, y: 0.8, x: 0.4 });
    D.skillTree.forEach((b, bi) => {
      const base = (bi / D.skillTree.length) * TAU + 0.5;
      let prev = root;
      b.skills.forEach((s, si) => {
        const k = si + 1;
        const a = base + Math.sin(si * 1.9 + bi) * 0.55;
        const r = 1.1 + k * 0.62;
        const p = new THREE.Vector3(Math.cos(a) * r, 3.6 + k * 0.72 + Math.cos(si * 2.3) * 0.4, Math.sin(a) * r);
        const node = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13 + s.rank * 0.085, 1), glow(b.color, 0.7 + s.rank * 0.35));
        node.position.copy(p); g.add(node);
        bob.push({ o: node, y: p.y, amp: 0.12, speed: 1.2, phase: si + bi * 2 });
        const from = si % 3 === 2 ? root : prev; // occasional fork back toward the heart
        linePts.push(from.clone(), p.clone());
        prev = p;
      });
    });
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linePts),
      new THREE.LineBasicMaterial({ color: 0x9fb8ff, transparent: true, opacity: 0.55 }));
    g.add(lines);
  },

  trophies(g, color) {
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.1, 0.3, 90, 10), glow(color, 0.9, { metalness: 1, roughness: 0.2, flatShading: false }));
    knot.position.y = 5.2; g.add(knot); spin.push({ o: knot, y: 0.5, x: 0.2 });
    const tint = { gold: 0xffd166, silver: 0xcfd8e6, bronze: 0xd08a52 };
    D.trophies.forEach((t, i) => {
      const a = (i / D.trophies.length) * TAU;
      const x = Math.cos(a) * 4, z = Math.sin(a) * 4;
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 1.3, 6), stone(0x4a4466));
      ped.position.set(x, 0.9, z);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), glow(tint[t.tier], 1.7, { metalness: 0.8 }));
      gem.position.set(x, 2.4, z);
      g.add(ped, gem); spin.push({ o: gem, y: 1 }); bob.push({ o: gem, y: 2.4, amp: 0.18, speed: 1.3, phase: i });
    });
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
    [[0x9a9aa2, 0], [0x121218, 0], [0x1f5fb8, 0.12], [0xb8322a, 0.15], [0xd9a520, 0.4]].forEach(([c, e], i) => {
      const ring = new THREE.Mesh(new THREE.CircleGeometry(range.radius * (1 - i / 5), 40),
        new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: e, roughness: 1 }));
      ring.position.set(T.x, T.y, T.z + i * 0.004); g.add(ring);
    });
    // a compound bow resting beside the target: riser, short limbs, cams, string and cables
    const bow = new THREE.Group();
    const bar = (x1, y1, x2, y2, w, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, Math.hypot(x2 - x1, y2 - y1), w * 0.7), mat);
      m.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0); m.rotation.z = Math.atan2(y2 - y1, x2 - x1) - Math.PI / 2;
      bow.add(m);
    };
    const riserMat = stone(0x2c3c48), limbMat = glow(color, 0.7);
    bar(1.2, -0.3, 1.2, 0.3, 0.2, stone(0x3a2718)); // grip
    bar(1.2, 0.3, 1.34, 0.8, 0.13, riserMat); bar(1.2, -0.3, 1.34, -0.8, 0.13, riserMat);
    bar(1.34, 0.8, 0.62, 1.42, 0.1, limbMat); bar(1.34, -0.8, 0.62, -1.42, 0.1, limbMat);
    [1.42, -1.42].forEach((y) => {
      const cam = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.055, 6, 18), glow(0xe3b866, 1.3));
      cam.position.set(0.62, y, 0); cam.scale.y = 0.8;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 8), riserMat);
      hub.rotation.x = Math.PI / 2; hub.position.copy(cam.position);
      bow.add(cam, hub);
    });
    const P = (x, y) => new THREE.Vector3(x, y, 0);
    bow.add(new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints([P(0.42, 1.42), P(0.42, -1.42), P(0.8, 1.38), P(0.66, -1.3), P(0.66, 1.3), P(0.8, -1.38)]),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 })));
    const stab = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.1, 6), riserMat);
    stab.rotation.z = -Math.PI / 2; stab.position.set(1.85, -0.2, 0);
    const weight = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 8), glow(color, 1));
    weight.rotation.z = Math.PI / 2; weight.position.set(2.45, -0.2, 0);
    const sight = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 6, 16), glow(0xff5a4a, 1.6));
    sight.rotation.y = Math.PI / 2; sight.position.set(1.62, 0.45, 0);
    bar(1.3, 0.45, 1.6, 0.45, 0.04, riserMat);
    bow.add(stab, weight, sight); bow.scale.setScalar(1.15); bow.position.set(-2.6, 2.5, 2.4); bow.rotation.set(0, Math.PI - 0.35, 0.08);
    g.add(bow); bob.push({ o: bow, y: 2.5, amp: 0.18, speed: 1.1, phase: 2 });
    // quiver
    const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 1.5, 7), stone(0x4a2f1c));
    quiver.position.set(3.4, 0.95, 1.6); quiver.rotation.z = -0.2; g.add(quiver);
    for (let i = 0; i < 4; i++) {
      const a = arrow(color); a.rotation.x = -Math.PI / 2 + (i - 1.5) * 0.08; a.rotation.z = -0.2 + (i - 1.5) * 0.06;
      a.position.set(3.55 + (i - 1.5) * 0.09, 1.5, 1.6); g.add(a);
    }
    // dojo lanterns for the other pursuits
    [[-4.4, -1.6, 0xff8a5c], [4.4, -1.4, 0xb79bff]].forEach(([x, z, c], i) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 5), stone(0x4a4466));
      post.position.set(x, 1.4, z);
      const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), glow(c, 2));
      lamp.position.set(x, 3, z);
      g.add(post, lamp); spin.push({ o: lamp, y: 0.9 }); bob.push({ o: lamp, y: 3, amp: 0.12, speed: 1.4, phase: i });
    });
    range.group = g; range.color = color;
    [[0.5, 0.42], [-0.62, -0.2]].forEach(([x, y]) => { const a = arrow(color); stick(a, x, y); g.add(a); });
  },

  guilds(g, color) {
    [[-2.6, 0x1f8f5f, 5.4], [2.6, 0x7a2bd6, 4.6]].forEach(([x, c, h], i) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, h, 6), stone(0x6b5a44));
      pole.position.set(x, h / 2 + 0.2, -1.2);
      const geo = new THREE.PlaneGeometry(1.7, 2.6, 8, 8);
      geo.translate(0.85, 0, 0);
      const flag = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.45, side: THREE.DoubleSide, roughness: 0.8 }));
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
      const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), glow(0xe3b866, 2));
      emblem.position.set(x, h + 0.5, -1.2); spin.push({ o: emblem, y: 1 });
      g.add(pole, flag, emblem);
    });
    for (let i = 0; i < 5; i++) { // campfire logs + flame
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.3, 5), stone(0x3a2718));
      log.rotation.set(Math.PI / 2.4, (i / 5) * TAU, 0); log.position.set(0, 0.45, 1.6);
      g.add(log);
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 6), glow(0xff8a3c, 3));
    flame.position.set(0, 1.2, 1.6);
    const fire = new THREE.PointLight(0xff8a3c, 40, 16, 2); fire.position.set(0, 1.8, 1.6);
    g.add(flame, fire);
    tick.push((t) => {
      const f = 1 + Math.sin(t * 11) * 0.08 + Math.sin(t * 17.3) * 0.06;
      flame.scale.set(f, 1 + Math.sin(t * 9) * 0.18, f); fire.intensity = 40 * f;
    });
    [[-3.6, 2.6], [3.7, 2.4]].forEach(([x, z]) => {
      const tent = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.9, 4), stone(0x5d5078));
      tent.position.set(x, 1.2, z); tent.rotation.y = Math.PI / 4; g.add(tent);
    });
    void color;
  },

  portal(g, color) {
    const gate = new THREE.Group(); gate.position.y = 4.4; g.add(gate);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.28, 8, 48), stone(0x4a4466));
    gate.add(ring);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(2.72, 0.07, 6, 64), glow(color, 2.6));
    gate.add(inner);
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
      gate.add(r);
    }
    gate.userData.face = true;
  },
};

/* ---------- place realms on the ring ---------- */
const realms = D.realms.map((r, i) => {
  const angle = (i / N) * TAU;
  const y = Math.sin(i * 1.7) * 3;
  const g = island(r.color);
  g.position.set(Math.cos(angle) * RING, y, Math.sin(angle) * RING);
  g.rotation.y = -angle + Math.PI / 2; // local +z faces outward, toward the camera
  build[r.id](g, r.color);
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
    const s = new THREE.Mesh(jitter(new THREE.CylinderGeometry(0.7, 0.3, 0.5, 6), 0.2), stone(0x353050));
    const y = THREE.MathUtils.lerp(y0, y1, f) - 0.6 + Math.sin(f * Math.PI) * 1.2;
    s.position.set(Math.cos(a) * RING, y, Math.sin(a) * RING);
    scene.add(s); bob.push({ o: s, y, amp: 0.3, speed: 0.8, phase: k + i });
  }
}

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
const head = (r, title) => `<p class="kicker">${esc(r.place)}</p><h2>${esc(title)}</h2>`;

const panels = {
  hero: (r) => `${head(r, D.hero.title)}
    <p class="lore">${esc(D.hero.lore)}</p>
    <dl class="meta">
      <dt>Class</dt><dd>${esc(D.hero.klass)}</dd>
      <dt>Guild</dt><dd>${esc(D.hero.guild)}</dd>
      <dt>Realm</dt><dd>${esc(D.hero.realm)}</dd>
    </dl>
    <section><h3>Attributes</h3><p class="note">Scores are for flavour; the evidence beside each is real.</p>${D.hero.attributes.map((a) => `
      <div class="attr"><span class="k" title="${esc(a.label)}">${a.key}</span>
        <div class="bar"><i style="width:${a.value * 5}%"></i></div><span class="v">${a.value}</span>
        <small>${esc(a.label)} — ${esc(a.note)}</small></div>`).join('')}</section>
    <section><h3>Journey</h3><div class="journey">${D.hero.journey.map((j) => `<span>${esc(j)}</span>`).join('<span class="arrow">➝</span>')}</div></section>
    <section><h3>Tongues</h3><div class="chips">${D.hero.tongues.map((t) => `<span class="chip"><b>${esc(t.name)}</b> · ${esc(t.rank)}</span>`).join('')}</div></section>`,

  quests: (r) => `${head(r, 'Quest Log')}
    <p class="lore">Campaigns fought, raids survived and one epic still unfolding.</p>
    <section style="margin-top:16px">${D.quests.map((q, i) => `
      <details class="quest"${i === 0 ? ' open' : ''}>
        <summary>
          <span class="q-kind">${esc(q.kind)} · ${esc(q.plain)} · ${esc(q.when)}</span>
          <span class="q-status ${q.status === 'Active' ? 'active' : ''}">${esc(q.status)}</span>
          <span class="q-name">${esc(q.name)}</span><span class="q-role">${esc(q.role)}</span>
        </summary>
        <div class="q-body"><p>${esc(q.summary)}</p>
          <ul>${q.objectives.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>
          ${q.flow ? `<div class="flow" aria-label="How it works">${q.flow.map((f) => `<span>${esc(f)}</span>`).join('<i>→</i>')}</div>` : ''}
          <div class="chips">${q.loot.map((l) => `<span class="chip">${esc(l)}</span>`).join('')}</div>
        </div>
      </details>`).join('')}</section>`,

  skills: (r) => `${head(r, 'Skill Tree')}
    <p class="lore">Three schools, one build: code that reads the world, hardware that touches it, and the engineering to make it hold.</p>
    ${D.skillTree.map((b) => `<section class="branch" style="--c:${b.color}">
      <h3>${esc(b.branch)} <small>${esc(b.sub)}</small></h3>
      ${b.skills.map((s) => `<div class="skill"><span>${esc(s.name)}</span>
        <span class="pips">${[1, 2, 3].map((n) => `<i class="${n <= s.rank ? 'on' : ''}"></i>`).join('')}<em>${D.rankNames[s.rank]}</em></span></div>`).join('')}
    </section>`).join('')}`,

  trophies: (r) => `${head(r, 'Deeds & Honours')}
    <section>${D.trophies.map((t) => `
      <div class="trophy"><span class="medal ${t.tier}">♛</span>
        <div><strong>${esc(t.name)}</strong><span>${esc(t.detail)}</span></div><time>${esc(t.when)}</time></div>`).join('')}</section>
    <section><h3>Scrolls of Certification</h3><ul class="scrolls">${D.scrolls.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></section>`,

  pursuits: (r) => `${head(r, 'Beyond the Workshop')}
    <p class="lore">What I do when nobody is marking it.</p>
    <div class="range">
      <button type="button" id="loose">Loose an arrow</button>
      <div class="score"><span>Last <b id="s-last">–</b></span><span>Best <b id="s-best">${best || '–'}</b></span><span>Shots <b id="s-n">${shots}</b></span></div>
    </div>
    <section style="margin-top:18px">${D.pursuits.map((p) => `
      <div class="pursuit"><span class="pg">${esc(p.glyph)}</span>
        <div><strong>${esc(p.name)}</strong><p>${esc(p.detail)}</p>${p.extra ? `<p class="extra">${esc(p.extra)}</p>` : ''}</div></div>`).join('')}</section>`,

  guilds: (r) => `${head(r, 'Guilds & Academies')}
    <section><h3>Banners carried</h3>${D.guilds.map((g) => `
      <div class="card"><time>${esc(g.when)}</time><strong>${esc(g.name)}</strong>
        <span class="sub">${esc(g.role)} · ${esc(g.place)}</span><p>${esc(g.detail)}</p></div>`).join('')}</section>
    <section><h3>Academies</h3>${D.academies.map((a) => `
      <div class="card"><time>${esc(a.when)}</time><strong>${esc(a.name)}</strong><p>${esc(a.what)}</p></div>`).join('')}</section>`,

  portal: (r) => `${head(r, 'Open a Gate')}
    <p class="lore">Looking for an engineer who is ready to be useful from day one? Step through.</p>
    <section style="margin-top:20px">${D.portals.map((p) => `
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
  `<button type="button" data-i="${i}" style="--c:${r.color}"><kbd>${i + 1}</kbd><span class="g">${r.glyph}</span>${r.name}</button>`).join('');
hotbar.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) go(+b.dataset.i); });
panel.addEventListener('click', (e) => { if (e.target.closest('#loose')) loose(); });

function go(i) {
  i = ((i % N) + N) % N;
  if (i === current) return;
  const r = realms[i];
  // travel the short way around the ring
  let d = r.angle - (targetAngle % TAU);
  d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
  targetAngle += d;
  current = i;
  document.documentElement.style.setProperty('--accent', r.color);
  place.textContent = r.place;
  panel.classList.remove('swap');
  panel.innerHTML = panels[r.id](r);
  panel.scrollTop = 0;
  void panel.offsetWidth;
  panel.classList.add('swap');
  hotbar.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-current', k === i));
  if (playing) history.replaceState(null, '', `#${r.id}`);
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
}
document.getElementById('start').addEventListener('click', start);

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
const pick = (e) => {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(pointer, camera);
  const hit = ray.intersectObjects(realms.map((r) => r.group), true)[0];
  return hit ? hit.object.userData.realm : -1;
};
canvas.addEventListener('pointermove', (e) => {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  if (e.pointerType === 'mouse' && playing) { const h = pick(e); canvas.style.cursor = h >= 0 && h !== current ? 'pointer' : ''; }
});
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', (e) => {
  if (!down || !playing) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y; down = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) return go(current + (dx < 0 ? 1 : -1));
  if (Math.abs(dx) + Math.abs(dy) < 8) {
    const h = pick(e);
    if (h >= 0 && h === current && realms[h].id === 'pursuits') loose();
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
let camY = 10;
const look = new THREE.Vector3();
const clock = new THREE.Clock();
const motePos = motes.geometry.attributes.position;

let lowPower = false;
const perf = { n: 0, sum: 0 };
function frame() {
  const raw = clock.getDelta();
  const dt = Math.min(raw, 0.05);
  // if the device cannot hold ~20fps, trade the glow and sharpness for smoothness
  if (!lowPower && playing && document.visibilityState === 'visible') {
    perf.n++; perf.sum += raw;
    if (perf.n === 80) {
      if (perf.sum / perf.n > 0.05) { lowPower = true; maxDpr = 1; bloom.enabled = false; layout(); }
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
  const d = playing ? dist : 30;
  camera.position.set(Math.cos(camAngle) * (RING + d) - Math.sin(camAngle) * pointer.x * 1.2, camY + pointer.y * 0.8 + (playing ? 0 : 5), Math.sin(camAngle) * (RING + d) + Math.cos(camAngle) * pointer.x * 1.2);
  look.set(Math.cos(camAngle) * RING, camY - 3, Math.sin(camAngle) * RING);
  camera.lookAt(look);

  composer.render();
  requestAnimationFrame(frame);
}

layout();
go(Math.max(0, realms.findIndex((r) => `#${r.id}` === location.hash)));
if (location.hash.length > 1 && current > 0) start();
frame();
