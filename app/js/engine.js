// Kinora Form Coach – analysis engine (no DOM, unit-testable in Node).
//
// computeMetrics() turns one frame of MediaPipe Pose landmarks into joint
// angles and alignment measures. Session consumes those metrics frame by
// frame: it counts repetitions, runs the exercise checks and finally
// builds the end-of-session biomechanics report.

import { EXERCISES } from './exercises.js';
import { FAULTS, REGIONS } from './knowledge.js';

export const P = {
  nose: 0, lEar: 7, rEar: 8, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16,
  lHip: 23, rHip: 24, lKn: 25, rKn: 26, lAn: 27, rAn: 28, lHeel: 29, rHeel: 30, lFoot: 31, rFoot: 32,
};

const DEG = 180 / Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z || 0) + (b.z || 0)) / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const sgn = (v) => (v >= 0 ? 1 : -1);

function angle(a, b, c) {
  const ux = a.x - b.x, uy = a.y - b.y, uz = (a.z || 0) - (b.z || 0);
  const vx = c.x - b.x, vy = c.y - b.y, vz = (c.z || 0) - (b.z || 0);
  const d = Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz) || 1e-9;
  return Math.acos(clamp((ux * vx + uy * vy + uz * vz) / d, -1, 1)) * DEG;
}
const flat = (p) => ({ x: p.x, y: p.y });
const angle2 = (a, b, c) => angle(flat(a), flat(b), flat(c));

// Signed deviation of b from the straight line a→c, in degrees.
// Positive = b lies below the line in the image (hips sagging for a plank).
function lineDeviation(a, b, c) {
  const dev = 180 - angle2(a, b, c);
  const t = (b.x - a.x) / ((c.x - a.x) || 1e-9);
  const lineY = a.y + t * (c.y - a.y);
  return b.y > lineY ? dev : -dev;
}

// Inward drift of the knee from the hip-ankle line, as a fraction of leg
// length. Positive = knee moved towards the midline (valgus). Front view.
function kneeInward(hip, knee, ank, midX) {
  const legLen = dist(hip, ank) || 1e-9;
  const t = (knee.y - hip.y) / ((ank.y - hip.y) || 1e-9);
  const lineX = hip.x + t * (ank.x - hip.x);
  const outward = sgn(hip.x - midX);
  return ((lineX - knee.x) * outward) / legLen;
}

/**
 * @param lm  normalised image landmarks (33 × {x,y,z,visibility}) – x,y in 0..1
 * @param wl  world landmarks in metres (optional, improves 3D angles)
 * @param W,H frame size in pixels (aspect-correct 2D measures)
 */
