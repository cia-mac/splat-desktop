import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

/* ═══════════════ TAURI API ═══════════════ */
const isTauri = !!window.__TAURI_INTERNALS__;
let invoke;
if (isTauri) {
  invoke = window.__TAURI_INTERNALS__.invoke;
}

/* ═══════════════ CONFIG ═══════════════ */
let COLS = 417, ROWS = 235, PER_CLUSTER = 7;
const CLUSTER_SPREAD = 4.0;
let SIZE_MIN = 1.7, SIZE_MAX = 5.4, SIZE_POW = 2.4;
let OPACITY = 0.55, BRIGHTNESS = 2.4;
let TURB_AMP = 2.0;
const TURB_SPEED = 0.5;
let MOUSE_RADIUS = 278, MOUSE_PUSH = 29;
const ATTRACT_STRENGTH = 30, SWIRL_STRENGTH = 25, SWIRL_INWARD = 6;
const RETURN_SPEED = 1.2, WAKE_RETURN = 0.35, WAKE_THRESHOLD = 3;
const SEED = 42;

/* ═══════════════ STATE ═══════════════ */
let vidW = 0, vidH = 0, videoName = 'ciafx';
let N = 0, geom, points, mat, videoTex;
let baseX, baseY, pos, uv, size, phaseX, phaseY, mOffX, mOffY;
let video, renderer, camera, scene, clock;
let running = false;

/* ═══════════════ SHADERS (GPU turbulence) ═══════════════ */
const VERT = `
  precision highp float;
  attribute vec2 aUV;
  attribute float aSize;
  attribute vec2 aPhase;
  attribute vec2 aMouseOff;

  uniform float uPixelRatio;
  uniform float uBrightness;
  uniform float uTime;
  uniform float uTurbAmp;
  uniform float uTurbSpeed;
  uniform float uVidH;

  varying vec2 vUV;
  varying float vBright;

  // Compact noise for turbulence
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i), b = hash(i + vec2(1,0));
    float c = hash(i + vec2(0,1)), d = hash(i + vec2(1,1));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vUV = aUV;
    vBright = uBrightness;

    vec3 p = position;

    // GPU turbulence (3 octaves)
    float dx = 0.0, dy = 0.0;
    for (int o = 0; o < 3; o++) {
      float freq = float(o + 1) * 0.7;
      float amp = uTurbAmp / float(o + 1);
      float tt = uTime * uTurbSpeed * float(o + 1);
      dx += amp * sin(freq * p.x * 0.01 + tt + aPhase.x);
      dy += amp * sin(freq * (uVidH - p.y) * 0.01 + tt * 1.3 + aPhase.y);
    }

    // Apply turbulence + mouse offset
    p.x += dx + aMouseOff.x;
    p.y += -dy - aMouseOff.y;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = aSize * uPixelRatio;
  }
`;

const FRAG = `
  precision mediump float;
  uniform sampler2D uVideo;
  uniform float uOpacity;
  uniform float uGaussExp;
  varying vec2 vUV;
  varying float vBright;

  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r2 = dot(d, d) * 4.0;
    float alpha = exp(-r2 * uGaussExp) * uOpacity;
    if (alpha < 0.005) discard;
    vec3 col = texture2D(uVideo, vUV).rgb;
    gl_FragColor = vec4(col * vBright * alpha, alpha);
  }
`;

/* ═══════════════ RNG ═══════════════ */
function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* Clean src param from URL if present */
if (new URLSearchParams(location.search).has('src'))
  history.replaceState(null, '', location.pathname);

/* ═══════════════ DOM REFS ═══════════════ */
const uploadOverlay = document.getElementById('upload-overlay');
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const ctrlToggle = document.getElementById('ctrl-toggle');
const ctrlPanel = document.getElementById('controls');

/* ═══════════════ CONTROLS TOGGLE ═══════════════ */
function togglePanel() {
  ctrlPanel.classList.toggle('closed');
  uploadOverlay.classList.toggle('panel-closed', ctrlPanel.classList.contains('closed'));
}
ctrlToggle.addEventListener('click', togglePanel);

