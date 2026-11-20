// Entry point: renderer, lights, the realms on their ring, navigation, input, layout and the frame loop.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as D from './data.js?v=59';
import { N, RING, TAU, bob, build, jitter, landmarks, reduceMotion, shoot, spin, stone, tick } from './props.js?v=59';
import { hops, loadModel, schedulePump } from './loader.js?v=59';
import { buildIslets, island, isletGroups } from './islets.js?v=59';
import { applyMood, clouds, groundU, mood, moodOf, moon, motes, scene, skyU, stars } from './sky.js?v=59';
import { track } from './track.js?v=59';
import { area, esc, findCard, hintEl, panels, pickArea, pickSchool, school, showHint } from './panels.js?v=59';

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

/* ---------- place realms on the ring ---------- */
const realms = D.realms.map((r, i) => {
  const angle = (i / N) * TAU;
  const y = Math.sin(i * 1.7) * 3;
  const g = island(r.color, r.land, i * 3.7 + 1);
  g.position.set(Math.cos(angle) * RING, y, Math.sin(angle) * RING);
  g.rotation.y = -angle + Math.PI / 2; // local +z faces outward, toward the camera
  g.userData.realm = i;
  const t0 = tick.length, s0 = spin.length;
  build[r.id](g, r.color);
  if (r.id === 'quests') buildIslets(g, i);
  if (landmarks[r.id]) landmarks[r.id](g);
  g.traverse((o) => { o.userData.realm = i; });
  // tag this island's animations so frame() can skip them while it is far away
  for (let k = t0; k < tick.length; k++) tick[k].realm = i;
  for (let k = s0; k < spin.length; k++) spin[k].realm = i;
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
// the scene hooks in here to fly the camera to the islet (set once the islets exist)
let onArea = () => {};

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
    track(r.id);
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
  setTimeout(() => showHint('controls'), 2500);
  if (current > 0 && !location.hash) history.replaceState(null, '', `#${realms[current].id}`);
  track(realms[current].id);
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
  // the plain view covers the canvas: skip the work until it closes
  if (document.body.classList.contains('summary-open')) { clock.getDelta(); requestAnimationFrame(frame); return; }
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

  for (const s of spin) { if (s.realm !== undefined && hops(s.realm) > 1) continue; s.o.rotation.x += (s.x || 0) * dt * m; s.o.rotation.y += (s.y || 0) * dt * m; s.o.rotation.z += (s.z || 0) * dt * m; }
  for (const b of bob) b.o.position.y = b.y + Math.sin(t * b.speed + b.phase) * b.amp * m;
  for (const f of tick) if (f.realm === undefined || hops(f.realm) <= 1) f(t, dt);
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
openItem(hashRealm, hashItem);
function openItem(realm, item) {
  if (!item) return;
  const ai = D.areas.findIndex((a) => a.id === item);
  if (ai >= 0 && realm === 'quests') pickArea(ai);
  else reveal(findCard((x) => slug(x.dataset.name) === item));
}
// a link followed while the site is open (pasted, or clicked in another tab's text) travels there too
addEventListener('hashchange', () => {
  const [realm, item] = decodeURIComponent(location.hash.slice(1)).split('/');
  const i = realms.findIndex((r) => r.id === realm);
  if (i < 0) return;
  go(i); start(); openItem(realm, item);
});
frame();

export { best, current, hemi, lightSkill, lowPower, onArea, panel, playing, renderer, shots, skillBoughs, skillLit, skillNodes, sun };
