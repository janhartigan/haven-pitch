// Skeleton definitions (unit-height mesh space: feet y=0, facing +Z) and idle animators.
import { Track, Pulses, Spring, fbm, easeIO } from './rig.js';
const S = (x) => Math.sin(x), PI = Math.PI;
const mir = (b) => [b, { ...b, n: b.n.replace(/L$/, 'R'), p: b.p && b.p.replace(/L$/, 'R'), side: 1, h: [-b.h[0], b.h[1], b.h[2]], t: b.t && [-b.t[0], b.t[1], b.t[2]] }];
const legSet = (pre, par, u, l, f, ft) => [
  ...mir({ n: pre + 'uL', p: par, side: -1, h: u, t: l }), ...mir({ n: pre + 'lL', p: pre + 'uL', side: -1, h: l, t: f }), ...mir({ n: pre + 'fL', p: pre + 'lL', side: -1, h: f, t: ft }),
].sort((a, b) => 0); // order preserved: parents listed first by construction below
function legs(pre, par, u, l, f, ft) { // returns bones in parent-first order for L and R
  const L = [{ n: pre + 'uL', p: par, side: -1, h: u, t: l }, { n: pre + 'lL', p: pre + 'uL', side: -1, h: l, t: f }, { n: pre + 'fL', p: pre + 'lL', side: -1, h: f, t: ft }];
  const R = L.map((b) => ({ ...b, n: b.n.replace(/L$/, 'R'), p: b.p === par ? par : b.p.replace(/L$/, 'R'), side: 1, h: [-b.h[0], b.h[1], b.h[2]], t: [-b.t[0], b.t[1], b.t[2]] }));
  return [...L, ...R];
}
const spine = (pts) => pts.map((b, i) => ({ ...b, p: b.p ?? (i ? pts[i - 1].n : 'root'), t: b.t || (pts[i + 1] ? pts[i + 1].h : b.h) }));
const ROOT = { n: 'root', h: [0, 0, 0], skin: false };