/* ═══════════════ VIDEO UPLOAD ═══════════════ */
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('dragover'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
uploadArea.addEventListener('drop', e => {
  e.preventDefault(); uploadArea.classList.remove('dragover');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
document.body.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('dragover'); });
document.body.addEventListener('drop', e => {
  e.preventDefault(); uploadArea.classList.remove('dragover');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

function handleFile(file) {
  if (!file.type.startsWith('video/')) { alert('Not a video file'); return; }
  if (file.size > 500 * 1024 * 1024) {
    if (!confirm('This file is over 500 MB. Performance may suffer. Continue?')) return;
  }
  videoName = file.name.replace(/\.[^.]+$/, '') || 'ciafx';
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.src = url; v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
  v.crossOrigin = 'anonymous';
  v.addEventListener('loadedmetadata', () => {
    vidW = v.videoWidth; vidH = v.videoHeight;
    if (vidW > 3840 || vidH > 2160) {
      if (!confirm(`Video is ${vidW}x${vidH}. This may be slow. 1080p recommended. Continue?`)) {
        URL.revokeObjectURL(url); return;
      }
    }
    initApp(v);
  });
  v.addEventListener('error', () => { alert('Could not decode video. Try a different format.'); URL.revokeObjectURL(url); });
}

/* ═══════════════ INIT APP ═══════════════ */
function initApp(v) {
  if (running) {
    if (geom) { geom.dispose(); scene.remove(points); }
    if (mat) mat.dispose();
    if (videoTex) videoTex.dispose();
    if (video) { video.pause(); URL.revokeObjectURL(video.src); }
    renderer.dispose();
  }

  video = v;
  video.play();

  uploadOverlay.classList.add('hidden');
  document.getElementById('status').style.visibility = 'visible';
  document.getElementById('kb-hint').style.visibility = 'visible';

  renderer = new THREE.WebGLRenderer({
    antialias: false, alpha: true, premultipliedAlpha: true,
    preserveDrawingBuffer: false, powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x000000, 0);
  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  clock = new THREE.Clock();
  makeCamera();

  videoTex = new THREE.VideoTexture(video);
  videoTex.minFilter = THREE.LinearFilter;
  videoTex.magFilter = THREE.LinearFilter;
  videoTex.colorSpace = THREE.SRGBColorSpace;

  mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uVideo: { value: videoTex },
      uOpacity: { value: OPACITY },
      uBrightness: { value: BRIGHTNESS },
      uGaussExp: { value: 5.0 },
      uPixelRatio: { value: Math.min(devicePixelRatio, 2) },
      uTime: { value: 0 },
      uTurbAmp: { value: TURB_AMP },
      uTurbSpeed: { value: TURB_SPEED },
      uVidH: { value: vidH },
    },
    transparent: true, depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquation: THREE.AddEquation,
  });

  buildParticles();
  buildControls();
  running = true;
  tick();
}

/* ═══════════════ CAMERA ═══════════════ */
function makeCamera() {
  const sa = innerWidth / innerHeight, va = vidW / vidH;
  let l, r, t, b;
  if (sa > va) {
    const h = vidW / sa, p = (vidH - h) / 2;
    l = 0; r = vidW; b = p; t = vidH - p;
  } else {
    const w = vidH * sa, p = (vidW - w) / 2;
    l = p; r = vidW - p; b = 0; t = vidH;
  }
  camera = new THREE.OrthographicCamera(l, r, t, b, -1, 1);
}

/* ═══════════════ BUILD PARTICLES ═══════════════ */
function buildParticles() {
  if (geom) { geom.dispose(); scene.remove(points); }
  N = COLS * ROWS * PER_CLUSTER;
  const rng = mulberry32(SEED);

  baseX = new Float32Array(N);
  baseY = new Float32Array(N);
  pos = new Float32Array(N * 3);
  uv = new Float32Array(N * 2);
  size = new Float32Array(N);
  const phase = new Float32Array(N * 2);
  mOffX = new Float32Array(N);
  mOffY = new Float32Array(N);

  const MARGIN = 30;
  const cellW = (vidW + 2 * MARGIN) / COLS;
  const cellH = (vidH + 2 * MARGIN) / ROWS;
  let idx = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cx = -MARGIN + (c + 0.5) * cellW;
      const cy = -MARGIN + (r + 0.5) * cellH;
      const uvx = Math.max(0, Math.min(1, cx / vidW));
      const uvy = Math.max(0, Math.min(1, cy / vidH));
      for (let k = 0; k < PER_CLUSTER; k++) {
        const a = rng() * Math.PI * 2, d = rng() * CLUSTER_SPREAD;
        baseX[idx] = cx + Math.cos(a) * d;
        baseY[idx] = cy + Math.sin(a) * d;
        uv[idx * 2] = uvx;
        uv[idx * 2 + 1] = 1.0 - uvy;
        size[idx] = SIZE_MIN + (SIZE_MAX - SIZE_MIN) * Math.pow(rng(), SIZE_POW);
        phase[idx * 2] = rng() * Math.PI * 2;
        phase[idx * 2 + 1] = rng() * Math.PI * 2;
        rng(); rng();
        pos[idx * 3] = baseX[idx];
        pos[idx * 3 + 1] = vidH - baseY[idx];
        pos[idx * 3 + 2] = 0;
        idx++;
      }
    }
  }

  geom = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3);
  posAttr.usage = THREE.DynamicDrawUsage;
  geom.setAttribute('position', posAttr);
  geom.setAttribute('aUV', new THREE.BufferAttribute(uv, 2));
  geom.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geom.setAttribute('aPhase', new THREE.BufferAttribute(phase, 2));

  // Mouse offset attribute (updated on CPU, only for displaced particles)
  const mouseOffArr = new Float32Array(N * 2);
  const mouseOffAttr = new THREE.BufferAttribute(mouseOffArr, 2);
  mouseOffAttr.usage = THREE.DynamicDrawUsage;
  geom.setAttribute('aMouseOff', mouseOffAttr);

  points = new THREE.Points(geom, mat);
  scene.add(points);

  document.getElementById('particle-count').textContent = N.toLocaleString() + ' particles';
}

