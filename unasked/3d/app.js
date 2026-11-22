import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildRig } from './rig.js?v=20261121b';
import { DEFS, ANIM } from './anims.js?v=20261121b';

const Q = new URLSearchParams(location.search);
const R = 0.72, SQ3 = Math.sqrt(3);
// offset coords (flat-top columns): x = 1.5c, z = sqrt3*(k + (c&1)/2)
const hexPos = (c, k) => new THREE.Vector3(1.5 * R * c, 0, SQ3 * R * (k + (Math.abs(c) % 2) / 2));

// h = target height in metres (w = target width for floaters), yaw in degrees, lift = metres above ground
const CREW = [
  { id: 'ondra',  name: 'Ondra',  c: -4, k: 0, w: 1.75, lift: 0.45, idle: 'float', sway: 0.0, breath: 0.035 },
  { id: 'sill',   name: 'Sill',   c: -3, k: 0, h: 2.5, sway: 0.035, breath: 0.012 },
  { id: 'hask',   name: 'Hask',   c: -2, k: 0, h: 1.25, sway: 0.006, breath: 0.012 },
  { id: 'human',  name: 'Human',  c: -1, k: 0, h: 1.74, sway: 0.018, breath: 0.012 },
  { id: 'blathe', name: 'Blathe', c: 0,  k: 0, h: 1.15, sway: 0.014, breath: 0.03 },
  { id: 'tumble', name: 'Tumble', c: 1,  k: 0, h: 0.42, sway: 0.03, breath: 0.03, family: 5 },
  { id: 'vell',   name: 'Vell',   c: 2,  k: 0, h: 1.8, swarm: true },
  { id: 'tiller', name: 'Tiller', c: 3,  k: 0, h: 1.55, sway: 0.01, breath: 0.014 },
];
for (const m of CREW) { if (Q.has('yaw_' + m.id)) m.yawOverride = +Q.get('yaw_' + m.id); }

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: Q.has('shot') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const BG = new THREE.Color(0x0b0d10);
const scene = new THREE.Scene();
scene.background = BG;
scene.fog = new THREE.Fog(BG, 14, 30);

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 1.2; controls.maxDistance = 26;
controls.maxPolarAngle = Math.PI * 0.49;
controls.target.set(-0.55, 0.75, 0.3);
camera.position.set(-0.55, 3.6, 9.4);

// lights
scene.add(new THREE.HemisphereLight(0xbcc6d6, 0x2a2219, 0.9));
const key = new THREE.DirectionalLight(0xffe2b8, 2.6);
key.position.set(-6, 10, 7);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -7, right: 7, top: 5, bottom: -5, near: 1, far: 30 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
scene.add(key);
const rim = new THREE.DirectionalLight(0xa9bfe6, 0.9);
rim.position.set(5, 6, -9); scene.add(rim);
const fill = new THREE.DirectionalLight(0xfff4e6, 0.8);
fill.position.set(4, 3, 10); scene.add(fill);

