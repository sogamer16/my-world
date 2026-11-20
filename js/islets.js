// Terrain: island() and the Projects islets with a landmark for each project.
import * as THREE from 'three';
import * as D from './data.js?v=59';
import { TAU, bob, flat, glow, jitter, localTree, pageFonts, reduceMotion, spin, stone, tick } from './props.js?v=59';
import { prop } from './loader.js?v=59';

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

export { buildIslets, island, isletGroups };