/* ═══════════════ MOUSE ═══════════════ */
const mouse = { x: -9999, y: -9999, active: false, left: false, right: false };

function screenToWorld(sx, sy) {
  const sa = innerWidth / innerHeight, va = vidW / vidH;
  if (sa > va) {
    const h = vidW / sa, p = (vidH - h) / 2;
    return { x: sx / innerWidth * vidW, y: p + sy / innerHeight * h };
  }
  const w = vidH * sa, p = (vidW - w) / 2;
  return { x: p + sx / innerWidth * w, y: sy / innerHeight * vidH };
}

addEventListener('mousemove', e => {
  if (!running) return;
  const w = screenToWorld(e.clientX, e.clientY);
  mouse.x = w.x; mouse.y = w.y; mouse.active = true;
});
addEventListener('mouseleave', () => { mouse.active = false; });
addEventListener('mousedown', e => { if (e.button === 0) mouse.left = true; if (e.button === 2) mouse.right = true; });
addEventListener('mouseup', e => { if (e.button === 0) mouse.left = false; if (e.button === 2) mouse.right = false; });
addEventListener('contextmenu', e => { if (running) e.preventDefault(); });

/* Mouse still runs on CPU but only updates the offset attribute.
   Turbulence is fully GPU. This is the right split: mouse affects
   a small radius of particles, turbulence affects all. */
