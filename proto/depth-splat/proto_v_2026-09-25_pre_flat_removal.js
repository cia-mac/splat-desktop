// Pointfield depth prototype, Phase 0 of docs/SPLAT_DEPTH_PLAN_v1.md.
// One page: Depth Anything V2 Small (ONNX, WebGPU EP) -> per-cell depth ->
// three primitives (depth-lifted points, EWA-style surfels, sorted Gaussians)
// under a bounded orbit. ?bench=1 runs the measurement sequence and POSTs
// results to ./results/ through server.py.
import * as THREE from './vendor/three.module.js';
import * as ort from './vendor/ort/ort.webgpu.min.mjs';
import * as MP4Box from './vendor/mp4box/mp4box.all.mjs';

ort.env.wasm.wasmPaths = new URL('./vendor/ort/', location.href).href;
ort.env.wasm.numThreads = 1;

const Q = new URLSearchParams(location.search);
const BENCH = Q.has('bench');
const INTERACTIVE = !(BENCH || Q.has('matched') || Q.has('render') || Q.has('eval') || Q.has('gallery'));
// Grid density: columns across; rows follow the 417x235 aspect. ?grid=208 etc.
const GRIDS = { 1112: 627, 834: 470, 626: 353, 417: 235, 278: 157, 208: 117, 139: 78, 104: 59 };
let COLS = +(Q.get('grid') || (INTERACTIVE ? 834 : 417)), ROWS = GRIDS[COLS] || Math.round(COLS * 235 / 417);
function setGrid(c) { COLS = c; ROWS = GRIDS[c] || Math.round(c * 235 / 417); U.uCols.value = COLS; U.uRows.value = ROWS; build(); if (bgOn) computeBg(); }
const FOV = 30, D = 1 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));

const S = {
  prim: Q.get('prim') || 'surfels', K: 1, clip: Q.get('clip') || 'default',
  model: Q.get('model') || 'fp16', res: Q.get('res') || '518x294',
  depthAmt: 0.8, ema: 1.0, hz: +(Q.get('hz') || 15), surfScale: 2.4, flatten: 0.5,
  gauss: 1.0, eps: 0.05, sortAlpha: 1.0, sortGauss: 1.2, sweep: true, playing: false,
  yaw: 0, pitch: 0, yawMax: 15, pitchMax: 6, yawLim: 30, pitchLim: 20, bgDown: +(Q.get('bgdown') || 2),
};

const logEl = document.getElementById('log');
const log = (...a) => { const s = a.join(' '); console.log(s); logEl.textContent = s; };
const now = () => performance.now();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const med = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
const pct = (a, p) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(b.length * p))] : NaN; };
const r1 = x => Math.round(x * 10) / 10;

/* ═══════════ renderer ═══════════ */
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.autoClear = false;
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 50);
let vidW = 1280, vidH = 720, aspect = 16 / 9;

const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true });
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.zoom = Math.min(1, (w / h) / aspect);
  camera.updateProjectionMatrix();
  const pr = renderer.getPixelRatio();
  rt.setSize(Math.round(w * pr), Math.round(h * pr));
  U.uFocal.value = (h * pr / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * camera.zoom;
  U.uPR.value = pr;
}

/* ═══════════ video ═══════════ */
const video = document.createElement('video');
video.muted = true; video.playsInline = true; video.loop = true; video.preload = 'auto';
const vtex = new THREE.VideoTexture(video);
vtex.minFilter = vtex.magFilter = THREE.LinearFilter;

async function loadClip(name) {
  S.clip = name;
  video.src = `media/${name}-10s.mp4`;
  await new Promise((res, rej) => { video.onloadeddata = res; video.onerror = rej; });
  vidW = video.videoWidth; vidH = video.videoHeight; aspect = vidW / vidH;
  U.uAspect.value = aspect; U.uVidH.value = vidH;
  await seek(2.0);
  resize();
}
async function seek(t) {
  video.pause(); S.playing = false;
  await seekTo(t);
}
// Seek and make sure the new frame reaches the texture before anything renders:
// wait for 'seeked', then for the frame to be presented, then force a re-upload.
async function seekTo(t) {
  await new Promise(res => { video.onseeked = res; video.currentTime = t; });
  if (video.requestVideoFrameCallback) await Promise.race([new Promise(r => video.requestVideoFrameCallback(() => r())), sleep(250)]);
  vtex.needsUpdate = true;
}

/* ═══════════ depth ═══════════ */
let session = null, inW = 518, inH = 294;
let depthTex = null, disp = null, prevRaw = null, prevDisp = null, dW = 0, dH = 0;
let lo = 0, hi = 1, depthVersion = 0, depthBusy = false, lastDepthStart = 0;
const depthStats = { inf: [], pre: [], post: [], flickRaw: [], flickShown: [], starts: [] };
const pre = document.createElement('canvas');
const pctx = pre.getContext('2d', { willReadFrequently: true });

async function loadModel(name) {
  const t0 = now();
  if (session) { try { await session.release(); } catch (e) {} }
  session = await ort.InferenceSession.create(`models/model_${name}.onnx`,
    { executionProviders: ['webgpu'], graphOptimizationLevel: 'all' });
  S.model = name;
  return now() - t0;
}
function setRes(res) { S.res = res; [inW, inH] = res.split('x').map(Number); }

async function infer(src = video) {
  const t0 = now();
  let px;
  if (src && src.px) px = src.px;   // already decoded at inW x inH (WebCodecs path)
  else { pre.width = inW; pre.height = inH; pctx.drawImage(src, 0, 0, inW, inH); px = pctx.getImageData(0, 0, inW, inH).data; }
  const n = inW * inH, f = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    f[i] = (px[4 * i] / 255 - 0.485) / 0.229;
    f[n + i] = (px[4 * i + 1] / 255 - 0.456) / 0.224;
    f[2 * n + i] = (px[4 * i + 2] / 255 - 0.406) / 0.225;
  }
  const t1 = now();
  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', f, [1, 3, inH, inW]) });
  const t = out[session.outputNames[0]];
  const data = t.data ?? await t.getData();
  const t2 = now();
  return { data, h: t.dims[t.dims.length - 2], w: t.dims[t.dims.length - 1], pre: t1 - t0, inf: t2 - t1 };
}

function robustRange(a) {
  const step = Math.max(1, Math.floor(a.length / 8192)), s = [];
  for (let i = 0; i < a.length; i += step) s.push(a[i]);
  s.sort((x, y) => x - y);
  return [s[Math.floor(s.length * 0.02)], s[Math.floor(s.length * 0.98)]];
}

async function updateDepth(resetClip) {
  depthBusy = true; lastDepthStart = now();
  depthStats.starts.push(lastDepthStart);
  const r = await infer();
  const t0 = now();
  const n = r.w * r.h;
  if (r.w !== dW || r.h !== dH || !disp) {
    dW = r.w; dH = r.h; disp = new Float32Array(n); prevRaw = null; prevDisp = null; resetClip = true;
    if (depthTex) depthTex.dispose();
    depthTex = new THREE.DataTexture(disp, dW, dH, THREE.RedFormat, THREE.FloatType);
    depthTex.minFilter = depthTex.magFilter = THREE.NearestFilter;
    U.uDepth.value = depthTex;
  }
  // Per-clip normalization: the range adapts slowly, never per frame.
  const [l, h] = robustRange(r.data);
  if (resetClip || !S.playing) { lo = l; hi = h; } else { lo += (l - lo) * 0.05; hi += (h - hi) * 0.05; }
  const inv = 1 / Math.max(1e-6, hi - lo), a = (resetClip || !prevDisp) ? 1 : S.ema;
  const raw = new Float32Array(n);
  let fr = 0, fs = 0;
  for (let i = 0; i < n; i++) {
    const dn = Math.min(1, Math.max(0, (r.data[i] - lo) * inv));
    raw[i] = dn;
    const v = a * dn + (1 - a) * disp[i];
    if (prevRaw) { fr += Math.abs(dn - prevRaw[i]); fs += Math.abs(v - disp[i]); }
    disp[i] = v;
  }
  if (prevRaw && S.playing) { depthStats.flickRaw.push(fr / n); depthStats.flickShown.push(fs / n); }
  prevRaw = raw; prevDisp = true;
  depthTex.needsUpdate = true;
  depthVersion++;
  sortWorker.postMessage({ depth: disp.slice(), dW, dH });
  if (bgOn) computeBg();
  depthStats.inf.push(r.inf); depthStats.pre.push(r.pre); depthStats.post.push(now() - t0);
  depthBusy = false;
}


/* ═══════════ bake on import ═══════════ */
// Depth for every Nth frame, computed once with the clip paused frame by frame.
// Normalized over the WHOLE clip (no per-frame pumping), then smoothed over time in
// both directions (impossible live: needs future frames), then played back on the
// video clock so color and depth are always the same instant.
const FPS = 30;
// Hash of the WHOLE frame (every 5th pixel). The old corner hash (top-left 64x36) sat on static sky
// and reported unchanged sky as a repeated frame.
const frameHash = px => { let h = 0; for (let i = 0; i < px.length; i += 20) h = (h * 31 + px[i] + px[i + 1] * 7 + px[i + 2] * 13) >>> 0; return h; };
const baked = { frames: null, n: 0, step: 2, active: false, lastI0: -1, lastA: -1 };
const meanAbsDiff = (a, b) => { let x = 0; for (let i = 0; i < a.length; i++) x += Math.abs(a[i] - b[i]); return x / a.length; };

async function bake(step = 2, onProgress, decoded = null) {
  video.pause(); S.playing = false; baked.active = false;
  const total = decoded ? decoded.total : Math.floor(video.duration * FPS), raws = [], infs = [], tsList = [];
  const fresh = { timeouts: 0, offFrame: 0, repeats: 0, lastHash: -1, hiddenAtStart: document.hidden };
  const T0 = now();
  const take = async (fr) => {                         // one decoded frame in, one raw depth map out
    const r = await infer(fr), h = frameHash(fr.px);
    if (h === fresh.lastHash) fresh.repeats++; fresh.lastHash = h;
    raws.push(new Float32Array(r.data)); infs.push(r.inf); tsList.push(fr.ts); dW = r.w; dH = r.h;
    if (onProgress) onProgress(raws.length, Math.ceil(total / step));
  };
  if (decoded && decoded.stream) await decoded.stream(take);
  else for (let f = 0; f < total; f += step) {
    if (decoded) { await take(decoded.byIndex.get(f)); continue; }
    const target = (f + 0.5) / FPS;
    await new Promise(res => { video.onseeked = res; video.currentTime = target; });
    // Freshness check: wait for the frame to be presented and read its media time.
    let mt = null;
    if (video.requestVideoFrameCallback) mt = await Promise.race([new Promise(r => video.requestVideoFrameCallback((_, m) => r(m.mediaTime))), sleep(300).then(() => null)]);
    if (mt === null) fresh.timeouts++; else if (Math.abs(mt - target) > 0.6 / FPS) fresh.offFrame++;
    const r = await infer();
    // Identical consecutive inputs = the decoder handed back the same frame.
    const h = frameHash(pctx.getImageData(0, 0, inW, inH).data);
    if (h === fresh.lastHash) fresh.repeats++; fresh.lastHash = h;
    raws.push(new Float32Array(r.data)); infs.push(r.inf); tsList.push(target * 1e6); dW = r.w; dH = r.h;
    if (onProgress) onProgress(raws.length, Math.ceil(total / step));
  }
  const T1 = now();
  // One range for the whole clip, from pooled samples.
  const pool = [];
  for (const a of raws) for (let i = 0; i < a.length; i += 61) pool.push(a[i]);
  pool.sort((x, y) => x - y);
  const gl = pool[Math.floor(pool.length * 0.02)], gh = pool[Math.floor(pool.length * 0.98)], inv = 1 / Math.max(1e-6, gh - gl);
  const norm = raws.map(a => { const o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) o[i] = Math.min(1, Math.max(0, (a[i] - gl) * inv)); return o; });
  raws.length = 0;                                     // free the raw model output early
  // Temporal smoothing [.25 .5 .25] (non-causal) is OFF by default: it smears moving edges (RESULTS_v5).
  // ?smooth=1 turns it on. Smoothed-flicker is still computed, one frame at a time, without storing it.
  const useSm = Q.get('smooth') === '1', n = norm.length;
  const smAt = k => { const a = norm[k], p = norm[Math.max(0, k - 1)], q = norm[Math.min(n - 1, k + 1)], o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) o[i] = 0.25 * p[i] + 0.5 * a[i] + 0.25 * q[i]; return o; };
  let fr = 0, fs = 0, prevSm = null; const out = [];
  for (let k = 0; k < n; k++) {
    if (k > 0) fr += meanAbsDiff(norm[k], norm[k - 1]);
    const cur = smAt(k); if (prevSm) fs += meanAbsDiff(cur, prevSm); prevSm = cur; if (useSm) out.push(cur);
  }
  const srcFrames = useSm ? out : norm;
  const frames = srcFrames.map(f => { const o = new Uint8Array(f.length); for (let i = 0; i < f.length; i++) o[i] = Math.round(f[i] * 255); return o; });   // 8-bit, 4x smaller than float32
  Object.assign(baked, { frames, q: true, n, step, active: true, lastI0: -1, lastA: -1, gl, gh, ts: tsList, meta: null });
  ensureDepthTex();
  return { frames: n, step, bakeMs: r1(T1 - T0), perFrameMs: r1((T1 - T0) / n), inferMed: r1(med(infs)), smoothed: useSm,
    memMB: r1(n * frames[0].length / 1e6), quantized: true, flickerRawPct: +(fr / (n - 1) * 100).toFixed(3),
    flickerSmoothedPct: +(fs / (n - 1) * 100).toFixed(3), clipRange: [gl, gh],
    stale: { timeouts: fresh.timeouts, offFrame: fresh.offFrame, repeatedInputs: fresh.repeats, hiddenAtStart: fresh.hiddenAtStart, hiddenAtEnd: document.hidden } };
}