export function computeMetrics(lm, wl, W = 1, H = 1) {
  if (!lm || lm.length < 33) return null;
  const p = (i) => ({ x: lm[i].x * W, y: lm[i].y * H, v: lm[i].visibility ?? 1 });
  const w = (i) => (wl && wl[i] ? wl[i] : { x: lm[i].x * W, y: lm[i].y * H, z: (lm[i].z || 0) * W });
  const vis = (...ix) => ix.reduce((s, i) => s + (lm[i].visibility ?? 1), 0) / ix.length;

  const visL = vis(P.lSh, P.lHip, P.lKn, P.lAn, P.lEl);
  const visR = vis(P.rSh, P.rHip, P.rKn, P.rAn, P.rEl);
  const S = visL >= visR
    ? { sh: P.lSh, el: P.lEl, wr: P.lWr, hip: P.lHip, kn: P.lKn, an: P.lAn, heel: P.lHeel, foot: P.lFoot, ear: P.lEar }
    : { sh: P.rSh, el: P.rEl, wr: P.rWr, hip: P.rHip, kn: P.rKn, an: P.rAn, heel: P.rHeel, foot: P.rFoot, ear: P.rEar };

  // View: yaw of the shoulder axis (3D) combined with the 2D width ratio.
  const wls = w(P.lSh), wrs = w(P.rSh);
  const yaw = Math.atan2(Math.abs((wrs.z || 0) - (wls.z || 0)), Math.abs(wrs.x - wls.x)) * DEG;
  const sh2W = dist(p(P.lSh), p(P.rSh));
  const torso2 = dist(mid(p(P.lSh), p(P.rSh)), mid(p(P.lHip), p(P.rHip))) || 1e-9;
  const ratio = sh2W / torso2;
  let view = 'angled';
  if (yaw < 35 && ratio > 0.45) view = 'front';
  else if (yaw > 55 || ratio < 0.3) view = 'side';

  const m = { view, yaw, side: visL >= visR ? 'L' : 'R', visibility: Math.max(visL, visR) };

  m.kneeL = angle(w(P.lHip), w(P.lKn), w(P.lAn));
  m.kneeR = angle(w(P.rHip), w(P.rKn), w(P.rAn));
  m.hipL = angle(w(P.lSh), w(P.lHip), w(P.lKn));
  m.hipR = angle(w(P.rSh), w(P.rHip), w(P.rKn));
  m.elbowL = angle(w(P.lSh), w(P.lEl), w(P.lWr));
  m.elbowR = angle(w(P.rSh), w(P.rEl), w(P.rWr));
  m.shoulderL = angle(w(P.lHip), w(P.lSh), w(P.lEl));
  m.shoulderR = angle(w(P.rHip), w(P.rSh), w(P.rEl));
  const L = m.side === 'L';
  m.knee = L ? m.kneeL : m.kneeR;
  m.hip = L ? m.hipL : m.hipR;
  m.elbow = L ? m.elbowL : m.elbowR;
  m.shoulder = L ? m.shoulderL : m.shoulderR;
  m.kneeSym = Math.abs(m.kneeL - m.kneeR);
  m.elbowSym = Math.abs(m.elbowL - m.elbowR);
  m.shoulderSym = Math.abs(m.shoulderL - m.shoulderR);

  const shM = mid(p(P.lSh), p(P.rSh)), hipM = mid(p(P.lHip), p(P.rHip)), ankM = mid(p(P.lAn), p(P.rAn));
  const nose = p(P.nose);
  const tdx = shM.x - hipM.x, tdy = shM.y - hipM.y;
  m.trunkLean = Math.atan2(Math.abs(tdx), -tdy) * DEG; // 0 = upright
  const facing = sgn(nose.x - shM.x);
  m.trunkLeanSigned = m.trunkLean * sgn(tdx) * facing; // + forward, − backward

  const sh = p(S.sh), hip = p(S.hip), kn = p(S.kn), an = p(S.an), ear = p(S.ear);
  const lineA = lineDeviation(sh, hip, an);
  const lineK = lineDeviation(sh, hip, kn);
  m.sag = Math.max(0, lineA); m.pike = Math.max(0, -lineA); m.lineDev = Math.abs(lineA);
  m.sagK = Math.max(0, lineK); m.pikeK = Math.max(0, -lineK);
  const horiz = (a, b) => Math.atan2(Math.abs(b.y - a.y), Math.abs(b.x - a.x)) * DEG;
  m.horizontal = horiz(sh, an) < 40 && dist(sh, an) > torso2 * 1.2;
  m.horizontalKnee = horiz(sh, kn) < 45;
  m.neck = angle2(ear, sh, hip);
  m.headFwd = Math.atan2((ear.x - sh.x) * facing, -(ear.y - sh.y)) * DEG;

  const hipW = dist(p(P.lHip), p(P.rHip)) || 1e-9;
  m.shoulderTilt = Math.abs(Math.atan2(p(P.rSh).y - p(P.lSh).y, p(P.rSh).x - p(P.lSh).x) * DEG);
  if (m.shoulderTilt > 90) m.shoulderTilt = 180 - m.shoulderTilt;
  m.hipTilt = Math.abs(Math.atan2(p(P.rHip).y - p(P.lHip).y, p(P.rHip).x - p(P.lHip).x) * DEG);
  if (m.hipTilt > 90) m.hipTilt = 180 - m.hipTilt;
  m.shift = (hipM.x - ankM.x) / hipW;
  m.shiftPct = m.shift * 100;

  const ankW = dist(p(P.lAn), p(P.rAn));
  m.valgus = Math.abs(p(P.lKn).x - p(P.rKn).x) / (Math.abs(p(P.lAn).x - p(P.rAn).x) || 1e-9);
  m.valgusOk = ankW > hipW * 0.6;
  m.kneeInL = kneeInward(p(P.lHip), p(P.lKn), p(P.lAn), hipM.x);
  m.kneeInR = kneeInward(p(P.rHip), p(P.rKn), p(P.rAn), hipM.x);
  m.kneeIn = Math.max(m.kneeInL, m.kneeInR);
  m.frontKneeIn = m.kneeL < m.kneeR ? m.kneeInL : m.kneeInR;

  const legLen = dist(hip, an) || 1e-9;
  m.heelRise = (p(S.foot).y - p(S.heel).y) / legLen;

  // Is the body usable? Key joints visible and inside the frame.
  const key = [S.sh, S.hip, S.kn, S.an];
  m.inFrame = key.every((i) => (lm[i].visibility ?? 1) > 0.5 && lm[i].x > -0.02 && lm[i].x < 1.02 && lm[i].y > -0.02 && lm[i].y < 1.02);
  return m;
}

