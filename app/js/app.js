// Kinora Form Coach – user interface, camera and pose tracking.
import { computeMetrics, smoothMetrics, Session, analyzeStill, uncheckedInView, P } from './engine.js';
import { EXERCISES, EXERCISE_ORDER } from './exercises.js';
import { FAULTS, REGIONS, GRADE, DAILY_TIPS } from './knowledge.js';

const DAILY_LIMIT_SEC = 60 * 60;
const COACH_WA = '5511985636163';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- Storage (safe) ---------------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

let usageCache = store.get('kfc.usage.v1', {});
function usedToday() { return usageCache[dayKey()] || 0; }
function remainingSec() { return Math.max(0, DAILY_LIMIT_SEC - usedToday()); }
let usageDirty = 0;
function addUsage(sec) {
  const k = dayKey();
  usageCache[k] = Math.min(DAILY_LIMIT_SEC, (usageCache[k] || 0) + sec);
  usageDirty += sec;
  if (usageDirty > 3) flushUsage();
}
function flushUsage() {
  const cutoff = dayKey(new Date(Date.now() - 40 * 864e5));
  for (const k of Object.keys(usageCache)) if (k < cutoff) delete usageCache[k];
  store.set('kfc.usage.v1', usageCache); usageDirty = 0;
}
const history = () => store.get('kfc.history.v1', []);
function saveHistory(rep) {
  const h = history();
  const { anatomy, ...slim } = rep;
  h.unshift({ id: Date.now(), day: dayKey(), ...slim });
  while (h.length > 60) h.pop();
  if (!store.set('kfc.history.v1', h)) { h.length = 20; store.set('kfc.history.v1', h); }
}
const prefs = Object.assign({ ex: 'squat', mode: 'live', voice: true, record: false, precision: 'full', facing: 'user' }, store.get('kfc.prefs.v1', {}));
const savePrefs = () => store.set('kfc.prefs.v1', prefs);

/* ---------------- Small UI helpers ---------------- */
function toast(msg, ms = 3200) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms);
}
const fmtTime = (s) => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
function show(screen) {
  for (const s of ['home', 'session', 'report']) $('#' + s).hidden = s !== screen;
  window.scrollTo(0, 0);
}
function updateQuota() {
  const rem = remainingSec(), min = Math.ceil(rem / 60);
  $('#quotaMin').textContent = min;
  $('#quotaRing').style.strokeDashoffset = String(94.25 * (1 - rem / DAILY_LIMIT_SEC));
  const chip = $('#quotaChip');
  chip.classList.toggle('low', rem > 0 && rem < 600); chip.classList.toggle('out', rem <= 0);
  $('#hudLeft').textContent = `${min} min left today`;
}

let voiceLast = {};
function say(text, key = text, gap = 4500) {
  if (!prefs.voice || !('speechSynthesis' in window)) return;
  const now = Date.now();
  if (voiceLast[key] && now - voiceLast[key] < gap) return;
  voiceLast[key] = now;
  try { const u = new SpeechSynthesisUtterance(text); u.lang = 'en-GB'; u.rate = 1.05; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch {}
}

/* ---------------- Icons for exercises ---------------- */
const ICONS = {
  squat: '<circle cx="27" cy="9" r="4.5"/><path d="M26 14l-5 13 11 2 -2 12M23 18l13 2M21 27"/>',
  lunge: '<circle cx="24" cy="7" r="4.5"/><path d="M24 12v15M24 27l9 3 0 11M24 27l-9 6 -4 8M24 17l-6 6M24 17l6 6"/>',
  hinge: '<circle cx="36" cy="12" r="4.5"/><path d="M31 15L16 22M16 22l2 10 -1 10M16 22l4 9 1 11M27 17l1 13"/>',
  bridge: '<circle cx="7" cy="36" r="4"/><path d="M11 36l12-8 9 1M32 29l5 10M3 42h42M23 28l-2 9"/>',
  pushup: '<circle cx="8" cy="22" r="4"/><path d="M12 25l30 7M14 26v12M22 28v10M3 40h42"/>',
  plank: '<circle cx="8" cy="24" r="4"/><path d="M12 27l30 6M13 28l1 10 6 0M3 40h42"/>',
  press: '<circle cx="24" cy="13" r="4.5"/><path d="M24 18v13M24 31l-5 11M24 31l5 11M20 20l-4-8 1-8M28 20l4-8-1-8M12 4h8M28 4h8"/>',
  posture: '<circle cx="24" cy="7" r="4.5"/><path d="M24 12v17M24 29l-4 13M24 29l4 13M24 15l-7 10M24 15l7 10M10 3v42M38 3v42" /><path d="M14 20h20" stroke-dasharray="2 3"/>',
};
const icon = (k) => `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ICONS.squat}</svg>`;

/* ---------------- Home ---------------- */
function renderHome() {
  const grid = $('#exGrid');
  grid.innerHTML = EXERCISE_ORDER.map((id) => `<button class="ex" role="radio" data-ex="${id}" aria-checked="${prefs.ex === id}">${icon(EXERCISES[id].icon)}<b>${esc(EXERCISES[id].name)}</b></button>`).join('');
  grid.onclick = (e) => { const b = e.target.closest('.ex'); if (b) selectEx(b.dataset.ex); };
  selectEx(prefs.ex);
  document.querySelectorAll('.mode').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.mode === prefs.mode));
    b.onclick = () => { prefs.mode = b.dataset.mode; savePrefs(); document.querySelectorAll('.mode').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); updateStart(); };
  });
  $('#optVoice').checked = prefs.voice; $('#optRecord').checked = prefs.record;
  $('#optPrecision').value = prefs.precision; $('#optFacing').value = prefs.facing;
  $('#optVoice').onchange = (e) => { prefs.voice = e.target.checked; savePrefs(); };
  $('#optRecord').onchange = (e) => { prefs.record = e.target.checked; savePrefs(); };
  $('#optPrecision').onchange = (e) => { prefs.precision = e.target.value; savePrefs(); landmarker = null; };
  $('#optFacing').onchange = (e) => { prefs.facing = e.target.value; savePrefs(); };
  renderDashboard();
  updateStart();
}