function ensureDepthTex() {
  if (depthTex && disp && dW * dH === disp.length) return;
  disp = new Float32Array(dW * dH);
  if (depthTex) depthTex.dispose();
  depthTex = new THREE.DataTexture(disp, dW, dH, THREE.RedFormat, THREE.FloatType);
  depthTex.minFilter = depthTex.magFilter = THREE.NearestFilter;
  U.uDepth.value = depthTex;
}

// Sidecar format "PFD1" (little endian): 24-byte header, then n frames of w*h uint8.
//   0  "PFD1"   4  u16 w   6  u16 h   8  u16 n   10 u8 step   11 u8 fps
//   12 f32 rangeLo   16 f32 rangeHi (model units, informational)   20 u32 reserved
// Values are the clip-normalized, smoothed depth in 0..1 quantized to 8 bits.
function encodeBake() {
  const w = dW, h = dH, n = baked.n, out = new Uint8Array(24 + n * w * h), dv = new DataView(out.buffer);
  out.set([0x50, 0x46, 0x44, 0x31], 0); dv.setUint16(4, w, true); dv.setUint16(6, h, true); dv.setUint16(8, n, true);
  dv.setUint8(10, baked.step); dv.setUint8(11, FPS); dv.setFloat32(12, baked.gl ?? 0, true); dv.setFloat32(16, baked.gh ?? 1, true);
  for (let k = 0; k < n; k++) { const f = baked.frames[k], o = 24 + k * w * h; for (let i = 0; i < w * h; i++) out[o + i] = Math.round(f[i] * 255); }
  return out;
}
async function loadBakeFrom(url, opts = {}) {
  const t0 = now();
  const res = await fetch(url); if (!res.ok) throw new Error(`bake fetch ${res.status}`);
  const buf = await res.arrayBuffer(), t1 = now(), dv = new DataView(buf), u8 = new Uint8Array(buf);
  const magic = String.fromCharCode(...u8.subarray(0, 4));
  if (magic === 'PFD2') {
    const n = dv.getUint32(4, true), w = dv.getUint16(8, true), h = dv.getUint16(10, true), step = dv.getUint8(12), jl = dv.getUint32(24, true);
    const meta = JSON.parse(new TextDecoder().decode(u8.subarray(32, 32 + jl)));
    if (opts.expectSha && meta.sha256 !== opts.expectSha) throw new Error(`PFD2 source hash mismatch: file ${String(meta.sha256).slice(0, 12)}, expected ${opts.expectSha.slice(0, 12)}`);
    let o = 32 + jl; const ts = []; for (let k = 0; k < n; k++) { ts.push(dv.getFloat64(o, true)); o += 8; }
    const frames = [];
    for (let k = 0; k < n; k++) { frames.push(u8.subarray(o, o + w * h)); o += w * h; }   // zero-copy views into the file buffer
    dW = w; dH = h; Object.assign(baked, { frames, q: true, n, step, active: true, lastI0: -1, lastA: -1, gl: dv.getFloat32(16, true), gh: dv.getFloat32(20, true), ts, meta });
    ensureDepthTex();
    return { format: 'PFD2', bytes: buf.byteLength, fetchMs: r1(t1 - t0), decodeMs: r1(now() - t1), frames: n, w, h, step, meta };
  }
  if (magic !== 'PFD1') throw new Error('not a PFD file');
  const w = dv.getUint16(4, true), h = dv.getUint16(6, true), n = dv.getUint16(8, true), step = dv.getUint8(10);
  const frames = [];
  for (let k = 0; k < n; k++) { const o = 24 + k * w * h; frames.push(u8.subarray(o, o + w * h)); }
  dW = w; dH = h; Object.assign(baked, { frames, q: true, n, step, active: true, lastI0: -1, lastA: -1, gl: dv.getFloat32(12, true), gh: dv.getFloat32(16, true), ts: null, meta: null });
  ensureDepthTex();
  return { format: 'PFD1', bytes: buf.byteLength, fetchMs: r1(t1 - t0), decodeMs: r1(now() - t1), frames: n, w, h, step };
}


/* ═══════════ deterministic decode (WebCodecs) ═══════════ */
// Replaces "seek a paused <video> and drawImage" (stale 7 to 12% of the time, AUDIT_v1).
// mp4box demuxes the file, VideoDecoder decodes in order, every frame carries its
// presentation timestamp, and we keep every stepth frame downscaled to inW x inH.
async function openClip(url) {
  const buf = await (await fetch(url)).arrayBuffer(); buf.fileStart = 0;
  const shaBuf = await crypto.subtle.digest('SHA-256', buf);
  const sha = [...new Uint8Array(shaBuf)].map(b => b.toString(16).padStart(2, '0')).join('');
  const file = MP4Box.createFile(), samples = [];
  let track = null, desc = null;
  file.onError = e => { throw new Error('mp4box ' + e); };
  file.onReady = info => {
    track = info.videoTracks[0];
    const entry = file.getTrackById(track.id).mdia.minf.stbl.stsd.entries[0];
    const box = entry.avcC || entry.hvcC;
    if (!box) throw new Error('no avcC/hvcC (codec ' + track.codec + ')');
    const ds = new MP4Box.DataStream(undefined, 0, MP4Box.Endianness.BIG_ENDIAN); box.write(ds);
    desc = new Uint8Array(ds.buffer, 8);
    file.setExtractionOptions(track.id, null, { nbSamples: 500 }); file.start();
  };
  file.onSamples = (id, user, ss) => { for (const s of ss) samples.push(s); };
  file.appendBuffer(buf); file.flush();
  if (!track) throw new Error('no video track');
  if (samples.length !== track.nb_samples) throw new Error(`samples ${samples.length} != ${track.nb_samples}`);
  return { track, desc, samples, sha, bytes: buf.byteLength };
}

// Keeps every stepth frame downscaled to inW x inH. With a `sink`, frames are handed over as they
// are decoded, with backpressure (at most 4 queued), so memory stays flat; without one they are
// all kept in byIndex.
async function decodeClip(url, step = 2, onProgress, sink = null) {
  const T0 = now();
  const { track, desc, samples, sha, bytes } = await openClip(url);
  const supp = await VideoDecoder.isConfigSupported({ codec: track.codec, codedWidth: track.video.width, codedHeight: track.video.height, description: desc });
  if (!supp.supported) throw new Error('decoder config unsupported: ' + track.codec);
  const c = document.createElement('canvas'); c.width = inW; c.height = inH;
  const cx = c.getContext('2d', { willReadFrequently: true });
  const byIndex = new Map(), stats = { codec: track.codec, w: track.video.width, h: track.video.height, samples: samples.length, tsBad: 0, order: 0, kept: 0, queueMax: 0 };
  let n = 0, decodeErr = null, ts0 = null; stats.firstTs = []; stats.timescale = track.timescale; stats.firstCts = samples.slice(0, 4).map(s => s.cts);
  const queue = []; let wakeConsumer = null, wakeFeeder = null, done = false, sinkErr = null;
  const consumer = sink ? (async () => {
    try {
      while (true) {
        if (!queue.length) { if (done) break; await new Promise(r => { wakeConsumer = r; }); continue; }
        const fr = queue.shift(); if (wakeFeeder) { wakeFeeder(); wakeFeeder = null; }
        await sink(fr);
      }
    } catch (e) { sinkErr = e; if (wakeFeeder) { wakeFeeder(); wakeFeeder = null; } }
  })() : null;
  const dec = new VideoDecoder({
    output: fr => {
      const idx = n++, ts = fr.timestamp;                               // microseconds
      if (ts0 === null) ts0 = ts;
      if (stats.firstTs.length < 4) stats.firstTs.push(ts);
      if (Math.abs((ts - ts0) * FPS / 1e6 - idx) > 0.02) stats.tsBad++; // frame idx must sit at idx/FPS after the first
      if (idx % step === 0) {
        cx.drawImage(fr, 0, 0, inW, inH);
        const obj = { px: cx.getImageData(0, 0, inW, inH).data, ts, idx }; stats.kept++;
        if (sink) { queue.push(obj); stats.queueMax = Math.max(stats.queueMax, queue.length); if (wakeConsumer) { wakeConsumer(); wakeConsumer = null; } }
        else byIndex.set(idx, obj);
      }
      fr.close();
    },
    error: e => { decodeErr = e; },
  });
  dec.configure({ codec: track.codec, codedWidth: track.video.width, codedHeight: track.video.height, description: desc });
  const tsc = 1e6 / track.timescale;
  for (const s of samples) {
    while (dec.decodeQueueSize > (sink ? 6 : 24)) await new Promise(r => dec.addEventListener('dequeue', r, { once: true }));
    while (sink && queue.length > 4 && !sinkErr) await new Promise(r => { wakeFeeder = r; });
    dec.decode(new EncodedVideoChunk({ type: s.is_sync ? 'key' : 'delta', timestamp: s.cts * tsc, duration: s.duration * tsc, data: s.data }));
    if (decodeErr) throw decodeErr;
    if (sinkErr) throw sinkErr;
    if (onProgress && n % 100 === 0) onProgress(n, samples.length);
  }
  await dec.flush(); dec.close();
  done = true; if (wakeConsumer) { wakeConsumer(); wakeConsumer = null; }
  if (consumer) await consumer;
  if (decodeErr) throw decodeErr;
  if (sinkErr) throw sinkErr;
  stats.frames = n; stats.decodeMs = r1(now() - T0); stats.fps = r1(n / ((now() - T0) / 1000));
  return { byIndex, total: n, stats, sha, bytes };
}

// Bake straight from the decoder: decode, infer, discard. Records the source hash for the sidecar.
async function bakeStream(url, step = 2, onProgress) {
  let dres = null;
  const decoded = { total: 0, stream: async sink => { dres = await decodeClip(url, step, null, sink); } };
  const b = await bake(step, onProgress, decoded);
  baked.meta = { sha256: dres.sha, sourceBytes: dres.bytes, sourceName: url, decoder: 'webcodecs' };
  return { ...b, decode: dres.stats, sha256: dres.sha };
}

// Sidecar "PFD2" (little endian). Header (32 bytes):
//   0 "PFD2"  4 u32 n  8 u16 w  10 u16 h  12 u8 step  13 u8 fps  16 f32 lo  20 f32 hi  24 u32 jsonLen
// then jsonLen bytes of UTF-8 JSON (source sha256/name/bytes, model, input size, normalization,
// smoothing, created), then n x f64 presentation timestamps (microseconds), then n frames of w*h u8
// (clip-normalized depth 0..1, quantized to 8 bits).
function encodeBake2() {
  const w = dW, h = dH, n = baked.n;
  const meta = { ...(baked.meta || {}), model: S.model, modelFile: `model_${S.model}.onnx`, input: `${inW}x${inH}`, normalize: 'clip p2-p98', smoothed: Q.get('smooth') === '1', created: new Date().toISOString(), encoder: 'depth-splat proto' };
  const json = new TextEncoder().encode(JSON.stringify(meta));
  const out = new Uint8Array(32 + json.length + n * 8 + n * w * h), dv = new DataView(out.buffer);
  out.set([0x50, 0x46, 0x44, 0x32], 0); dv.setUint32(4, n, true); dv.setUint16(8, w, true); dv.setUint16(10, h, true);
  dv.setUint8(12, baked.step); dv.setUint8(13, FPS); dv.setFloat32(16, baked.gl ?? 0, true); dv.setFloat32(20, baked.gh ?? 1, true); dv.setUint32(24, json.length, true);
  out.set(json, 32);
  let o = 32 + json.length;
  for (let k = 0; k < n; k++) { dv.setFloat64(o, baked.ts?.[k] ?? k * baked.step * 1e6 / FPS, true); o += 8; }
  for (let k = 0; k < n; k++) { const f = baked.frames[k]; if (baked.q) out.set(f, o); else for (let i = 0; i < w * h; i++) out[o + i] = Math.round(f[i] * 255); o += w * h; }
  return out;
}

// Blend the two nearest baked frames for the video's current time.
function applyBaked() {
  const pos = Math.max(0, Math.min(baked.n - 1, video.currentTime * FPS / baked.step - 0.5 / baked.step));
  const i0 = Math.floor(pos), i1 = Math.min(baked.n - 1, i0 + 1), a = pos - i0;
  if (i0 === baked.lastI0 && Math.abs(a - baked.lastA) < 0.02) return;
  baked.lastI0 = i0; baked.lastA = a;
  const A = baked.frames[i0], B = baked.frames[i1];
  const k255 = baked.q ? 1 / 255 : 1;
  for (let i = 0; i < disp.length; i++) disp[i] = (A[i] + (B[i] - A[i]) * a) * k255;
  depthTex.needsUpdate = true; depthVersion++;
  if (/sorted/.test(S.prim)) sortWorker.postMessage({ depth: disp.slice(), dW, dH });
  if (bgOn) computeBg();
}