function updateMouseOffsets(dt) {
  const offAttr = geom.getAttribute('aMouseOff');
  const offArr = offAttr.array;
  let dirty = false;

  for (let i = 0; i < N; i++) {
    // Mouse interaction
    if (mouse.active) {
      const curX = baseX[i], curY = baseY[i];
      const ddx = curX + mOffX[i] - mouse.x;
      const ddy = curY + mOffY[i] - mouse.y;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dist < MOUSE_RADIUS && dist > 0.5) {
        const nx = ddx / dist, ny = ddy / dist;
        const fo = 1 - dist / MOUSE_RADIUS;
        if (mouse.right) {
          const f = fo * ATTRACT_STRENGTH * dt * 4;
          mOffX[i] -= nx * f; mOffY[i] -= ny * f;
        } else if (mouse.left) {
          const f = fo * MOUSE_PUSH * dt * 4;
          mOffX[i] += nx * f; mOffY[i] += ny * f;
        } else {
          const sf = fo * SWIRL_STRENGTH * dt * 4;
          const inf = fo * SWIRL_INWARD * dt * 4;
          mOffX[i] += -ny * sf - nx * inf;
          mOffY[i] += nx * sf - ny * inf;
        }
      }
    }

    // Wake return (decay offset back to zero)
    const disp = Math.sqrt(mOffX[i] * mOffX[i] + mOffY[i] * mOffY[i]);
    if (disp > 0.01) {
      const decay = Math.exp(-(disp > WAKE_THRESHOLD ? WAKE_RETURN : RETURN_SPEED) * dt);
      mOffX[i] *= decay; mOffY[i] *= decay;
      dirty = true;
    }

    offArr[i * 2] = mOffX[i];
    offArr[i * 2 + 1] = mOffY[i];
  }

  if (dirty || mouse.active) {
    offAttr.needsUpdate = true;
  }
}

/* ═══════════════ TICK ═══════════════ */
let frames = 0, fpsT = 0;
const fpsEl = document.getElementById('fps-display');

function tick() {
  if (!running) return;
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.getElapsedTime();

  // Update uniforms (GPU handles turbulence)
  mat.uniforms.uTime.value = t;
  mat.uniforms.uBrightness.value = BRIGHTNESS;
  mat.uniforms.uOpacity.value = OPACITY;
  mat.uniforms.uTurbAmp.value = TURB_AMP;

  // Only CPU work: mouse offsets
  updateMouseOffsets(dt);

  renderer.render(scene, camera);

  frames++; fpsT += dt;
  if (fpsT >= 0.5) {
    fpsEl.textContent = Math.round(frames / fpsT) + ' fps';
    frames = 0; fpsT = 0;
  }
}

/* ═══════════════ RESIZE ═══════════════ */
addEventListener('resize', () => {
  if (!running) return;
  renderer.setSize(innerWidth, innerHeight);
  makeCamera();
});

/* ═══════════════ KEYBOARD ═══════════════ */
addEventListener('keydown', e => {
  if (!running) return;
  if (e.key === ' ') { e.preventDefault(); toggleVideoPause(); }
  if (e.key === 'r' || e.key === 'R') { e.preventDefault(); toggleRecord(); }
  if ((e.metaKey || e.ctrlKey) && e.key === 'o') { e.preventDefault(); fileInput.click(); }
  if (e.key === 'Escape') { togglePanel(); }
});

let videoPaused = false;
function toggleVideoPause() {
  if (!video) return;
  if (video.paused) { video.play(); videoPaused = false; }
  else { video.pause(); videoPaused = true; }
}

/* ═══════════════ CONTROLS ═══════════════ */
let rebuildTimer = null;
function scheduleRebuild() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => buildParticles(), 300);
}

function computeGrid(target) {
  const aspect = (vidW && vidH) ? vidW / vidH : 16 / 9;
  const cells = target / PER_CLUSTER;
  const rows = Math.max(10, Math.round(Math.sqrt(cells / aspect)));
  return { cols: Math.max(10, Math.round(rows * aspect)), rows };
}