function selectEx(id) {
  prefs.ex = id; savePrefs();
  document.querySelectorAll('.ex').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.ex === id)));
  const ex = EXERCISES[id];
  $('#setupTip').innerHTML = `<b>${esc(ex.name)}:</b> ${esc(ex.blurb)} ${esc(ex.setup)}`;
}

function updateStart() {
  updateQuota();
  const rem = remainingSec();
  const btn = $('#startBtn');
  const needsTime = prefs.mode !== 'photo';
  btn.disabled = needsTime && rem <= 0;
  btn.innerHTML = (prefs.mode === 'photo' ? 'Analyse a photo' : prefs.mode === 'video' ? 'Choose a video to analyse' : 'Start live analysis') + ' <svg><use href="#i-arrow"/></svg>';
  $('#limitNote').textContent = rem <= 0
    ? 'You have used your 60 minutes of analysis for today. Come back after midnight, or use photo analysis.'
    : `Up to 60 minutes of video analysis per day (${Math.ceil(rem / 60)} min left today). Your allowance resets every night at midnight. Photos are unlimited.`;
}

function streak(h) {
  const days = new Set(h.map((x) => x.day));
  let n = 0; const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function renderDashboard() {
  const h = history();
  $('#statToday').textContent = Math.round(usedToday() / 60);
  $('#statStreak').textContent = streak(h);
  const best = h.filter((x) => x.score > 0).reduce((a, x) => Math.max(a, x.score), 0);
  $('#statBest').textContent = best || '–';

  // Daily plan: changes every day, based on the last 7 days of results.
  const today = new Date();
  const dayIdx = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 864e5);
  const exOfDay = EXERCISE_ORDER[dayIdx % EXERCISE_ORDER.length];
  const tip = DAILY_TIPS[dayIdx % DAILY_TIPS.length];
  const weekAgo = dayKey(new Date(Date.now() - 7 * 864e5));
  const recent = h.filter((x) => x.day >= weekAgo);
  const tally = {};
  for (const s of recent) for (const f of s.faults || []) tally[f.id] = (tally[f.id] || 0) + FAULTS[f.id].weight * (f.pct || 1);
  const focus = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
  const dateStr = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const sessionsSeen = focus ? recent.filter((s) => (s.faults || []).some((f) => f.id === focus)).length : 0;
  $('#todayCard').innerHTML = `
    <p class="eyebrow">Today · ${esc(dateStr)}</p>
    ${focus
      ? `<h3>Today's focus: ${esc(FAULTS[focus].title)}</h3><p>Found in ${sessionsSeen} of your sessions this week. Warm-up drill before you film: ${esc(FAULTS[focus].drill)}</p>`
      : `<h3>${h.length ? 'Great week: no recurring fault!' : 'Welcome to your Form Coach'}</h3><p>${esc(tip)}</p>`}
    <div class="chips">
      <button class="chip" data-pick="${exOfDay}">Exercise of the day: ${esc(EXERCISES[exOfDay].name)}</button>
      ${focus ? `<span class="chip">Tip: ${esc(tip)}</span>` : ''}
    </div>`;
  $('#todayCard').querySelector('[data-pick]').onclick = (e) => { selectEx(e.currentTarget.dataset.pick); $('#exGrid').scrollIntoView({ behavior: 'smooth', block: 'center' }); };

  // 14-day chart: minutes analysed per day + average score
  const days = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5); days.push({ k: dayKey(d), label: d.toLocaleDateString('en-GB', { weekday: 'narrow' }), min: (usageCache[dayKey(d)] || 0) / 60 }); }
  for (const d of days) { const s = h.filter((x) => x.day === d.k && x.score > 0); d.score = s.length ? Math.round(s.reduce((a, x) => a + x.score, 0) / s.length) : null; d.n = h.filter((x) => x.day === d.k).length; }
  if (!h.length) {
    $('#chart').innerHTML = '<p class="empty">Your daily minutes and scores will appear here after your first session.</p>';
  } else {
    const W = 700, H = 190, bw = W / 14;
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Minutes analysed and average score, last 14 days">`;
    days.forEach((d, i) => {
      const x = i * bw + bw * 0.2, w = bw * 0.6;
      const bh = Math.max(d.min > 0 ? 4 : 0, (d.min / 60) * 120);
      svg += `<rect x="${x}" y="${150 - 120}" width="${w}" height="120" rx="6" fill="rgba(255,255,255,.04)"/>`;
      if (bh) svg += `<rect x="${x}" y="${150 - bh}" width="${w}" height="${bh}" rx="6" fill="#8B4FD8"/>`;
      if (d.score !== null) svg += `<text x="${x + w / 2}" y="${150 - bh - 8}" text-anchor="middle" font-size="15" font-weight="700" fill="${d.score >= 75 ? '#3DDC97' : d.score >= 60 ? '#FFB547' : '#FF5C7A'}">${d.score}</text>`;
      svg += `<text x="${x + w / 2}" y="172" text-anchor="middle" font-size="13" fill="#A9A5B8">${d.label}</text>`;
    });
    svg += `<text x="0" y="188" font-size="11" fill="#6B6878">Bars: minutes analysed per day (max 60) · Numbers: average form score</text></svg>`;
    $('#chart').innerHTML = svg;
  }
  const rec = $('#recent');
  rec.innerHTML = h.slice(0, 6).map((s, i) => {
    const g = GRADE(s.score);
    const d = new Date(s.date);
    return `<button data-i="${i}"><span class="sc" style="color:var(--${g.tone})">${s.score || '–'}</span><span class="meta"><b>${esc(s.exercise)}</b><small>${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · ${s.mode === 'photo' ? 'Photo' : (s.repCount ?? '') + (s.type === 'reps' ? ' reps · ' : '') + fmtTime(s.duration || 0)}</small></span><svg width="18" height="18"><use href="#i-arrow"/></svg></button>`;
  }).join('');
  rec.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; const s = history()[+b.dataset.i]; if (s) renderReport({ ...s, anatomy: EXERCISES[s.exId].anatomy }, { fromHistory: true }); };
}

