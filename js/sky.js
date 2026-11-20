// The scene and its sky: fog, sky dome, ground below, stars, motes, clouds and moon.
import * as THREE from 'three';
import * as D from './data.js?v=59';
import { RING, TAU, points } from './props.js?v=59';
import { hemi, lowPower, renderer, sun } from './main.js?v=59';

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0718, 0.006);

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

export { applyMood, clouds, groundU, mood, moodOf, moon, motes, scene, skyU, stars };
