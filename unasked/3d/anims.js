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
// r3 rules: no bone scaling on the spine chain (it pulsed the whole body), no sine Y offsets on pelvis/spine/chest,
// feet pinned by IK. Motion lives in heads, necks, limbs, tails, ears. Every instance runs its own schedule.
function init(rig, f) { if (!rig.state.ok) { f(rig.state, rig.seed); rig.state.ok = true; } return rig.state; }
const sp = (k, d) => new Spring(k, d);
const COUNT = {};
// Action scheduler: cycles a per-instance list of [name, minDur, maxDur]; blend weights via springs (~0.4 s ease).
class Sched {
  constructor(seed, seq, names) { let x = Math.floor((Math.sin(seed * 91.7) * 0.5 + 0.5) * 1e6) + 1; this.r = () => ((x = (x * 16807) % 2147483647) / 2147483647);
    this.seq = seq; this.k = 0; this.tEnd = this._dur(0); this.w = {}; this.sp = {}; for (const n of names) { this.w[n] = 0; this.sp[n] = new Spring(28, 10.5); } this.cur = seq[0][0]; }
  _dur(k) { const a = this.seq[k % this.seq.length]; return a[1] + this.r() * (a[2] - a[1]); }
  step(t, dt) { while (t > this.tEnd) { this.k++; this.tEnd += this._dur(this.k); } this.cur = this.seq[this.k % this.seq.length][0];
    for (const n in this.sp) this.w[n] = Math.max(0, Math.min(1.05, this.sp[n].step(n === this.cur ? 1 : 0, dt))); return this.w; }
}
// distribute a look (yaw, pitch, roll) over a chain with springs already applied
function look(rig, yy, pp, rr, chain) { for (const [n, k] of chain) rig.rot(n, pp * k, yy * k, rr * k); }