function buildControls() {
  const body = document.getElementById('controls-body');
  body.innerHTML = '';
  const hasVideo = vidW > 0;

  /* Presets */
  const preDiv = document.createElement('div'); preDiv.className = 'presets';
  const presets = [
    { label: 'light', count: 200000 },
    { label: 'standard', count: 686000 },
    { label: 'dense', count: 1200000 }
  ];
  let densitySlider, densityVal;

  presets.forEach(p => {
    const btn = document.createElement('button'); btn.textContent = p.label;
    if (p.label === 'standard') btn.classList.add('active');
    btn.addEventListener('click', () => {
      const g = computeGrid(p.count); COLS = g.cols; ROWS = g.rows;
      densitySlider.value = p.count;
      densityVal.textContent = (p.count / 1000).toFixed(0) + 'k';
      preDiv.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      scheduleRebuild();
    });
    preDiv.appendChild(btn);
  });
  body.appendChild(preDiv);

  function addSection(title) {
    const s = document.createElement('div'); s.className = 'ctrl-section';
    const h = document.createElement('h3'); h.textContent = title; s.appendChild(h);
    body.appendChild(s); return s;
  }

  function addSlider(sec, label, min, max, step, val, fmt, fn) {
    const row = document.createElement('div'); row.className = 'ctrl-row';
    const lbl = document.createElement('label'); lbl.textContent = label;
    const v = document.createElement('span'); v.className = 'ctrl-val'; v.textContent = fmt(val);
    const sl = document.createElement('input');
    sl.type = 'range'; sl.min = min; sl.max = max; sl.step = step; sl.value = val;
    sl.addEventListener('input', () => {
      v.textContent = fmt(parseFloat(sl.value));
      fn(parseFloat(sl.value));
    });
    row.append(lbl, v);
    row.appendChild(sl);
    sec.appendChild(row);
    return { slider: sl, valEl: v };
  }

  const pSec = addSection('particles');
  const dr = addSlider(pSec, 'Density', 10000, 1000000, 10000, COLS * ROWS * PER_CLUSTER,
    v => (v / 1000).toFixed(0) + 'k',
    v => { const g = computeGrid(v); COLS = g.cols; ROWS = g.rows; scheduleRebuild(); });
  densitySlider = dr.slider; densityVal = dr.valEl;
  addSlider(pSec, 'Per cell', 1, 8, 1, PER_CLUSTER, v => v.toFixed(0),
    v => { PER_CLUSTER = v; scheduleRebuild(); });

  const sSec = addSection('size');
  addSlider(sSec, 'Min size', 0.1, 3.0, 0.1, SIZE_MIN, v => v.toFixed(1),
    v => { SIZE_MIN = v; scheduleRebuild(); });
  addSlider(sSec, 'Max size', 0.5, 8.0, 0.1, SIZE_MAX, v => v.toFixed(1),
    v => { SIZE_MAX = v; scheduleRebuild(); });

  const aSec = addSection('appearance');
  addSlider(aSec, 'Brightness', 0.5, 5.0, 0.1, BRIGHTNESS, v => v.toFixed(1),
    v => { BRIGHTNESS = v; });
  addSlider(aSec, 'Opacity', 0.1, 1.0, 0.05, OPACITY, v => v.toFixed(2),
    v => { OPACITY = v; });
  addSlider(aSec, 'Turbulence', 0, 20, 0.5, TURB_AMP, v => v.toFixed(1),
    v => { TURB_AMP = v; });

  const mSec = addSection('mouse');
  addSlider(mSec, 'Radius', 50, 500, 10, MOUSE_RADIUS, v => v.toFixed(0),
    v => { MOUSE_RADIUS = v; });
  addSlider(mSec, 'Push force', 5, 100, 1, MOUSE_PUSH, v => v.toFixed(0),
    v => { MOUSE_PUSH = v; });

  if (hasVideo) {
    /* Record section */
    const recSec = document.createElement('div'); recSec.id = 'record-section';
    const recBtn = document.createElement('button'); recBtn.id = 'record-btn'; recBtn.textContent = 'record';
    recBtn.addEventListener('click', toggleRecord); recSec.appendChild(recBtn);

    const timerEl = document.createElement('div'); timerEl.id = 'record-timer';
    recSec.appendChild(timerEl);

    const loopRow = document.createElement('div'); loopRow.id = 'full-loop-row';
    const loopCb = document.createElement('input'); loopCb.type = 'checkbox'; loopCb.id = 'full-loop';
    const loopLbl = document.createElement('label'); loopLbl.htmlFor = 'full-loop'; loopLbl.textContent = 'Record full loop';
    loopRow.append(loopCb, loopLbl); recSec.appendChild(loopRow); body.appendChild(recSec);

    const newBtn = document.createElement('button'); newBtn.id = 'new-video'; newBtn.textContent = 'New video';
    newBtn.addEventListener('click', resetToUpload); body.appendChild(newBtn);
  }
}

/* ═══════════════ RECORD ═══════════════ */
let mediaRecorder = null, recordedChunks = [], recordStart = 0, recordTimerInterval = null;