// Exponential smoothing of numeric metrics to remove jitter.
export function smoothMetrics(prev, next, alpha = 0.45) {
  if (!prev || !next) return next;
  const out = { ...next };
  for (const k in next) {
    if (typeof next[k] === 'number' && typeof prev[k] === 'number' && k !== 'yaw') out[k] = prev[k] + alpha * (next[k] - prev[k]);
  }
  return out;
}

const NUMERIC = (m) => Object.keys(m).filter((k) => typeof m[k] === 'number');
const applies = (check, view) => !check.views || check.views.includes(view);
const median = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); const h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);

export class Session {
  constructor(exId, { mode = 'live', persistFrames = 5 } = {}) {
    this.ex = EXERCISES[exId];
    if (!this.ex) throw new Error('Unknown exercise ' + exId);
    this.exId = exId; this.mode = mode; this.persistFrames = persistFrames;
    this.t0 = null; this.tLast = null; this.activeTime = 0;
    this.reps = []; this.phase = 'up'; this.rep = null; this.upMax = -Infinity;
    this.viewCount = { front: 0, side: 0, angled: 0 };
    this.frameFault = {}; this.active = new Set(); this.liveCount = {};
    this.hold = { inPos: 0, good: 0, faultTime: {}, samples: {} };
    this.samples = {}; this.frames = 0;
  }

  get view() {
    const v = this.viewCount;
    return Object.keys(v).reduce((a, b) => (v[a] >= v[b] ? a : b));
  }

  // x is the driver mapped so that "work" always means x going DOWN.
  _x(m) { const d = this.ex.driver(m); return this.ex.dir === 'up' ? -d : d; }

  /** Feed one frame. Returns events: rep | cue | good. */
  update(m, t) {
    const events = [];
    if (this.t0 === null) this.t0 = t;
    const dt = this.tLast === null ? 0 : Math.min(0.25, Math.max(0, t - this.tLast));
    this.tLast = t;
    if (!m || !m.inFrame) { this.active.clear(); return { events, active: this.active, phase: this.phase }; }
    this.frames++; this.viewCount[m.view]++;
    const ex = this.ex;

    // Live checks with persistence (removes one-frame glitches)
    const gated = ex.gate ? ex.gate(m) : true;
    const newActive = new Set();
    for (const c of ex.live || []) {
      const hit = gated && applies(c, m.view) && c.t(m, this.phase, this);
      this.frameFault[c.f] = hit ? (this.frameFault[c.f] || 0) + 1 : 0;
      if (this.frameFault[c.f] >= this.persistFrames) {
        newActive.add(c.f);
        if (!this.active.has(c.f)) { this.liveCount[c.f] = (this.liveCount[c.f] || 0) + 1; events.push({ type: 'cue', fault: c.f }); }
      }
    }
    this.active = newActive;

    if (ex.type === 'hold') {
      if (gated) {
        this.hold.inPos += dt;
        if (!newActive.size) this.hold.good += dt;
        for (const f of newActive) this.hold.faultTime[f] = (this.hold.faultTime[f] || 0) + dt;
        for (const mt of ex.metrics) (this.hold.samples[mt.key] ||= []).push(m[mt.key]);
      }
      return { events, active: this.active, phase: gated ? 'hold' : 'out' };
    }

    if (ex.type === 'posture') {
      for (const k of NUMERIC(m)) (this.samples[k] ||= []).push(m[k]);
      return { events, active: this.active, phase: 'hold' };
    }

    // Repetition state machine
    if (!gated) return { events, active: this.active, phase: this.phase };
    const x = this._x(m);
    const start = ex.dir === 'up' ? -ex.start : ex.start;
    const end = ex.dir === 'up' ? -ex.end : ex.end;
    if (this.phase === 'up') {
      this.upMax = Math.max(this.upMax, ex.dir === 'up' ? -x : x);
      if (x < start) {
        this.phase = 'down';
        this.rep = { tStart: t, start: { ...m }, min: { ...m }, max: { ...m }, bottom: { ...m }, xExt: x, tExt: t, views: { front: 0, side: 0, angled: 0 }, prevTop: this.upMax };
        events.push({ type: 'rep-start' });
      }
    }
    if (this.phase === 'down' && this.rep) {
      const r = this.rep;
      r.views[m.view]++;
      for (const k of NUMERIC(m)) { if (m[k] < r.min[k]) r.min[k] = m[k]; if (m[k] > r.max[k]) r.max[k] = m[k]; }
      if (x < r.xExt) { r.xExt = x; r.tExt = t; r.bottom = { ...m }; events.push({ type: 'new-extreme' }); }
      if (x > end) {
        this.phase = 'up'; this.upMax = ex.dir === 'up' ? -x : x;
        const travel = start - r.xExt;
        const dur = t - r.tStart;
        if (travel >= ex.minTravel && dur > 0.35 && dur < 20) events.push({ type: 'rep', rep: this._finishRep(r, t) });
        this.rep = null;
      }
    }
    return { events, active: this.active, phase: this.phase };
  }