/* ---------------- Pose model ---------------- */
let landmarker = null, landmarkerMode = 'VIDEO', visionMod = null;
async function getLandmarker(msgEl) {
  if (landmarker) return landmarker;
  msgEl && (msgEl.textContent = `Loading the AI model (${prefs.precision === 'lite' ? '6' : '9'} MB, first time only)…`);
  visionMod ||= await import('../vendor/mediapipe/vision_bundle.mjs');
  const { FilesetResolver, PoseLandmarker } = visionMod;
  const fileset = await FilesetResolver.forVisionTasks(new URL('../vendor/mediapipe/wasm', import.meta.url).href);
  const opts = (delegate) => ({
    baseOptions: { modelAssetPath: new URL(`../models/pose_landmarker_${prefs.precision}.task`, import.meta.url).href, delegate },
    runningMode: 'VIDEO', numPoses: 2,
    minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
  });
  try { landmarker = await PoseLandmarker.createFromOptions(fileset, opts('GPU')); }
  catch { landmarker = await PoseLandmarker.createFromOptions(fileset, opts('CPU')); }
  landmarkerMode = 'VIDEO';
  return landmarker;
}
async function setRunningMode(mode) {
  if (landmarkerMode !== mode) { await landmarker.setOptions({ runningMode: mode }); landmarkerMode = mode; }
}