export const DEFS = {
  tumble: { bones: [ROOT, ...spine([{ n: 'pelvis', h: [0, 0.45, -0.18] }, { n: 'spine', h: [0, 0.47, 0.02] }, { n: 'chest', h: [0, 0.46, 0.2] }, { n: 'neck', h: [0, 0.6, 0.27] }, { n: 'head', h: [0, 0.78, 0.36], t: [0, 0.8, 0.5] }]),
    { n: 'earL', p: 'head', side: -1, h: [-0.12, 0.88, 0.32], t: [-0.16, 0.98, 0.3], ymin: 0.84 }, { n: 'earR', p: 'head', side: 1, h: [0.12, 0.88, 0.32], t: [0.16, 0.98, 0.3], ymin: 0.84 },
    { n: 'tail1', p: 'pelvis', h: [0, 0.44, -0.32], t: [0, 0.35, -0.46] }, { n: 'tail2', p: 'tail1', h: [0, 0.35, -0.46], t: [0, 0.26, -0.57] }, { n: 'tail3', p: 'tail2', h: [0, 0.26, -0.57], t: [0, 0.22, -0.68] },
    ...legs('F', 'chest', [-0.09, 0.36, 0.24], [-0.09, 0.18, 0.26], [-0.09, 0.03, 0.27], [-0.09, 0.0, 0.31]),
    ...legs('H', 'pelvis', [-0.11, 0.38, -0.17], [-0.11, 0.17, -0.24], [-0.11, 0.03, -0.17], [-0.11, 0.0, -0.12])],
    legs: [['FuL', 'FlL', 'FfL'], ['FuR', 'FlR', 'FfR'], ['HuL', 'HlL', 'HfL'], ['HuR', 'HlR', 'HfR']] },
  hask: { bones: [ROOT, ...spine([{ n: 'pelvis', h: [0, 0.5, -0.3] }, { n: 'spine', h: [0, 0.55, 0.0] }, { n: 'chest', h: [0, 0.5, 0.28] }, { n: 'neck', h: [0, 0.55, 0.44], r: 0.8 }, { n: 'head', h: [0, 0.58, 0.56], t: [0, 0.55, 0.7], r: 0.8 }]),
    ...legs('F', 'chest', [-0.3, 0.33, 0.16], [-0.32, 0.16, 0.18], [-0.32, 0.03, 0.2], [-0.32, 0.0, 0.28]),
    ...legs('H', 'pelvis', [-0.28, 0.33, -0.38], [-0.3, 0.16, -0.4], [-0.3, 0.03, -0.4], [-0.3, 0.0, -0.32])],
    legs: [['FuL', 'FlL', 'FfL'], ['FuR', 'FlR', 'FfR'], ['HuL', 'HlL', 'HfL'], ['HuR', 'HlR', 'HfR']] },
  tiller: { bones: [ROOT, ...spine([{ n: 'pelvis', h: [0, 0.62, -0.38] }, { n: 'spine', h: [0, 0.64, -0.1] }, { n: 'chest', h: [0, 0.66, 0.15] }, { n: 'neck', h: [0, 0.74, 0.3] }, { n: 'head', h: [0, 0.74, 0.45], t: [0, 0.5, 0.6] }]),
    { n: 'earL', p: 'head', side: -1, h: [-0.09, 0.88, 0.37], t: [-0.11, 0.97, 0.35], ymin: 0.84 }, { n: 'earR', p: 'head', side: 1, h: [0.09, 0.88, 0.37], t: [0.11, 0.97, 0.35], ymin: 0.84 },
    { n: 'tail1', p: 'pelvis', h: [0, 0.62, -0.57], t: [0, 0.45, -0.63] },
    { n: 'pilot', p: 'chest', side: -1, h: [-0.18, 0.64, 0.28], t: [-0.18, 0.78, 0.32], r: 0.6 },
    ...legs('F', 'chest', [-0.12, 0.46, 0.13], [-0.12, 0.24, 0.13], [-0.12, 0.04, 0.13], [-0.12, 0.0, 0.18]),
    ...legs('H', 'pelvis', [-0.12, 0.48, -0.42], [-0.12, 0.22, -0.46], [-0.12, 0.04, -0.42], [-0.12, 0.0, -0.37])],
    legs: [['FuL', 'FlL', 'FfL'], ['FuR', 'FlR', 'FfR'], ['HuL', 'HlL', 'HfL'], ['HuR', 'HlR', 'HfR']] },
  human: { bones: [ROOT, ...spine([{ n: 'pelvis', h: [0, 0.52, 0] }, { n: 'spine', h: [0, 0.62, 0] }, { n: 'chest', h: [0, 0.74, 0] }, { n: 'neck', h: [0, 0.85, 0] }, { n: 'head', h: [0, 0.9, 0], t: [0, 1.0, 0] }]),
    ...legs('A', 'chest', [-0.1, 0.8, 0], [-0.13, 0.63, 0], [-0.14, 0.47, 0.01], [-0.14, 0.41, 0.01]),
    ...legs('L', 'pelvis', [-0.05, 0.5, 0], [-0.05, 0.27, 0.005], [-0.05, 0.05, 0], [-0.05, 0.01, 0.07])],
    legs: [['LuL', 'LlL', 'LfL'], ['LuR', 'LlR', 'LfR']] },
  blathe: { bones: [ROOT, ...spine([{ n: 'pelvis', h: [0, 0.4, 0] }, { n: 'spine', h: [0, 0.55, 0] }, { n: 'chest', h: [0, 0.7, 0] }, { n: 'head', h: [0, 0.85, 0.02], t: [0, 1.0, 0.05] }]),
    { n: 'sacL', p: 'chest', side: -1, h: [-0.13, 0.73, 0.13], t: [-0.16, 0.73, 0.2], r: 0.7 }, { n: 'sacR', p: 'chest', side: 1, h: [0.13, 0.73, 0.13], t: [0.16, 0.73, 0.2], r: 0.7 },
    ...legs('A', 'chest', [-0.22, 0.64, 0], [-0.25, 0.47, 0.02], [-0.25, 0.33, 0.04], [-0.25, 0.27, 0.06]),
    ...legs('L', 'pelvis', [-0.1, 0.35, 0], [-0.1, 0.18, 0.01], [-0.1, 0.03, 0.02], [-0.1, 0.0, 0.12])],
    legs: [['LuL', 'LlL', 'LfL'], ['LuR', 'LlR', 'LfR']] },
  sill: { bones: [ROOT, ...spine([{ n: 'pelvis', h: [0, 0.5, 0] }, { n: 'spine', h: [0, 0.6, 0] }, { n: 'chest', h: [0, 0.7, 0] }, { n: 'neck', h: [0, 0.8, 0] }, { n: 'head', h: [0, 0.88, 0], t: [0, 1.0, 0.02] }]),
    ...legs('A', 'chest', [-0.09, 0.76, 0], [-0.11, 0.6, 0], [-0.12, 0.45, 0], [-0.12, 0.38, 0]),
    ...legs('L', 'pelvis', [-0.04, 0.48, 0], [-0.04, 0.26, 0.003], [-0.04, 0.04, 0], [-0.04, 0.0, 0.05])],
    legs: [['LuL', 'LlL', 'LfL'], ['LuR', 'LlR', 'LfR']] },
};

