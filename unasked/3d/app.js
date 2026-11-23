import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildRig } from './rig.js?v=20261122c';
import { DEFS, ANIM, MAP2 } from './anims.js?v=20261122c';
import { buildRig2 } from './rig2.js?v=20261122c';

const Q = new URLSearchParams(location.search);
const R = 0.72, SQ3 = Math.sqrt(3);
// offset coords (flat-top columns): x = 1.5c, z = sqrt3*(k + (c&1)/2)
const hexPos = (c, k) => new THREE.Vector3(1.5 * R * c, 0, SQ3 * R * (k + (Math.abs(c) % 2) / 2));

// h = target height in metres (w = target width for floaters), yaw in degrees, lift = metres above ground
const CREW = [
  { id: 'ondra',  name: 'Ondra',  c: -4, k: 0, w: 1.75, lift: 0.45, idle: 'float', sway: 0.0, breath: 0.035 },
  { id: 'sill',   name: 'Sill',   c: -3, k: 0, h: 2.3, sway: 0.035, breath: 0.012 },
  { id: 'hask',   name: 'Hask',   c: -2, k: 0, h: 1.1, tint: 1.5, sway: 0.006, breath: 0.012 },
  { id: 'human',  name: 'Human',  c: -1, k: 0, h: 1.74, tint: 1.3, sway: 0.018, breath: 0.012 },
  { id: 'blathe', name: 'Blathe', c: 0,  k: 0, h: 1.15, sway: 0.014, breath: 0.03 },
  { id: 'tumble', name: 'Tumble', c: 1,  k: 0, h: 0.42, sway: 0.03, breath: 0.03, family: 5 },
  { id: 'vell',   name: 'Vell',   c: 2,  k: 0, h: 1.8, swarm: true },
  { id: 'tiller', name: 'Tiller', c: 3,  k: 0, h: 1.2, sway: 0.01, breath: 0.014 },
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
  const txt = await (await fetch(`m/${id}.b64?v=20261122c`)).text();
  const bin = Uint8Array.from(atob(txt.trim()), (c) => c.charCodeAt(0));
  return await new Promise((res, rej) => loader.parse(bin.buffer, '', res, rej));
}