/* ---------------- Drawing ---------------- */
const BONES = [
  [P.lSh, P.rSh, ['shoulder', 'upperback']], [P.lSh, P.lEl, ['shoulder', 'elbow']], [P.lEl, P.lWr, ['elbow']], [P.rSh, P.rEl, ['shoulder', 'elbow']], [P.rEl, P.rWr, ['elbow']],
  [P.lSh, P.lHip, ['lowback', 'upperback']], [P.rSh, P.rHip, ['lowback', 'upperback']], [P.lHip, P.rHip, ['hip', 'lowback']],
  [P.lHip, P.lKn, ['hip', 'knee']], [P.rHip, P.rKn, ['hip', 'knee']], [P.lKn, P.lAn, ['knee', 'ankle']], [P.rKn, P.rAn, ['knee', 'ankle']],
  [P.lAn, P.lHeel, ['ankle']], [P.rAn, P.rHeel, ['ankle']], [P.lHeel, P.lFoot, ['ankle']], [P.rHeel, P.rFoot, ['ankle']], [P.lAn, P.lFoot, ['ankle']], [P.rAn, P.rFoot, ['ankle']],
  [P.lEar, P.lSh, ['neck']], [P.rEar, P.rSh, ['neck']],
];
const JOINTS = [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
const MAIN_JOINT = {
  squat: (m) => (m.side === 'L' ? [P.lKn, m.kneeL] : [P.rKn, m.kneeR]),
  lunge: (m) => (m.kneeL < m.kneeR ? [P.lKn, m.kneeL] : [P.rKn, m.kneeR]),
  hinge: (m) => (m.side === 'L' ? [P.lHip, m.hipL] : [P.rHip, m.hipR]),
  bridge: (m) => (m.side === 'L' ? [P.lHip, m.hipL] : [P.rHip, m.hipR]),
  pushup: (m) => (m.side === 'L' ? [P.lEl, m.elbowL] : [P.rEl, m.elbowR]),
  kneepushup: (m) => (m.side === 'L' ? [P.lEl, m.elbowL] : [P.rEl, m.elbowR]),
  press: (m) => (m.side === 'L' ? [P.lSh, m.shoulderL] : [P.rSh, m.shoulderR]),
};

function drawPose(ctx, lm, W, H, mirror, activeFaults, m, exId) {
  if (!lm) return;
  const bad = new Set([...activeFaults].map((f) => FAULTS[f].region));
  const X = (i) => (mirror ? W - lm[i].x * W : lm[i].x * W), Y = (i) => lm[i].y * H;
  const s = Math.max(2, Math.min(W, H) / 160);
  ctx.lineCap = 'round';
  for (const [a, b, regs] of BONES) {
    if ((lm[a].visibility ?? 1) < 0.35 || (lm[b].visibility ?? 1) < 0.35) continue;
    const isBad = regs.some((r) => bad.has(r));
    ctx.strokeStyle = isBad ? '#FF5C7A' : 'rgba(180,138,240,.95)';
    ctx.lineWidth = isBad ? s * 2.2 : s * 1.5;
    ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.stroke();
  }
  for (const i of JOINTS) {
    if ((lm[i].visibility ?? 1) < 0.35) continue;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X(i), Y(i), s * 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8B4FD8'; ctx.beginPath(); ctx.arc(X(i), Y(i), s * 0.8, 0, Math.PI * 2); ctx.fill();
  }
  const mj = m && MAIN_JOINT[exId];
  if (mj) {
    const [j, a] = mj(m);
    const fs = Math.round(s * 7);
    ctx.font = `800 ${fs}px Inter, sans-serif`;
    const txt = `${Math.round(a)}°`, tx = X(j) + s * 5, ty = Y(j) - s * 2;
    ctx.lineWidth = s * 2; ctx.strokeStyle = 'rgba(11,10,16,.85)'; ctx.strokeText(txt, tx, ty);
    ctx.fillStyle = '#fff'; ctx.fillText(txt, tx, ty);
  }
}

/* ---------------- Live / video session ---------------- */
const S = {}; // current session state
const video = $('#video'), canvas = $('#canvas'), ctx = canvas.getContext('2d');
const snapCanvas = document.createElement('canvas');

function hudAngles(m, exId) {
  if (!m) return '';
  const r = (v) => `${Math.round(v)}°`;
  const map = {
    squat: [['Knee', m.view === 'front' ? (m.kneeL + m.kneeR) / 2 : m.knee], ['Hip', m.hip], ['Trunk', m.trunkLean]],
    lunge: [['Front knee', Math.min(m.kneeL, m.kneeR)], ['Trunk', m.trunkLean]],
    hinge: [['Hip', m.hip], ['Knee', m.knee]],
    bridge: [['Hip', m.hip], ['Knee', m.knee]],
    pushup: [['Elbow', m.elbow], ['Body line', 180 - m.lineDev]],
    kneepushup: [['Elbow', m.elbow]],
    plank: [['Body line', 180 - m.lineDev], ['Neck', m.neck]],
    press: [['Shoulder', m.shoulder], ['Elbow', Math.min(m.elbowL, m.elbowR)]],
    posture: m.view === 'front' ? [['Shoulder tilt', m.shoulderTilt], ['Pelvis tilt', m.hipTilt]] : [['Head forward', m.headFwd], ['Trunk', m.trunkLeanSigned]],
  }[exId] || [];
  return map.map(([k, v]) => `<span>${k} <b>${r(v)}</b></span>`).join('') + `<span>View: <b>${m.view}</b></span>`;
}

function setMsg(text, cls = '') { const el = $('#centerMsg'); el.textContent = text; el.className = 'center-msg ' + cls; }
function showCue(text, good = false) {
  const el = $('#cue'); el.textContent = text; el.className = 'cue' + (good ? ' good' : ''); el.hidden = false;
  clearTimeout(showCue._t); showCue._t = setTimeout(() => (el.hidden = true), good ? 1400 : 2600);
}

async function startSession(mode, file) {
  const exId = prefs.ex, ex = EXERCISES[exId];
  if (remainingSec() <= 0) { toast('Daily limit reached: 60 minutes used today.'); return; }
  Object.assign(S, {
    exId, mode, running: true, paused: false, stage: mode === 'live' ? 'setup' : 'rec', inFrameSince: null,
    session: new Session(exId, { mode }), prevLm: null, prevWl: null, prevM: null, lastVT: -1, lastWall: null, lastMedia: null,
    shots: {}, shotOrder: [], recorder: null, chunks: [], stream: null, objectUrl: null, wake: null, active: new Set(),
  });
  $('#hudCount').textContent = '0';
  $('#hudCountLabel').textContent = ex.type === 'reps' ? 'reps' : ex.type === 'hold' ? 'good form' : 'posture';
  $('#hudTime').textContent = '0:00';
  $('#sessionEx').textContent = `${ex.name} · ${ex.setup}`;
  $('#pauseBtn').querySelector('span').textContent = 'Pause';
  $('#pauseBtn').querySelector('use').setAttribute('href', '#i-pause');
  $('#flipBtn').hidden = mode !== 'live';
  $('#voiceBtn').classList.toggle('off', !prefs.voice);
  $('#cue').hidden = true; setMsg('');
  show('session');
  const loading = $('#loading'); loading.hidden = false;
  try {
    await getLandmarker($('#loadingText'));
    await setRunningMode('VIDEO');
    $('#loadingText').textContent = mode === 'live' ? 'Starting the camera…' : 'Opening your video…';
    if (mode === 'live') await openCamera();
    else await openVideo(file);
  } catch (err) {
    console.error(err);
    loading.hidden = true; S.running = false;
    toast(mode === 'live' ? 'Could not open the camera. Please allow camera access and try again.' : 'Could not open this video. Try an MP4 or MOV file.', 5000);
    stopMedia(); show('home'); return;
  }
  loading.hidden = true;
  try { S.wake = await navigator.wakeLock?.request('screen'); } catch {}
  if (mode === 'live') setMsg('Step back: show your whole body');
  else startRecorder();
  requestAnimationFrame(loop);
}

async function openCamera() {
  stopTracks();
  S.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: prefs.facing, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } });
  video.srcObject = S.stream; video.muted = true;
  await video.play();
  sizeCanvas();
}
async function openVideo(file) {
  video.srcObject = null;
  S.objectUrl = URL.createObjectURL(file);
  video.src = S.objectUrl; video.muted = true; video.loop = false;
  await new Promise((res, rej) => { video.onloadedmetadata = res; video.onerror = rej; });
  if (video.duration > remainingSec()) toast(`Only the first ${Math.floor(remainingSec() / 60)} minutes will be analysed (daily limit).`, 5000);
  video.onended = () => S.running && finishSession('ended');
  sizeCanvas();
  await video.play();
}
function sizeCanvas() {
  const W = video.videoWidth || 720, H = video.videoHeight || 1280;
  const scale = Math.min(1, 1280 / Math.max(W, H));
  canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
  $('#stage').style.aspectRatio = `${canvas.width} / ${canvas.height}`;
  snapCanvas.width = 360; snapCanvas.height = Math.round((360 * canvas.height) / canvas.width);
}
function stopTracks() { if (S.stream) { S.stream.getTracks().forEach((t) => t.stop()); S.stream = null; } }
function stopMedia() {
  stopTracks();
  video.pause(); video.removeAttribute('src'); video.srcObject = null; video.load();
  if (S.objectUrl) { URL.revokeObjectURL(S.objectUrl); S.objectUrl = null; }
  try { S.wake?.release(); } catch {}
}

function startRecorder() {
  if (!prefs.record || !window.MediaRecorder || !canvas.captureStream) return;
  const type = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
  try {
    S.recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: type, videoBitsPerSecond: 1_500_000 });
    S.recorder.ondataavailable = (e) => e.data.size && S.chunks.push(e.data);
    S.recorder.start(1000);
  } catch { S.recorder = null; }
}

function beginCountdown() {
  S.stage = 'countdown';
  let n = 3;
  const tick = () => {
    if (!S.running) return;
    if (n > 0) { setMsg(String(n), 'count'); say(String(n), 'cd' + n, 0); n--; setTimeout(tick, 1000); }
    else { setMsg('Go!', 'count'); say('Go', 'go', 0); setTimeout(() => setMsg(''), 700); S.stage = 'rec'; S.lastWall = performance.now(); startRecorder(); }
  };
  tick();
}