  addTime(dt) { this.activeTime += dt; }

  _finishRep(r, t) {
    const ex = this.ex;
    r.tEnd = t;
    r.ext = ex.dir === 'up' ? -r.xExt : r.xExt;
    const toExt = r.tExt - r.tStart, fromExt = t - r.tExt;
    r.ecc = ex.dir === 'up' ? fromExt : toExt;
    r.con = ex.dir === 'up' ? toExt : fromExt;
    r.view = Object.keys(r.views).reduce((a, b) => (r.views[a] >= r.views[b] ? a : b));
    r.faults = ex.repChecks.filter((c) => applies(c, r.view) && safe(() => c.t(r))).map((c) => c.f);
    r.score = Math.max(0, 100 - r.faults.reduce((s, f) => s + FAULTS[f].weight, 0));
    r.n = this.reps.length + 1;
    this.reps.push(r);
    return r;
  }

  /** Build the end-of-session report. */
  report() {
    const ex = this.ex, view = this.view;
    const base = {
      exId: this.exId, exercise: ex.name, type: ex.type, mode: this.mode, view,
      date: new Date().toISOString(), duration: this.activeTime, frames: this.frames, anatomy: ex.anatomy,
    };
    let faults = [], metrics = [], score = 0, extra = {};

    if (ex.type === 'reps') {
      const n = this.reps.length;
      const counts = {};
      for (const r of this.reps) for (const f of r.faults) counts[f] = (counts[f] || 0) + 1;
      faults = Object.entries(counts).map(([id, count]) => ({ id, count, of: n, pct: count / n }));
      score = n ? Math.round(mean(this.reps.map((r) => r.score))) : 0;
      metrics = ex.metrics.filter((mt) => !mt.views || mt.views.includes(view)).map((mt) => {
        const vals = this.reps.map((r) => safe(() => mt.get(r))).filter(Number.isFinite);
        return metricRow(mt, vals);
      }).filter((r) => r.n);
      const good = this.reps.filter((r) => !r.faults.length).length;
      extra = {
        reps: this.reps.map((r) => ({ n: r.n, score: r.score, faults: r.faults, ext: r.ext, ecc: r.ecc, con: r.con })),
        repCount: n, goodReps: good,
        tempo: n ? { ecc: mean(this.reps.map((r) => r.ecc)), con: mean(this.reps.map((r) => r.con)), dur: mean(this.reps.map((r) => r.tEnd - r.tStart)) } : null,
        consistency: n > 2 ? stdev(this.reps.map((r) => r.ext)) : null,
      };
    } else if (ex.type === 'hold') {
      const h = this.hold;
      faults = Object.entries(h.faultTime).map(([id, sec]) => ({ id, seconds: sec, pct: sec / (h.inPos || 1), count: this.liveCount[id] || 1 }));
      score = h.inPos > 1 ? Math.round((h.good / h.inPos) * 100) : 0;
      metrics = ex.metrics.map((mt) => metricRow(mt, (h.samples[mt.key] || []).filter(Number.isFinite), true)).filter((r) => r.n);
      extra = { holdTime: h.inPos, goodTime: h.good };
    } else {
      const med = {};
      for (const k in this.samples) med[k] = median(this.samples[k]);
      faults = (ex.checks || []).filter((c) => applies(c, view) && Object.keys(med).length && safe(() => c.t(med))).map((c) => ({ id: c.f, count: 1, of: 1, pct: 1 }));
      score = Object.keys(med).length ? Math.max(0, 100 - faults.reduce((s, f) => s + FAULTS[f.id].weight, 0)) : 0;
      metrics = ex.metrics.filter((mt) => !mt.views || mt.views.includes(view)).map((mt) => metricRow(mt, Number.isFinite(med[mt.key]) ? [med[mt.key]] : [], true)).filter((r) => r.n);
    }

    faults.sort((a, b) => FAULTS[b.id].weight * b.pct - FAULTS[a.id].weight * a.pct);
    const regions = {};
    for (const k in REGIONS) regions[k] = 0;
    for (const f of faults) regions[FAULTS[f.id].region] = Math.max(regions[FAULTS[f.id].region], f.pct);
    return { ...base, score, faults, metrics, regions, ...extra };
  }
}