const actors = [], pickables = [];
// r4: auto-rigged characters. Keep the glTF skeleton; place/scale via a wrapper group (no geometry baking).
async function build2(m, gl, g) {
  const D = MAP2[m.id], root = gl.scene; root.updateMatrixWorld(true);
  let sk = null; root.traverse((o) => { if (o.isSkinnedMesh) { sk = o; o.frustumCulled = false; } });
  finishMesh(root, m);
  const box = new THREE.Box3().setFromObject(root), sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  root.position.set(-c.x, -box.min.y, -c.z); root.updateMatrixWorld(true);
  const map = { ...D.map }, legs = D.legs.map((L, i) => L.map((b, j) => { const k = 'g' + i + 'ulf'[j]; map[k] = b; return k; }));
  const inst = new THREE.Group(); inst.add(root);
  const sc = m.h / sz.y; inst.scale.setScalar(sc); g.add(inst); inst.updateMatrixWorld(true);
  const rig = buildRig2(root, sk, map, legs, 11 + m.c * 3, sz.y); m.rigs = [rig]; m.size = sz.clone().multiplyScalar(sc); m.hh = sz.y;
  if (D.sacs) addSacs(sk, D.sacs, rig);
  if (m.id === 'sill') rig.organs = addSillFrame(sk);
  if (m.id === 'tiller') { addPouch(rig, sz.y); await addRider(m, rig, sz.y); }
}
// Blathe's throat sacs: inflate in the vertex shader before skinning (bind space), glow with inflation.
function addSacs(sk, sacs, rig) {
  const g = sk.geometry; g.computeBoundingBox(); const bb = g.boundingBox, h = bb.max.y - bb.min.y, cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
  const C = sacs.map(([x, y, z, r]) => new THREE.Vector4(cx + x * h, bb.min.y + y * h, cz + z * h, r * h));
  const U = { value: new THREE.Vector2(0, 0) }; rig.sacU = U; const force = Q.has('sac') ? +Q.get('sac') : -1;
  const mat = sk.material;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSacA = { value: C[0] }; sh.uniforms.uSacB = { value: C[1] }; sh.uniforms.uInfl = force >= 0 ? { value: new THREE.Vector2(force, force) } : U;
    sh.vertexShader = 'uniform vec4 uSacA, uSacB; uniform vec2 uInfl; varying float vSac;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      { vec3 dA = transformed - uSacA.xyz, dB = transformed - uSacB.xyz;
        float fA = 1.0 - smoothstep(uSacA.w * 0.5, uSacA.w * 1.5, length(dA)), fB = 1.0 - smoothstep(uSacB.w * 0.5, uSacB.w * 1.5, length(dB));
        transformed += dA * fA * uInfl.x * 0.9 + dB * fB * uInfl.y * 0.9; vSac = fA * (0.35 + uInfl.x) + fB * (0.35 + uInfl.y); }`);
    sh.fragmentShader = 'varying float vSac;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(1.0, 0.5, 0.12) * vSac * 0.55;');
  };
  mat.needsUpdate = true;
}

// r5 looks: bind-space unit-height coords (u) shared by the vertex/fragment hooks
function unitUniforms(o) {
  const g = o.geometry; g.computeBoundingBox(); const b = g.boundingBox, S = b.max.y - b.min.y;
  return { uMin: { value: b.min.clone() }, uS: { value: S }, uHX: { value: (b.max.x - b.min.x) / (2 * S) }, uHZ: { value: (b.max.z - b.min.z) / (2 * S) } };
}
const UNIT_V = 'uniform vec3 uMin; uniform float uS, uHX, uHZ; varying vec3 vU;\n';
const UNIT_B = 'vec3 u = (position - uMin) / uS; u.x -= uHX; u.z -= uHZ; vU = u;\n';
const RIM = 'float fr = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.5);\n';
const LOOK = {
  // Tiller: concept mid-tone grey-brown, lighter muzzle and belly, darker dorsal saddle and feet; rounded back, rear spike smoothed
  tiller(mat, o) {
    const U = unitUniforms(o);
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = UNIT_V + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + UNIT_B + `
        float zm = smoothstep(-0.86, -0.62, u.z) * (1.0 - smoothstep(0.5, 0.7, u.z));
        float dy = 0.04 * max(0.0, 1.0 - pow(u.x / 0.29, 2.0)) * smoothstep(0.7, 0.93, u.y) * zm;
        if (u.z < -0.76) { float t = (-0.76 - u.z) / 0.18; float cap = 0.93 - t * t * 0.1; if (u.y > cap) dy -= (u.y - cap) * 0.85; }
        transformed.y += dy * uS;`);
      sh.fragmentShader = 'varying vec3 vU;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        { vec3 c = diffuseColor.rgb; float l = dot(c, vec3(0.299, 0.587, 0.114));
          vec3 base = vec3(0.30, 0.245, 0.19);
          c = mix(base * (0.45 + 4.5 * l), c * 2.4, 0.35);
          float muz = smoothstep(0.7, 0.86, vU.z) * (1.0 - smoothstep(0.62, 0.82, vU.y));
          float belly = (1.0 - smoothstep(0.38, 0.6, vU.y)) * step(0.2, vU.y);
          float saddle = smoothstep(0.86, 0.98, vU.y) * (1.0 - smoothstep(0.55, 0.75, vU.z));
          float feet = 1.0 - smoothstep(0.05, 0.13, vU.y);
          c *= (1.0 + 0.45 * muz + 0.3 * belly) * (1.0 - 0.28 * saddle) * (1.0 - 0.4 * feet);
          diffuseColor.rgb = c; }`);
    };
    mat.customProgramCacheKey = () => 'tiller5';
  },
  // rider: punchier blue/orange and a cool rim so it reads against the mount at board distance
  rider(mat) {
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        { vec3 c = diffuseColor.rgb; float l = dot(c, vec3(0.299, 0.587, 0.114)); diffuseColor.rgb = max(vec3(0.0), mix(vec3(l), c, 1.6)) * 1.5; }`)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + RIM + 'totalEmissiveRadiance += vec3(0.45, 0.75, 1.0) * fr * 0.7;');
    };
    mat.customProgramCacheKey = () => 'rider5';
  },
  // Sill: milky glass body, clear in the middle and dense at the edges, cool rim; brass frame and organs are separate geometry
  sill(mat, o) {
    const U = unitUniforms(o);
    mat.transparent = true; mat.depthWrite = false; mat.opacity = 1; mat.roughness = 0.12; mat.metalness = 0.0;
    mat.color.setRGB(0.97, 0.95, 0.92); mat.emissive.setRGB(0.085, 0.078, 0.07);
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = UNIT_V + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + UNIT_B + `
        if (u.y > ${SILL_NECK.toFixed(3)}) { float t = min(1.0, (u.y - ${SILL_NECK.toFixed(3)}) / ${(1 - SILL_NECK).toFixed(3)});
          vec3 w = vec3(u.x * (1.0 - 0.12 * t), ${SILL_NECK.toFixed(3)} + (u.y - ${SILL_NECK.toFixed(3)}) * 1.6, u.z * (1.0 - 0.06 * t) - 0.012 * t * t);
          transformed += (w - u) * uS; }`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + RIM + 'totalEmissiveRadiance += vec3(0.95, 0.9, 0.82) * fr * 0.32;')
        .replace('#include <opaque_fragment>', 'diffuseColor.a = mix(0.38, 0.95, fr);\n#include <opaque_fragment>');
    };
    mat.customProgramCacheKey = () => 'sill6';
  },
};

// Sill's head in the concept is a tall tapered bulb leaning slightly back; the generated mesh is a short round head.
// Same stretch is used by the vertex shader (LOOK.sill) and by anything placed on the head.
const SILL_NECK = 0.86;
let _glow = null; function glowTex() { if (_glow) return _glow; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); _glow = new THREE.CanvasTexture(c); return _glow; }
function sillHead(x, y, z) { if (y <= SILL_NECK) return [x, y, z]; const t = Math.min(1, (y - SILL_NECK) / (1 - SILL_NECK)); return [x * (1 - 0.12 * t), SILL_NECK + (y - SILL_NECK) * 1.6, z * (1 - 0.06 * t) - 0.012 * t * t]; }

// Sill's brass frame, per the concept sheet: medial + lateral rails on each leg with rungs front and back and an X at the knee,
// the lateral rails running up the torso sides to the shoulders, a waist belt, and a spine rail with a shoulder yoke on the back.
// Everything is placed in BIND space and parented to the bone it rides with: local = boneInverse * bindMatrix * M.
// (r5 used world matrices at build time, which depend on whether a frame had rendered yet -> frame landed on Blathe's hex.)
function addSillFrame(sk) {
  const bones = sk.skeleton.bones, inv = sk.skeleton.boneInverses, g = sk.geometry, PA = g.attributes.position, n = PA.count, V = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { V[3*i] = PA.getX(i); V[3*i+1] = PA.getY(i); V[3*i+2] = PA.getZ(i); }
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], V[3*i+a]); mx[a] = Math.max(mx[a], V[3*i+a]); }
  const S = mx[1] - mn[1], ox = (mn[0] + mx[0]) / 2, oz = (mn[2] + mx[2]) / 2, y0 = mn[1];
  const ux = (i) => (V[3*i] - ox) / S, uy = (i) => (V[3*i+1] - y0) / S, uz = (i) => (V[3*i+2] - oz) / S;
  const U = (x, y, z) => new THREE.Vector3(ox + x * S, y0 + y * S, oz + z * S);
  const slab = (y, f) => { const r = []; for (let i = 0; i < n; i++) if (Math.abs(uy(i) - y) < 0.012 && f(ux(i), uz(i))) r.push(i); return r; };
  // leg cross-section at height y on one side: medial/lateral x, front/back z, centre z
  const legSec = (side, y) => { const s = slab(y, (x) => x * side > 0.004 && Math.abs(x) < 0.15); let mi = 9, la = 0, fz = -9, bz = 9, cz = 0;
    for (const i of s) { const ax = Math.abs(ux(i)); mi = Math.min(mi, ax); la = Math.max(la, ax); fz = Math.max(fz, uz(i)); bz = Math.min(bz, uz(i)); cz += uz(i); }
    return { mi: mi * side, la: la * side, fz, bz, cz: cz / s.length, cx: (mi + la) / 2 * side }; };
  const torSec = (y) => { const s = slab(y, (x) => Math.abs(x) < 0.105); let la = 0, fz = -9, bz = 9, cz = 0; for (const i of s) { la = Math.max(la, Math.abs(ux(i))); fz = Math.max(fz, uz(i)); bz = Math.min(bz, uz(i)); cz += uz(i); } return { la, fz, bz, cz: cz / s.length }; };
  const brass = new THREE.MeshStandardMaterial({ color: 0xa87b3a, metalness: 0.85, roughness: 0.35, emissive: 0x1c1206 });
  const R = 0.0034, J = 0.0062, e = 0.002; // radii (unit height), outward offset so rails sit on the skin
  const bindM = sk.bindMatrix;
  const put = (mesh, b) => { if (typeof b !== 'number') b = bones.indexOf(b); mesh.updateMatrix(); const L = new THREE.Matrix4().multiplyMatrices(inv[b], bindM).multiply(mesh.matrix); L.decompose(mesh.position, mesh.quaternion, mesh.scale); bones[b].add(mesh); };
  const strut = (a, b, bone, r = R) => { const d = new THREE.Vector3().subVectors(b, a), L = d.length(); if (L < 1e-6) return;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * S, r * S, L, 6), brass); m.castShadow = true; m.userData.owner = 'sill';
    m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); put(m, bone); };
  const joint = (p, bone, r = J) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r * S, 10, 6), brass); m.position.copy(p); m.castShadow = true; m.userData.owner = 'sill'; put(m, bone); };
  const legBone = (y, th, sh) => (y <= 0.3 ? sh : th);
  const torBone = (y) => (y < 0.6 ? 0 : y < 0.67 ? 1 : y < 0.73 ? 2 : 3);
  const LY = [0.05, 0.12, 0.2, 0.295, 0.38, 0.46, 0.53];
  for (const [side, th, sh] of [[1, 44, 45], [-1, 48, 49]]) {
    const sec = LY.map((y) => legSec(side, y));
    const med = sec.map((c, k) => U(c.mi - side * e, LY[k], c.cz)), lat = sec.map((c, k) => U(c.la + side * e, LY[k], c.cz));
    for (let k = 0; k < LY.length - 1; k++) { const b = legBone((LY[k] + LY[k + 1]) / 2, th, sh); strut(med[k], med[k + 1], bones[b]); strut(lat[k], lat[k + 1], bones[b]); }
    LY.forEach((y, k) => { const b = legBone(y, th, sh); joint(med[k], bones[b]); joint(lat[k], bones[b]); });
    for (const k of [1, 2, 4, 5]) { const c = sec[k], b = legBone(LY[k], th, sh), fr = U(c.cx, LY[k], c.fz + e), bk = U(c.cx, LY[k], c.bz - e);
      strut(med[k], fr, bones[b], R * 0.8); strut(fr, lat[k], bones[b], R * 0.8); strut(med[k], bk, bones[b], R * 0.8); strut(bk, lat[k], bones[b], R * 0.8); }
    // X across the front of the knee
    const k0 = legSec(side, 0.25), k1 = legSec(side, 0.34);
    strut(U(k0.mi, 0.25, k0.fz + e), U(k1.la, 0.34, k1.fz + e), bones[sh], R * 0.8); strut(U(k0.la, 0.25, k0.fz + e), U(k1.mi, 0.34, k1.fz + e), bones[sh], R * 0.8);
    // lateral rail up the torso side to the shoulder
    const TY = [0.53, 0.6, 0.67, 0.74, 0.79], tp = TY.map((y, k) => { if (k === 0) return lat[LY.length - 1]; const t = torSec(y); return U(side * (t.la + e), y, t.cz); });
    for (let k = 0; k < TY.length - 1; k++) strut(tp[k], tp[k + 1], bones[torBone(TY[k])]);
    tp.forEach((p, k) => joint(p, bones[torBone(TY[k])], k === TY.length - 1 ? J * 1.3 : J));
  }
  // waist belt (front and back) and the back spine rail with a shoulder yoke
  const by = 0.545, bt = torSec(by), bx = [-1, -0.5, 0, 0.5, 1].map((f) => f * (bt.la + e));
  for (const zf of [1, -1]) { const pts = bx.map((x) => { const s = slab(by, (xx) => Math.abs(xx - x) < 0.015); let z = zf > 0 ? -9 : 9; for (const i of s) z = zf > 0 ? Math.max(z, uz(i)) : Math.min(z, uz(i)); return U(x, by, z + zf * e); });
    for (let k = 0; k < pts.length - 1; k++) strut(pts[k], pts[k + 1], bones[0]); }
  const SY = [0.545, 0.62, 0.69, 0.76, 0.8], sp = SY.map((y) => { const s = slab(y, (x) => Math.abs(x) < 0.015); let z = 9; for (const i of s) z = Math.min(z, uz(i)); return U(0, y, z - e); });
  for (let k = 0; k < SY.length - 1; k++) strut(sp[k], sp[k + 1], bones[torBone(SY[k])]);
  sp.forEach((p, k) => joint(p, bones[torBone(SY[k])]));
  for (const side of [1, -1]) { const t = torSec(0.79), sh = U(side * (t.la + e), 0.79, t.cz); strut(sh, sp[3], bones[3]); strut(sh, sp[2], bones[3], R * 0.8); }
  // inner light: amber and teal organs inside the chest and belly (concept), additive so they glow through the glass
  const org = [[0.035, 0.735, 0.012, 0.016, 0xffa850, 3], [-0.035, 0.735, 0.012, 0.016, 0xffa850, 3], [0.045, 0.7, 0.02, 0.012, 0x6fe8d0, 3], [-0.045, 0.7, 0.02, 0.012, 0x6fe8d0, 3],
    [0.0, 0.69, 0.015, 0.014, 0xffc070, 2], [0.02, 0.64, 0.015, 0.013, 0xff9a40, 1], [-0.02, 0.64, 0.015, 0.013, 0xff9a40, 1], [0.0, 0.6, 0.012, 0.012, 0xffb060, 1]];
  const organs = [];
  for (const [x, y, z, r, c, b] of org) { const t = torSec(y), zz = t.cz + z * 0.5;
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: c, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(U(x, y, zz)); put(m, b); m.scale.multiplyScalar(r * S * 4.5); m.userData.owner = 'sill'; organs.push(m); }
  // sensor dots: a vertical row on the front of the (stretched) head
  const dotM = new THREE.MeshStandardMaterial({ color: 0x1a120a, metalness: 0.6, roughness: 0.4 });
  for (let k = 0; k < 6; k++) { const y = 0.935 + k * 0.0085; const s = slab(y, (x) => Math.abs(x) < 0.012); if (!s.length) continue; let z = -9; for (const i of s) z = Math.max(z, uz(i));
    const [hx, hy, hz] = sillHead(0, y, z + 0.001); const d = new THREE.Mesh(new THREE.SphereGeometry(0.0036 * S, 8, 6), dotM); d.position.copy(U(hx, hy, hz)); d.userData.owner = 'sill'; put(d, 5); }
  return organs;
}

// Tiller's rider is its own model with its own skeleton, carried in the sling pouch (child of the mount's chest bone).
// r6: the rider sits IN a leather pouch slung on the mount's left shoulder (concept), head and gills above the rim.
// Unit-height coords of the mount (x<0 = its left). Shoulder surface there is |x| ~0.21 at y 0.55-0.75, z 0.35.
const POUCH = { x: -0.29, y: 0.5, z: 0.37, r: 0.1, d: 0.2, sx: 0.8 };
const RIDER = { x: -0.29, y: 0.62, z: 0.37, h: 0.2, pitch: -1.0, yaw: -0.2 }; // upright: tail down in the bag, head and gills out
function mountLocal(mount, M) { // matrix in mount frame space -> chest-bone space (both read from the same, freshly updated hierarchy)
  const chest = mount.B.chest; mount.frame.updateMatrixWorld(true);
  const chestInFrame = new THREE.Matrix4().copy(mount.frame.matrixWorld).invert().multiply(chest.matrixWorld);
  return chestInFrame.invert().multiply(M);
}
function addPouch(mount, H) {
  const P = POUCH, prof = [[0.0, 0.0], [0.45, 0.02], [0.8, 0.12], [0.97, 0.3], [1.0, 0.55], [0.96, 0.85], [1.0, 1.0]].map(([r, y]) => new THREE.Vector2(r * P.r * H, y * P.d * H));
  const leather = new THREE.MeshStandardMaterial({ color: 0x4e3424, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  const inner = new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.95, metalness: 0, side: THREE.BackSide });
  const g = new THREE.Group();
  const lumpy = (geo) => { const pa = geo.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), a = Math.atan2(z, x), f = 1 + 0.07 * Math.sin(3 * a + y * 40) + 0.04 * Math.sin(5 * a - y * 25); pa.setXYZ(i, x * f, y - 0.012 * H * Math.cos(2 * a) * (y / (P.d * H)), z * f); } geo.computeVertexNormals(); return geo; };
  const bag = new THREE.Mesh(lumpy(new THREE.LatheGeometry(prof, 32, 0, Math.PI * 2)), leather); bag.castShadow = true; g.add(bag);
  const lin = new THREE.Mesh(lumpy(new THREE.LatheGeometry(prof.map((v) => new THREE.Vector2(v.x * 0.97, v.y)), 32)), inner); g.add(lin);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(P.r * H * 1.0, 0.009 * H, 8, 28), new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.8 })); rim.rotation.x = Math.PI / 2; rim.position.y = P.d * H; g.add(rim);
  g.scale.set(P.sx, 1, 1);
  const M = new THREE.Matrix4().compose(new THREE.Vector3(P.x * H, P.y * H, P.z * H), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)).multiply(new THREE.Matrix4().makeScale(P.sx, 1, 1));
  g.scale.set(1, 1, 1);
  const holder = new THREE.Group(); holder.add(g); mountLocal(mount, M).decompose(holder.position, holder.quaternion, holder.scale);
  // strap: from the rim, hugging the shoulder, over the withers (surface points measured on the mesh at z~0.35)
  const SP = [[-0.2, 0.7, 0.37], [-0.212, 0.75, 0.36], [-0.185, 0.8, 0.35], [-0.172, 0.85, 0.35], [-0.152, 0.9, 0.35], [-0.09, 0.95, 0.35], [0.0, 0.975, 0.35]].map(([x, y, z]) => new THREE.Vector3(x * H, y * H, z * H));
  const sg = new THREE.Group();
  for (let i = 0; i < SP.length - 1; i++) { const d = new THREE.Vector3().subVectors(SP[i + 1], SP[i]), m = new THREE.Mesh(new THREE.BoxGeometry(0.006 * H, d.length() * 1.04, 0.032 * H), leather);
    m.position.copy(SP[i]).add(SP[i + 1]).multiplyScalar(0.5); const out = new THREE.Vector3(SP[i].x, SP[i].y - 0.6 * H, 0).normalize();
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), d, new THREE.Vector3(0, 0, 1))); m.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))); m.castShadow = true; sg.add(m); }
  const sh = new THREE.Group(); sh.add(sg); mountLocal(mount, new THREE.Matrix4()).decompose(sh.position, sh.quaternion, sh.scale);
  for (const h of [holder, sh]) { h.traverse((o) => { o.userData.owner = 'tiller'; }); mount.B.chest.add(h); }
}
async function addRider(m, mount, H) {
  const gl = await loadGLB('rider'), root = gl.scene; root.updateMatrixWorld(true);
  let sk = null; root.traverse((o) => { if (o.isSkinnedMesh) { sk = o; o.frustumCulled = false; } });
  finishMesh(root, { id: 'rider' });
  const box = new THREE.Box3().setFromObject(root), sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  root.position.set(-c.x, -box.min.y, -c.z);
  const holder = new THREE.Group(); holder.add(root);
  const k = (RIDER.h * H) / sz.y;
  const want = new THREE.Matrix4().compose(new THREE.Vector3(RIDER.x * H, RIDER.y * H, RIDER.z * H), new THREE.Quaternion().setFromEuler(new THREE.Euler(RIDER.pitch, RIDER.yaw, 0, 'YXZ')), new THREE.Vector3(k, k, k));
  mountLocal(mount, want).decompose(holder.position, holder.quaternion, holder.scale);
  mount.B.chest.add(holder); holder.updateMatrixWorld(true);
  const D = MAP2.rider, rig = buildRig2(root, sk, D.map, [], 97 + m.c, sz.y); rig.kind = 'rider'; mount.rider = rig;
}

function finishMesh(root, m) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const old = o.material;
    const mat = new THREE.MeshStandardMaterial({ map: old.map || null, vertexColors: !!o.geometry.attributes.color, roughness: m.id === 'sill' ? 0.25 : 0.82, metalness: 0.0 });
    if (m.id === 'sill') { mat.transparent = true; mat.opacity = 0.9; mat.emissive = new THREE.Color(0x2a2418); mat.roughness = 0.3; }
    if (m.id === 'ondra') { mat.transparent = true; mat.opacity = 0.82; mat.depthWrite = false; mat.roughness = 0.35; mat.emissive = new THREE.Color(0x1a2230); mat.side = THREE.DoubleSide; }
    if (m.id === 'blathe') { mat.emissive = new THREE.Color(0x1c1004); }
    if (m.tint) mat.color.setScalar(m.tint);
    if (o.isSkinnedMesh && LOOK[m.id]) LOOK[m.id](mat, o);
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

// Vell: a swarm of finger-length gliders holding a polite person shape.
// r5: each glider has a body keel and bent wings that beat; oil-slick sheen; the swarm is dense at a shell
// so the head, shoulders and robe-like taper read, with a thin halo of strays.
function makeVell(m) {
  const N = 4200;
  // glider: keel (tetra-ish spindle) + two swept wings with dihedral; aW = wing-tip weight for the beat
  const pos = [], w = [];
  const tri = (a, b, c, wa, wb, wc) => { pos.push(...a, ...b, ...c); w.push(wa, wb, wc); };
  const nose = [0, 0, 0.034], tail = [0, 0.002, -0.022], top = [0, 0.007, 0.004], bot = [0, -0.005, 0.006];
  tri(nose, top, tail, 0, 0, 0); tri(nose, tail, bot, 0, 0, 0); tri(nose, bot, top, 0, 0, 0);
  for (const sx of [1, -1]) { const root1 = [0, 0.003, 0.016], root2 = [0, 0.003, -0.012], tip = [sx * 0.036, 0.011, -0.01], mid = [sx * 0.018, 0.008, 0.008];
    tri(root1, mid, root2, 0, 0.5, 0); tri(mid, tip, root2, 0.5, 1, 0); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aW', new THREE.Float32BufferAttribute(w, 1));
  g.computeVertexNormals();
  const ph = new Float32Array(N), hue = new Float32Array(N);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.75, roughness: 0.3, side: THREE.DoubleSide, envMapIntensity: 0.22 });
  mat.envMap = VELL_ENV;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = VELL_T;
    sh.vertexShader = 'attribute float aW; attribute float aPh; attribute float aHue; uniform float uT; varying float vHue;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vHue = aHue; transformed.y += aW * sin(uT * (9.0 + 5.0 * fract(aPh * 3.7)) + aPh) * 0.014;`);
    sh.fragmentShader = 'varying float vHue;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { float fr = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
        vec3 iri = 0.5 + 0.5 * cos(6.2832 * (vHue + fr * 0.9 + vec3(0.0, 0.33, 0.67)));
        totalEmissiveRadiance += iri * (0.012 + 0.12 * fr * fr * fr); }`);
  };
  mat.customProgramCacheKey = () => 'vell5';
  const im = new THREE.InstancedMesh(g, mat, N); im.castShadow = true;
  // shape: radius profile (x, z) by height, head sphere, arms close to the body
  const prof = [[0.0, 0.015, 0.012], [0.25, 0.07, 0.055], [0.6, 0.13, 0.09], [0.95, 0.16, 0.1], [1.2, 0.2, 0.115], [1.36, 0.23, 0.11], [1.42, 0.12, 0.08], [1.47, 0.055, 0.05]];
  const rAt = (y) => { for (let i = 0; i < prof.length - 1; i++) { const [y0, a0, b0] = prof[i], [y1, a1, b1] = prof[i + 1]; if (y <= y1) { const t = (y - y0) / (y1 - y0); return [a0 + (a1 - a0) * t, b0 + (b1 - b0) * t]; } } return [0.05, 0.05]; };
  const P = [], col = new THREE.Color();
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < N; i++) {
    const k = rnd(); let x, y, z;
    const shell = 0.72 + 0.28 * Math.sqrt(rnd()); // most gliders sit near the surface so the silhouette reads
    if (k < 0.13) { const a = rnd() * 6.283, b = Math.acos(2 * rnd() - 1), r = 0.105 * shell; y = 1.6 + Math.cos(b) * r * 1.15; x = Math.sin(b) * Math.cos(a) * r; z = Math.sin(b) * Math.sin(a) * r * 0.95; }
    else if (k < 0.25) { const sd = rnd() < 0.5 ? 1 : -1, t = rnd(), a = rnd() * 6.283, r = 0.045 * shell; x = sd * (0.245 + 0.02 * t) + Math.cos(a) * r; y = 1.33 - 0.5 * t; z = 0.02 * t + Math.sin(a) * r; }
    else { y = Math.pow(rnd(), 0.8) * 1.45; const [rx, rz] = rAt(y), a = rnd() * 6.283; x = Math.cos(a) * rx * shell; z = Math.sin(a) * rz * shell; }
    const stray = rnd() < 0.07;
    if (stray) { x *= 1.6 + rnd(); z *= 1.6 + rnd(); y += (rnd() - 0.5) * 0.3; }
    // lower body frays: more motion near the ground
    const fray = Math.max(0, 0.5 - y) * 0.12;
    P.push({ x, y, z, f: 0.5 + rnd() * 1.2, p: rnd() * 6.28, amp: stray ? 0.12 + rnd() * 0.2 : 0.008 + rnd() * 0.02 + fray, stray, hd: Math.atan2(x, z) + Math.PI / 2 });
    ph[i] = rnd() * 6.28; hue[i] = rnd();
    const glint = rnd() < 0.05; if (glint) col.setHSL(0.11, 0.55, 0.5); else col.setHSL(0.55 + rnd() * 0.1, 0.08 + rnd() * 0.1, 0.07 + rnd() * 0.08);
    im.setColorAt(i, col);
  }
  g.setAttribute('aPh', new THREE.InstancedBufferAttribute(ph, 1)); g.setAttribute('aHue', new THREE.InstancedBufferAttribute(hue, 1));
  const s = m.h / 1.75, dummy = new THREE.Object3D();
  im.userData.update = (t) => {
    VELL_T.value = t;
    for (let i = 0; i < N; i++) {
      const q = P[i], w = t * q.f + q.p;
      const dx = Math.sin(w) * q.amp, dz = Math.cos(w * 0.9) * q.amp, dy = Math.sin(w * 1.3) * q.amp * 0.5;
      dummy.position.set((q.x + dx) * s, (q.y + dy + 0.012 * Math.sin(t * 1.1)) * s, (q.z + dz) * s);
      // gliders circle the body: heading tangent to the surface, banking with their wobble
      dummy.rotation.set(Math.sin(w * 1.7) * 0.35, q.hd + Math.sin(w * 0.5) * 0.6, Math.sin(w * 2.3) * 0.5);
      dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
  };
  im.frustumCulled = false;
  return im;
}
const VELL_T = { value: 0 };
const VELL_ENV = (() => { const pm = new THREE.PMREMGenerator(renderer); const t = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); return t; })();

async function build() {
  const rs = await Promise.allSettled(CREW.map(async (m) => {
    const g = new THREE.Group(); g.position.copy(hexPos(m.c, m.k)); scene.add(g); m.group = g;
    m.hh = m.h || 1;
    if (m.swarm) { g.add(makeVell(m)); m.size = new THREE.Vector3(0.7, m.h, 0.5); }
    else {
      const gl = await loadGLB(m.id);
      if (MAP2[m.id]) { await build2(m, gl, g); }
      else {
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
      }
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

const fbmA = (x) => Math.sin(x * 6.1) * 0.5 + Math.sin(x * 3.7 + 1.3) * 0.35 + Math.sin(x * 9.3 + 2.1) * 0.15;
const clock = new THREE.Clock(); let simT = 0;
const CAP = Q.has('cap'), ORB = Q.has('orbit') ? +Q.get('orbit') : 0;
function animate(dt) {
  simT += dt;
  for (const m of actors) if (m.rigs) for (const r of m.rigs) { ANIM[m.id](r, simT, dt); if (r.rider) ANIM.rider(r.rider, simT, dt); if (r.organs) r.organs.forEach((o, i) => { o.material.opacity = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(simT * (0.9 + 0.23 * i) + i * 1.7)); }); if (r.sacU && r.sac) r.sacU.value.set(r.sac[0], r.sac[1]); if (r.lights) r.lights.forEach((L, i) => { L.intensity = 0.25 + 0.3 * r.sac[i]; }); }
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
    if (m.idle === 'float') { m.group.position.y = m.lift + fbmA(t * 0.18) * 0.025; m.group.rotation.y = THREE.MathUtils.degToRad(m.yawOverride ?? 0) + fbmA(t * 0.07 + 5) * 0.35; m.group.rotation.z = fbmA(t * 0.15 + 9) * 0.05; m.group.rotation.x = fbmA(t * 0.13 + 2) * 0.04; }
  }
  if (ORB && !tween) { const o = camera.position.clone().sub(controls.target), a = ORB * (1 / 30) * Math.PI / 180; o.applyAxisAngle(new THREE.Vector3(0, 1, 0), a); camera.position.copy(controls.target).add(o); }
  controls.update();
}
build().then(() => {
  document.getElementById('load').style.opacity = 0;
  const f = Q.get('focus'); const m = CREW.find((x) => x.id === f);
  if (f || Q.has('az')) focus(m || null, Q.has('az') ? +Q.get('az') : undefined, Q.has('el') ? +Q.get('el') : undefined);
  window.__actors = actors; window.__ready = true;
}).catch((e) => { document.getElementById('load').textContent = 'Could not load: ' + e.message; console.error(e); });
if (!CAP) frame();