// With several people in view, analyse the biggest (closest) one.
function pickMain(res) {
  const all = res?.landmarks || [];
  if (all.length < 2) return 0;
  let best = 0, bestA = -1;
  all.forEach((lm, i) => {
    const xs = lm.map((p) => p.x), ys = lm.map((p) => p.y);
    const a = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    if (a > bestA) { bestA = a; best = i; }
  });
  return best;
}

function smoothLm(prev, cur, a = 0.6) {
  if (!prev || !cur) return cur;
  return cur.map((p, i) => ({ x: prev[i].x + a * (p.x - prev[i].x), y: prev[i].y + a * (p.y - prev[i].y), z: (prev[i].z ?? 0) + a * ((p.z ?? 0) - (prev[i].z ?? 0)), visibility: p.visibility }));
}

function loop() {
  if (!S.running) return;
  if (video.readyState >= 2 && video.currentTime !== S.lastVT && !(S.paused && S.mode === 'video')) {
    S.lastVT = video.currentTime;
    const now = performance.now();
    let res = null;
    try { res = landmarker.detectForVideo(video, now); } catch (e) { console.warn(e); }
    processFrame(res, S.mode === 'live' ? now / 1000 : video.currentTime, now);
  }
  requestAnimationFrame(loop);
}

function processFrame(res, t, now) {
  const W = canvas.width, H = canvas.height;
  const mirror = S.mode === 'live' && prefs.facing === 'user';
  ctx.save();
  if (mirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, 0, 0, W, H);
  ctx.restore();

  const pi = pickMain(res);
  const lmRaw = res?.landmarks?.[pi], wlRaw = res?.worldLandmarks?.[pi];
  const lm = lmRaw ? (S.prevLm = smoothLm(S.prevLm, lmRaw)) : (S.prevLm = null);
  const wl = wlRaw ? (S.prevWl = smoothLm(S.prevWl, wlRaw)) : (S.prevWl = null);
  const m = lm ? (S.prevM = smoothMetrics(S.prevM, computeMetrics(lm, wl, W, H))) : (S.prevM = null);
  drawPose(ctx, lm, W, H, mirror, S.active, m, S.exId);
  $('#hudAngles').innerHTML = hudAngles(m, S.exId);

  if (S.stage === 'setup') {
    if (m && m.inFrame) {
      S.inFrameSince ??= now;
      setMsg('Hold still…');
      if (now - S.inFrameSince > 1200) beginCountdown();
    } else { S.inFrameSince = null; setMsg(lm ? 'Step back: show your whole body' : 'Step into the frame'); }
    return;
  }
  if (S.stage !== 'rec' || S.paused) return;

  // Time accounting (daily allowance)
  let dt = 0;
  if (S.mode === 'live') { dt = S.lastWall ? (now - S.lastWall) / 1000 : 0; S.lastWall = now; }
  else { dt = S.lastMedia === null ? 0 : Math.max(0, t - S.lastMedia); S.lastMedia = t; }
  dt = Math.min(dt, 0.5);
  S.session.addTime(dt); addUsage(dt);
  $('#hudTime').textContent = fmtTime(S.session.activeTime);
  updateQuota();
  if (remainingSec() <= 0) { finishSession('limit'); return; }

  if (S.mode === 'video' && !lm) setMsg('No person detected'); else if (S.mode === 'video') setMsg('');
  if (S.mode === 'live' && m && !m.inFrame) setMsg('Move back: whole body in view'); else if (S.mode === 'live') setMsg('');

  const out = S.session.update(m, t);
  S.active = out.active;
  const ex = EXERCISES[S.exId];
  for (const ev of out.events) {
    if (ev.type === 'new-extreme') snapCanvas.getContext('2d').drawImage(canvas, 0, 0, snapCanvas.width, snapCanvas.height);
    if (ev.type === 'cue') {
      const f = FAULTS[ev.fault]; showCue(f.cue); say(f.cue, ev.fault);
      if (!S.shots[ev.fault]) S.shots[ev.fault] = { url: shrink(canvas), caption: f.title };
    }
    if (ev.type === 'rep') {
      const r = ev.rep;
      const c = $('#hudCount'); c.textContent = r.n; c.parentElement.classList.remove('pop'); void c.offsetWidth; c.parentElement.classList.add('pop');
      if (r.faults.length) {
        const f = FAULTS[r.faults[0]]; showCue(`Rep ${r.n}: ${f.cue}`); say(f.cue, r.faults[0]);
        for (const id of r.faults) if (!S.shots[id]) S.shots[id] = { url: snapCanvas.toDataURL('image/jpeg', 0.72), caption: `Rep ${r.n}: ${FAULTS[id].title}` };
      } else { showCue(`Rep ${r.n}: good form`, true); say(String(r.n), 'count', 0); }
      if (!S.shots._best || r.score > S.shots._best.score) S.shots._best = { url: snapCanvas.toDataURL('image/jpeg', 0.72), caption: `Rep ${r.n}: your best position`, score: r.score };
    }
  }
  if (ex.type === 'hold') {
    $('#hudCount').textContent = fmtTime(S.session.hold.good);
    if (out.phase === 'out') setMsg('Get into position (side view)');
  } else if (ex.type === 'posture') {
    $('#hudCount').textContent = fmtTime(S.session.activeTime);
    if (!S.shots._best && S.session.frames > 20) S.shots._best = { url: shrink(canvas), caption: 'Your posture' };
  }
}

function shrink(src) { const c = snapCanvas; c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.72); }