export const ANIM = {
  tumble(rig, t, dt) {
    const s = init(rig, (s, z) => {
      const k = (COUNT.tumble = (COUNT.tumble ?? -1) + 1) % 5; s.k = k;
      const SEQ = [
        [['look', 5, 7], ['sniff', 3, 4], ['look', 3, 5], ['bow', 2.2, 2.6]],
        [['sit', 6, 8], ['look', 3, 4], ['sniff', 3, 4]],
        [['sniff', 6, 8], ['look', 2.5, 3.5], ['sit', 4, 5]],
        [['scratch', 4.5, 5.5], ['sit', 2, 3], ['look', 3, 4]],
        [['look', 1.2, 1.6], ['bow', 2.4, 2.8], ['look', 3, 4], ['sniff', 3, 4]],
      ];
      s.sch = new Sched(z, SEQ[k], ['look', 'sit', 'sniff', 'scratch', 'bow']);
      s.look = new Track(z + 1, { hold: [0.6, 1.8], trans: [0.16, 0.3], pick: (r) => [(r() - 0.5) * 1.8, (r() - 0.55) * 0.6, (r() - 0.5) * 0.8], start: [0, 0, 0] });
      s.earL = new Pulses(z + 4, { gap: [1.2, 3.5], dur: 0.2 }); s.earR = new Pulses(z + 5, { gap: [1.4, 4], dur: 0.2 });
      s.hy = sp(150, 16); s.hp = sp(150, 16); s.ht = sp(120, 14); s.eL = sp(260, 11); s.eR = sp(260, 11);
      s.t1 = sp(45, 6); s.t2 = sp(32, 4.5); s.t3 = sp(22, 3.2); s.rate = 0.9 + k * 0.045; s.side = k % 2 ? 1 : -1;
    });
    rig.reset();
    const tt = t * s.rate, w = s.sch.step(t, dt);
    const br = S(tt * 2 * PI * 0.6 + rig.seed);
    rig.rot('chest', 0.03 * br, 0, 0);                                  // breathing as a tiny chest pitch, no scale
    const sit = Math.min(1, w.sit + w.scratch), sn = w.sniff, bw = w.bow, lk = 0.45 + 0.55 * w.look + 0.3 * sit;
    // sit: rump down, chest up, front legs straight (IK keeps paws planted)
    rig.move('pelvis', 0, -0.15 * sit, 0.02 * sit); rig.rot('pelvis', -0.42 * sit, 0, 0); rig.rot('chest', 0.18 * sit, 0, 0);
    // sniff ground: neck dives, nose twitches and sweeps
    const nose = sn * (0.07 * S(tt * 26) * Math.max(0, S(tt * 2.1))) ;
    rig.move('chest', 0, -0.05 * sn, 0.01 * sn); rig.rot('chest', 0.12 * sn, 0, 0);
    rig.rot('neck', 0.75 * sn, 0.5 * sn * S(tt * 0.9 + s.k), 0); rig.rot('head', 0.35 * sn + nose, 0, 0);
    // play-bow: chest dips, paws reach, rump up, tail wags fast
    rig.move('chest', 0, -0.1 * bw, 0.03 * bw); rig.rot('chest', 0.2 * bw, 0, 0); rig.rot('pelvis', -0.1 * bw, 0, 0); rig.rot('head', -0.45 * bw, 0, 0.2 * bw);
    if (bw > 0.01) { rig.legs[0].off.set(0, 0, 0.08 * bw); rig.legs[1].off.set(0, 0, 0.08 * bw); }
    // look around (big, quick head turns with a little settle)
    const L = s.look.at(tt), yy = s.hy.step(L[0] * lk * (1 - 0.6 * sn), dt), pp = s.hp.step(L[1] * lk * (1 - sn), dt), rr = s.ht.step(L[2] * lk, dt);
    look(rig, yy, pp, rr, [['neck', 0.45], ['head', 0.6]]);
    // scratch: hind paw up to the ear, fast strokes, head tilts into it
    const sc = w.scratch, side = s.side, hl = rig.legs[side < 0 ? 2 : 3];
    if (sc > 0.01) { const f = S(tt * 2 * PI * 5.5);
      hl.off.set(side * 0.03 * sc, (0.27 + 0.035 * f) * sc, (0.2 + 0.03 * f) * sc);
      rig.rot('head', 0.1 * sc, -side * 0.35 * sc, -side * 0.5 * sc); rig.rot('neck', 0, -side * 0.2 * sc, -side * 0.25 * sc); rig.rot('chest', 0, 0, side * 0.12 * sc); }
    // ears: flick + swing against head turns, flatten while scratching
    const eSwing = (yy - L[0] * lk) * 1.4, fl = s.earL.at(tt).v, fr = s.earR.at(tt).v;
    rig.rot('earL', -0.4 * sc, 0, s.eL.step(-fl * 0.9 + eSwing * 0.4 - 0.5 * sc, dt)); rig.rot('earR', -0.4 * sc, 0, s.eR.step(fr * 0.9 + eSwing * 0.4 + 0.5 * sc, dt));
    // tail: curl and sway with follow-through; fast wag in play-bow
    const base = fbm(tt * 0.5, rig.seed) * 0.8 + bw * 0.55 * S(tt * 15) + sit * 0.4 * side;
    const lift = 0.2 + fbm(tt * 0.3, rig.seed + 3) * 0.25 + bw * 0.5 - sit * 0.3;
    const a1 = s.t1.step(base, dt), a2 = s.t2.step(a1, dt), a3 = s.t3.step(a2, dt);
    rig.rot('tail1', -lift, a1 * 0.7, 0); rig.rot('tail2', -lift * 0.7, a2 * 0.8, 0); rig.rot('tail3', -lift * 0.4, a3 * 1.0, 0);
    rig.solveIK();
  },
  hask(rig, t, dt) {
    const s = init(rig, (s, z) => {
      s.sch = new Sched(z, [['look', 2.5, 3.5], ['stamp', 2.2, 2.2], ['graze', 3.5, 5], ['look', 2, 3], ['stamp', 2.2, 2.2]], ['look', 'stamp', 'graze']);
      s.look = new Track(z + 1, { hold: [1.4, 2.6], trans: [0.7, 1.0], pick: (r) => [(r() - 0.5) * 1.3, (r() - 0.6) * 0.35, (r() - 0.5) * 0.3] });
      s.hy = sp(28, 9); s.hp = sp(28, 9); s.hr = sp(28, 9); s.jolt = sp(90, 7); s.t0 = -1; s.side = 1;
    });
    rig.reset();
    const w = s.sch.step(t, dt);
    if (s.sch.cur === 'stamp' && s.t0 < 0) { s.t0 = t; s.side = -s.side; } if (s.sch.cur !== 'stamp') s.t0 = -1;
    const br = S(t * 2 * PI * 0.2); rig.rot('chest', 0.025 * br, 0, 0); rig.rot('spine', -0.015 * br, 0, 0);
    let shift = 0, lift = 0, impact = 0; const u = s.t0 >= 0 ? (t - s.t0) / 1.8 : -1, side = s.side;
    if (u >= 0 && u <= 1) {
      shift = u < 0.25 ? easeIO(u / 0.25) : u < 0.85 ? 1 : 1 - easeIO((u - 0.85) / 0.15);
      lift = u < 0.25 ? 0 : u < 0.55 ? easeIO((u - 0.25) / 0.3) : u < 0.62 ? 1 - (u - 0.55) / 0.07 : 0;
      impact = u >= 0.62 && u < 0.66 ? 1 : 0;
    }
    const j = s.jolt.step(impact ? -1 : 0, dt);
    // weight onto the other three legs, then lift and slam the free front foot
    rig.move('chest', -side * shift * 0.05, j * 0.025, 0); rig.rot('chest', 0, side * shift * 0.06, side * shift * 0.1); rig.move('pelvis', -side * shift * 0.02, 0, 0);
    const leg = rig.legs[side < 0 ? 1 : 0]; leg.off.set(side * 0.02 * lift, lift * 0.2, lift * 0.06);
    // head: low and heavy; grazing sweeps the snout along the ground
    const g = w.graze, L = s.look.at(t);
    const yy = s.hy.step(L[0] * (1 - g) + g * 0.45 * S(t * 0.8), dt), pp = s.hp.step(L[1] * (1 - g) + g * 0.6 + lift * 0.25 + shift * 0.15 - j * 0.3, dt), rr = s.hr.step(L[2], dt);
    rig.move('chest', 0, -0.035 * g, 0); rig.rot('chest', 0.1 * g, 0, 0);
    look(rig, yy, pp, rr, [['neck', 0.5], ['head', 0.6]]);
    rig.solveIK();
  },
  tiller(rig, t, dt) {
    const s = init(rig, (s, z) => {
      s.sch = new Sched(z, [['alert', 1.0, 1.4], ['graze', 2.4, 3.0], ['alert', 2.4, 3.0], ['graze', 2.5, 3.5]], ['graze', 'alert']);
      s.look = new Track(z + 1, { hold: [0.9, 2], trans: [0.35, 0.6], pick: (r) => [(r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.5), (r() - 0.5) * 0.3, (r() - 0.5) * 0.4] });
      s.toss = new Pulses(z + 7, { gap: [2.2, 4], dur: 0.9 });
      s.shift = new Track(z + 2, { hold: [2.5, 4.5], trans: [0.8, 1.2], pick: (r, p) => (p > 0 ? -1 : 1) * (0.6 + r() * 0.4), start: 0.7 });
      s.earL = new Pulses(z + 3, { gap: [1.2, 3], dur: 0.25 }); s.earR = new Pulses(z + 4, { gap: [1.5, 3.5], dur: 0.25 });
      s.swish = new Pulses(z + 5, { gap: [1.8, 3.5], dur: 1.0 });
      s.pilot = new Track(z + 6, { hold: [0.6, 1.6], trans: [0.12, 0.22], pick: (r) => [(r() - 0.5) * 2.2, (r() - 0.5) * 0.9, (r() - 0.5) * 0.9] });
      s.hy = sp(45, 10); s.hp = sp(30, 9); s.t1 = sp(30, 4); s.py = sp(160, 12); s.pp = sp(160, 12);
    });
    rig.reset();
    const w = s.sch.step(t, dt), g = w.graze, a = w.alert;
    const br = S(t * 2 * PI * 0.28); rig.rot('chest', 0.02 * br, 0, 0);
    const sh = s.shift.at(t);
    rig.rot('chest', 0, -sh * 0.02, sh * 0.015);
    // grazing: whole neck dips to the ground, chewing nods; alert: head high, quick looks, ears forward
    const L = s.look.at(t), chew = g * 0.06 * S(t * 2 * PI * 1.6);
    const ts = s.toss.at(t), toss = a * (ts.u >= 0 ? Math.sin(ts.u * PI * 3) * (1 - ts.u) * 0.45 : 0);
    const yy = s.hy.step(L[0] * a + g * 0.25 * S(t * 0.6), dt), pp = s.hp.step(g * 1.05 - a * 0.25 + L[1] * a, dt);
    rig.rot('chest', 0.04 * g, 0, 0);
    rig.rot('neck', pp * 0.7 - Math.abs(toss) * 0.3, yy * 0.45, L[2] * a); rig.rot('head', pp * 0.4 + chew, yy * 0.55 + toss, L[2] * a + toss * 0.5);
    rig.rot('earL', -0.3 * a, 0, -s.earL.at(t).v * 1.3 - toss * 1.5 + yy * 0.5); rig.rot('earR', -0.3 * a, 0, s.earR.at(t).v * 1.3 - toss * 1.5 + yy * 0.5);
    const sw = s.swish.at(t); const tail = s.t1.step(sw.v * (sw.i % 2 ? 1 : -1) * 1.1 + fbm(t * 0.4, rig.seed) * 0.2, dt);
    rig.rot('tail1', -0.1, tail, 0);
    const P = s.pilot.at(t); rig.rot('pilot', s.pp.step(P[1], dt), s.py.step(P[0], dt), P[2]);
    rig.solveIK();
  },
  human(rig, t, dt) {
    const s = init(rig, (s, z) => {
      s.look = new Track(z + 1, { hold: [1.4, 3.2], trans: [0.4, 0.7], pick: (r) => [r() < 0.2 ? (r() < 0.5 ? -1 : 1) * 1.2 : (r() - 0.5) * 1.4, (r() - 0.55) * 0.4, (r() - 0.5) * 0.25] });
      s.shift = new Track(z + 2, { hold: [2.2, 4], trans: [0.8, 1.2], pick: (r, p) => (p > 0 ? -1 : 1) * (0.7 + r() * 0.3), start: 0.85 });
      s.hy = sp(70, 12); s.hp = sp(70, 12); s.cy = sp(14, 6); s.aL = sp(22, 4.5); s.aR = sp(22, 4.5); s.ch = sp(26, 7.5);
    });
    rig.reset();
    const br = S(t * 2 * PI * 0.25);
    rig.rot('chest', -0.025 * br, 0, 0); rig.rot('AuL', 0, 0, -0.03 * br); rig.rot('AuR', 0, 0, 0.03 * br);
    // hip-to-hip: pelvis slides over the standing leg, hip hitches, spine and shoulders counter
    const sh = s.shift.at(t), ch = s.ch.step(sh, dt);
    rig.move('pelvis', sh * 0.032, -Math.abs(sh) * 0.006, 0); rig.rot('pelvis', 0, sh * 0.08, -sh * 0.1);
    rig.rot('spine', 0, 0, ch * 0.09); rig.rot('chest', 0, 0, ch * 0.05);
    // looking around: eyes/head lead, chest follows slowly
    const L = s.look.at(t), yy = s.hy.step(L[0], dt), pp = s.hp.step(L[1], dt), cy = s.cy.step(L[0], dt);
    rig.rot('spine', 0, cy * 0.12, 0); rig.rot('chest', 0, cy * 0.18, 0);
    rig.rot('neck', pp * 0.4, (yy - cy * 0.3) * 0.35, L[2] * 0.5 - ch * 0.04); rig.rot('head', pp * 0.6, (yy - cy * 0.3) * 0.55, L[2] - ch * 0.05);
    // arms hang and lag the torso
    const aL = s.aL.step(-ch * 0.12 - cy * 0.06, dt), aR = s.aR.step(-ch * 0.12 - cy * 0.06, dt);
    rig.rot('AuL', 0.04 * S(t * 0.7) + aL * 0.4, 0, aL - 0.03); rig.rot('AuR', -0.04 * S(t * 0.7) - aR * 0.4, 0, aR + 0.03);
    rig.rot('AlL', -0.12, 0, 0); rig.rot('AlR', -0.12, 0, 0);
    rig.solveIK();
  },
  blathe(rig, t, dt) {
    const s = init(rig, (s, z) => {
      s.look = new Track(z + 1, { hold: [1.0, 2.6], trans: [0.25, 0.45], pick: (r) => [(r() - 0.5) * 1.3, (r() - 0.5) * 0.4, (r() - 0.5) * 0.5] });
      s.rock = new Track(z + 2, { hold: [0.9, 1.8], trans: [0.45, 0.7], pick: (r, p) => (p > 0 ? -1 : 1) * (0.6 + r() * 0.4), start: 0.7 });
      s.talk = new Track(z + 3, { hold: [0.8, 2.2], trans: [0.15, 0.3], pick: (r) => (r() < 0.7 ? 1 : 0), start: 1 });
      s.gest = new Pulses(z + 4, { gap: [2.5, 4.5], dur: 1.4 });
      s.hy = sp(80, 11); s.hp = sp(80, 11); s.sL = sp(140, 8); s.sR = sp(140, 8); s.aL = sp(30, 5); s.aR = sp(30, 5); s.big = sp(10, 5);
    });
    rig.reset();
    const br = S(t * 2 * PI * 0.35);
    rig.rot('chest', -0.03 * br, 0, 0);
    const rk = s.rock.at(t);
    rig.move('pelvis', rk * 0.01, 0, 0); rig.rot('pelvis', 0, rk * 0.03, -rk * 0.05); rig.rot('spine', 0, 0, rk * 0.03); rig.rot('chest', 0, 0, rk * 0.03);
    // throat sacs: slow breath swell + muttered syllables; scaled up to ~1.8x, out of phase
    const tk = s.talk.at(t), sylL = Math.max(0, S(t * 8.3) * 0.6 + S(t * 5.1 + 1) * 0.4), sylR = Math.max(0, S(t * 8.3 - 0.9) * 0.6 + S(t * 5.9) * 0.4);
    const bigB = s.big.step(0.5 + 0.5 * br, dt);
    const sL = s.sL.step(0.35 * bigB + tk * sylL * 0.65, dt), sR = s.sR.step(0.35 * bigB + tk * sylR * 0.65, dt);
    rig.scale('sacL', 1 + 0.8 * sL, 1 + 0.65 * sL, 1 + 0.8 * sL); rig.scale('sacR', 1 + 0.8 * sR, 1 + 0.65 * sR, 1 + 0.8 * sR); rig.sac = [sL, sR];
    const L = s.look.at(t), yy = s.hy.step(L[0], dt), pp = s.hp.step(L[1] - tk * sylL * 0.12, dt);
    rig.rot('head', pp, yy, L[2] - rk * 0.06);
    // occasional gesture with one hand while muttering
    const g = s.gest.at(t), gs = g.i % 2 ? 1 : 0, gv = g.v;
    rig.rot('AuL', -(gs ? 0 : gv) * 0.15, 0, s.aL.step(-rk * 0.1, dt) - 0.04 * br - (gs ? 0 : gv) * 0.08);
    rig.rot('AuR', -(gs ? gv : 0) * 0.15, 0, s.aR.step(-rk * 0.1, dt) + 0.04 * br + (gs ? gv : 0) * 0.08);
    rig.rot('AlL', -(gs ? 0 : gv) * 0.5, 0, 0); rig.rot('AlR', -(gs ? gv : 0) * 0.5, 0, 0);
    rig.solveIK();
  },
  sill(rig, t, dt) {
    const s = init(rig, (s, z) => {
      s.look = new Track(z + 1, { hold: [1.8, 3.5], trans: [0.9, 1.4], pick: (r) => [(r() - 0.5) * 1.3, (r() - 0.5) * 0.35, (r() - 0.5) * 0.8] });
      s.hy = sp(20, 6); s.hp = sp(20, 6); s.ht = sp(20, 6); s.aL = sp(10, 3); s.aR = sp(10, 3); s.sw = sp(8, 4);
    });
    rig.reset();
    const br = S(t * 2 * PI * 0.15); rig.rot('chest', -0.02 * br, 0, 0);
    // slow sway from the hips, upper body counters like a reed
    const sw = s.sw.step(S(t * 2 * PI / 5.5 + 0.7) * 0.8 + fbm(t * 0.25, 3) * 0.4, dt);
    rig.move('pelvis', sw * 0.02, 0, 0); rig.rot('pelvis', 0, sw * 0.05, -sw * 0.085); rig.rot('spine', 0, 0, sw * 0.05); rig.rot('chest', 0, 0, sw * 0.06);
    const L = s.look.at(t), yy = s.hy.step(L[0], dt), pp = s.hp.step(L[1], dt), tl = s.ht.step(L[2], dt);
    rig.rot('neck', pp * 0.45, yy * 0.4, tl * 0.4 - sw * 0.05); rig.rot('head', pp * 0.55, yy * 0.6, tl * 0.6);
    rig.rot('AuL', 0.08 * fbm(t * 0.3, 4), 0, s.aL.step(-sw * 0.12 + fbm(t * 0.3, 4) * 0.06, dt)); rig.rot('AuR', 0.08 * fbm(t * 0.3, 7), 0, s.aR.step(-sw * 0.12 + fbm(t * 0.3, 8) * 0.06, dt));
    rig.rot('AlL', -0.12 + fbm(t * 0.25, 2) * 0.12, 0, 0); rig.rot('AlR', -0.12 + fbm(t * 0.25, 6) * 0.12, 0, 0);
    rig.solveIK();
  },
};