function toggleRecord() {
  if (mediaRecorder && mediaRecorder.state === 'recording') { stopRecord(); return; }
  startRecord();
}

function startRecord() {
  // Enable preserveDrawingBuffer for recording
  if (renderer) {
    const oldCanvas = renderer.domElement;
    renderer.dispose();
    renderer = new THREE.WebGLRenderer({
      canvas: oldCanvas, antialias: false, alpha: true, premultipliedAlpha: true,
      preserveDrawingBuffer: true, powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.setClearColor(0x000000, 0);
  }

  const stream = renderer.domElement.captureStream(30);
  const types = [
    'video/mp4;codecs=hvc1',
    'video/mp4;codecs=avc1',
    'video/webm;codecs=vp9',
    'video/webm'
  ];
  let mime = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
  const opts = { videoBitsPerSecond: 12000000 };
  if (mime) opts.mimeType = mime;
  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';

  mediaRecorder = new MediaRecorder(stream, opts);
  recordedChunks = [];
  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.onstop = async () => {
    const blob = new Blob(recordedChunks, { type: mime || 'video/mp4' });
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const defaultName = `ciafx_${videoName}_${ts}.${ext}`;

    // Native save dialog (Tauri) or download fallback (browser)
    if (isTauri) {
      try {
        const filePath = await invoke('plugin:dialog|save', {
          options: {
            defaultPath: defaultName,
            filters: [{ name: 'Video', extensions: [ext] }]
          }
        });
        if (filePath) {
          const arrayBuf = await blob.arrayBuffer();
          const bytes = Array.from(new Uint8Array(arrayBuf));
          await invoke('save_file', { path: filePath, data: bytes });
        }
      } catch (err) {
        console.error('save failed:', err);
      }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = defaultName; a.click();
      URL.revokeObjectURL(url);
    }

    // Restore non-preserveDrawingBuffer renderer
    const oldCanvas = renderer.domElement;
    renderer.dispose();
    renderer = new THREE.WebGLRenderer({
      canvas: oldCanvas, antialias: false, alpha: true, premultipliedAlpha: true,
      preserveDrawingBuffer: false, powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.setClearColor(0x000000, 0);
  };

  if (document.getElementById('full-loop').checked) {
    video.currentTime = 0;
    let prev = 0;
    const check = () => {
      if (!mediaRecorder || mediaRecorder.state !== 'recording') return;
      if (video.currentTime < prev && prev > 1) { stopRecord(); return; }
      prev = video.currentTime; requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }

  mediaRecorder.start();
  recordStart = performance.now();

  const btn = document.getElementById('record-btn');
  btn.textContent = 'stop'; btn.classList.add('recording');

  const timerEl = document.getElementById('record-timer');
  timerEl.classList.add('visible');
  recordTimerInterval = setInterval(() => {
    const s = Math.floor((performance.now() - recordStart) / 1000);
    const m = Math.floor(s / 60);
    timerEl.textContent = `${m}:${String(s % 60).padStart(2, '0')}`;
  }, 250);
}

function stopRecord() {
  if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
  const btn = document.getElementById('record-btn');
  btn.textContent = 'record'; btn.classList.remove('recording');
  const timerEl = document.getElementById('record-timer');
  timerEl.classList.remove('visible');
  clearInterval(recordTimerInterval);
}

/* ═══════════════ NEW VIDEO ═══════════════ */
function resetToUpload() {
  running = false;
  if (mediaRecorder && mediaRecorder.state === 'recording') stopRecord();
  if (geom) { geom.dispose(); scene.remove(points); }
  if (mat) mat.dispose();
  if (videoTex) videoTex.dispose();
  if (video) { video.pause(); URL.revokeObjectURL(video.src); }
  if (renderer) { renderer.domElement.remove(); renderer.dispose(); }
  uploadOverlay.classList.remove('hidden');
  document.getElementById('status').style.visibility = 'hidden';
  document.getElementById('kb-hint').style.visibility = 'hidden';
  vidW = 0; vidH = 0;
  buildControls();
  fileInput.value = '';
}

/* ═══════════════ INIT CONTROLS ON LOAD ═══════════════ */
buildControls();
