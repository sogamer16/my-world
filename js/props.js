// Shared basics (constants, per-frame lists, materials) and the things placed on the islands: archery range, trees, realm builders, signs, medals, hoodie, folklore, landmarks.
import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import * as D from './data.js?v=56';
import { prop } from './loader.js?v=56';
import { skillBoughs, skillLit, skillNodes } from './main.js?v=56';

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
  img.src = `assets/logos/${file}?v=56`;
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
    img.src = `assets/logos/${logo}?v=56`;
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

export { N, RING, TAU, bob, build, flat, glow, jitter, landmarks, localTree, pageFonts, points, reduceMotion, shoot, spin, stone, tick };
