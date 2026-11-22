// Rig adapter for auto-rigged GLBs (UniRig skeleton + learned skin weights).
// Same API as rig.js buildRig: reset / rot / move / scale / legs[i].off / solveIK, with semantic role names.
// rot(): euler in the character's REST mesh axes (x pitch, y yaw, z roll) regardless of each bone's own rest frame.
// move()/IK offsets are in unit-height fractions of the character.
import * as THREE from 'three';
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _m = new THREE.Matrix4();
export function buildRig2(frame, skinned, map, legsDef, seed, H) {
  const bones = skinned.skeleton.bones, B = {}, info = new Map();
  frame.updateMatrixWorld(true);
  const Finv = new THREE.Matrix4().copy(frame.matrixWorld).invert(), Fq = new THREE.Quaternion(); frame.getWorldQuaternion(Fq); const FqInv = Fq.clone().invert();
  const get = (idx) => typeof idx === 'number' ? bones[idx] : skinned.skeleton.getBoneByName(idx);
  const MULTI = {};
  for (const [role, idx] of Object.entries(map)) { if (Array.isArray(idx)) { MULTI[role] = idx.map(get).filter(Boolean); B[role] = MULTI[role][0]; } else { const b = get(idx); if (b) B[role] = b; } }
  for (const b of bones) {
    const wq = new THREE.Quaternion(); b.getWorldQuaternion(wq); const C = FqInv.clone().multiply(wq); // rest rotation in frame space
    const pq = new THREE.Quaternion(); if (b.parent) b.parent.getWorldQuaternion(pq); const PC = FqInv.clone().multiply(pq);
    const pm = new THREE.Matrix4(); if (b.parent) pm.copy(Finv).multiply(b.parent.matrixWorld); const pmInv = new THREE.Matrix3().setFromMatrix4(pm).invert();
    info.set(b, { rp: b.position.clone(), rq: b.quaternion.clone(), rs: b.scale.clone(), C, Ci: C.clone().invert(), pmInv });
  }
  const legs = (legsDef || []).map(([u, l, f]) => {
    const g = (r) => frame.worldToLocal(B[r].getWorldPosition(new THREE.Vector3()));
    const pu = g(u), pl = g(l), pf = g(f);
    const dir = pf.clone().sub(pu).normalize(), knee = pl.clone().sub(pu); let pole = knee.sub(dir.clone().multiplyScalar(knee.dot(dir)));
    if (pole.length() < 1e-4) pole = new THREE.Vector3(0, 0, 1); pole.normalize();
    return { u: B[u], l: B[l], f: B[f], rest: pf.clone(), off: new THREE.Vector3(), pole, fC: info.get(B[f]).C.clone() };
  });
  const rig = { mesh: skinned, frame, B, legs, seed, state: {}, H };
  rig.reset = () => { for (const [b, I] of info) { b.position.copy(I.rp); b.quaternion.copy(I.rq); b.scale.copy(I.rs); } for (const L of legs) L.off.set(0, 0, 0); };
  const rot1 = (b, x, y, z) => { const I = info.get(b); _e.set(x, y, z, 'YXZ'); _q.setFromEuler(_e); const X = I.Ci.clone().multiply(_q).multiply(I.C); b.quaternion.multiply(X); };
  rig.rot = (n, x = 0, y = 0, z = 0) => { if (!x && !y && !z) return; if (MULTI[n]) { const k = MULTI[n].length; for (const b of MULTI[n]) rot1(b, x / k, y / k, z / k); return; } const b = B[n]; if (b) rot1(b, x, y, z); };
  rig.move = (n, x = 0, y = 0, z = 0) => { const b = B[n]; if (!b) return; const I = info.get(b); _v.set(x * H, y * H, z * H).applyMatrix3(I.pmInv); b.position.add(_v); };
  rig.scale = (n, x = 1, y = 1, z = 1) => { const b = B[n]; if (!b) return; const I = info.get(b); b.scale.set(I.rs.x * x, I.rs.y * y, I.rs.z * z); };
  rig.solveIK = () => {
    frame.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(frame.matrixWorld).invert();
    const W2L = (p) => p.clone().applyMatrix4(inv), fq = new THREE.Quaternion(); frame.getWorldQuaternion(fq);
    for (const L of legs) {
      const a = W2L(L.u.getWorldPosition(new THREE.Vector3())), b = W2L(L.l.getWorldPosition(new THREE.Vector3())), c = W2L(L.f.getWorldPosition(new THREE.Vector3()));
      const t = L.rest.clone().add(L.off.clone().multiplyScalar(H));
      const lab = a.distanceTo(b), lbc = b.distanceTo(c); let lat = a.distanceTo(t); lat = Math.min(Math.max(lat, Math.abs(lab - lbc) + 1e-5), lab + lbc - 1e-5);
      const dir = t.clone().sub(a).normalize(), perp = L.pole.clone().sub(dir.clone().multiplyScalar(L.pole.dot(dir))).normalize();
      const cosA = (lab * lab + lat * lat - lbc * lbc) / (2 * lab * lat), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
      const knee = a.clone().add(dir.clone().multiplyScalar(lab * cosA)).add(perp.multiplyScalar(lab * sinA));
      const align = (bone, from, to) => {
        const q = new THREE.Quaternion().setFromUnitVectors(from.normalize(), to.normalize());
        const bw = new THREE.Quaternion(); bone.getWorldQuaternion(bw);
        const wq = fq.clone().multiply(q).multiply(fq.clone().invert()).multiply(bw);
        const pw = new THREE.Quaternion(); bone.parent.getWorldQuaternion(pw);
        bone.quaternion.copy(pw.invert().multiply(wq)); bone.updateMatrixWorld(true);
      };
      align(L.u, b.clone().sub(a), knee.clone().sub(a));
      const b2 = W2L(L.l.getWorldPosition(new THREE.Vector3())), c2 = W2L(L.f.getWorldPosition(new THREE.Vector3()));
      align(L.l, c2.clone().sub(b2), t.clone().sub(b2));
      const pw = new THREE.Quaternion(); L.f.parent.getWorldQuaternion(pw);
      L.f.quaternion.copy(pw.invert().multiply(fq.clone().multiply(L.fC))); L.f.updateMatrixWorld(true);
    }
  };
  return rig;
}
