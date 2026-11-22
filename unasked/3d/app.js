import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildRig } from './rig.js?v=20261122b';
import { DEFS, ANIM, MAP2 } from './anims.js?v=20261122b';
import { buildRig2 } from './rig2.js?v=20261122b';

const Q = new URLSearchParams(location.search);
const R = 0.72, SQ3 = Math.sqrt(3);
// offset coords (flat-top columns): x = 1.5c, z = sqrt3*(k + (c&1)/2)
const hexPos = (c, k) => new THREE.Vector3(1.5 * R * c, 0, SQ3 * R * (k + (Math.abs(c) % 2) / 2));

// h = target height in metres (w = target width for floaters), yaw in degrees, lift = metres above ground
const CREW = [
  { id: 'ondra',  name: 'Ondra',  c: -4, k: 0, w: 1.75, lift: 0.45, idle: 'float', sway: 0.0, breath: 0.035 },
  { id: 'sill',   name: 'Sill',   c: -3, k: 0, h: 2.5, sway: 0.035, breath: 0.012 },
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
  const txt = await (await fetch(`m/${id}.b64?v=20261122b`)).text();
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
  if (m.id === 'sill') { addSillFrame(sk, sc); rig.organs = sk.userData.organs; }
  if (m.id === 'tiller') await addRider(m, rig, sz.y);
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
  sill(mat) {
    mat.transparent = true; mat.depthWrite = false; mat.opacity = 1; mat.roughness = 0.15; mat.metalness = 0.0;
    mat.color.setRGB(0.86, 0.92, 0.98); mat.emissive.setRGB(0.02, 0.025, 0.03);
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + RIM + 'totalEmissiveRadiance += vec3(0.08, 0.09, 0.1) + vec3(0.55, 0.7, 0.85) * fr * 0.4;')
        .replace('#include <opaque_fragment>', 'diffuseColor.a = mix(0.42, 0.96, fr);\n#include <opaque_fragment>');
    };
    mat.customProgramCacheKey = () => 'sill5';
  },
};

// Sill's brass frame: struts and bolted joints laid on the body surface, each strut carried by the bone it spans.
function addSillFrame(sk, sc) {
  const WS = new THREE.Matrix4().makeScale(sc, sc, sc);
  const bones = sk.skeleton.bones, g = sk.geometry, n = g.attributes.position.count, V = [], t = new THREE.Vector3();
  sk.updateWorldMatrix(true, true); for (let i = 0; i < n; i++) { sk.getVertexPosition(i, t); V.push(t.x, t.y, t.z); }
  const bb = new THREE.Box3(); for (let i = 0; i < n; i++) bb.expandByPoint(t.set(V[3*i], V[3*i+1], V[3*i+2]));
  const S = bb.max.y - bb.min.y, ox = (bb.min.x + bb.max.x) / 2, oz = (bb.min.z + bb.max.z) / 2, y0 = bb.min.y;
  const U = (x, y, z) => new THREE.Vector3(ox + x * S, y0 + y * S, oz + z * S); // unit coords -> mesh space
  const near = (fn) => { let best = null; for (let i = 0; i < n; i++) { const x = (V[3*i]-ox)/S, y = (V[3*i+1]-y0)/S, z = (V[3*i+2]-oz)/S; const v = fn(x, y, z); if (v !== null && (best === null || v > best)) best = v; } return best; };
  // body centre-line of a leg at height y: mean x of verts in the slab on that side
  const legAt = (side, y) => { let sx = 0, sz = 0, c = 0; for (let i = 0; i < n; i++) { const x = (V[3*i]-ox)/S, yy = (V[3*i+1]-y0)/S, z = (V[3*i+2]-oz)/S; if (Math.abs(yy - y) < 0.012 && x * side > 0.005 && Math.abs(x) < 0.15) { sx += x; sz += z; c++; } } return [sx / c, sz / c]; };
  const front = (x, y) => near((vx, vy, vz) => (Math.abs(vx - x) < 0.012 && Math.abs(vy - y) < 0.015) ? vz : null);
  const outer = (side, y, z) => near((vx, vy, vz) => (vx * side > 0 && Math.abs(vx) < 0.15 && Math.abs(vy - y) < 0.015 && Math.abs(vz - z) < 0.02) ? vx * side : null);
  const brass = new THREE.MeshStandardMaterial({ color: 0xb8893e, metalness: 0.9, roughness: 0.32, emissive: 0x2a1a06 });
  const R = 0.0042, J = 0.0072, out = -0.004;
  const sk2 = sk; sk2.updateMatrixWorld(true);
  const put = (mesh, bone) => { mesh.applyMatrix4(WS); mesh.updateMatrixWorld(true); bone.attach(mesh); }; // V = world / inst scale here (measured)
  const strut = (a, b, bone, r = R) => { const d = new THREE.Vector3().subVectors(b, a), L = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * S, r * S, L, 8), brass); m.castShadow = true;
    m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); put(m, bone); };
  const joint = (p, bone) => { const m = new THREE.Mesh(new THREE.SphereGeometry(J * S, 12, 8), brass); m.position.copy(p); m.castShadow = true; put(m, bone);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(J * 1.25 * S, 0.0022 * S, 6, 16), brass); ring.position.copy(p); ring.lookAt(p.clone().add(new THREE.Vector3(0, 0, 1))); put(ring, bone); };
  const legs = [[1, 44, 45, 46], [-1, 48, 49, 50]];
  const hipY = 0.52, kneeY = 0.295, ankY = 0.06;
  for (const [side, th, sh, ft] of legs) {
    const P = {}; for (const [k, y] of [['h', hipY], ['k', kneeY], ['a', ankY], ['m1', 0.41], ['m2', 0.18]]) {
      const [lx, lz] = legAt(side, y); const fz = front(lx, y) + out, oxx = (outer(side, y, lz) + out) * side;
      P[k + 'f'] = U(lx, y, fz); P[k + 'o'] = U(oxx, y, lz + 0.004); }
    strut(P.hf, P.kf, bones[th]); strut(P.kf, P.af, bones[sh]); strut(P.ho, P.ko, bones[th]); strut(P.ko, P.ao, bones[sh]);
    strut(P.m1f, P.ko, bones[th], R * 0.8); strut(P.m2f, P.ko, bones[sh], R * 0.8);
    joint(P.kf, bones[sh]); joint(P.ko, bones[sh]); joint(P.hf, bones[th]); joint(P.ao, bones[sh]); joint(P.af, bones[sh]);
  }
  // hip belt and torso uprights to the shoulders
  const belt = []; for (const x of [-0.085, -0.045, 0, 0.045, 0.085]) belt.push(U(x, 0.545, front(x, 0.545) + out));
  for (let i = 0; i < belt.length - 1; i++) strut(belt[i], belt[i + 1], bones[0]);
  for (const side of [1, -1]) {
    const pts = [0.545, 0.62, 0.7, 0.775].map((y) => { const x = side * (0.055 - (y - 0.545) * 0.05); return U(x, y, front(x, y) + out); });
    for (let i = 0; i < pts.length - 1; i++) strut(pts[i], pts[i + 1], bones[[0, 1, 2][i]]);
    joint(pts[0], bones[0]); joint(pts[3], bones[3]);
    const sh = U(side * 0.03 + side * 0.0, 0.795, front(side * 0.03, 0.795) + out); strut(pts[3], sh, bones[3], R * 0.8);
  }
  // inner light: a few warm/cool organs inside the chest, seen through the glass
  const cols = [0xffb450, 0x7fe0c0, 0xffd080, 0x9fd8ff, 0xffa040];
  [[0.015, 0.72, -0.02, 0.018], [-0.02, 0.69, -0.015, 0.015], [0.0, 0.645, -0.02, 0.02], [0.025, 0.66, -0.025, 0.012], [-0.01, 0.6, -0.02, 0.014]].forEach(([x, y, z, r], i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r * 0.6 * S, 12, 8), new THREE.MeshBasicMaterial({ color: cols[i], transparent: true, opacity: 0.7, depthWrite: false }));
    m.position.copy(U(x, y, z)); m.userData.pulse = i; put(m, bones[3]); sk.userData.organs = (sk.userData.organs || []).concat(m); });
  // sensor dots down the side of the head (concept), faintly lit
  const dotM = new THREE.MeshBasicMaterial({ color: 0x1a1510 });
  for (const side of [1, -1]) for (let i = 0; i < 5; i++) { const y = 0.955 - i * 0.012, z = 0.012;
    const x = outer(side, y, z); if (x === null) continue; const d = new THREE.Mesh(new THREE.SphereGeometry(0.0042 * S, 8, 6), dotM); d.position.copy(U(side * (x - 0.001), y, z)); put(d, bones[5]); }
}