/* ═══════════ shaders ═══════════ */
const U = {
  uDepth: { value: null }, uVideo: { value: vtex }, uCols: { value: COLS }, uRows: { value: ROWS },
  uK: { value: 1 }, uAspect: { value: aspect }, uD: { value: D }, uDepthAmt: { value: S.depthAmt },
  uTime: { value: 0 }, uTurb: { value: 1 }, uVidH: { value: vidH }, uFocal: { value: 1000 },
  uPR: { value: 1 }, uSpread: { value: 0.6 }, uSurfScale: { value: S.surfScale }, uFlatten: { value: S.flatten },
  uGauss: { value: S.gauss }, uEps: { value: S.eps }, uOpacity: { value: 0.55 }, uBright: { value: 2.4 },
  uSortAlpha: { value: S.sortAlpha }, uSortGauss: { value: S.sortGauss }, uEdge: { value: 0.2 }, uTilt: { value: 0 }, uMotion: { value: null }, uMotionT: { value: 0 }, uDepthBg: { value: null }, uColorBg: { value: null }, uBgPush: { value: 0.1 }, uBgScale: { value: 2 }, uCov: { value: 3 },
};

const COMMON = /* glsl */`
  precision highp float;
  uniform sampler2D uDepth; uniform sampler2D uVideo; uniform sampler2D uDepthBg; uniform sampler2D uColorBg;
  #ifdef BG_LAYER
  #define DEPTHMAP uDepthBg
  #else
  #define DEPTHMAP uDepth
  #endif
  uniform float uCols, uRows, uK, uAspect, uD, uDepthAmt, uTime, uTurb, uVidH, uFocal, uPR, uSpread;
  out vec3 vCol;
  float hashu(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return float(x) / 4294967295.0; }
  // Lift an image point (top-down uv) along the original camera's ray, so the
  // front view is unchanged and depth only shows under orbit.
  vec3 liftTop(vec2 t) {
    float dn = texture(DEPTHMAP, clamp(t, 0.0, 1.0)).r;
    float z = uDepthAmt * (dn - 0.5) * 2.0;
    float s = (uD - z) / uD;
    return vec3((t.x * 2.0 - 1.0) * uAspect * s, (1.0 - t.y * 2.0) * s, z);
  }
  void splatInfo(float idx, out vec2 cellT, out vec2 memT, out float jit) {
    float cell = floor(idx / uK); float k = idx - cell * uK;
    float row = floor(cell / uCols); float col = cell - row * uCols;
    cellT = vec2((col + 0.5) / uCols, (row + 0.5) / uRows);
    memT = cellT;
    uint ui = uint(idx);
    if (uK > 1.0) {
      float a = hashu(ui * 3u + 1u) * 6.2831853, d = hashu(ui * 3u + 2u) * uSpread;
      memT += vec2(cos(a) / uCols, sin(a) / uRows) * d;
    }
    jit = hashu(ui * 7u + 5u);
  }
  vec3 turb(vec3 p, float idx) {
    uint ui = uint(idx);
    float a = hashu(ui * 11u + 3u) * 6.283, b = hashu(ui * 13u + 9u) * 6.283;
    return p + uTurb * 0.004 * vec3(sin(p.y * 9.0 + uTime * 0.5 + a), sin(p.x * 9.0 + uTime * 0.65 + b), 0.0);
  }
  vec3 videoColor(vec2 t) { return texture(uVideo, vec2(t.x, 1.0 - t.y)).rgb; }
`;

// (i) Points: today's Pointfield point, lifted by depth. Same soft disc, same
// premultiplied-over blend, no sort, no depth test.
const pointsMat = new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3, uniforms: U, transparent: true, depthTest: false, depthWrite: false,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  vertexShader: COMMON + /* glsl */`
    void main() {
      float idx = position.x; vec2 cT, mT; float j; splatInfo(idx, cT, mT, j);
      vec3 p = turb(liftTop(mT), idx);
      float s = (uD - p.z) / uD;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      float sizePx = mix(1.7, 5.4, pow(j, 2.4));
      gl_PointSize = sizePx * uPR * (uD * s) / -mv.z;
      vCol = videoColor(mT);
    }`,
  fragmentShader: /* glsl */`
    precision highp float; out vec4 outColor; in vec3 vCol; uniform float uOpacity, uBright;
    void main() {
      vec2 d = gl_PointCoord - 0.5; float r2 = dot(d, d) * 4.0;
      float a = exp(-r2 * 5.0) * uOpacity; if (a < 0.005) discard;
      outColor = vec4(vCol * uBright * a, a);
    }`,
});

const SURF_VS = COMMON + /* glsl */`
  uniform float uSurfScale, uFlatten, uEps, uEdge, uTilt, uMotionT, uBgPush, uBgScale;
  uniform sampler2D uMotion;
  in float aIdx; out vec2 vQ;
  float dAt(vec2 t) { return texture(DEPTHMAP, clamp(t, 0.0, 1.0)).r; }
  void main() {
    vec2 cT, mT; float j; splatInfo(aIdx, cT, mT, j);
    vec3 p = liftTop(mT);
    float du = 1.0 / uCols, dv = 1.0 / uRows;
    // Edge-aware cutoff: a surfel whose neighbours (one cell each side) disagree in
    // normalized depth by more than uEdge sits on a depth discontinuity. Those are
    // the "flying pixels"; drop them (degenerate quad, clipped).
    // Motion mask: drop surfels where the image changes fast between neighbouring frames
    // (motion-blurred objects), a temporal signal the geometric filters cannot see.
    #ifndef BG_LAYER
    if (uMotionT > 0.0 && texture(uMotion, clamp(mT, 0.0, 1.0)).r > uMotionT) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vQ = vec2(2.0); vCol = vec3(0.0); return; }
    if (uEdge > 0.0) {
      // fixed reference offset (the 417x235 grid the 0.2 threshold was tuned on), so finer grids cut the same edges
      float eu = 1.0 / 417.0, ev = 1.0 / 235.0;
      float g = max(abs(dAt(mT + vec2(eu, 0.0)) - dAt(mT - vec2(eu, 0.0))), abs(dAt(mT + vec2(0.0, ev)) - dAt(mT - vec2(0.0, ev))));
      if (g > uEdge) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vQ = vec2(2.0); vCol = vec3(0.0); return; }
    }
    #endif
    vec3 tx = liftTop(mT + vec2(du, 0.0)) - liftTop(mT - vec2(du, 0.0));
    vec3 ty = liftTop(mT - vec2(0.0, dv)) - liftTop(mT + vec2(0.0, dv));
    vec3 n = normalize(cross(tx, ty));
    // Tilt fade: a smooth depth ramp (motion-blurred thin object) shows up as a surfel
    // turned almost edge-on to the original camera. Drop it when n.z < uTilt.
    #ifndef BG_LAYER
    if (uTilt > 0.0 && n.z < uTilt) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vQ = vec2(2.0); vCol = vec3(0.0); return; }
    #endif
    n = normalize(mix(n, vec3(0.0, 0.0, 1.0), uFlatten));
    vec3 t1 = normalize(tx - n * dot(tx, n)); vec3 t2 = cross(n, t1);
    float s = (uD - p.z) / uD;
    float cellW = 2.0 * uAspect / uCols;
    #ifdef BG_LAYER
    float bgS = uBgScale;
    #else
    float bgS = 1.0;
    #endif
    float r = 0.5 * cellW * uSurfScale * bgS * s * (uK > 1.0 ? 0.8 : 1.0) * mix(0.85, 1.15, j);
    p = turb(p, aIdx);
    vec3 wp = p + (position.x * t1 + position.y * t2) * r;
    vec4 mv = modelViewMatrix * vec4(wp, 1.0);
    #ifdef DEPTH_PASS
    mv.xyz += normalize(mv.xyz) * uEps;
    #endif
    #ifdef BG_LAYER
    mv.xyz += normalize(mv.xyz) * uBgPush;
    #endif
    gl_Position = projectionMatrix * mv;
    vQ = position.xy;
    #ifdef BG_LAYER
    vCol = texture(uColorBg, clamp(mT, 0.0, 1.0)).rgb;
    #else
    vCol = videoColor(mT);
    #endif
  }`;