async function finishSession(reason) {
  if (!S.running) return;
  S.running = false;
  flushUsage();
  let videoUrl = null;
  if (S.recorder && S.recorder.state !== 'inactive') {
    await new Promise((res) => { S.recorder.onstop = res; S.recorder.stop(); });
    if (S.chunks.length) videoUrl = URL.createObjectURL(new Blob(S.chunks, { type: S.recorder.mimeType }));
  }
  stopMedia();
  if (reason === 'limit') toast('Your 60 minutes for today are used up. Here is your report.', 5000);
  const rep = S.session.report();
  if (S.session.frames > 5 && (rep.type !== 'reps' || rep.repCount > 0 || rep.duration > 10)) saveHistory(rep);
  renderReport(rep, { shots: S.shots, videoUrl, reason });
}

/* ---------------- Photo ---------------- */
async function analysePhoto(file) {
  const exId = prefs.ex, ex = EXERCISES[exId];
  show('session');
  $('#loading').hidden = false;
  try {
    await getLandmarker($('#loadingText'));
    $('#loadingText').textContent = 'Analysing your photo…';
    const img = new Image(); img.src = URL.createObjectURL(file);
    await img.decode();
    await setRunningMode('IMAGE');
    const res = landmarker.detect(img);
    const scale = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    const cx = c.getContext('2d'); cx.drawImage(img, 0, 0, c.width, c.height);
    const pi = pickMain(res);
    const lm = res.landmarks?.[pi], wl = res.worldLandmarks?.[pi];
    const m = lm ? computeMetrics(lm, wl, c.width, c.height) : null;
    const rep = analyzeStill(exId, m);
    drawPose(cx, lm, c.width, c.height, false, new Set(rep.faults.map((f) => f.id)), m, exId);
    URL.revokeObjectURL(img.src);
    $('#loading').hidden = true;
    if (!m) { toast('No person found in this photo. Use a photo with your whole body visible.', 5000); show('home'); return; }
    const notes = [];
    if (!m.inFrame) notes.push('Part of your body (usually the legs or feet) is cut off or hidden in this photo, so some angles are estimated and the result is less reliable. Retake it with your whole body in view, head to feet.');
    if (ex.type === 'reps') notes.push('Photo analysis looks at one position. Take the photo at the hardest point of the movement (bottom of the squat, top of the press). For tempo, rep count and consistency, use a video.');
    if (m.inFrame) saveHistory(rep);
    renderReport(rep, { photoUrl: c.toDataURL('image/jpeg', 0.85), photoNote: notes.join(' ') });
  } catch (e) {
    console.error(e); $('#loading').hidden = true; toast('Could not analyse this photo.'); show('home');
  }
}

/* ---------------- Report ---------------- */
function ring(score, empty) {
  const g = GRADE(score), C = 2 * Math.PI * 50;
  return `<div class="ring"><svg viewBox="0 0 118 118"><circle class="bgc" cx="59" cy="59" r="50"/><circle class="fgc" cx="59" cy="59" r="50" stroke="var(--${g.tone})" stroke-dasharray="${C}" stroke-dashoffset="${empty ? C : C * (1 - score / 100)}"/></svg><div><b>${empty ? '–' : score}</b><small>/ 100</small></div></div>`;
}
const fmtV = (v, r) => (Number.isFinite(v) ? v.toFixed(r.fmt) : '–') + (r.unit === '°' ? '°' : r.unit ? ' ' + r.unit : '');

function bodyMap(regions) {
  const col = (k) => { const v = regions[k] || 0; return v === 0 ? '#3DDC97' : v < 0.34 ? '#FFB547' : '#FF5C7A'; };
  const op = (k) => ((regions[k] || 0) === 0 ? 0.35 : 0.9);
  const spot = (k, x, y, r = 11) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col(k)}" fill-opacity="${op(k)}"/>`;
  const body = `<g fill="none" stroke="#5c5670" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><circle cx="100" cy="30" r="17" fill="#1D1A28"/><path d="M100 48v12M66 74h68M66 74l-12 52-6 44M134 74l12 52 6 44M72 74l8 92h40l8-92M80 166l-6 88 2 78M120 166l6 88-2 78M76 332h-14M124 332h14"/></g>`;
  const spots = spot('neck', 100, 58, 9) + spot('shoulder', 66, 76) + spot('shoulder', 134, 76) + spot('upperback', 100, 96, 12) + spot('elbow', 54, 126) + spot('elbow', 146, 126) + spot('lowback', 100, 140, 13) + spot('hip', 82, 168) + spot('hip', 118, 168) + spot('knee', 76, 254) + spot('knee', 124, 254) + spot('ankle', 76, 326, 10) + spot('ankle', 124, 326, 10);
  const svg = `<svg viewBox="0 0 200 350" role="img" aria-label="Body map of detected faults">${body}${spots}</svg>`;
  const list = Object.keys(REGIONS).map((k) => {
    const v = regions[k] || 0;
    const st = v === 0 ? 'good' : v < 0.34 ? 'warn' : 'bad';
    return `<li><span class="dot ${st}"></span>${REGIONS[k]}: <b>${v === 0 ? 'no issue detected' : Math.round(v * 100) + '% of the time'}</b></li>`;
  }).join('');
  return `<div class="bodymap">${svg}<ul>${list}</ul></div>`;
}