// Tiller's rider is its own model with its own skeleton, carried in the sling pouch (child of the mount's chest bone).
const RIDER = { x: 0.0, y: 0.985, z: 0.04, h: 0.33, pitch: 0.0, yaw: 0.0 };
async function addRider(m, mount, H) {
  const gl = await loadGLB('rider'), root = gl.scene; root.updateMatrixWorld(true);
  let sk = null; root.traverse((o) => { if (o.isSkinnedMesh) { sk = o; o.frustumCulled = false; } });
  finishMesh(root, { id: 'rider' });
  const box = new THREE.Box3().setFromObject(root), sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  root.position.set(-c.x, -box.min.y, -c.z);
  const holder = new THREE.Group(); holder.add(root);
  const k = (RIDER.h * H) / sz.y;
  const want = new THREE.Matrix4().compose(new THREE.Vector3(RIDER.x * H, RIDER.y * H, RIDER.z * H), new THREE.Quaternion().setFromEuler(new THREE.Euler(RIDER.pitch, RIDER.yaw, 0, 'YXZ')), new THREE.Vector3(k, k, k));
  const chest = mount.B.chest; mount.frame.updateMatrixWorld(true);
  const chestInFrame = new THREE.Matrix4().copy(mount.frame.matrixWorld).invert().multiply(chest.matrixWorld);
  const local = chestInFrame.invert().multiply(want); local.decompose(holder.position, holder.quaternion, holder.scale);
  chest.add(holder); holder.updateMatrixWorld(true);
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
  for (const m of actors) if (m.rigs) for (const r of m.rigs) { ANIM[m.id](r, simT, dt); if (r.rider) ANIM.rider(r.rider, simT, dt); if (r.organs) r.organs.forEach((o, i) => { o.material.opacity = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(simT * (0.9 + 0.23 * i) + i * 1.7)); }); if (r.sacU && r.sac) r.sacU.value.set(r.sac[0], r.sac[1]); if (r.lights) r.lights.forEach((L, i) => { L.intensity = 0.25 + 0.3 * r.sac[i]; }); }
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