function safe(fn) { try { return fn(); } catch { return undefined; } }
function stdev(a) { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); }

function metricRow(mt, vals, avgOnly = false) {
  const n = vals.length;
  if (!n) return { label: mt.label, n: 0 };
  const avg = mean(vals), lo = Math.min(...vals), hi = Math.max(...vals);
  const [t0, t1] = mt.target;
  const inRange = (v) => v >= t0 && v <= t1;
  const span = Math.max(5, (t1 - t0) * 0.15);
  const status = inRange(avg) ? 'good' : (avg >= t0 - span && avg <= t1 + span ? 'warn' : 'bad');
  return { label: mt.label, n, avg, min: lo, max: hi, target: mt.target, unit: mt.unit ?? '°', plane: mt.plane, status, fmt: mt.fmt ?? 0, avgOnly };
}

/**
 * Analyse a single photo. For rep exercises the photo should show the
 * hardest point of the movement (bottom of the squat, top of the press...).
 */
export function analyzeStill(exId, m) {
  const ex = EXERCISES[exId];
  const s = new Session(exId, { mode: 'photo' });
  if (!m) return { ...s.report(), noPose: true };
  s.viewCount[m.view] = 1; s.frames = 1;
  const view = m.view;
  let faults = [];
  if (ex.type === 'reps') {
    const r = { ext: ex.driver(m), start: m, min: m, max: m, bottom: m, ecc: Infinity, con: Infinity, prevTop: 180, view };
    faults = ex.repChecks.filter((c) => !['fast_tempo', 'pushup_lockout', 'heel_lift'].includes(c.f) && applies(c, view) && safe(() => c.t(r))).map((c) => c.f);
    const metrics = ex.metrics.filter((mt) => !mt.views || mt.views.includes(view)).map((mt) => metricRow(mt, [safe(() => mt.get(r))].filter(Number.isFinite), true)).filter((x) => x.n);
    const base = s.report();
    const fl = faults.map((id) => ({ id, count: 1, of: 1, pct: 1 }));
    const regions = { ...base.regions };
    for (const f of fl) regions[FAULTS[f.id].region] = 1;
    return { ...base, repCount: undefined, reps: undefined, tempo: null, score: Math.max(0, 100 - faults.reduce((a, f) => a + FAULTS[f].weight, 0)), faults: fl, metrics, regions, still: true };
  }
  if (ex.type === 'hold') {
    const fl = ex.live.filter((c) => applies(c, view) && safe(() => c.t(m, 'down', s))).map((c) => ({ id: c.f, count: 1, of: 1, pct: 1 }));
    const metrics = ex.metrics.map((mt) => metricRow(mt, [m[mt.key]].filter(Number.isFinite), true)).filter((x) => x.n);
    const regions = { ...s.report().regions };
    for (const f of fl) regions[FAULTS[f.id].region] = 1;
    return { ...s.report(), holdTime: undefined, score: Math.max(0, 100 - fl.reduce((a, f) => a + FAULTS[f.id].weight, 0)), faults: fl, metrics, regions, still: true };
  }
  for (const k of NUMERIC(m)) s.samples[k] = [m[k]];
  return { ...s.report(), still: true };
}

/** Fault titles that cannot be measured from the given camera view. */
export function uncheckedInView(exId, view) {
  const ex = EXERCISES[exId];
  const list = [...(ex.repChecks || []), ...(ex.checks || []), ...(ex.live || [])];
  const out = new Set();
  for (const c of list) if (c.views && !c.views.includes(view)) out.add(c.f);
  return [...out].map((f) => FAULTS[f].title);
}