function renderReport(rep, opt = {}) {
  const ex = EXERCISES[rep.exId];
  const g = GRADE(rep.score);
  const date = new Date(rep.date);
  const isReps = rep.type === 'reps' && !rep.still;
  const empty = (isReps && !rep.repCount) || (rep.type === 'hold' && !rep.still && !(rep.holdTime > 1)) || (rep.type === 'posture' && !rep.metrics.length);
  const unchecked = uncheckedInView(rep.exId, rep.view);
  const shots = opt.shots || {};
  const frames = [...(rep.faults || []).filter((f) => shots[f.id]).map((f) => shots[f.id]), shots._best].filter(Boolean);

  let kpis = '';
  if (isReps) kpis = `<div><b>${rep.repCount}</b><small>repetitions</small></div><div><b>${rep.goodReps}/${rep.repCount}</b><small>perfect reps</small></div>${rep.tempo ? `<div><b>${rep.tempo.ecc.toFixed(1)} s</b><small>avg lowering time</small></div><div><b>${rep.tempo.dur.toFixed(1)} s</b><small>avg rep duration</small></div>` : ''}${rep.consistency !== null && rep.consistency !== undefined ? `<div><b>±${rep.consistency.toFixed(0)}°</b><small>depth consistency</small></div>` : ''}`;
  else if (rep.type === 'hold' && !rep.still) kpis = `<div><b>${fmtTime(rep.holdTime || 0)}</b><small>time in position</small></div><div><b>${fmtTime(rep.goodTime || 0)}</b><small>with good form</small></div>`;
  kpis += rep.still ? '<div><b>Photo</b><small>single position</small></div>' : `<div><b>${fmtTime(rep.duration)}</b><small>analysed</small></div>`;
  kpis += `<div><b style="text-transform:capitalize">${esc(rep.view)}</b><small>camera view</small></div>`;

  const faultsHtml = (rep.faults || []).map((f) => {
    const F = FAULTS[f.id];
    const sev = F.weight * (f.pct || 1) >= 10 ? 'bad' : 'warn';
    const freq = f.seconds !== undefined ? `${fmtTime(f.seconds)} of the hold (${Math.round(f.pct * 100)}%)` : rep.still ? 'Seen in this photo' : `In ${f.count} of ${f.of} reps (${Math.round(f.pct * 100)}%)`;
    return `<article class="fault ${sev === 'warn' ? 'warn' : ''}"><h3>${esc(F.title)} <span class="chip ${sev}">${sev === 'bad' ? 'Priority' : 'Minor'}</span></h3>
      <p class="freq">${freq} · ${esc(REGIONS[F.region])}</p>
      <p class="cue-line">“${esc(F.cue)}”</p>
      <dl><div><dt>Biomechanics</dt><dd>${esc(F.why)}</dd></div><div><dt>Anatomy</dt><dd>${esc(F.anatomy)}</dd></div><div><dt>Muscles</dt><dd>${esc(F.muscles)}</dd></div><div><dt>Corrective drill</dt><dd>${esc(F.drill)}</dd></div></dl></article>`;
  }).join('');

  const metricsHtml = rep.metrics.length ? `<table class="table"><thead><tr><th>Measure</th><th>You</th><th>Target</th><th class="hide-sm">Plane</th></tr></thead><tbody>${rep.metrics.map((r) => `<tr><td><span class="dot ${r.status}"></span>${esc(r.label)}</td><td><b>${fmtV(r.avg, r)}</b>${!r.avgOnly && r.n > 1 ? `<small>range ${fmtV(r.min, r)} to ${fmtV(r.max, r)}</small>` : ''}</td><td>${r.target[0] <= -100 ? '≤ ' + r.target[1] : r.target[0] + ' to ' + r.target[1]}${r.unit === '°' ? '°' : r.unit ? ' ' + r.unit : ''}</td><td class="hide-sm">${esc(r.plane)}</td></tr>`).join('')}</tbody></table>` : '<p class="sub">Not enough data to measure.</p>';

  const repsHtml = isReps && rep.reps?.length ? `<section class="r-sec"><h2>Rep by rep</h2><p class="sub">Each bar is one repetition. Green = clean rep; orange / red = faults found.</p><div class="reps">${rep.reps.map((r) => `<div class="rep" title="${esc(r.faults.map((f) => FAULTS[f].title).join(', ') || 'Clean rep')}"><i style="height:${Math.max(8, r.score)}px;background:${r.score >= 90 ? 'var(--good)' : r.score >= 70 ? 'var(--warn)' : 'var(--bad)'}"></i>${r.n}</div>`).join('')}</div></section>` : '';

  const waText = [`Hello Wael, here is my Kinora Form Coach report:`, `${rep.exercise} · ${date.toLocaleDateString('en-GB')}`, `Score: ${rep.score}/100 (${g.label})`,
    isReps ? `Reps: ${rep.repCount} (${rep.goodReps} perfect)` : '', rep.faults?.length ? 'Main issues: ' + rep.faults.slice(0, 3).map((f) => FAULTS[f.id].title).join('; ') : 'No faults detected', 'Can you help me improve?'].filter(Boolean).join('\n');

  $('#report').innerHTML = `
    <div class="r-head">${ring(rep.score, empty)}<div><p class="eyebrow">Biomechanics report</p><h1>${esc(rep.exercise)}</h1><p>${date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })} · ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · <b style="color:var(--${empty ? 'muted' : g.tone})">${empty ? 'No score: not enough data' : g.label}</b></p></div></div>
    <div class="kpis">${kpis}</div>
    ${opt.reason === 'limit' ? '<p class="note">The session stopped because your 60 minutes of analysis for today are used up. Your allowance resets at midnight.</p>' : ''}
    ${empty ? `<p class="note">${isReps ? 'No complete repetition was detected.' : 'Not enough of the movement was visible.'} Make sure your whole body stays in view, follow the camera set-up (${esc(ex.setup)}) and move through a full range of motion.</p>` : ''}
    ${opt.photoNote ? `<p class="note info">${esc(opt.photoNote)}</p>` : ''}
    ${unchecked.length && !empty ? `<p class="note info">Filmed from the <b>${esc(rep.view)}</b>. Not checked in this view: ${esc(unchecked.join(', '))}. ${esc(ex.setup)}</p>` : ''}
    ${opt.photoUrl ? `<div class="photo-view"><img src="${opt.photoUrl}" alt="Your photo with the detected skeleton"></div>` : ''}
    ${frames.length ? `<section class="r-sec"><h2>Key moments</h2><p class="sub">Captured during your session with the skeleton and joint angle.</p><div class="frames">${frames.map((s) => `<figure><img src="${s.url}" alt=""><figcaption>${esc(s.caption)}</figcaption></figure>`).join('')}</div></section>` : ''}
    ${!empty ? `<section class="r-sec"><h2>What to correct</h2><p class="sub">Sorted by priority: the biggest risk to your joints first.</p>${faultsHtml || `<div class="allgood"><b>No faults detected.</b> Every checked angle stayed in the safe range. Keep the same control, then progress the load or the tempo.</div>`}</section>
    <section class="r-sec"><h2>Biomechanics</h2><p class="sub">Your measured joint angles compared with the target range for this exercise.</p>${metricsHtml}</section>` : ''}
    ${repsHtml}
    ${!empty ? `<section class="r-sec"><h2>Body map</h2><p class="sub">Where the faults load your body.</p>${bodyMap(rep.regions)}</section>` : ''}
    <section class="r-sec"><h2>Anatomy of the movement</h2><div class="anat"><div><b>Prime movers</b><p>${esc(rep.anatomy.prime)}</p></div><div><b>Stabilisers</b><p>${esc(rep.anatomy.stab)}</p></div><div><b>Joints &amp; planes</b><p>${esc(rep.anatomy.joints)}</p></div></div></section>
    <div class="actions">
      <button class="btn btn-primary" id="rNew">New session <svg><use href="#i-arrow"/></svg></button>
      <a class="btn btn-wa" href="https://wa.me/${COACH_WA}?text=${encodeURIComponent(waText)}" target="_blank" rel="noopener"><svg><use href="#i-wa"/></svg> Send to Coach Wael</a>
      <button class="btn btn-ghost" id="rPdf"><svg><use href="#i-pdf"/></svg> Save as PDF</button>
      ${opt.videoUrl ? `<a class="btn btn-ghost" href="${opt.videoUrl}" download="kinora-${rep.exId}-${dayKey(date)}.${opt.videoUrl && S.recorder?.mimeType?.includes('mp4') ? 'mp4' : 'webm'}"><svg><use href="#i-down"/></svg> Download annotated video</a>` : ''}
    </div>
    <p class="disclaimer">Form Coach estimates joint positions from a 2D camera image with an AI pose model. Precision depends on light, camera angle and clothing, so no camera system can be 100% exact. Use it as a training guide, not a medical diagnosis. Stop if you feel pain and consult a doctor or physiotherapist. Your video was analysed on this device and was never uploaded.</p>`;
  $('#rNew').onclick = () => { renderHome(); show('home'); };
  $('#rPdf').onclick = () => window.print();
  show('report');
  if (!opt.fromHistory) renderDashboard();
}

