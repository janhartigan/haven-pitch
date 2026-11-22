// Procedural rigs: hand-placed skeletons, distance-based skin weights (smoothed on the mesh),
// two-bone IK that keeps feet planted, and layered idle animation (holds + eases, springs for overlap).
import * as THREE from 'three';

// ---------- small animation toolkit ----------
const fract = (x) => x - Math.floor(x);
const hash = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
export function vnoise(t, s) { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); const a = hash(i + s * 57.3), b = hash(i + 1 + s * 57.3); return (a + (b - a) * u) * 2 - 1; }
export const fbm = (t, s) => vnoise(t, s) * 0.62 + vnoise(t * 2.13 + 3.1, s + 9) * 0.28 + vnoise(t * 4.7, s + 17) * 0.1;
export const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOutBack = (x) => { const c = 1.6; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
function rng(seed) { let s = Math.floor(hash(seed) * 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// A track holds a value for a while, then eases to a new one (reads as decisions, not drift).
export class Track {
  constructor(seed, { hold = [1.5, 4], trans = [0.35, 0.7], pick, start = 0, back = false }) {
    this.r = rng(seed); this.hold = hold; this.trans = trans; this.pick = pick; this.back = back;
    const v0 = pick(this.r, start); if (start === undefined || (Array.isArray(v0) && !Array.isArray(start))) start = Array.isArray(v0) ? v0.map(() => 0) : 0;
    this.segs = [{ t0: -1e3, tr: 0.01, v: start }];
  }
  _gen(t) {
    while (this.segs[this.segs.length - 1].t0 < t + 10) {
      const last = this.segs[this.segs.length - 1], r = this.r;
      const t0 = Math.max(0, last.t0) + this.hold[0] + r() * (this.hold[1] - this.hold[0]);
      this.segs.push({ t0, tr: this.trans[0] + r() * (this.trans[1] - this.trans[0]), v: this.pick(r, last.v) });
    }
  }
  at(t) {
    this._gen(t); let k = this.segs.length - 1; while (k > 0 && this.segs[k].t0 > t) k--;
    const s = this.segs[k], p = this.segs[Math.max(0, k - 1)], u = Math.min(1, (t - s.t0) / s.tr);
    const e = this.back ? easeOutBack(u) : easeIO(u);
    if (typeof s.v === 'number') return p.v + (s.v - p.v) * e;
    return s.v.map((x, i) => p.v[i] + (x - p.v[i]) * e);
  }
}
// One-shot pulses at random times (ear flicks, stamps, sniffs). Returns 0..1 envelope, plus which pulse.
export class Pulses {
  constructor(seed, { gap = [2, 6], dur = 0.3, shape = 'flick' }) { this.r = rng(seed); this.gap = gap; this.dur = dur; this.shape = shape; this.ts = [this.r() * gap[1]]; }
  at(t) {
    while (this.ts[this.ts.length - 1] < t + 10) this.ts.push(this.ts[this.ts.length - 1] + this.gap[0] + this.r() * (this.gap[1] - this.gap[0]));
    for (let i = this.ts.length - 1; i >= 0; i--) { const u = (t - this.ts[i]) / this.dur; if (u >= 0 && u <= 1) return { v: this.shape === 'flick' ? Math.sin(Math.PI * u) * (u < 0.35 ? 1 : 1) : Math.sin(Math.PI * u), u, i }; if (this.ts[i] < t - this.dur) break; }
    return { v: 0, u: -1, i: -1 };
  }
}
// Critically-damped-ish spring used for follow-through (tails, ears, arms, head lag).
export class Spring {
  constructor(k = 60, d = 9) { this.k = k; this.d = d; this.x = 0; this.v = 0; this.init = false; }
  step(target, dt) { if (!this.init) { this.x = target; this.init = true; } const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n; for (let i = 0; i < n; i++) { const a = this.k * (target - this.x) - this.d * this.v; this.v += a * h; this.x += this.v * h; } return this.x; }
}

// ---------- skin weights ----------
function segDist(p, a, b) {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2], L = abx * abx + aby * aby + abz * abz;
  let t = L > 0 ? ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby + (p[2] - a[2]) * abz) / L : 0; t = Math.max(0, Math.min(1, t));
  const x = a[0] + abx * t - p[0], y = a[1] + aby * t - p[1], z = a[2] + abz * t - p[2]; return Math.sqrt(x * x + y * y + z * z);
}
export function computeWeights(geo, def) {
  const pos = geo.attributes.position, n = pos.count, idx = geo.index ? geo.index.array : null;
  const map = new Map(), wid = new Int32Array(n), P = [];
  for (let i = 0; i < n; i++) { const k = Math.round(pos.getX(i) * 4000) + ',' + Math.round(pos.getY(i) * 4000) + ',' + Math.round(pos.getZ(i) * 4000); let id = map.get(k); if (id === undefined) { id = P.length; map.set(k, id); P.push([pos.getX(i), pos.getY(i), pos.getZ(i)]); } wid[i] = id; }
  const nw = P.length, bones = def.bones, nb = bones.length, segs = bones.map((b) => b.skin === false ? null : [b.h, b.t || b.h]);
  const W = new Float32Array(nw * nb);
  for (let v = 0; v < nw; v++) {
    const p = P[v]; let tot = 0;
    for (let j = 0; j < nb; j++) {
      if (!segs[j]) continue; let d = segDist(p, segs[j][0], segs[j][1]) / (bones[j].r || 1);
      if (bones[j].side && p[0] * bones[j].side < -0.015) d = d * 3 + 0.05;
      if (bones[j].ymax !== undefined && p[1] > bones[j].ymax) d += (p[1] - bones[j].ymax) * 3;
      if (bones[j].ymin !== undefined && p[1] < bones[j].ymin) d += (bones[j].ymin - p[1]) * 3;
      const w = 1 / (Math.pow(d + 0.004, 5)); W[v * nb + j] = w; tot += w;
    }
    for (let j = 0; j < nb; j++) W[v * nb + j] /= tot;
  }
  // smooth along the surface so joints bend instead of crease
  if (idx) {
    const deg = new Int32Array(nw), nbr = [];
    for (let v = 0; v < nw; v++) nbr.push([]);
    for (let f = 0; f < idx.length; f += 3) { const a = wid[idx[f]], b = wid[idx[f + 1]], c = wid[idx[f + 2]]; nbr[a].push(b, c); nbr[b].push(a, c); nbr[c].push(a, b); }
    const T = new Float32Array(nw * nb);
    for (let it = 0; it < (def.smooth ?? 6); it++) {
      for (let v = 0; v < nw; v++) { const L = nbr[v]; if (!L.length) { for (let j = 0; j < nb; j++) T[v * nb + j] = W[v * nb + j]; continue; }
        for (let j = 0; j < nb; j++) { let s = 0; for (const u of L) s += W[u * nb + j]; T[v * nb + j] = 0.5 * W[v * nb + j] + 0.5 * s / L.length; } }
      W.set(T);
    }
  }
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const v = wid[i], arr = []; for (let j = 0; j < nb; j++) arr.push([W[v * nb + j], j]); arr.sort((a, b) => b[0] - a[0]);
    let t = 0; for (let k = 0; k < 4; k++) t += arr[k][0];
    for (let k = 0; k < 4; k++) { si[i * 4 + k] = arr[k][1]; sw[i * 4 + k] = arr[k][0] / t; }
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
}

// ---------- rig instance ----------
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _e = new THREE.Euler();
export function buildRig(geo, material, def, seed) {
  if (!geo.attributes.skinIndex) computeWeights(geo, def);
  const mesh = new THREE.SkinnedMesh(geo, material); mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
  const B = {}, list = [];
  for (const d of def.bones) {
    const b = new THREE.Bone(); b.name = d.n; const par = d.p ? B[d.p] : null; const pd = d.p ? def.bones.find((x) => x.n === d.p) : null;
    b.position.set(d.h[0] - (pd ? pd.h[0] : 0), d.h[1] - (pd ? pd.h[1] : 0), d.h[2] - (pd ? pd.h[2] : 0));
    (par || mesh).add(b); B[d.n] = b; list.push(b);
  }
  mesh.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton(list));
  for (const b of list) { b.userData.rp = b.position.clone(); b.userData.rq = b.quaternion.clone(); }
  // IK legs: rest foot positions in mesh space, pole from rest knee bend
  const legs = (def.legs || []).map(([u, l, f]) => {
    const pu = new THREE.Vector3(...def.bones.find((x) => x.n === u).h), pl = new THREE.Vector3(...def.bones.find((x) => x.n === l).h), pf = new THREE.Vector3(...def.bones.find((x) => x.n === f).h);
    const dir = pf.clone().sub(pu).normalize(), knee = pl.clone().sub(pu); let pole = knee.sub(dir.clone().multiplyScalar(knee.dot(dir)));
    if (pole.length() < 1e-3) pole = new THREE.Vector3(0, 0, 1); pole.normalize();
    return { u: B[u], l: B[l], f: B[f], rest: pf.clone(), off: new THREE.Vector3(), pole, fq: null };
  });
  const rig = { mesh, B, legs, seed, state: {}, def };
  rig.reset = () => { for (const b of list) { b.position.copy(b.userData.rp); b.quaternion.copy(b.userData.rq); b.scale.set(1, 1, 1); } for (const L of legs) L.off.set(0, 0, 0); };
  // rotate bone by local euler (radians) on top of rest
  rig.rot = (n, x = 0, y = 0, z = 0) => { const b = B[n]; if (!b) return; _e.set(x, y, z, 'YXZ'); _q.setFromEuler(_e); b.quaternion.multiply(_q); };
  rig.move = (n, x = 0, y = 0, z = 0) => { const b = B[n]; if (b) b.position.add(_v.set(x, y, z)); };
  rig.scale = (n, x = 1, y = 1, z = 1) => { const b = B[n]; if (!b) return; b.scale.set(x, y, z); for (const c of b.children) if (c.isBone) c.scale.set(1 / x, 1 / y, 1 / z); };
  rig.solveIK = () => {
    mesh.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
    const L2W = (p) => p.clone().applyMatrix4(mesh.matrixWorld), W2L = (p) => p.clone().applyMatrix4(inv);
    for (const L of legs) {
      const a = W2L(L.u.getWorldPosition(new THREE.Vector3())), b = W2L(L.l.getWorldPosition(new THREE.Vector3())), c = W2L(L.f.getWorldPosition(new THREE.Vector3()));
      const t = L.rest.clone().add(L.off); if (window.__dbgIK) console.log('DBG', JSON.stringify([a, b, c, t].map((v) => v.toArray().map((x) => +x.toFixed(3)))));
      const lab = a.distanceTo(b), lbc = b.distanceTo(c); let lat = a.distanceTo(t); lat = Math.min(Math.max(lat, Math.abs(lab - lbc) + 1e-4), lab + lbc - 1e-4);
      const dir = t.clone().sub(a).normalize(), perp = L.pole.clone().sub(dir.clone().multiplyScalar(L.pole.dot(dir))).normalize();
      const cosA = (lab * lab + lat * lat - lbc * lbc) / (2 * lab * lat), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
      const knee = a.clone().add(dir.clone().multiplyScalar(lab * cosA)).add(perp.multiplyScalar(lab * sinA));
      const align = (bone, from, to) => { // rotate bone (in mesh space) so vector from->to
        const q = new THREE.Quaternion().setFromUnitVectors(from.normalize(), to.normalize());
        const mq = new THREE.Quaternion(); mesh.getWorldQuaternion(mq);
        const bw = new THREE.Quaternion(); bone.getWorldQuaternion(bw);
        const wq = mq.clone().multiply(q).multiply(mq.clone().invert()).multiply(bw); // world-space target
        const pw = new THREE.Quaternion(); bone.parent.getWorldQuaternion(pw);
        bone.quaternion.copy(pw.invert().multiply(wq)); bone.updateMatrixWorld(true);
      };
      align(L.u, b.clone().sub(a), knee.clone().sub(a));
      const b2 = W2L(L.l.getWorldPosition(new THREE.Vector3())), c2 = W2L(L.f.getWorldPosition(new THREE.Vector3()));
      align(L.l, c2.clone().sub(b2), t.clone().sub(b2));
      // keep the paw flat: restore the foot's rest orientation in mesh space
      const mq = new THREE.Quaternion(); mesh.getWorldQuaternion(mq); const pw = new THREE.Quaternion(); L.f.parent.getWorldQuaternion(pw);
      L.f.quaternion.copy(pw.invert().multiply(mq)); L.f.updateMatrixWorld(true);
    }
  };
  return rig;
}