// ---------- animators: (rig, t, dt) ; rig.state persists springs/tracks ----------
function init(rig, f) { if (!rig.state.ok) { f(rig.state, rig.seed); rig.state.ok = true; } return rig.state; }
const sp = (k, d) => new Spring(k, d);

export const ANIM = {
  tumble(rig, t, dt) {
    const s = init(rig, (s, z) => {
      s.look = new Track(z + 1, { hold: [0.8, 2.6], trans: [0.18, 0.35], pick: (r) => [(r() - 0.5) * 1.5, (r() - 0.6) * 0.5, (r() - 0.5) * 0.7] , start: [0, 0, 0] });
      s.shift = new Track(z + 2, { hold: [1.5, 3.5], trans: [0.4, 0.7], pick: (r) => (r() - 0.5) * 2 });
      s.sniff = new Pulses(z + 3, { gap: [2.5, 6], dur: 0.6 });
      s.earL = new Pulses(z + 4, { gap: [1.5, 5], dur: 0.22 }); s.earR = new Pulses(z + 5, { gap: [1.8, 5.5], dur: 0.22 });
      s.paw = new Pulses(z + 6, { gap: [5, 9], dur: 1.3 }); s.pawSide = 0;
      s.hy = sp(140, 15); s.hp = sp(140, 15); s.ht = sp(110, 13); s.eL = sp(260, 12); s.eR = sp(260, 12);
      s.t1 = sp(40, 6); s.t2 = sp(28, 4.5); s.t3 = sp(20, 3.5); s.rate = 0.85 + (z % 7) * 0.05;
      s.bow = new Pulses(z + 7, { gap: [7, 13], dur: 2.2 });
    });
    t *= s.rate;
    rig.reset();
    const br = S(t * 2 * PI * 0.75 + rig.seed);
    rig.scale('chest', 1 + 0.035 * br, 1 + 0.025 * br, 1 + 0.02 * br);
    const sh = s.shift.at(t);
    const paw = s.paw.at(t), pawIdx = paw.i % 2 === 0 ? 0 : 1, pv = paw.v; // lift one front paw, curious
    rig.move('pelvis', sh * 0.02, -Math.abs(sh) * 0.006 + 0.004 * br, 0); rig.rot('pelvis', 0, sh * 0.06, -sh * 0.05);
    rig.move('chest', (pawIdx ? -1 : 1) * pv * 0.02, pv * 0.01, -pv * 0.01); rig.rot('chest', 0, sh * 0.08, sh * 0.04);
    const L = s.look.at(t), sn = s.sniff.at(t);
    const sniffNod = sn.v * (0.12 + 0.05 * S(t * 40)) ;
    const yy = s.hy.step(L[0], dt), pp = s.hp.step(L[1], dt), tt = s.ht.step(L[2], dt);
    rig.rot('neck', L[1] * 0.35, L[0] * 0.35, 0);
    rig.rot('head', pp * 0.65 + sniffNod, yy * 0.65, tt);
    // ears: perk toward motion, flick independently
    const eSwing = (yy - L[0]) * 1.2;
    const fl = s.earL.at(t).v, fr = s.earR.at(t).v;
    rig.rot('earL', 0, 0, s.eL.step(-fl * 0.7 + eSwing * 0.3, dt)); rig.rot('earR', 0, 0, s.eR.step(fr * 0.7 + eSwing * 0.3, dt));
    // tail: slow curl with follow-through down the chain
    const base = fbm(t * 0.35, rig.seed) * 0.55 + sh * 0.25;
    const lift = 0.15 + fbm(t * 0.2, rig.seed + 3) * 0.2;
    const a1 = s.t1.step(base, dt), a2 = s.t2.step(a1, dt), a3 = s.t3.step(a2, dt);
    rig.rot('tail1', -lift, a1 * 0.6, 0); rig.rot('tail2', -lift * 0.8, a2 * 0.7, 0); rig.rot('tail3', -lift * 0.5, a3 * 0.9, 0);
    // paw lift with IK target
    const leg = rig.legs[pawIdx]; if (pv > 0) leg.off.set(0, pv * 0.09, pv * 0.04);
    // play-bow stretch: chest dips, front paws reach, rump stays up, tail lifts
    const bw = s.bow.at(t); if (bw.u >= 0 && pv === 0) {
      const u = bw.u, e = u < 0.3 ? easeIO(u / 0.3) : u < 0.7 ? 1 : 1 - easeIO((u - 0.7) / 0.3);
      rig.move('chest', 0, -0.11 * e, 0.02 * e); rig.rot('chest', 0.25 * e, 0, 0); rig.rot('pelvis', -0.12 * e, 0, 0);
      rig.rot('head', -0.35 * e, 0, 0); rig.rot('tail1', -0.5 * e, 0, 0);
      rig.legs[0].off.set(0, 0, 0.07 * e); rig.legs[1].off.set(0, 0, 0.07 * e);
    }
    rig.solveIK();
  },
  hask(rig, t, dt) {
    const s = init(rig, (s, z) => {
      s.look = new Track(z + 1, { hold: [2.5, 5], trans: [1.0, 1.6], pick: (r) => [(r() - 0.5) * 1.0, r() < 0.3 ? 0.4 : (r() - 0.6) * 0.4, (r() - 0.5) * 0.18] });
      s.stamp = new Pulses(z + 2, { gap: [4.5, 8], dur: 1.6 }); s.hy = sp(30, 9); s.hp = sp(30, 9); s.jolt = sp(90, 7);
    });
    rig.reset();
    const br = S(t * 2 * PI * 0.22);
    rig.move('spine', 0, 0.01 * br, 0); rig.scale('spine', 1 + 0.018 * br, 1 + 0.03 * br, 1 + 0.008 * br);
    const st = s.stamp.at(t), side = st.i % 2 ? 1 : -1; let u = st.u, lift = 0, shift = 0, impact = 0;
    if (u >= 0) {
      shift = u < 0.3 ? easeIO(u / 0.3) : u < 0.85 ? 1 : 1 - easeIO((u - 0.85) / 0.15);
      lift = u < 0.3 ? 0 : u < 0.62 ? easeIO((u - 0.3) / 0.32) : u < 0.7 ? 1 - (u - 0.62) / 0.08 : 0;
      impact = u >= 0.7 && u < 0.72 ? 1 : 0;
    }
    const j = s.jolt.step(impact ? -1 : 0, dt);
    rig.move('chest', -side * shift * 0.035, j * 0.02 + lift * 0.012, 0); rig.rot('chest', 0, 0, side * shift * 0.07);
    rig.move('pelvis', -side * shift * 0.012, 0, 0);
    const L = s.look.at(t), yy = s.hy.step(L[0], dt), pp = s.hp.step(L[1] + lift * 0.15 - j * 0.12, dt);
    rig.rot('neck', pp * 0.5, yy * 0.5, L[2]); rig.rot('head', pp * 0.6, yy * 0.6, L[2] * 0.6);
    const leg = rig.legs[side < 0 ? 1 : 0]; leg.off.set(0, lift * 0.1, lift * 0.03);
    rig.solveIK();
  },
  tiller(rig, t, dt) {
    const s = init(rig, (s, z) => {
      s.look = new Track(z + 1, { hold: [2, 4.5], trans: [0.7, 1.2], pick: (r) => [(r() - 0.5) * 0.9, r() < 0.4 ? 0.7 : (r() - 0.6) * 0.35, (r() - 0.5) * 0.2] });
      s.toss = new Pulses(z + 7, { gap: [5, 9], dur: 0.9 });
      s.shift = new Track(z + 2, { hold: [3, 6], trans: [0.9, 1.4], pick: (r) => (r() - 0.5) * 2 });
      s.earL = new Pulses(z + 3, { gap: [2, 5], dur: 0.25 }); s.earR = new Pulses(z + 4, { gap: [2.5, 6], dur: 0.25 });
      s.swish = new Pulses(z + 5, { gap: [3, 6], dur: 0.9 });
      s.pilot = new Track(z + 6, { hold: [0.5, 1.8], trans: [0.12, 0.22], pick: (r) => [(r() - 0.5) * 1.8, (r() - 0.5) * 0.8, (r() - 0.5) * 0.7] });
      s.hy = sp(35, 9); s.hp = sp(35, 9); s.t1 = sp(30, 4); s.py = sp(160, 12); s.pp = sp(160, 12);
    });
    rig.reset();
    const br = S(t * 2 * PI * 0.3);
    rig.scale('spine', 1 + 0.02 * br, 1 + 0.025 * br, 1); rig.move('spine', 0, 0.004 * br, 0);
    const sh = s.shift.at(t);
    rig.move('pelvis', sh * 0.018, 0, -sh * 0.02); rig.move('chest', sh * 0.014, -Math.abs(sh) * 0.006, -sh * 0.018); rig.rot('chest', 0, sh * 0.04, sh * 0.05);
    const L = s.look.at(t), yy = s.hy.step(L[0], dt), pp = s.hp.step(L[1], dt);
    const ts = s.toss.at(t), toss = ts.u >= 0 ? Math.sin(ts.u * PI * 3) * (1 - ts.u) * 0.35 : 0;
    rig.rot('neck', pp * 0.55 + 0.03 * br - Math.abs(toss) * 0.3, yy * 0.45, L[2]); rig.rot('head', pp * 0.45, yy * 0.55 + toss, L[2] + toss * 0.5);
    if (ts.u >= 0) { rig.rot('earL', 0, 0, -toss * 1.5); rig.rot('earR', 0, 0, -toss * 1.5); }
    rig.rot('earL', 0, 0, -s.earL.at(t).v * 0.6); rig.rot('earR', 0, 0, s.earR.at(t).v * 0.6);
    const sw = s.swish.at(t); const tail = s.t1.step(sw.v * (sw.i % 2 ? 1 : -1) * 0.9 + fbm(t * 0.4, rig.seed) * 0.15, dt);
    rig.rot('tail1', 0, tail, 0);
    const P = s.pilot.at(t); rig.rot('pilot', s.pp.step(P[1], dt) + S(t * 3.1) * 0.06, s.py.step(P[0], dt), P[2]); rig.move('pilot', 0, Math.max(0, S(t * 1.3)) * 0.015, 0);
    rig.solveIK();
  },
  human(rig, t, dt) {
    const s = init(rig, (s, z) => {
      s.look = new Track(z + 1, { hold: [1.8, 4.5], trans: [0.45, 0.8], pick: (r) => [(r() - 0.5) * 1.4, (r() - 0.55) * 0.35, (r() - 0.5) * 0.2] });
      s.shift = new Track(z + 2, { hold: [3, 6], trans: [1.0, 1.5], pick: (r, p) => (p > 0 ? -1 : 1) * (0.6 + r() * 0.4), start: 0.8 });
      s.hy = sp(60, 11); s.hp = sp(60, 11); s.aL = sp(25, 5); s.aR = sp(25, 5); s.ch = sp(30, 7);
    });
    rig.reset();
    const br = S(t * 2 * PI * 0.27);
    rig.scale('chest', 1 + 0.015 * br, 1 + 0.01 * br, 1 + 0.025 * br); rig.move('chest', 0, 0.003 * br, 0);
    const sh = s.shift.at(t), ch = s.ch.step(sh, dt);
    const L = s.look.at(t), yy = s.hy.step(L[0], dt), pp = s.hp.step(L[1], dt);
    rig.move('pelvis', sh * 0.032, -Math.abs(sh) * 0.009, 0); rig.rot('pelvis', 0, sh * 0.07, -sh * 0.075);
    rig.rot('spine', 0, -ch * 0.04 + yy * 0.08, ch * 0.055); rig.rot('chest', 0, -ch * 0.03 + yy * 0.12, ch * 0.04);
    rig.rot('neck', pp * 0.4, yy * 0.3, L[2] * 0.5 - ch * 0.03); rig.rot('head', pp * 0.6, yy * 0.45, L[2] - ch * 0.04);
    const aL = s.aL.step(-ch * 0.06, dt), aR = s.aR.step(-ch * 0.06, dt);
    rig.rot('AuL', 0.02 * br, 0, aL - 0.02); rig.rot('AuR', 0.02 * br, 0, aR + 0.02);
    rig.rot('AlL', -0.05 - 0.02 * br, 0, 0); rig.rot('AlR', -0.05 - 0.02 * br, 0, 0);
    rig.solveIK();
  },
  blathe(rig, t, dt) {
    const s = init(rig, (s, z) => {
      s.look = new Track(z + 1, { hold: [1.5, 3.5], trans: [0.3, 0.55], pick: (r) => [(r() - 0.5) * 0.8, (r() - 0.5) * 0.3, (r() - 0.5) * 0.35] });
      s.rock = new Track(z + 2, { hold: [1.2, 2.5], trans: [0.5, 0.8], pick: (r, p) => (p > 0 ? -1 : 1) * (0.5 + r() * 0.5), start: 0.6 });
      s.talk = new Track(z + 3, { hold: [0.6, 2.2], trans: [0.15, 0.3], pick: (r) => (r() < 0.65 ? 1 : 0) });
      s.hy = sp(80, 11); s.hp = sp(80, 11); s.sL = sp(180, 9); s.sR = sp(180, 9); s.aL = sp(30, 5); s.aR = sp(30, 5);
    });
    rig.reset();
    const br = S(t * 2 * PI * 0.4);
    rig.scale('spine', 1 + 0.03 * br, 1 + 0.012 * br, 1 + 0.04 * br);
    const rk = s.rock.at(t);
    rig.move('pelvis', rk * 0.028, -Math.abs(rk) * 0.006, 0); rig.rot('pelvis', 0, rk * 0.04, -rk * 0.09); rig.rot('chest', 0, 0, rk * 0.05);
    // muttering: syllable-like pulses through the throat sacs, slightly out of phase
    const tk = s.talk.at(t), syl = Math.max(0, S(t * 9.3) * 0.6 + S(t * 5.7 + 1) * 0.4);
    const sL = s.sL.step(tk * syl, dt), sR = s.sR.step(tk * Math.max(0, S(t * 9.3 - 0.7) * 0.6 + S(t * 6.1) * 0.4), dt);
    rig.scale('sacL', 1 + 0.4 * sL, 1 + 0.35 * sL, 1 + 0.4 * sL); rig.scale('sacR', 1 + 0.4 * sR, 1 + 0.35 * sR, 1 + 0.4 * sR); rig.sac = [sL, sR];

    const L = s.look.at(t), yy = s.hy.step(L[0], dt), pp = s.hp.step(L[1] - tk * syl * 0.1, dt);
    rig.rot('head', pp, yy, L[2] - rk * 0.03);
    rig.rot('AuL', 0, 0, s.aL.step(-rk * 0.08, dt) - 0.02 * br); rig.rot('AuR', 0, 0, s.aR.step(-rk * 0.08, dt) + 0.02 * br);
    rig.solveIK();
  },
  sill(rig, t, dt) {
    const s = init(rig, (s, z) => {
      s.look = new Track(z + 1, { hold: [2.5, 5.5], trans: [1.2, 1.8], pick: (r) => [(r() - 0.5) * 0.9, (r() - 0.5) * 0.3, (r() - 0.5) * 0.5] });
      s.shift = new Track(z + 2, { hold: [3.5, 6], trans: [1.6, 2.2], pick: (r, p) => (p > 0 ? -1 : 1) * (0.6 + r() * 0.4), start: 0.7 });
      s.hy = sp(20, 6); s.hp = sp(20, 6); s.ht = sp(20, 6); s.aL = sp(12, 3.2); s.aR = sp(12, 3.2);
    });
    rig.reset();
    const br = S(t * 2 * PI * 0.16);
    rig.scale('chest', 1 + 0.012 * br, 1 + 0.008 * br, 1 + 0.02 * br);
    const sh = s.shift.at(t);
    rig.move('pelvis', sh * 0.018, -Math.abs(sh) * 0.004, 0); rig.rot('pelvis', 0, sh * 0.03, -sh * 0.045); rig.rot('spine', 0, 0, sh * 0.035); rig.rot('chest', 0, sh * 0.06, sh * 0.03);
    const L = s.look.at(t), yy = s.hy.step(L[0], dt), pp = s.hp.step(L[1], dt), tl = s.ht.step(L[2], dt);
    rig.rot('neck', pp * 0.5, yy * 0.4, tl * 0.4); rig.rot('head', pp * 0.5, yy * 0.6, tl * 0.6);
    rig.rot('AuL', 0, 0, s.aL.step(-sh * 0.05 + fbm(t * 0.3, 4) * 0.04, dt)); rig.rot('AuR', 0, 0, s.aR.step(-sh * 0.05 + fbm(t * 0.3, 8) * 0.04, dt));
    rig.rot('AlL', -0.08 + fbm(t * 0.25, 2) * 0.08, 0, 0); rig.rot('AlR', -0.08 + fbm(t * 0.25, 6) * 0.08, 0, 0);
    rig.solveIK();
  },
};