/* ---------------- Wiring ---------------- */
$('#startBtn').onclick = () => {
  if (prefs.mode === 'live') {
    if (!navigator.mediaDevices?.getUserMedia) { toast('Your browser cannot open the camera. Use “Upload a video” instead.', 5000); return; }
    startSession('live');
  } else if (prefs.mode === 'video') { $('#videoInput').value = ''; $('#videoInput').click(); }
  else {
    const ex = EXERCISES[prefs.ex];
    $('#photoHint').textContent = ex.type === 'posture' ? 'Stand relaxed with your whole body visible. One photo from the front, then one from the side.' : `Show the hardest point of the ${ex.name.toLowerCase()} with your whole body visible. ${ex.setup}`;
    $('#photoSheet').hidden = false;
  }
};
$('#videoInput').onchange = (e) => { const f = e.target.files[0]; if (f) startSession('video', f); };
$('#photoTake').onclick = () => { const i = $('#photoInput'); i.setAttribute('capture', prefs.facing === 'user' ? 'user' : 'environment'); i.value = ''; i.click(); };
$('#photoPick').onclick = () => { const i = $('#photoInput'); i.removeAttribute('capture'); i.value = ''; i.click(); };
$('#photoCancel').onclick = () => ($('#photoSheet').hidden = true);
$('#photoSheet').onclick = (e) => { if (e.target.id === 'photoSheet') e.currentTarget.hidden = true; };
$('#photoInput').onchange = (e) => { $('#photoSheet').hidden = true; const f = e.target.files[0]; if (f) analysePhoto(f); };

$('#stopBtn').onclick = () => {
  if (S.stage !== 'rec') { S.running = false; stopMedia(); setMsg(''); show('home'); renderHome(); return; }
  finishSession('user');
};
$('#pauseBtn').onclick = () => {
  if (!S.running || S.stage !== 'rec') return;
  S.paused = !S.paused;
  S.lastWall = null; S.lastMedia = null;
  if (S.mode === 'video') S.paused ? video.pause() : video.play();
  if (S.recorder) S.paused ? S.recorder.pause() : S.recorder.resume();
  $('#pauseBtn').querySelector('span').textContent = S.paused ? 'Resume' : 'Pause';
  $('#pauseBtn').querySelector('use').setAttribute('href', S.paused ? '#i-play' : '#i-pause');
  setMsg(S.paused ? 'Paused' : '');
};
$('#flipBtn').onclick = async () => {
  if (S.mode !== 'live' || !S.running) return;
  prefs.facing = prefs.facing === 'user' ? 'environment' : 'user'; savePrefs();
  try { await openCamera(); S.prevLm = S.prevWl = S.prevM = null; } catch { toast('Could not switch camera.'); }
};
$('#voiceBtn').onclick = () => { prefs.voice = !prefs.voice; savePrefs(); $('#voiceBtn').classList.toggle('off', !prefs.voice); if (!prefs.voice) try { speechSynthesis.cancel(); } catch {} };

document.addEventListener('visibilitychange', () => { if (document.hidden) flushUsage(); else if (!S.running) { usageCache = store.get('kfc.usage.v1', {}); updateStart(); renderDashboard(); } });
window.addEventListener('pagehide', flushUsage);
// Refresh the daily allowance and plan when the date changes while the app is open.
let lastDay = dayKey();
setInterval(() => { if (dayKey() !== lastDay) { lastDay = dayKey(); voiceLast = {}; if (!S.running) { updateStart(); renderDashboard(); } else updateQuota(); } }, 30000);

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
renderHome();