// (ii) Surfels, EWA-style: pass 1 depth only (pushed back by eps), pass 2
// accumulate weighted color of every surfel within eps of the front surface,
// pass 3 normalize. Order independent, no sort.
const depthMat = new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3, uniforms: U, defines: { DEPTH_PASS: 1 }, colorWrite: false,
  depthTest: true, depthWrite: true, vertexShader: SURF_VS,
  fragmentShader: `precision highp float; out vec4 outColor; in vec2 vQ; in vec3 vCol;
    void main() { if (dot(vQ, vQ) > 1.0) discard; outColor = vec4(0.0); }`,
});
const accMat = new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3, uniforms: U, transparent: true, depthTest: true, depthWrite: false,
  depthFunc: THREE.LessEqualDepth, blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
  vertexShader: SURF_VS,
  fragmentShader: `precision highp float; out vec4 outColor; in vec2 vQ; in vec3 vCol; uniform float uGauss;
    void main() { float r2 = dot(vQ, vQ); if (r2 > 1.0) discard; float w = exp(-r2 * uGauss);
      outColor = vec4(vCol * w, w); }`,
});
// Background layer for hole filling: the same surfels, drawn from a far-pushed
// "farthest nearby pixel" depth and color, so a disocclusion shows stretched
// background instead of black. Foreground wins wherever it exists (depth pass).
const bgDepthMat = depthMat.clone(); bgDepthMat.defines = { DEPTH_PASS: 1, BG_LAYER: 1 }; bgDepthMat.uniforms = U;
const bgAccMat = accMat.clone(); bgAccMat.defines = { BG_LAYER: 1 }; bgAccMat.uniforms = U;
// (iii) Sorted Gaussians: the same oriented quads, premultiplied over, drawn
// back to front in the order the worker computes.
const sortedMat = new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3, uniforms: U, transparent: true, depthTest: false, depthWrite: false,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  vertexShader: SURF_VS,
  fragmentShader: `precision highp float; out vec4 outColor; in vec2 vQ; in vec3 vCol; uniform float uSortGauss, uSortAlpha;
    void main() { float r2 = dot(vQ, vQ); if (r2 > 1.0) discard; float a = exp(-r2 * uSortGauss) * uSortAlpha;
      outColor = vec4(vCol * a, a); }`,
});
const compScene = new THREE.Scene(), orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
compScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3, uniforms: { uAcc: { value: rt.texture }, uCov: U.uCov }, depthTest: false, depthWrite: false,
  vertexShader: `out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `precision highp float; out vec4 outColor; uniform sampler2D uAcc; uniform float uCov; in vec2 vUv;
    void main() { vec4 a = texture(uAcc, vUv); vec3 c = a.rgb / max(a.a, 1e-5);
      float cov = clamp(a.a * uCov, 0.0, 1.0); outColor = vec4(c * cov, 1.0); }`,
})));

/* ═══════════ geometry ═══════════ */
const scene = new THREE.Scene();
let bgObj = null, bgOn = false;
let N = 0, pointsObj = null, surfObj = null, sortObj = null, sortAttr = null, psortObj = null, psortAttr = null;
const QUAD_POS = new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]);
function quadGeom(idx, dynamic) {
  const g = new THREE.InstancedBufferGeometry();
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.setAttribute('position', new THREE.BufferAttribute(QUAD_POS, 3));
  const a = new THREE.InstancedBufferAttribute(idx, 1);
  if (dynamic) a.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('aIdx', a); g.instanceCount = idx.length;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
  return g;
}
function build() {
  for (const o of [pointsObj, surfObj, sortObj, psortObj]) if (o) { scene.remove(o); o.geometry.dispose(); }
  N = COLS * ROWS * S.K; U.uK.value = S.K;
  const idx = new Float32Array(N); for (let i = 0; i < N; i++) idx[i] = i;
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(idx, 1));
  pg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
  pointsObj = new THREE.Points(pg, pointsMat);
  surfObj = new THREE.Mesh(quadGeom(idx, false), accMat);
  if (bgObj) scene.remove(bgObj);
  bgObj = new THREE.Mesh(surfObj.geometry, bgAccMat); bgObj.frustumCulled = false; bgObj.visible = false; scene.add(bgObj);
  sortObj = new THREE.Mesh(quadGeom(idx.slice(), true), sortedMat);
  sortAttr = sortObj.geometry.getAttribute('aIdx');
  // (iv) Today's points drawn back to front: the "keep the points, add depth" option.
  const psg = new THREE.BufferGeometry();
  psortAttr = new THREE.BufferAttribute(idx.slice(), 1); psortAttr.setUsage(THREE.DynamicDrawUsage);
  psg.setAttribute('position', psortAttr); psg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
  psortObj = new THREE.Points(psg, pointsMat);
  for (const o of [pointsObj, surfObj, sortObj, psortObj]) { o.frustumCulled = false; o.visible = false; scene.add(o); }
  lastSortKey = '';
}

/* ═══════════ sort worker ═══════════ */
const sortWorker = new Worker('sortworker.js');
let sortBusy = false, sortSeq = 0, lastSortKey = '';
const sortStats = [];
sortWorker.onmessage = (e) => {
  sortBusy = false;
  if (e.data.N !== N) return;               // stale after a rebuild
  if (S.prim === 'psorted') { psortAttr.array = e.data.order; psortAttr.needsUpdate = true; }
  else { sortAttr.array = e.data.order; sortAttr.needsUpdate = true; }
  sortStats.push(e.data.ms);
};
function maybeSort() {
  if (sortBusy || !disp) return;
  const p = camera.position;
  const key = `${S.prim}|${depthVersion}|${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}|${S.depthAmt}|${N}`;
  if (key === lastSortKey) return;
  lastSortKey = key; sortBusy = true;
  sortWorker.postMessage({ sort: true, seq: ++sortSeq, cols: COLS, rows: ROWS, K: S.K, aspect, D,
    depthAmt: S.depthAmt, cam: [p.x, p.y, p.z] });
}

/* ═══════════ camera + frame ═══════════ */
function placeCamera(t) {
  if (S.sweep) {
    S.yaw = S.yawMax * Math.sin(t * 2 * Math.PI * 0.2);
    S.pitch = S.pitchMax * Math.sin(t * 2 * Math.PI * 0.13);
  }
  const y = THREE.MathUtils.degToRad(S.yaw), p = THREE.MathUtils.degToRad(S.pitch);
  camera.position.set(D * Math.sin(y) * Math.cos(p), D * Math.sin(p), D * Math.cos(y) * Math.cos(p));
  camera.lookAt(0, 0, 0);
}
function renderFrame(t) {
  U.uTime.value = t; U.uDepthAmt.value = S.depthAmt;
  placeCamera(t);
  renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 1); renderer.clear();
  if (!depthTex) return;
  pointsObj.visible = S.prim === 'points';
  surfObj.visible = S.prim === 'surfels';
  bgObj.visible = S.prim === 'surfels' && bgOn;
  sortObj.visible = S.prim === 'sorted';
  psortObj.visible = S.prim === 'psorted';
  if (S.prim === 'surfels') {
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, false);
    surfObj.material = depthMat; bgObj.material = bgDepthMat; renderer.render(scene, camera);
    surfObj.material = accMat; bgObj.material = bgAccMat; renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.render(compScene, orthoCam);
  } else {
    if (S.prim === 'sorted' || S.prim === 'psorted') maybeSort();
    renderer.render(scene, camera);
  }
}

const frameTimes = []; let lastT = 0; const t0 = now();
function loop() {
  requestAnimationFrame(loop);
  const tn = now();
  if (lastT) { frameTimes.push(tn - lastT); if (frameTimes.length > 240) frameTimes.shift(); }
  lastT = tn;
  if (baked.active) applyBaked();
  else if (S.playing && session && !depthBusy && tn - lastDepthStart >= 1000 / S.hz) updateDepth(false);
  renderFrame((tn - t0) / 1000);
  if ((tn | 0) % 250 < 17) drawStats();
}
function drawStats() {
  const ft = frameTimes.slice(-120);
  document.getElementById('stats').textContent = [
    `${S.prim}  N=${(N / 1000).toFixed(0)}k  ${canvas.width}x${canvas.height}`,
    `fps ${r1(1000 / med(ft))}  frame p50 ${r1(med(ft))} p95 ${r1(pct(ft, 0.95))} ms`,
    `depth ${S.model} ${S.res}: infer ${r1(med(depthStats.inf.slice(-15)))} ms, pre ${r1(med(depthStats.pre.slice(-15)))} ms`,
    `sort ${r1(med(sortStats.slice(-15)))} ms   yaw ${r1(S.yaw)} pitch ${r1(S.pitch)}`,
    `flicker raw ${(med(depthStats.flickRaw.slice(-30)) * 100).toFixed(2)}%  shown ${(med(depthStats.flickShown.slice(-30)) * 100).toFixed(2)}%`,
  ].join('\n');
}

/* ═══════════ UI ═══════════ */
function syncUI() {
  document.querySelectorAll('#prims button').forEach(b => b.classList.toggle('on', b.dataset.prim === S.prim));
  for (const k of ['K', 'clip', 'model', 'res', 'depthAmt', 'ema', 'hz', 'surfScale', 'flatten'])
    document.getElementById(k).value = S[k];
  document.getElementById('play').classList.toggle('on', S.playing);
  document.getElementById('sweep').classList.toggle('on', S.sweep);
  document.getElementById('fill').classList.toggle('on', bgOn); document.getElementById('fill').textContent = bgOn ? 'Fill: on' : 'Fill: off';
  document.getElementById('edge').value = U.uEdge.value; document.getElementById('tilt').value = U.uTilt.value;
  document.querySelectorAll('#looks button').forEach(b => b.classList.toggle('on', b.dataset.look === curLook));
  syncOutputs();
  clearTimeout(syncUI._t); syncUI._t = setTimeout(() => { for (const k of ['depthAmt', 'ema', 'hz', 'surfScale', 'flatten']) document.getElementById(k).value = S[k]; }, 400);
}
const LOOK_DEFS = {
  blend:  () => { S.prim = 'surfels'; S.surfScale = 2.4; U.uGauss.value = 1.0; bgOn = true; computeBg(); },
  blobs:  () => { S.prim = 'sorted'; S.surfScale = 1.8; U.uSortGauss.value = 2.5; U.uSortAlpha.value = 1.0; bgOn = false; },
  dots:   () => { S.prim = 'sorted'; S.surfScale = 1.0; U.uSortGauss.value = 1.5; U.uSortAlpha.value = 1.0; bgOn = false; },
  points: () => { S.prim = 'points'; bgOn = false; },
};
let curLook = 'blend';
function setLook(name) { curLook = name; LOOK_DEFS[name](); U.uSurfScale.value = S.surfScale; lastSortKey = ''; syncUI(); }
function syncOutputs() {
  const src = { surfScale: S.surfScale, depthAmt: S.depthAmt, hz: S.hz, ema: S.ema, flatten: S.flatten, edge: U.uEdge.value, tilt: U.uTilt.value };
  document.querySelectorAll('[data-out]').forEach(o => { const v = src[o.dataset.out]; if (v !== undefined) o.textContent = (+v).toFixed(o.dataset.out === 'hz' ? 0 : 2); });
}
function bindUI() {
  document.querySelectorAll('#looks button').forEach(b => b.onclick = () => setLook(b.dataset.look));
  document.querySelectorAll('#prims button').forEach(b => b.onclick = () => { S.prim = b.dataset.prim; syncUI(); });
  document.getElementById('K').onchange = e => { S.K = +e.target.value; build(); };
  document.getElementById('grid').value = COLS;
  document.getElementById('grid').onchange = e => setGrid(+e.target.value);
  document.getElementById('clip').onchange = async e => { await loadClip(e.target.value); await updateDepth(true); syncUI(); };
  document.getElementById('model').onchange = async e => { log('loading', e.target.value); log('loaded in', r1(await loadModel(e.target.value)), 'ms'); await updateDepth(true); };
  document.getElementById('res').onchange = async e => { setRes(e.target.value); await updateDepth(true); };
  for (const k of ['depthAmt', 'ema', 'hz', 'surfScale', 'flatten'])
    document.getElementById(k).oninput = e => { S[k] = +e.target.value; U.uSurfScale.value = S.surfScale; U.uFlatten.value = S.flatten; syncOutputs(); };
  document.getElementById('bake').onclick = async () => {
    const b = document.getElementById('bake'); b.disabled = true; setRes('518x294');
    const r = await bakeStream(`media/${S.clip}-10s.mp4`, 2, (k) => { b.textContent = `Baking ${k}`; });
    b.textContent = `Baked ${r.frames}f in ${(r.bakeMs / 1000).toFixed(1)}s`; b.disabled = false; b.classList.add('on');
    document.getElementById('live').textContent = 'Depth: baked'; if (bgOn) computeBg();
    log('bake', JSON.stringify({ frames: r.frames, bakeMs: r.bakeMs, memMB: r.memMB }));
  };
  document.getElementById('savebake').onclick = async () => {
    if (!baked.frames) { log('nothing baked'); return; }
    await post(`${S.clip}-10s.pfd`, new Blob([encodeBake2()])); log('saved', `results/${S.clip}-10s.pfd`);
  };
  document.getElementById('loadbake').onclick = async () => {
    try {
      const src = await openClip(`media/${S.clip}-10s.mp4`);          // hash of the clip on screen
      const r = await loadBakeFrom(`results/${S.clip}-10s.pfd`, { expectSha: src.sha });
      document.getElementById('live').textContent = 'Depth: baked'; if (bgOn) computeBg(); log('bake loaded (source hash verified)', r.frames, 'frames');
    } catch (e) { log('LOAD FAILED:', e.message); }
  };
  document.getElementById('live').onclick = () => { baked.active = !baked.active && !!baked.frames; document.getElementById('live').textContent = baked.active ? 'Depth: baked' : 'Depth: live'; };
  document.getElementById('tilt').oninput = e => { U.uTilt.value = +e.target.value; syncOutputs(); };
  document.getElementById('edge').oninput = e => { U.uEdge.value = +e.target.value; syncOutputs(); };
  document.getElementById('fill').onclick = () => { bgOn = !bgOn; if (bgOn) computeBg(); syncUI(); };
  document.getElementById('reco').onclick = applyRecommended;
  document.getElementById('play').onclick = () => { S.playing = !S.playing; S.playing ? video.play() : video.pause(); syncUI(); };
  document.getElementById('sweep').onclick = () => { S.sweep = !S.sweep; syncUI(); };
  document.getElementById('flat').onclick = () => { S.depthAmt = S.depthAmt > 0 ? 0 : 0.8; syncUI(); };
  document.getElementById('front').onclick = () => { S.sweep = false; S.yaw = S.pitch = 0; syncUI(); };
  document.getElementById('ctrl-toggle').onclick = () => document.getElementById('controls').classList.toggle('closed');
  addEventListener('keydown', e => {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.key !== 'Escape') return;
    const k = e.key.toLowerCase();
    if (k === 'h' || k === 'escape') document.getElementById('controls').classList.toggle('closed');
    else if (k === ' ') { e.preventDefault(); document.getElementById('play').click(); }
    else if (k === 's') document.getElementById('sweep').click();
    else if (k === 'f') document.getElementById('front').click();
    else if ('1234'.includes(k) && k) setLook(['blend', 'blobs', 'dots', 'points'][+k - 1]);
  });
  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, yaw: S.yaw, pitch: S.pitch }; S.sweep = false; syncUI(); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    S.yaw = THREE.MathUtils.clamp(drag.yaw - (e.clientX - drag.x) * 0.1, -S.yawLim, S.yawLim);
    S.pitch = THREE.MathUtils.clamp(drag.pitch + (e.clientY - drag.y) * 0.1, -S.pitchLim, S.pitchLim);
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
}

/* ═══════════ bench ═══════════ */
async function post(name, body) {
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch(`result/${name}`, { method: 'POST', body }); if (r.ok) return; } catch (e) {}
    await sleep(300 * (i + 1));
  }
  console.warn('post failed', name);
}
// Synchronous cost of one frame: render, then force completion with a 1-pixel
// read. rAF is capped at the display rate, so this is what shows headroom.
function gpuFrameMs(n) {
  const gl = renderer.getContext(), px = new Uint8Array(4), ms = [];
  for (let i = 0; i < n; i++) {
    const a = now(); renderFrame((a - t0) / 1000);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    ms.push(now() - a);
  }
  return ms;
}
const nextFrame = () => new Promise(r => requestAnimationFrame(r));
async function shot(name) {
  await nextFrame();
  renderFrame((now() - t0) / 1000);
  const url = canvas.toDataURL('image/jpeg', 0.9);
  await post(name, await (await fetch(url)).blob());
}
async function progress(R, step) { R.step = step; log('bench:', step); await post('progress.json', JSON.stringify(R, null, 1)); }

const PARTS = (Q.get('parts') || 'infer,render,shots,video,rec').split(',');
const MODEL0 = S.model, RES0 = S.res;
async function playVideo() {
  // Safari can leave play() pending when the window is not visible; do not hang on it.
  await Promise.race([video.play().catch(() => {}), sleep(1500)]);
  if (video.paused) console.warn('video did not start (window hidden?)');
}
async function bench() {
  const R = { started: new Date().toISOString(), ua: navigator.userAgent, dpr: devicePixelRatio,
    canvas: [canvas.width, canvas.height], css: [innerWidth, innerHeight] };
  try {
    const ad = await navigator.gpu?.requestAdapter();
    R.adapter = ad ? { ...ad.info, features: [...ad.features].length } : null;
    R.webgl = renderer.getContext().getParameter(renderer.getContext().VERSION);

    // 1. Inference latency on a still frame.
    R.infer = [];
    for (const model of PARTS.includes('infer') ? ['q4f16', 'fp16'] : []) {
      await progress(R, `load ${model}`);
      const cold = await loadModel(model);
      for (const res of ['518x294', '924x518']) {
        setRes(res);
        const pr = [], inf = [];
        let first = null;
        for (let i = 0; i < 13; i++) {
          const r = await infer();
          if (i === 0) first = r.inf;
          if (i >= 3) { pr.push(r.pre); inf.push(r.inf); }
        }
        R.infer.push({ model, res, coldLoadMs: r1(cold), firstRunMs: r1(first), inferMed: r1(med(inf)),
          inferP90: r1(pct(inf, 0.9)), inferMin: r1(Math.min(...inf)), preMed: r1(med(pr)) });
        await progress(R, `infer ${model} ${res}`);
      }
    }
    await loadModel(MODEL0); setRes(RES0);
    await updateDepth(true);

    // 2. Render cost per primitive and density, with the orbit sweeping.
    R.render = [];
    S.sweep = true;
    if (Q.has('fill')) { bgOn = true; U.uEdge.value = 0.2; computeBg(); }
    for (const prim of PARTS.includes('render') ? ['points', 'psorted', 'surfels', 'sorted'] : []) {
      for (const K of [1, 4, 7]) {
        S.prim = prim; S.K = K; build(); syncUI();
        await sleep(1200);
        frameTimes.length = 0; sortStats.length = 0;
        await sleep(3000);
        const ft = frameTimes.slice();
        await nextFrame(); const g = gpuFrameMs(40);
        R.render.push({ prim, N, fps: r1(1000 / med(ft)), frameP50: r1(med(ft)), frameP95: r1(pct(ft, 0.95)),
          syncFrameMed: r1(med(g)), syncFrameP90: r1(pct(g, 0.9)),
          frames: ft.length, sortMed: /sorted/.test(prim) ? r1(med(sortStats)) : null,
          sortP95: /sorted/.test(prim) ? r1(pct(sortStats, 0.95)) : null, sorts: /sorted/.test(prim) ? sortStats.length : null });
        await progress(R, `render ${prim} K${K}`);
      }
    }

    // 3. Screenshots of each primitive at the front view and at the orbit limits.
    const views = [['front', 0, 0], ['yawP15', 15, 0], ['yawM15', -15, 4], ['yawP30', 30, 0]];
    const shotSet = [['points', 7], ['psorted', 7], ['surfels', 1], ['sorted', 1]];
    S.sweep = false;
    for (const clip of PARTS.includes('shots') ? ['default', 'luchi'] : []) {
      await loadClip(clip); await updateDepth(true);
      S.prim = 'points'; S.K = 7; build(); S.depthAmt = 0; S.yaw = 0; S.pitch = 0;
      await sleep(300); await shot(`${clip}_flat_points_today.jpg`);
      S.depthAmt = 0.8;
      for (const [prim, K] of shotSet) {
        S.prim = prim; S.K = K; build();
        for (const [vn, yw, pt] of views) {
          S.yaw = yw; S.pitch = pt;
          await sleep(/sorted/.test(prim) ? 400 : 150);
          await shot(`${clip}_${prim}_K${K}_${vn}.jpg`);
        }
      }
      await progress(R, `shots ${clip}`);
    }

    // 4. Video: live depth at 15 Hz, flicker without and with smoothing.
    await loadClip('default');
    S.prim = 'surfels'; S.K = 1; build(); S.sweep = true; bgOn = Q.has('fill'); U.uEdge.value = 0.2;
    R.video = [];
    for (const ema of PARTS.includes('video') ? [1.0, 0.5, 0.3] : []) {
      S.ema = ema;
      video.currentTime = 0; await updateDepth(true);
      for (const k in depthStats) depthStats[k].length = 0;
      frameTimes.length = 0;
      S.playing = true; await playVideo();
      await sleep(8000);
      S.playing = false; video.pause();
      await sleep(300);
      const st = depthStats.starts, hz = st.length > 1 ? (st.length - 1) / ((st[st.length - 1] - st[0]) / 1000) : 0;
      R.video.push({ ema, model: S.model, res: S.res, depthHz: r1(hz), inferMed: r1(med(depthStats.inf)), inferP90: r1(pct(depthStats.inf, 0.9)),
        preMed: r1(med(depthStats.pre)), postMed: r1(med(depthStats.post)),
        flickerRawPct: +(med(depthStats.flickRaw) * 100).toFixed(3), flickerShownPct: +(med(depthStats.flickShown) * 100).toFixed(3),
        renderFps: r1(1000 / med(frameTimes)) });
      await progress(R, `video ema ${ema}`);
    }

    // 4b. Bake on import: depth for every 2nd frame once, then baked playback.
    if (PARTS.includes('bake')) {
      await loadClip('default'); setRes('518x294');
      await progress(R, 'bake start');
      R.bake = await bake(2, (k, n) => { if (k % 25 === 0) log('bake', k, '/', n); });
      await progress(R, 'bake done');
      S.K = 1; S.sweep = false; S.yaw = -15; S.pitch = 4;
      R.bakedPlayback = [];
      for (const prim of ['surfels', 'psorted']) {
        S.prim = prim; S.K = prim === 'psorted' ? 7 : 1; build(); S.depthAmt = 0.8;
        video.currentTime = 0; S.playing = true; await playVideo(); await sleep(800);
        frameTimes.length = 0; sortStats.length = 0;
        await sleep(3000);
        const ft = frameTimes.slice(); await nextFrame(); const g = gpuFrameMs(40);
        R.bakedPlayback.push({ prim, N, fps: r1(1000 / med(ft)), frameP95: r1(pct(ft, 0.95)), syncFrameMed: r1(med(g)),
          syncFrameP90: r1(pct(g, 0.9)), sortMed: /sorted/.test(prim) ? r1(med(sortStats)) : null, sorts: /sorted/.test(prim) ? sortStats.length : null });
        S.playing = false; video.pause();
        for (const t of [2.0, 5.0, 8.0]) {
          await seekTo(t);
          await sleep(500); await shot(`bake_${prim}_t${t}.jpg`);
        }
        await progress(R, `baked ${prim}`);
      }
    }

    // 4c. Persist: bake, save the sidecar, drop the frames, reload from the file, compare, scrub.
    if (PARTS.includes('persist')) {
      await loadClip('default'); setRes('518x294');
      const b = await bake(2, () => {});
      const ref = baked.frames.map(f => f.slice());
      const bytes = encodeBake();
      await post('default-10s.pfd', new Blob([bytes]));
      baked.frames = null; baked.active = false;
      const L = await loadBakeFrom('results/default-10s.pfd');
      let maxErr = 0, sumErr = 0, cnt = 0;
      for (let k = 0; k < ref.length; k++) for (let i = 0; i < ref[k].length; i += 7) { const e = Math.abs(ref[k][i] - baked.frames[k][i]); if (e > maxErr) maxErr = e; sumErr += e; cnt++; }
      // Scrub: seek to 40 places (including the ends), apply, render, force completion.
      S.prim = 'surfels'; S.K = 1; build(); S.sweep = false; S.yaw = -15; S.pitch = 4;
      const times = [0, 0.02, 9.95, 9.99, ...Array.from({ length: 36 }, (_, i) => (i * 37 % 100) / 10)];
      const scrub = [], gl = renderer.getContext(), px = new Uint8Array(4); let bad = 0;
      for (const t of times) {
        const a = now();
        await seekTo(t);
        applyBaked(); renderFrame((now() - t0) / 1000); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        scrub.push(now() - a);
        for (let i = 0; i < disp.length; i += 997) if (!(disp[i] >= 0 && disp[i] <= 1)) bad++;
      }
      R.persist = { fileBytes: bytes.byteLength, fileMB: r1(bytes.byteLength / 1e6), bakeMs: b.bakeMs, load: L, maxAbsErr: +maxErr.toFixed(5),
        meanAbsErr: +(sumErr / cnt).toFixed(6), scrubMedMs: r1(med(scrub)), scrubP90Ms: r1(pct(scrub, 0.9)), scrubMaxMs: r1(Math.max(...scrub)), scrubs: scrub.length, badDepthSamples: bad };
      await progress(R, 'persist done');
      for (const t of [1.0, 6.5]) { await seekTo(t); await sleep(400); await shot(`persist_surfels_t${t}.jpg`); }
    }

    // 4d. Long bake: how often do depth artifacts (halos) appear? A frame every 2 s at yaw -15.
    if (PARTS.includes('longbake')) {
      R.longbake = [];
      for (const clip of (Q.get('clips') || 'luchi,default30').split(',')) {
        await loadClip(clip); setRes('518x294');
        await progress(R, `longbake ${clip} start`);
        const b = await bake(2, (k, n) => { if (k % 40 === 0) log('bake', clip, k, '/', n); });
        R.longbake.push({ clip, durationS: r1(video.duration), ...b });
        S.prim = 'surfels'; S.K = 1; build(); S.sweep = false; S.yaw = -15; S.pitch = 4; S.depthAmt = 0.8;
        for (let t = 1; t < video.duration - 0.5; t += 2) {
          await seekTo(t);
          await sleep(350); await shot(`long_${clip}_t${String(Math.round(t)).padStart(2, '0')}.jpg`);
        }
        await progress(R, `longbake ${clip} done`);
      }
    }

    // 4e. Deterministic bake: WebCodecs decode, timestamps, pixel alignment vs ffmpeg, then bake.
    if (PARTS.includes('decodebake')) {
      const clip = Q.get('clips') || 'default30';
      setRes('518x294');
      const D = {};
      D.hiddenAtStart = document.hidden;
      const dcd = await decodeClip(`media/${clip}-10s.mp4`, 2, (k, n) => { if (k % 300 === 0) log('decode', k, '/', n); });
      D.decode = dcd.stats;
      // Pixel alignment: for targets F, MAD between the decoded frame and ffmpeg frames F-2..F+2.
      const targets = [30, 270, 570, 810].filter(f => dcd.byIndex.has(f));
      const cA = document.createElement('canvas'); cA.width = inW; cA.height = inH; const xA = cA.getContext('2d', { willReadFrequently: true });
      D.alignment = [];
      for (const F of targets) {
        const mad = {};
        for (const d of [-2, -1, 0, 1, 2]) {
          const im = await loadImg(`${Q.get('dir') || 'frames'}/f_${String(F + d).padStart(4, '0')}.jpg`); xA.drawImage(im, 0, 0, inW, inH);
          const a = xA.getImageData(0, 0, inW, inH).data, b = dcd.byIndex.get(F).px; let sum = 0;
          for (let i = 0; i < a.length; i += 4) sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
          mad[d] = +(sum / (inW * inH * 3)).toFixed(3);
        }
        const best = Object.entries(mad).sort((x, y) => x[1] - y[1])[0][0];
        D.alignment.push({ F, mad, bestOffset: +best });
      }
      await progress({ ...R, decodeStage: D }, 'decode done');
      const b = await bake(2, (k, n) => { if (k % 50 === 0) log('bake', k, '/', n); }, dcd);
      D.bake = b; D.hiddenAtEnd = document.hidden;
      R.decodebake = D;
      await progress(R, 'decodebake done');
    }

    // 4f. Streaming bake vs in-memory bake, PFD2 round trip, hash check, timestamps.
    if (PARTS.includes('streambake')) {
      const url = `media/${Q.get('clips') || 'default30'}-10s.mp4`; setRes('518x294');
      const SB = {};
      const b1 = await bakeStream(url, 2, (k) => { if (k % 100 === 0) log('stream', k); });
      SB.stream = { ...b1 }; delete SB.stream.stale;
      const ref = baked.frames.map(f => f.slice()), refTs = baked.ts.slice(), meta1 = { ...baked.meta };
      const dcd = await decodeClip(url, 2);
      const b2 = await bake(2, null, dcd);
      let maxDiff = 0; for (let k = 0; k < ref.length; k++) for (let i = 0; i < ref[k].length; i += 3) maxDiff = Math.max(maxDiff, Math.abs(ref[k][i] - baked.frames[k][i]));   // in 8-bit levels
      SB.inMemory = { bakeMs: b2.bakeMs, frames: b2.frames, decodeMs: dcd.stats.decodeMs };
      SB.streamVsMemory = { frames: [ref.length, baked.frames.length], maxAbsDiff: +maxDiff.toFixed(6) };
      // PFD2 round trip
      baked.meta = meta1; baked.ts = refTs;
      const bytes = encodeBake2();
      await post(`stream-${Q.get('clips') || 'default30'}.pfd`, new Blob([bytes]));
      const clip = await openClip(url);
      baked.frames = null; baked.active = false;
      const L = await loadBakeFrom(`results/stream-${Q.get('clips') || 'default30'}.pfd`, { expectSha: clip.sha });
      let qmax = 0; for (let k = 0; k < ref.length; k++) for (let i = 0; i < ref[k].length; i += 3) qmax = Math.max(qmax, Math.abs(ref[k][i] - baked.frames[k][i]));   // 8-bit levels: 0 = byte-identical
      let rejected = false, rejMsg = ''; try { await loadBakeFrom(`results/stream-${Q.get('clips') || 'default30'}.pfd`, { expectSha: '0'.repeat(64) }); } catch (e) { rejected = true; rejMsg = String(e.message); }
      // timestamps: monotonic, spaced step frames apart
      const ts = baked.ts; let tsBad = 0; for (let k = 1; k < ts.length; k++) if (Math.abs((ts[k] - ts[k - 1]) * FPS / 1e6 - 2) > 0.05) tsBad++;
      SB.pfd2 = { fileMB: r1(bytes.byteLength / 1e6), load: { ...L, meta: undefined }, quantMaxErr: +qmax.toFixed(5), shaMatchLoaded: L.meta.sha256 === clip.sha, wrongHashRejected: rejected, rejectMsg: rejMsg, tsBad, firstTs: ts.slice(0, 3), meta: L.meta };
      R.streambake = SB;
      await progress(R, 'streambake done');
    }

    // 5. Recordings: 6 s of each primitive, video playing, orbit sweeping.
    R.recordings = [];
    S.ema = 0.5;
    for (const [prim, K] of PARTS.includes('rec') ? (Q.get('rec') ? Q.get('rec').split(',').map(x => { const [p, k] = x.split(':'); return [p, +k]; }) : [...shotSet, ['points_flat', 7]]) : []) {
      const flat = prim === 'points_flat';
      S.prim = flat ? 'points' : prim; S.K = K; build(); S.depthAmt = flat ? 0 : 0.8;
      video.currentTime = 0; await updateDepth(true);
      S.playing = true; await playVideo();
      const types = ['video/mp4', 'video/webm'];
      const mime = types.find(t => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(canvas.captureStream(30), { mimeType: mime, videoBitsPerSecond: 12e6 });
      const chunks = []; rec.ondataavailable = e => chunks.push(e.data);
      const done = new Promise(r => rec.onstop = r);
      rec.start(); await sleep(6000); rec.stop(); await Promise.race([done, sleep(8000)]);
      S.playing = false; video.pause();
      const ext = mime.includes('mp4') ? 'mp4' : 'webm';
      const name = `rec_${prim}_K${K}.${ext}`;
      await post(name, new Blob(chunks, { type: mime }));
      R.recordings.push(name);
      await progress(R, `rec ${prim}`);
    }
    S.depthAmt = 0.8;
    R.finished = new Date().toISOString();
  } catch (e) {
    R.error = String(e && e.stack || e);
  }
  await post(`bench_${PARTS.join('-')}.json`, JSON.stringify(R, null, 1));
  log('bench done');
}



/* ═══════════ color-guided depth snapping ═══════════ */
// Motion blur gives thin objects a smooth ramp of in-between depth (the "streaks"),
// which a gradient cutoff cannot see. Near any depth edge (local range > T), split the
// window into clearly-near and clearly-far pixels, and snap each pixel's depth to the
// group whose mean color it resembles more. d: normalized depth (0..1, 1 = near),
// rgb: RGBA bytes at the same w x h. Returns a new array.
function snapDepth(d, rgb, w, h, rad = 7, T = 0.08) {
  const out = new Float32Array(d);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = Math.max(0, x - rad), x1 = Math.min(w - 1, x + rad), y0 = Math.max(0, y - rad), y1 = Math.min(h - 1, y + rad);
    let lo = 1, hi = 0;
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) { const v = d[yy * w + xx]; if (v < lo) lo = v; if (v > hi) hi = v; }
    const range = hi - lo; if (range < T) continue;
    const nearT = hi - 0.25 * range, farT = lo + 0.25 * range;
    let nR = 0, nG = 0, nB = 0, nD = 0, nC = 0, fR = 0, fG = 0, fB = 0, fD = 0, fC = 0;
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
      const i = yy * w + xx, v = d[i];
      if (v >= nearT) { nR += rgb[4 * i]; nG += rgb[4 * i + 1]; nB += rgb[4 * i + 2]; nD += v; nC++; }
      else if (v <= farT) { fR += rgb[4 * i]; fG += rgb[4 * i + 1]; fB += rgb[4 * i + 2]; fD += v; fC++; }
    }
    if (!nC || !fC) continue;
    const i = y * w + x, r = rgb[4 * i], g = rgb[4 * i + 1], b = rgb[4 * i + 2];
    const dn = (r - nR / nC) ** 2 + (g - nG / nC) ** 2 + (b - nB / nC) ** 2;
    const df = (r - fR / fC) ** 2 + (g - fG / fC) ** 2 + (b - fB / fC) ** 2;
    out[i] = dn <= df ? nD / nC : fD / fC;
  }
  return out;
}
const rgbCanvas = document.createElement('canvas');
function rgbAt(img, w, h) {
  rgbCanvas.width = w; rgbCanvas.height = h;
  const c = rgbCanvas.getContext('2d', { willReadFrequently: true }); c.drawImage(img, 0, 0, w, h);
  return c.getImageData(0, 0, w, h).data;
}


// Per-pixel motion at depth resolution: |L(F)-L(F-1)| + |L(F+1)-L(F)| (luma, 0..510),
// then a max-filter of radius 2 so the mask covers the blur's soft edges.
function motionMask(prev, cur, next, w, h, dil = 2) {
  const L = (a, i) => 0.299 * a[4 * i] + 0.587 * a[4 * i + 1] + 0.114 * a[4 * i + 2];
  const m = new Float32Array(w * h), o = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { const c = L(cur, i); m[i] = Math.abs(c - L(prev, i)) + Math.abs(L(next, i) - c); }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0;
    for (let yy = Math.max(0, y - dil); yy <= Math.min(h - 1, y + dil); yy++) for (let xx = Math.max(0, x - dil); xx <= Math.min(w - 1, x + dil); xx++) v = Math.max(v, m[yy * w + xx]);
    o[y * w + x] = v;
  }
  return o;
}
let motionTex = null, bgDepthTex = null, bgColorTex = null, bgColorAvgTex = null, bgColorBlur2Tex = null;
// For each pixel, the depth and color of the farthest pixel (lowest normalized depth)
// within a (2R+1)^2 window. Min is separable, so two 1-D passes carrying the argmin.
function farthestLayer(d, rgb, w, h, R) {
  const idxH = new Int32Array(w * h), idx = new Int32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let best = y * w + x;
    for (let xx = Math.max(0, x - R); xx <= Math.min(w - 1, x + R); xx++) { const j = y * w + xx; if (d[j] < d[best]) best = j; }
    idxH[y * w + x] = best;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let best = idxH[y * w + x];
    for (let yy = Math.max(0, y - R); yy <= Math.min(h - 1, y + R); yy++) { const j = idxH[yy * w + x]; if (d[j] < d[best]) best = j; }
    idx[y * w + x] = best;
  }
  const bd = new Float32Array(w * h), bc = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { const j = idx[i]; bd[i] = d[j]; bc[4 * i] = rgb[4 * j]; bc[4 * i + 1] = rgb[4 * j + 1]; bc[4 * i + 2] = rgb[4 * j + 2]; bc[4 * i + 3] = 255; }
  return { bd, bc };
}

// Same layer at 1/f resolution (nearest subsample, window R/f), returned at the reduced size.
// The bg layer is soft and only ever sampled in UV space, so the smaller texture is a drop-in.
function farthestLayerFast(d, rgb, w, h, R, f = 2) {
  if (f <= 1) return { ...farthestLayer(d, rgb, w, h, R), w, h };
  const wd = Math.ceil(w / f), hd = Math.ceil(h / f), dd = new Float32Array(wd * hd), rd = new Uint8Array(wd * hd * 4);
  for (let y = 0; y < hd; y++) for (let x = 0; x < wd; x++) {
    const j = Math.min(h - 1, y * f) * w + Math.min(w - 1, x * f), i = y * wd + x;
    dd[i] = d[j]; rd[4 * i] = rgb[4 * j]; rd[4 * i + 1] = rgb[4 * j + 1]; rd[4 * i + 2] = rgb[4 * j + 2]; rd[4 * i + 3] = 255;
  }
  return { ...farthestLayer(dd, rd, wd, hd, Math.max(1, Math.round(R / f))), w: wd, h: hd };
}


// Box blur of an RGBA8 map (alpha untouched), separable, `passes` times: softens the fill's striping.
function blurRGBA(bc, w, h, r, passes = 2) {
  let a = bc, b = new Uint8Array(bc.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let R = 0, G = 0, B = 0, n = 0; for (let xx = Math.max(0, x - r); xx <= Math.min(w - 1, x + r); xx++) { const i = 4 * (y * w + xx); R += a[i]; G += a[i + 1]; B += a[i + 2]; n++; } const o = 4 * (y * w + x); b[o] = R / n; b[o + 1] = G / n; b[o + 2] = B / n; b[o + 3] = 255; }
    const c = new Uint8Array(bc.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let R = 0, G = 0, B = 0, n = 0; for (let yy = Math.max(0, y - r); yy <= Math.min(h - 1, y + r); yy++) { const i = 4 * (yy * w + x); R += b[i]; G += b[i + 1]; B += b[i + 2]; n++; } const o = 4 * (y * w + x); c[o] = R / n; c[o + 1] = G / n; c[o + 2] = B / n; c[o + 3] = 255; }
    a = c;
  }
  return a;
}

// Fill color v2: average the colors of every "far" pixel (within tol of the window's
// farthest depth) on a stride-4 grid inside the window, instead of copying the single
// farthest pixel (which is often sky or a white wall, so the fill looked washed out).
function avgFarColor(d, rgb, w, h, bd, R, stride = 4, tol = 0.05) {
  const bc = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, lim = bd[i] + tol; let r = 0, g = 0, b = 0, n = 0;
    for (let yy = Math.max(0, y - R); yy <= Math.min(h - 1, y + R); yy += stride)
      for (let xx = Math.max(0, x - R); xx <= Math.min(w - 1, x + R); xx += stride) {
        const j = yy * w + xx; if (d[j] <= lim) { r += rgb[4 * j]; g += rgb[4 * j + 1]; b += rgb[4 * j + 2]; n++; }
      }
    if (!n) { r = rgb[4 * i]; g = rgb[4 * i + 1]; b = rgb[4 * i + 2]; n = 1; }
    bc[4 * i] = r / n; bc[4 * i + 1] = g / n; bc[4 * i + 2] = b / n; bc[4 * i + 3] = 255;
  }
  return bc;
}

/* ═══════════ matched-frame test ═══════════ */
// Frames come from ffmpeg (frames/f_NNNN.jpg), so color and depth are provably the
// same decoded image. Depth is raw (one fixed range for the whole set, no smoothing,
// no turbulence). Each target renders six ways; the artifact's behaviour across them
// says whether it comes from the model, the temporal filter, or color/depth sync.
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
async function matchedTest() {
  const targets = (Q.get('targets') || '30,210,270,330,450,570,690,810').split(',').map(Number);
  const need = new Set();
  for (const F of targets) for (const d of [-4, -2, -1, 0, 1, 2, 4]) need.add(F + d);
  const imgs = new Map(), raw = new Map(), infs = [];
  setRes('518x294');
  for (const f of [...need].sort((a, b) => a - b)) imgs.set(f, await loadImg(`${Q.get('dir') || 'frames'}/f_${String(f).padStart(4, '0')}.jpg`));
  for (const F of targets) for (const f of [F - 2, F, F + 2]) {
    if (raw.has(f)) continue;
    const r = await infer(imgs.get(f)); raw.set(f, new Float32Array(r.data)); infs.push(r.inf); dW = r.w; dH = r.h;
  }
  const pool = []; for (const a of raw.values()) for (let i = 0; i < a.length; i += 31) pool.push(a[i]);
  pool.sort((x, y) => x - y);
  const lo = pool[Math.floor(pool.length * 0.02)], hi = pool[Math.floor(pool.length * 0.98)], inv = 1 / (hi - lo);
  const norm = a => { const o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) o[i] = Math.min(1, Math.max(0, (a[i] - lo) * inv)); return o; };
  ensureDepthTex(); baked.active = false; S.playing = false; video.pause();
  S.prim = 'surfels'; S.K = 1; build(); S.sweep = false; S.yaw = -15; S.pitch = 4; S.depthAmt = 0.8; U.uTurb.value = 0;
  const texCache = new Map();
  const colorTex = f => { if (!texCache.has(f)) { const t = new THREE.Texture(imgs.get(f)); t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true; texCache.set(f, t); } return texCache.get(f); };
  const setDepth = a => { disp.set(a); depthTex.needsUpdate = true; depthVersion++; };
  const R = { targets, frames: need.size, inferMed: r1(med(infs)), range: [lo, hi], shots: [] };
  for (const F of targets) {
    const rawF = norm(raw.get(F)), m2 = norm(raw.get(F - 2)), p2 = norm(raw.get(F + 2));
    const smooth = new Float32Array(rawF.length); for (let i = 0; i < rawF.length; i++) smooth[i] = 0.25 * m2[i] + 0.5 * rawF[i] + 0.25 * p2[i];
    // Depth-edge share: fraction of depth-map pixels whose right/down neighbour differs by > 0.1.
    let edges = 0; for (let y = 0; y < dH - 1; y++) for (let x = 0; x < dW - 1; x++) { const i = y * dW + x; if (Math.abs(rawF[i] - rawF[i + 1]) > 0.1 || Math.abs(rawF[i] - rawF[i + dW]) > 0.1) edges++; }
    const edgeSweep = Q.get('edge') ? Q.get('edge').split(',').map(Number) : null;
    const snapSweep = Q.get('snap') ? Q.get('snap').split(',').map(Number) : null;
    if (snapSweep) {
      const rgb = rgbAt(imgs.get(F), dW, dH);
      R.snapMs = R.snapMs || {};
      var snapped = snapSweep.map(rad => { if (!rad) return [rad, rawF]; const a = now(); const o = snapDepth(rawF, rgb, dW, dH, rad); (R.snapMs[rad] = R.snapMs[rad] || []).push(r1(now() - a)); return [rad, o]; });
    }
    const tiltSweep = Q.get('tilt') ? Q.get('tilt').split(',').map(Number) : null;
    const motionSweep = Q.get('motion') ? Q.get('motion').split(',').map(Number) : null;
    const motionCull = {};
    if (motionSweep) {
      const mask = motionMask(rgbAt(imgs.get(F - 1), dW, dH), rgbAt(imgs.get(F), dW, dH), rgbAt(imgs.get(F + 1), dW, dH), dW, dH);
      if (motionTex) motionTex.dispose();
      motionTex = new THREE.DataTexture(mask, dW, dH, THREE.RedFormat, THREE.FloatType);
      motionTex.minFilter = motionTex.magFilter = THREE.NearestFilter; motionTex.needsUpdate = true; U.uMotion.value = motionTex;
      for (const t of motionSweep) if (t) { let c = 0; for (let i = 0; i < mask.length; i++) if (mask[i] > t) c++; motionCull[t] = +(c / mask.length * 100).toFixed(2); }
    }
    const holes = Q.has('holes');
    if (holes && (Q.get('holes') === '3' || Q.get('holes') === '4')) {
      const rgbF = rgbAt(imgs.get(F), dW, dH), f0 = farthestLayerFast(rawF, rgbF, dW, dH, 40, 2);
      const mk = (bc) => { const t = new THREE.DataTexture(bc, f0.w, f0.h, THREE.RGBAFormat, THREE.UnsignedByteType); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; };
      const td = new THREE.DataTexture(f0.bd, f0.w, f0.h, THREE.RedFormat, THREE.FloatType); td.minFilter = td.magFilter = THREE.NearestFilter; td.needsUpdate = true;
      U.uDepthBg.value = td; bgColorTex = mk(f0.bc); bgColorAvgTex = mk(blurRGBA(f0.bc, f0.w, f0.h, 3, 2));
      bgColorBlur2Tex = mk(blurRGBA(f0.bc, f0.w, f0.h, 6, 3));
    } else if (holes) {
      const t0h = now();
      const rgbF = rgbAt(imgs.get(F), dW, dH), Rw = +(Q.get('R') || 40);
      const { bd, bc } = farthestLayer(rawF, rgbF, dW, dH, Rw);
      (R.bgMs = R.bgMs || []).push(r1(now() - t0h));
      const t1h = now(); const bcAvg = avgFarColor(rawF, rgbF, dW, dH, bd, Rw);
      (R.avgColorMs = R.avgColorMs || []).push(r1(now() - t1h));
      if (bgColorAvgTex) bgColorAvgTex.dispose();
      bgColorAvgTex = new THREE.DataTexture(bcAvg, dW, dH, THREE.RGBAFormat, THREE.UnsignedByteType);
      bgColorAvgTex.minFilter = bgColorAvgTex.magFilter = THREE.NearestFilter; bgColorAvgTex.needsUpdate = true;
      if (bgDepthTex) bgDepthTex.dispose(); if (bgColorTex) bgColorTex.dispose();
      bgDepthTex = new THREE.DataTexture(bd, dW, dH, THREE.RedFormat, THREE.FloatType);
      bgColorTex = new THREE.DataTexture(bc, dW, dH, THREE.RGBAFormat, THREE.UnsignedByteType);
      for (const t of [bgDepthTex, bgColorTex]) { t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; }
      U.uDepthBg.value = bgDepthTex; U.uColorBg.value = bgColorTex;
    }
    const variants = holes
      ? (Q.get('holes') === '4'
        ? [['e1_edge010', rawF, 0, 0.10, 0, 0, -15, true, 'single'], ['e2_edge015', rawF, 0, 0.15, 0, 0, -15, true, 'single'],
           ['e3_edge020', rawF, 0, 0.20, 0, 0, -15, true, 'single'], ['e4_edge030', rawF, 0, 0.30, 0, 0, -15, true, 'single']]
        : Q.get('holes') === '3'
        ? [['h1_holes_15', rawF, 0, 0.1, 0, 0, -15, false], ['h7_now_15', rawF, 0, 0.1, 0, 0, -15, true, 'single'],
           ['h8_blur_15', rawF, 0, 0.1, 0, 0, -15, true, 'avg'], ['h9_blur2_15', rawF, 0, 0.1, 0, 0, -15, true, 'blur2']]
        : Q.get('holes') === '2'
        ? [['h1_holes_15', rawF, 0, 0.1, 0, 0, -15, false], ['h3_fill_15', rawF, 0, 0.1, 0, 0, -15, true, 'single'],
           ['h5_fillavg_15', rawF, 0, 0.1, 0, 0, -15, true, 'avg'], ['h6_fillavg_25', rawF, 0, 0.1, 0, 0, -25, true, 'avg']]
        : [['h1_holes_15', rawF, 0, 0.1, 0, 0, -15, false], ['h2_holes_7', rawF, 0, 0.1, 0, 0, -7.5, false],
           ['h3_fill_15', rawF, 0, 0.1, 0, 0, -15, true], ['h4_fill_25', rawF, 0, 0.1, 0, 0, -25, true]])
      : motionSweep
      ? motionSweep.map(t => [`motion_${t}`, rawF, 0, 0.1, 0, t])
      : tiltSweep
      ? tiltSweep.map(t => [`tilt_${String(t).replace('.', '')}`, rawF, 0, 0.1, t])
      : snapSweep
      ? snapped.map(([rad, dep]) => [`snap_r${rad}`, dep, 0, 0.1])
      : edgeSweep
      ? edgeSweep.map(e => [`edge_${String(e).replace('.', '')}`, rawF, 0, e])
      : [['a_matched_raw', rawF, 0, 0], ['b_matched_smoothed', smooth, 0, 0], ['c_color+1', rawF, 1, 0], ['d_color+2', rawF, 2, 0], ['e_color+4', rawF, 4, 0], ['f_color-2', rawF, -2, 0]];
    for (const [name, depth, off, edge, tilt = 0, mot = 0, yaw = -15, bg = false, cmode = 'single'] of variants) {
      if (holes) U.uColorBg.value = cmode === 'blur2' ? bgColorBlur2Tex : cmode === 'avg' ? bgColorAvgTex : bgColorTex;
      U.uEdge.value = edge; U.uTilt.value = tilt; U.uMotionT.value = mot; S.yaw = yaw; S.pitch = yaw ? 4 * Math.sign(-yaw) * Math.min(1, Math.abs(yaw) / 15) : 0; bgOn = bg;
      setDepth(depth); U.uVideo.value = colorTex(F + off);
      await sleep(120);
      await shot(`m_F${String(F).padStart(4, '0')}_${name.replace('+', 'p').replace('-', 'm')}.jpg`);
      if (holes) { await nextFrame(); const g = gpuFrameMs(20); ((R.syncMs = R.syncMs || {})[name] = R.syncMs[name] || []).push(r1(med(g))); }
    }
    const cull = {};
    for (const e of (edgeSweep || [])) { if (!e) continue; let c = 0;
      const d = (u, v) => rawF[Math.min(dH - 1, Math.max(0, Math.floor(v * dH))) * dW + Math.min(dW - 1, Math.max(0, Math.floor(u * dW)))];
      for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) { const u = (q + 0.5) / COLS, v = (r + 0.5) / ROWS;
        const g = Math.max(Math.abs(d(u + 1 / COLS, v) - d(u - 1 / COLS, v)), Math.abs(d(u, v + 1 / ROWS) - d(u, v - 1 / ROWS))); if (g > e) c++; }
      cull[e] = +(c / (COLS * ROWS) * 100).toFixed(2); }
    const tiltCull = {};
    for (const t of (tiltSweep || [])) { if (!t) continue; let c = 0;
      const d = (u, v) => rawF[Math.min(dH - 1, Math.max(0, Math.floor(v * dH))) * dW + Math.min(dW - 1, Math.max(0, Math.floor(u * dW)))];
      const L = (u, v) => { const z = S.depthAmt * (d(u, v) - 0.5) * 2, s2 = (D - z) / D; return [(u * 2 - 1) * aspect * s2, (1 - v * 2) * s2, z]; };
      for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) { const u = (q + 0.5) / COLS, v = (r + 0.5) / ROWS;
        const a = L(u + 1 / COLS, v), b = L(u - 1 / COLS, v), e = L(u, v - 1 / ROWS), f = L(u, v + 1 / ROWS);
        const tx = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], ty = [e[0] - f[0], e[1] - f[1], e[2] - f[2]];
        const n = [tx[1] * ty[2] - tx[2] * ty[1], tx[2] * ty[0] - tx[0] * ty[2], tx[0] * ty[1] - tx[1] * ty[0]];
        if (n[2] / Math.hypot(...n) < t) c++; }
      tiltCull[t] = +(c / (COLS * ROWS) * 100).toFixed(2); }
    R.shots.push({ F, motionPixelPct: motionCull, tiltCulledPct: tiltCull, culledPct: cull, edgePct: +(edges / ((dW - 1) * (dH - 1)) * 100).toFixed(2) });
    await progress(R, `matched F${F}`);
  }
  U.uVideo.value = vtex; U.uTurb.value = 1; U.uEdge.value = 0.1; U.uTilt.value = 0; U.uMotionT.value = 0; bgOn = false;
  await post('matched.json', JSON.stringify(R, null, 1));
  log('matched done');
}



// Background fill for the interactive page: recompute the farthest-nearby layer from the
// current depth and the current video frame (about 25 ms CPU; live depth rate drops a bit).
function computeBg() {
  if (!disp || !depthTex) return;
  let rgb; try { rgb = rgbAt(video, dW, dH); } catch (e) { return; }
  const { bd, bc, w: bw, h: bh } = farthestLayerFast(disp, rgb, dW, dH, 40, S.bgDown);
  if (bgDepthTex) bgDepthTex.dispose(); if (bgColorTex) bgColorTex.dispose();
  bgDepthTex = new THREE.DataTexture(bd, bw, bh, THREE.RedFormat, THREE.FloatType);
  bgColorTex = new THREE.DataTexture(bc, bw, bh, THREE.RGBAFormat, THREE.UnsignedByteType);
  for (const t of [bgDepthTex, bgColorTex]) { t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; }
  U.uDepthBg.value = bgDepthTex; U.uColorBg.value = bgColorTex;
}
// The look shown in look_v1.mp4: surfels, edge cutoff 0.10, background fill, orbit within +-15 / +-6.
function applyRecommended() {
  S.prim = 'surfels'; S.K = 1; build(); S.depthAmt = 0.8; S.yawMax = 15; S.pitchMax = 6; S.yawLim = 15; S.pitchLim = 6; S.sweep = true;
  U.uEdge.value = 0.2; U.uTilt.value = 0; U.uMotionT.value = 0; bgOn = true; computeBg(); syncUI();
}


/* ═══════════ objective eval harness ═══════════ */
// Scores renderer settings without eyeballing. Render size is forced to 1280x720 (the source
// size) and the camera to 16:9, so the front view (yaw 0) lines up pixel for pixel with the
// source frame. Metrics per config, averaged over the target frames:
//   madFront   mean abs RGB difference to the source at yaw 0 (fidelity; lower is better)
//   psnrFront  the same as PSNR
//   hole15     share of pure-black pixels (r+g+b < 15) at yaw +-15 (hole area)
//   dark15     share of dark pixels (r+g+b < 60) at yaw +-15 (holes + dark seam dots)
async function evalSweep() {
  const targets = (Q.get('targets') || '30,270,570,690,810').split(',').map(Number);
  setRes('518x294');
  const W = 1280, H = 720, gl = renderer.getContext();
  const raw = new Map(), imgs = new Map();
  for (const F of targets) { imgs.set(F, await loadImg(`${Q.get('dir') || 'frames'}/f_${String(F).padStart(4, '0')}.jpg`)); const r = await infer(imgs.get(F)); raw.set(F, new Float32Array(r.data)); dW = r.w; dH = r.h; }
  const pool = []; for (const a of raw.values()) for (let i = 0; i < a.length; i += 31) pool.push(a[i]);
  pool.sort((x, y) => x - y);
  const lo = pool[Math.floor(pool.length * 0.02)], hi = pool[Math.floor(pool.length * 0.98)], inv = 1 / (hi - lo);
  ensureDepthTex(); baked.active = false; S.playing = false; video.pause();
  renderer.setPixelRatio(1); renderer.setSize(W, H, false); camera.aspect = W / H; camera.zoom = 1; camera.updateProjectionMatrix(); rt.setSize(W, H); U.uPR.value = 1;
  S.prim = 'surfels'; S.K = 1; build(); S.sweep = false; S.depthAmt = 0.8; U.uTurb.value = 0; U.uTilt.value = 0; U.uMotionT.value = 0;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d', { willReadFrequently: true });
  const src = new Map(), depths = new Map(), bgs = new Map(), bgMs = {};
  const tex = new THREE.Texture(); tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; U.uVideo.value = tex;
  for (const F of targets) {
    cx.drawImage(imgs.get(F), 0, 0, W, H); src.set(F, cx.getImageData(0, 0, W, H).data);
    const nd = new Float32Array(raw.get(F).length); for (let k = 0; k < nd.length; k++) nd[k] = Math.min(1, Math.max(0, (raw.get(F)[k] - lo) * inv));
    depths.set(F, nd);
    const rgbF = rgbAt(imgs.get(F), dW, dH);
    for (const f of [1, 2, 4]) {
      const ta = now(), { bd, bc, w: bw, h: bh } = farthestLayerFast(nd, rgbF, dW, dH, +(Q.get('R') || 40), f);
      (bgMs[f] = bgMs[f] || []).push(r1(now() - ta));
      const t1 = new THREE.DataTexture(bd, bw, bh, THREE.RedFormat, THREE.FloatType), t2 = new THREE.DataTexture(bc, bw, bh, THREE.RGBAFormat, THREE.UnsignedByteType);
      for (const t of [t1, t2]) { t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; }
      bgs.set(`${F}|${f}`, [t1, t2]);
    }
  }
  const buf = new Uint8Array(W * H * 4);
  const grab = () => { renderFrame(0); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf); };
  const base = { edge: 0.1, fill: 1, surf: 2.4, gauss: 2.5, push: 0.1, flat: 0.5 };
  const apply = c => { U.uEdge.value = c.edge; bgOn = !!c.fill; U.uSurfScale.value = c.surf; U.uGauss.value = c.gauss; U.uBgPush.value = c.push; U.uFlatten.value = c.flat; U.uBgScale.value = c.bgScale ?? 1; U.uCov.value = c.cov ?? 3; };
  const scoreOne = async c => {
    apply(c); let mad = 0, sq = 0, hole = 0, dark = 0, dotsAcc = 0, seamAcc = 0, nH = 0;
    for (const F of targets) {
      tex.image = imgs.get(F); tex.needsUpdate = true; disp.set(depths.get(F)); depthTex.needsUpdate = true; depthVersion++;
      const bt = bgs.get(`${F}|${c.down ?? 1}`); U.uDepthBg.value = bt[0]; U.uColorBg.value = bt[1];
      S.yaw = 0; S.pitch = 0; grab();
      const a = src.get(F); let m = 0, q = 0;
      for (let y = 0; y < H; y++) { const ro = (H - 1 - y) * W * 4, so = y * W * 4;
        for (let x = 0; x < W; x++) { const i = so + 4 * x, j = ro + 4 * x;
          const d = Math.abs(buf[j] - a[i]) + Math.abs(buf[j + 1] - a[i + 1]) + Math.abs(buf[j + 2] - a[i + 2]); m += d; q += d * d / 3; } }
      mad += m / (W * H * 3); sq += q / (W * H * 3);
      for (const [yw, pt] of [[15, -4], [-15, 4]]) {
        S.yaw = yw; S.pitch = pt; grab(); let h = 0, d2 = 0, dots = 0, seam = 0;
        const x0 = Math.floor(W * 0.15), x1 = Math.floor(W * 0.85), y0 = Math.floor(H * 0.12), y1 = Math.floor(H * 0.88), area = (x1 - x0) * (y1 - y0);
        const isDark = (x, y) => { const i = 4 * (y * W + x); return buf[i] + buf[i + 1] + buf[i + 2] < 60; };
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
          const i = 4 * (y * W + x), sm = buf[i] + buf[i + 1] + buf[i + 2];
          if (sm < 15) h++;
          if (sm >= 15 && y > y0 + 2 && y < y1 - 2 && x > x0 + 2 && x < x1 - 2) {          // luma drop vs the 5x5 neighbourhood median
            const L = (yy, xx) => { const k = 4 * (yy * W + xx); return 0.299 * buf[k] + 0.587 * buf[k + 1] + 0.114 * buf[k + 2]; };
            const nb = []; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) nb.push(L(y + dy, x + dx));
            nb.sort((a, b) => a - b); if (L(y, x) < 0.6 * nb[12] && nb[12] > 40) seam++;
          }
          if (sm < 60) { d2++; let bright = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && !isDark(x + dx, y + dy)) bright++; if (bright >= 5) dots++; }
        }
        hole += h / area; dark += d2 / area; dotsAcc += dots / area; seamAcc += seam / area; nH++;
      }
    }
    const n = targets.length; const mse = sq / n;
    return { ...c, madFront: +(mad / n).toFixed(3), psnrFront: +(10 * Math.log10(255 * 255 / Math.max(1e-9, mse))).toFixed(2), hole15: +(hole / nH * 100).toFixed(3), dark15: +(dark / nH * 100).toFixed(3), dots15: +(dotsAcc / nH * 100).toFixed(4), seam15: +(seamAcc / nH * 100).toFixed(4) };
  };
  const cfgs = (Q.get('cfgfile') ? await (await fetch(Q.get('cfgfile') + '?t=' + Date.now())).json() : null) || (() => {
    const L = [base, { ...base, fill: 0 }];
    for (const e of [0, 0.05, 0.08, 0.15, 0.2, 0.3]) L.push({ ...base, edge: e }, { ...base, edge: e, fill: 0 });
    for (const v of [1.6, 2.0, 3.0, 3.6]) L.push({ ...base, surf: v });
    for (const v of [1, 4, 6]) L.push({ ...base, gauss: v });
    for (const v of [0.01, 0.03, 0.3]) L.push({ ...base, push: v });
    for (const v of [0, 0.25, 0.75, 1]) L.push({ ...base, flat: v });
    return L;
  })();
  const out = [];
  for (const c of cfgs) { out.push(await scoreOne(c)); if (out.length % 6 === 0) { log('eval', out.length, '/', cfgs.length); await post('eval_partial.json', JSON.stringify(out)); } }
  await post(`eval_${Q.get('tag') || 'sweep'}.json`, JSON.stringify({ targets, out, bgMs: Object.fromEntries(Object.entries(bgMs).map(([k, v]) => [k, r1(med(v))])) }, null, 1));
  U.uVideo.value = vtex; U.uTurb.value = 1; bgOn = false; resize();
  log('eval done');
}

/* ═══════════ look render ═══════════ */
// Deterministic render of the recommended config, frame by frame: per-frame raw depth
// (no temporal smoothing) normalized over the whole excerpt, surfels, edge cutoff 0.10,
// background fill, gentle orbit. Frames are POSTed as rf_NNNN.jpg for ffmpeg to assemble.
async function renderLook() {
  const n = +(Q.get('n') || 300), start = +(Q.get('start') || 150), maxYaw = +(Q.get('yaw') || 15);
  setRes('518x294');
  const pad = f => String(f).padStart(4, '0'), raws = [], t0 = now();
  for (let i = 0; i < n; i++) {
    const r = await infer(await loadImg(`${Q.get('dir') || 'frames'}/f_${pad(start + i)}.jpg`));
    raws.push(new Float32Array(r.data)); dW = r.w; dH = r.h;
    if (i % 50 === 0) log('depth', i, '/', n);
  }
  const depthMs = now() - t0;
  const pool = []; for (const a of raws) for (let i = 0; i < a.length; i += 61) pool.push(a[i]);
  pool.sort((x, y) => x - y);
  const lo = pool[Math.floor(pool.length * 0.02)], hi = pool[Math.floor(pool.length * 0.98)], inv = 1 / (hi - lo);
  ensureDepthTex(); baked.active = false; S.playing = false; video.pause();
  S.prim = 'surfels'; S.K = 1; build(); S.sweep = false; S.depthAmt = 0.8; U.uTurb.value = 0; U.uEdge.value = 0.2; U.uTilt.value = 0; U.uMotionT.value = 0; bgOn = true;
  const tex = new THREE.Texture(); tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; U.uVideo.value = tex;
  const t1 = now();
  for (let i = 0; i < n; i++) {
    const im = await loadImg(`${Q.get('dir') || 'frames'}/f_${pad(start + i)}.jpg`);
    tex.image = im; tex.needsUpdate = true;
    const nd = new Float32Array(raws[i].length); for (let k = 0; k < nd.length; k++) nd[k] = Math.min(1, Math.max(0, (raws[i][k] - lo) * inv));
    disp.set(nd); depthTex.needsUpdate = true; depthVersion++;
    const { bd, bc, w: bw, h: bh } = farthestLayerFast(nd, rgbAt(im, dW, dH), dW, dH, 40, S.bgDown);
    if (bgDepthTex) bgDepthTex.dispose(); if (bgColorTex) bgColorTex.dispose();
    bgDepthTex = new THREE.DataTexture(bd, bw, bh, THREE.RedFormat, THREE.FloatType);
    bgColorTex = new THREE.DataTexture(bc, bw, bh, THREE.RGBAFormat, THREE.UnsignedByteType);
    for (const t of [bgDepthTex, bgColorTex]) { t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; }
    U.uDepthBg.value = bgDepthTex; U.uColorBg.value = bgColorTex;
    S.yaw = maxYaw * Math.sin(2 * Math.PI * i / 180); S.pitch = 5 * Math.sin(2 * Math.PI * i / 240);
    await shot(`rf_${pad(i)}.jpg`);
    if (i % 50 === 0) log('render', i, '/', n);
  }
  bgOn = false; U.uVideo.value = vtex; U.uTurb.value = 1;
  await post('render.json', JSON.stringify({ start, n, maxYaw, depthMs: r1(depthMs), renderMs: r1(now() - t1), range: [lo, hi], canvas: [canvas.width, canvas.height] }));
  log('render done');
}

// Look gallery: the same frame rendered at several grid densities and splat styles,
// so the "which splat look" question can be judged from one contact sheet.
async function gallery() {
  const frames = (Q.get('frames') || '270').split(',').map(Number), yaw = +(Q.get('yaw') || 10);
  const grids = (Q.get('grids') || '417,208,139,104').split(',').map(Number);
  const LOOKS = {
    blend: () => { S.prim = 'surfels'; U.uSurfScale.value = 2.4; U.uGauss.value = 1.0; bgOn = true; },
    blobs: () => { S.prim = 'sorted'; U.uSurfScale.value = 1.8; U.uSortGauss.value = 2.5; U.uSortAlpha.value = 1.0; bgOn = false; },
    dots:  () => { S.prim = 'sorted'; U.uSurfScale.value = 1.0; U.uSortGauss.value = 1.5; U.uSortAlpha.value = 1.0; bgOn = false; },
  };
  const looks = (Q.get('looks') || 'blend,blobs,dots').split(',');
  setRes('518x294');
  const W = +(Q.get('w') || 1280), H = Math.round(W * 9 / 16);
  renderer.setPixelRatio(1); renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); rt.setSize(W, H); U.uPR.value = 1;
  ensureDepthTex(); baked.active = false; S.playing = false; video.pause();
  S.K = 1; S.sweep = false; S.depthAmt = 0.8; U.uTurb.value = 0; U.uEdge.value = 0.2; U.uTilt.value = 0; U.uMotionT.value = 0;
  const tex = new THREE.Texture(); tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; U.uVideo.value = tex;
  const ms = {};
  for (const F of frames) {
    const im = await loadImg(`${Q.get('dir') || 'frames'}/f_${String(F).padStart(4, '0')}.jpg`);
    const r = await infer(im); dW = r.w; dH = r.h; const a = r.data;
    const tmp = Array.from(a.filter((_, i) => i % 7 === 0)).sort((x, y) => x - y);
    const lo = tmp[Math.floor(tmp.length * 0.02)], hi = tmp[Math.floor(tmp.length * 0.98)];
    const nd = new Float32Array(a.length); for (let k = 0; k < nd.length; k++) nd[k] = Math.min(1, Math.max(0, (a[k] - lo) / (hi - lo)));
    tex.image = im; tex.needsUpdate = true; disp.set(nd); depthTex.needsUpdate = true; depthVersion++;
    const { bd, bc, w: bw, h: bh } = farthestLayerFast(nd, rgbAt(im, dW, dH), dW, dH, 40, S.bgDown);
    if (bgDepthTex) bgDepthTex.dispose(); if (bgColorTex) bgColorTex.dispose();
    bgDepthTex = new THREE.DataTexture(bd, bw, bh, THREE.RedFormat, THREE.FloatType);
    bgColorTex = new THREE.DataTexture(bc, bw, bh, THREE.RGBAFormat, THREE.UnsignedByteType);
    for (const t of [bgDepthTex, bgColorTex]) { t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; }
    U.uDepthBg.value = bgDepthTex; U.uColorBg.value = bgColorTex;
    for (const g of grids) {
      COLS = g; ROWS = GRIDS[g] || Math.round(g * 235 / 417); U.uCols.value = COLS; U.uRows.value = ROWS; build();
      for (const L of looks) {
        LOOKS[L](); S.yaw = yaw; S.pitch = 3;
        if (S.prim === 'sorted') { lastSortKey = ''; renderFrame(0); for (let i = 0; i < 200 && sortBusy; i++) await sleep(10); renderFrame(0); for (let i = 0; i < 200 && sortBusy; i++) await sleep(10); }
        if (Q.has('time') && L === looks[0]) { LOOKS[L](); const t = gpuFrameMs(20); ms[g] = r1(med(t.slice(5))); }
        await shot(`gal_f${F}_${L}_${g}.jpg`);
      }
    }
  }
  await post('gallery.json', JSON.stringify({ frames, grids, looks, yaw, canvas: [canvas.width, canvas.height], syncFrameMs: ms }));
  log('gallery done');
}

window.__pf = { S, U, renderer, rt, get N() { return N; } };

/* ═══════════ boot ═══════════ */
(async () => {
  try {
    addEventListener('resize', resize);
    bindUI(); syncUI();
    await loadClip(S.clip);
    build();
    loop();
    log('loading model', S.model, '...');
    const ms = await loadModel(S.model); setRes(S.res);
    log('model loaded in', r1(ms), 'ms');
    await updateDepth(true);
    log('ready');
    if (INTERACTIVE) applyRecommended();
    if (INTERACTIVE && Q.has('autoload')) {
      document.getElementById('loadbake').click(); await sleep(1500);
      S.sweep = false; S.yaw = +(Q.get('yaw') || 8); S.pitch = +(Q.get('pitch') || 3);
      for (const t of [1.0, 4.0, 7.0]) { await seekTo(t); await sleep(700); await shot(`auto_t${t}.jpg`); }
      log('autoload done: ' + document.getElementById('log').textContent);
      await post('autoload.json', JSON.stringify({ log: document.getElementById('log').textContent, live: document.getElementById('live').textContent, baked: baked.n, dbg: { surfScale: S.surfScale, uSurf: U.uSurfScale.value, sliderSurf: document.getElementById('surfScale').value, sliderDepth: document.getElementById('depthAmt').value, depthAmt: S.depthAmt, gauss: U.uGauss.value, cov: U.uCov.value, bgScale: U.uBgScale.value, cols: COLS, N, pr: renderer.getPixelRatio(), rt: [rt.width, rt.height], zoom: camera.zoom, look: curLook } }));
    }
    if (INTERACTIVE && Q.has('snap')) { S.sweep = false; S.yaw = +(Q.get('yaw') || 11); S.pitch = +(Q.get('pitch') || 4); await sleep(500); await shot('snap_' + Q.get('snap') + '.jpg'); log('snap done'); }
    if (BENCH) await bench();
    if (Q.has('matched')) await matchedTest();
    if (Q.has('render')) await renderLook();
    if (Q.has('eval')) await evalSweep();
    if (Q.has('gallery')) await gallery();
  } catch (e) {
    log('ERROR', e && e.message || e);
    try { await post('bench.json', JSON.stringify({ error: String(e && e.stack || e) })); } catch (_) {}
  }
})();