// ground: dusty painted-looking disc that fades into the dark
function groundTex() {
  const s = 1024, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, '#5a5045'); grd.addColorStop(0.45, '#3e372f'); grd.addColorStop(0.8, '#1a1815'); grd.addColorStop(1, '#0b0d10');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * s, y = rnd() * s, r = rnd() * 3 + 0.5, a = rnd() * 0.07;
    g.fillStyle = rnd() > 0.5 ? `rgba(255,236,205,${a})` : `rgba(0,0,0,${a * 1.4})`;
    g.beginPath(); g.ellipse(x, y, r * 2.2, r, rnd() * 3, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const ground = new THREE.Mesh(new THREE.CircleGeometry(22, 96), new THREE.MeshStandardMaterial({ map: groundTex(), roughness: 1, metalness: 0 }));
ground.rotation.x = -Math.PI / 2; ground.position.set(-0.55, 0, 0.3); ground.receiveShadow = true;
scene.add(ground);

// subtle in-engine hex lines, fading with distance
{
  const pos = [], col = [], c0 = new THREE.Color(0xe9cf9f), center = new THREE.Vector3(-0.55, 0, 0.3);
  for (let c = -7; c <= 6; c++) for (let k = -3; k <= 3; k++) {
    const p = hexPos(c, k), d = p.distanceTo(center), a = Math.max(0, 1 - d / 5.2);
    if (a <= 0.02) continue;
    for (let i = 0; i < 6; i++) {
      const a0 = i * Math.PI / 3, a1 = (i + 1) * Math.PI / 3, rr = R * 0.97;
      pos.push(p.x + rr * Math.cos(a0), 0.012, p.z + rr * Math.sin(a0), p.x + rr * Math.cos(a1), 0.012, p.z + rr * Math.sin(a1));
      const cc = c0.clone().multiplyScalar(a * 0.15); col.push(cc.r, cc.g, cc.b, cc.r, cc.g, cc.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
}
// focus highlight: thin glowing hex outline (no fill, no base)
function hexRing(r0, r1) {
  const sh = new THREE.Shape(), hole = new THREE.Path();
  for (let i = 0; i <= 6; i++) { const a = i * Math.PI / 3; (i ? sh.lineTo : sh.moveTo).call(sh, r1 * Math.cos(a), r1 * Math.sin(a)); }
  for (let i = 0; i <= 6; i++) { const a = -i * Math.PI / 3; (i ? hole.lineTo : hole.moveTo).call(hole, r0 * Math.cos(a), r0 * Math.sin(a)); }
  sh.holes.push(hole); const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); return g;
}
const hiMat = new THREE.MeshBasicMaterial({ color: 0xf0c27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
const hi = new THREE.Mesh(hexRing(R * 0.93, R * 0.975), hiMat); hi.position.y = 0.014; scene.add(hi);

// idle shader: sway grows with height so feet stay planted; breathing swells the chest band
const uTime = { value: 0 };
function addIdle(mat, m, phase) {
  mat.userData.u = { uSway: { value: m.sway || 0 }, uBreath: { value: m.breath || 0 }, uH: { value: m.hh }, uPh: { value: phase } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, mat.userData.u, { uTime });
    sh.vertexShader = 'uniform float uTime,uSway,uBreath,uH,uPh;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float hN = clamp(position.y / uH, 0.0, 1.0);
      float b = sin(uTime * 1.7 + uPh);
      float band = smoothstep(0.25, 0.6, hN) * (1.0 - smoothstep(0.75, 1.0, hN));
      transformed.xz *= 1.0 + uBreath * b * band;
      transformed.y *= 1.0 + uBreath * 0.35 * b;
      float s = hN * hN * uSway;
      transformed.x += s * sin(uTime * 0.9 + uPh);
      transformed.z += s * 0.6 * sin(uTime * 0.63 + uPh * 1.3);`);
  };
  mat.customProgramCacheKey = () => 'idle';
}

const loader = new GLTFLoader();
async function loadGLB(id) {
  const txt = await (await fetch(`m/${id}.b64?v=20261121b`)).text();
  const bin = Uint8Array.from(atob(txt.trim()), (c) => c.charCodeAt(0));
  return await new Promise((res, rej) => loader.parse(bin.buffer, '', res, rej));
}

const actors = [], pickables = [];
function finishMesh(root, m) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const old = o.material;
    const mat = new THREE.MeshStandardMaterial({ map: old.map || null, vertexColors: !!o.geometry.attributes.color, roughness: m.id === 'sill' ? 0.25 : 0.82, metalness: 0.0 });
    if (m.id === 'sill') { mat.transparent = true; mat.opacity = 0.9; mat.emissive = new THREE.Color(0x2a2418); mat.roughness = 0.3; }
    if (m.id === 'ondra') { mat.transparent = true; mat.opacity = 0.82; mat.depthWrite = false; mat.roughness = 0.35; mat.emissive = new THREE.Color(0x1a2230); mat.side = THREE.DoubleSide; }
    if (m.id === 'blathe') { mat.emissive = new THREE.Color(0x1c1004); }
    o.material = mat;
  });
}

// Ondra: brass pressure ring at the bell's rim and a curtain of fine drifting feelers
function addOndraParts(g, root, sc) {
  let mesh; root.traverse((o) => { if (o.isMesh) mesh = o; });
  const pa = mesh.geometry.attributes.position, H = new THREE.Box3().setFromBufferAttribute(pa).max.y;
  // find the bell's rim: the lowest height where the body is still wide
  const bins = new Array(40).fill(0);
  for (let i = 0; i < pa.count; i++) { const y = pa.getY(i) / H, r = Math.hypot(pa.getX(i), pa.getZ(i)); const b = Math.min(39, Math.floor(y * 40)); bins[b] = Math.max(bins[b], r); }
  const rMax = Math.max(...bins.slice(14)); let rimB = 39; for (let b = 14; b < 40; b++) if (bins[b] > rMax * 0.85) { rimB = b; break; }
  const rimY = (rimB + 1.5) / 40 * H, rimR = bins[Math.min(39, rimB + 1)] * 1.01;
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08a4a, metalness: 0.85, roughness: 0.38 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(rimR * sc, 0.022, 10, 96), brass);
  ring.rotation.x = Math.PI / 2; ring.position.y = rimY * sc; ring.castShadow = true; g.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(rimR * sc * 0.985, 0.009, 6, 96), brass);
  ring2.rotation.x = Math.PI / 2; ring2.position.y = rimY * sc - 0.05; g.add(ring2);
  const N = 70, SEG = 14, pos = new Float32Array(N * SEG * 2 * 3), base = [];
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < N; i++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * rimR * sc * 0.85; base.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, len: 0.5 + rnd() * 0.55, p: rnd() * 6.28 }); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xc9d4e0, transparent: true, opacity: 0.55 }));
  lines.frustumCulled = false; g.add(lines);
  const y0 = rimY * sc * 0.92;
  g.userData.feelers = (t) => {
    let k = 0;
    for (const f of base) {
      let px = f.x, py = y0, pz = f.z;
      for (let j = 1; j <= SEG; j++) {
        const u = j / SEG, w = Math.sin(t * 0.8 + f.p + u * 3.0) * 0.07 * u, v = Math.cos(t * 0.6 + f.p * 1.7 + u * 2.4) * 0.06 * u;
        const nx = f.x * (1 + u * 0.15) + w, ny = y0 - u * f.len * (rimY * sc), nz = f.z * (1 + u * 0.15) + v;
        pos.set([px, py, pz, nx, ny, nz], k); k += 6; px = nx; py = ny; pz = nz;
      }
    }
    geo.attributes.position.needsUpdate = true;
  };
}

// Vell: a swarm of finger-length gliders holding a polite person shape
function makeVell(m) {
  const N = 5200, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.03, -0.028, 0, -0.006, 0, 0.004, -0.014, 0, 0, 0.03, 0, 0.004, -0.014, 0.028, 0, -0.006], 3));
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide });
  const im = new THREE.InstancedMesh(g, mat, N); im.castShadow = true;
  const caps = [ // [x,y,z, x2,y2,z2, radius, weight]
    [-0.11, 0.05, 0, -0.1, 0.85, 0, 0.08, 3], [0.11, 0.05, 0, 0.1, 0.85, 0, 0.08, 3],
    [0, 0.9, 0, 0, 1.42, 0, 0.17, 6], [-0.25, 1.38, 0, -0.3, 0.8, 0.03, 0.055, 2], [0.25, 1.38, 0, 0.3, 0.8, 0.03, 0.055, 2],
    [0, 1.55, 0, 0, 1.72, 0, 0.1, 2],
  ];
  const tot = caps.reduce((a, c) => a + c[7], 0);
  const P = [], col = new THREE.Color();
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < N; i++) {
    let r = rnd() * tot, cp = caps[0]; for (const c of caps) { if ((r -= c[7]) <= 0) { cp = c; break; } }
    const t = rnd(), a = rnd() * 6.283, rr = cp[6] * Math.sqrt(rnd());
    const stray = rnd() < 0.09;
    P.push({ x: cp[0] + (cp[3] - cp[0]) * t + Math.cos(a) * rr, y: cp[1] + (cp[4] - cp[1]) * t, z: cp[2] + (cp[5] - cp[2]) * t + Math.sin(a) * rr,
      f: 0.6 + rnd() * 1.4, p: rnd() * 6.28, amp: stray ? 0.18 + rnd() * 0.25 : 0.015 + rnd() * 0.03, stray });
    col.setHSL(0.52 + rnd() * 0.12, 0.08 + rnd() * 0.15, 0.04 + rnd() * 0.08); im.setColorAt(i, col);
  }
  const s = m.h / 1.75, dummy = new THREE.Object3D();
  im.userData.update = (t) => {
    for (let i = 0; i < N; i++) {
      const q = P[i], w = t * q.f + q.p;
      const dx = Math.sin(w) * q.amp, dz = Math.cos(w * 0.9) * q.amp, dy = Math.sin(w * 1.3) * q.amp * 0.5;
      dummy.position.set((q.x + dx) * s, (q.y + dy + 0.01 * Math.sin(t * 1.7)) * s, (q.z + dz) * s);
      dummy.rotation.set(Math.sin(w * 2.0) * 0.5, Math.atan2(Math.cos(w), -Math.sin(w * 0.9) * 0.9), Math.sin(w * 7.0) * 0.6);
      dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
  };
  im.frustumCulled = false;
  return im;
}

async function build() {
  const rs = await Promise.allSettled(CREW.map(async (m) => {
    const g = new THREE.Group(); g.position.copy(hexPos(m.c, m.k)); scene.add(g); m.group = g;
    m.hh = m.h || 1;
    if (m.swarm) { g.add(makeVell(m)); m.size = new THREE.Vector3(0.7, m.h, 0.5); }
    else {
      const gl = await loadGLB(m.id);
      const root = new THREE.Group(); gl.scene.updateMatrixWorld(true);
      const meshes = []; gl.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
      const toF32 = (g) => { for (const k of Object.keys(g.attributes)) { const a = g.attributes[k]; if (k === 'uv') continue;
          if (k === 'color') { const f = new Float32Array(a.count * 3), c = new THREE.Color(); for (let i = 0; i < a.count; i++) { c.setRGB(a.getComponent(i, 0), a.getComponent(i, 1), a.getComponent(i, 2), THREE.SRGBColorSpace); f[i * 3] = c.r; f[i * 3 + 1] = c.g; f[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(f, 3)); continue; } if (!(a.array instanceof Float32Array) || a.normalized) { const f = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let j = 0; j < a.itemSize; j++) f[i * a.itemSize + j] = a.getComponent(i, j); g.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize)); } } };
      for (const o of meshes) { toF32(o.geometry); o.geometry.applyMatrix4(o.matrixWorld); o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.updateMatrix(); root.add(o); }
      { const b = new THREE.Box3().setFromObject(root), c = b.getCenter(new THREE.Vector3());
        for (const o of meshes) o.geometry.translate(-c.x, -b.min.y, -c.z); }
      finishMesh(root, m);
      // GLBs are pre-normalised: metres, feet at y=0, facing +Z, height 1. Scale here.
      const box = new THREE.Box3().setFromObject(root), sz = box.getSize(new THREE.Vector3());
      const sc = m.w ? m.w / Math.max(sz.x, sz.z) : m.h / sz.y; m.hh = sz.y;
      const n = m.family || 1;
      m.rigs = [];
      for (let i = 0; i < n; i++) {
        let inst;
        if (DEFS[m.id]) {
          const src = meshes[0]; const rig = buildRig(src.geometry, src.material.clone(), DEFS[m.id], 11 + i * 7 + m.c * 3);
          inst = new THREE.Group(); inst.add(rig.mesh); m.rigs.push(rig);
          if (m.id === 'blathe') rig.lights = ['sacL', 'sacR'].map((n) => { const L = new THREE.PointLight(0xffa640, 0, 0.5, 2); L.position.set(n === 'sacL' ? -0.02 : 0.02, 0, 0.04); rig.B[n].add(L); return L; });
        } else {
          inst = n > 1 ? root.clone(true) : root; const ph = i * 1.9;
          inst.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); addIdle(o.material, m, ph); } });
        }
        const s = sc * (n > 1 ? [1.05, 0.92, 0.8, 0.86, 0.74][i] : 1);
        inst.scale.setScalar(s);
        if (n > 1) { const o = [[0.02, 0.22], [-0.34, -0.06], [0.33, -0.02], [-0.12, -0.36], [0.2, -0.34]][i]; inst.position.set(o[0], 0, o[1]); inst.rotation.y = [0.15, -0.9, 0.8, -2.6, 2.3][i]; }
        g.add(inst);
      }
      m.size = sz.clone().multiplyScalar(sc);
      if (m.id === 'ondra') addOndraParts(g, root, sc);
      if (m.lift) g.position.y = m.lift;
      g.rotation.y = THREE.MathUtils.degToRad(m.yawOverride ?? 0);
    }
    const hgt = m.size.y + (m.lift || 0);
    const pick = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.8, R * 0.8, hgt, 8), new THREE.MeshBasicMaterial({ visible: false }));
    pick.position.copy(hexPos(m.c, m.k)); pick.position.y = hgt / 2; pick.userData.m = m; scene.add(pick); pickables.push(pick);
    m.center = hexPos(m.c, m.k).setY((m.lift || 0) + m.size.y * 0.55);
    actors.push(m);
  }));
  rs.forEach((r, i) => { if (r.status === 'rejected') console.error('load failed', CREW[i].id, r.reason); });
}

// UI
const names = document.getElementById('names');
const btn = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; names.appendChild(b); return b; };
const allBtn = btn('Crew', () => focus(null));
for (const m of CREW) m.btn = btn(m.name, () => focus(m));
if (Q.has('noui')) names.style.display = 'none';

let tween = null, focused = null;
function focus(m, az, el) {
  focused = m;
  for (const x of CREW) x.btn.classList.toggle('on', x === m); allBtn.classList.toggle('on', !m);
  let tgt, dist;
  if (!m) { tgt = new THREE.Vector3(-0.55, 0.75, 0.3); dist = 9.9; }
  else { tgt = m.center.clone(); const ext = Math.max(m.size.y + (m.lift || 0) * 0.5, m.size.x, m.size.z); dist = Math.max(1.6, ext * 1.9 + 0.6) * (Q.has('zoom') ? +Q.get('zoom') : 1); }
  const dir = camera.position.clone().sub(controls.target).normalize();
  if (az !== undefined) { const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el ?? 14); dir.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)); }
  else if (dir.y < 0.12) { dir.y = 0.2; dir.normalize(); }
  tween = { t0: performance.now(), d: Q.has('shot') ? 1 : 900, fromT: controls.target.clone(), toT: tgt, fromP: camera.position.clone(), toP: tgt.clone().add(dir.multiplyScalar(dist)) };
  if (m) { hi.position.x = m.group.position.x; hi.position.z = m.group.position.z; }
}
const ray = new THREE.Raycaster(), mv = new THREE.Vector2(); let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
  mv.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(mv, camera);
  const h = ray.intersectObjects(pickables)[0]; if (h) focus(h.object.userData.m);
});
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const clock = new THREE.Clock(); let simT = 0;
const CAP = Q.has('cap');
function animate(dt) {
  simT += dt;
  for (const m of actors) if (m.rigs) for (const r of m.rigs) { ANIM[m.id](r, simT, dt); if (r.lights) r.lights.forEach((L, i) => { L.intensity = 0.25 + 1.6 * r.sac[i]; }); }
}
window.__step = (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) { animate(dt); tick(simT); } renderer.render(scene, camera); };
function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 20); animate(dt); tick(simT);
  renderer.render(scene, camera); requestAnimationFrame(frame);
}
function tick(t) {
  uTime.value = t;
  if (tween) {
    const k = CAP ? 1 : Math.min(1, (performance.now() - tween.t0) / tween.d), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    controls.target.lerpVectors(tween.fromT, tween.toT, e); camera.position.lerpVectors(tween.fromP, tween.toP, e);
    if (k >= 1) tween = null;
  }
  hiMat.opacity += ((focused && !Q.has('noui') ? 0.55 + 0.15 * Math.sin(t * 2.2) : 0) - hiMat.opacity) * 0.1;
  for (const m of actors) {
    if (m.swarm) m.group.children[0].userData.update(t);
    if (m.group && m.group.userData.feelers) m.group.userData.feelers(t);
    if (m.idle === 'float') { m.group.position.y = m.lift + Math.sin(t * 0.7) * 0.07; m.group.rotation.y = THREE.MathUtils.degToRad(m.yawOverride ?? 0) + Math.sin(t * 0.13) * 0.25; }
  }
  controls.update();
}
build().then(() => {
  document.getElementById('load').style.opacity = 0;
  const f = Q.get('focus'); const m = CREW.find((x) => x.id === f);
  if (f || Q.has('az')) focus(m || null, Q.has('az') ? +Q.get('az') : undefined, Q.has('el') ? +Q.get('el') : undefined);
  window.__actors = actors; window.__ready = true;
}).catch((e) => { document.getElementById('load').textContent = 'Could not load: ' + e.message; console.error(e); });
if (!CAP) frame();
