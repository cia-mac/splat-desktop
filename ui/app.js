import * as THREE from './vendor/three.module.js';
import { initGuide } from './guide.js';
import { createActions } from './actions.js';

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
let MOUSE_RADIUS = 180, MOUSE_PUSH = 29;   // radius: the iPhone's default (was 278); scaled to the window by fieldScale()
const SWIRL_STRENGTH = 25, SWIRL_INWARD = 6;
const RETURN_SPEED = 1.2, WAKE_RETURN = 0.35, WAKE_THRESHOLD = 3;
const SEED = 42;

/* ═══════════════ STATE ═══════════════ */
let vidW = 0, vidH = 0, videoName = 'Pointfield';
let N = 0, geom, points, mat, videoTex;
let baseX, baseY, pos, uv, size, phaseX, phaseY, mOffX, mOffY;
let video, renderer, camera, scene, clock;
let running = false;
let rafId = 0;

/* ═══════════════ SHADERS (GPU turbulence) ═══════════════ */
const VERT = `
  precision highp float;
  attribute vec2 aUV;
  attribute float aSize;
  attribute vec2 aPhase;
  attribute vec2 aMouseOff;

  uniform float uPixelRatio;
  uniform float uBrightness;
  uniform float uSize;   // 1 normally; the explode swells the points for a moment
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
    gl_PointSize = aSize * uPixelRatio * uSize;
  }
`;

const FRAG = `
  precision mediump float;
  uniform sampler2D uVideo;
  uniform float uOpacity;
  uniform float uGaussExp;
  uniform vec3 uTint;    // white normally; the explode is white-hot, cooling through orange
  varying vec2 vUV;
  varying float vBright;

  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r2 = dot(d, d) * 4.0;
    float alpha = exp(-r2 * uGaussExp) * uOpacity;
    if (alpha < 0.005) discard;
    vec3 col = texture2D(uVideo, vUV).rgb * uTint;
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

/* ═══════════════ VIEWPORT ═══════════════ */
// Panel width (matches #controls width in style.css). When the panel is open
// it overlays the right edge of the canvas; the visible drawing area is the
// window width minus the panel width.
const PANEL_W = 320;
function visibleSize() {
  const panelOpen = !ctrlPanel.classList.contains('closed');
  // Clamp: a window narrower than the panel would otherwise hand setSize() a
  // zero or negative width and build a degenerate camera frustum.
  return {
    width: Math.max(1, innerWidth - (panelOpen ? PANEL_W : 0)),
    height: Math.max(1, innerHeight),
  };
}
function resizeRenderSurface() {
  if (!running || !renderer) return;
  resetPointer();   // the screen-to-world mapping changes: old pointer samples are in the old coordinates
  const sz = visibleSize();
  renderer.setSize(sz.width, sz.height);
  makeCamera();
}

/* ═══════════════ CONTROLS TOGGLE ═══════════════ */
function togglePanel() {
  ctrlPanel.classList.toggle('closed');
  uploadOverlay.classList.toggle('panel-closed', ctrlPanel.classList.contains('closed'));
  resizeRenderSurface();
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

/* Bundled sample (the ciamac bird, same clip as the homepage and the iPhone app).
   Read into a blob so it takes the exact path a dropped file takes; a direct
   src on the app's own scheme is not relied on for video in the webview. */
const SAMPLE_BRIGHTNESS = 1.0;   // the bird is mostly white shirt and sky; the 2.4 default blows it out
function loadSample() {
  BRIGHTNESS = SAMPLE_BRIGHTNESS;   // initApp builds the uniform and the slider from this
  fetch('sample.mp4')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
    .then(b => handleFile(new File([b], 'Pointfield.mp4', { type: 'video/mp4' })))
    .catch(() => {}); // no sample: the drop screen stays, as before
}
document.getElementById('sample-btn').addEventListener('click', e => {
  e.stopPropagation(); // the card itself opens the file picker
  loadSample();
});

function handleFile(file) {
  if (!file.type.startsWith('video/')) { alert('Not a video file'); return; }
  if (file.size > 500 * 1024 * 1024) {
    if (!confirm('This file is over 500 MB. Performance may suffer. Continue?')) return;
  }
  // Nothing is written to the globals until the file is accepted; a rejected
  // file must not disturb the video that is already running.
  const name = file.name.replace(/\.[^.]+$/, '') || 'Pointfield';
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.src = url; v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
  v.crossOrigin = 'anonymous';
  v.addEventListener('loadedmetadata', () => {
    const w = v.videoWidth, h = v.videoHeight;
    if (!w || !h) {
      alert('That file has no video track.');
      URL.revokeObjectURL(url); return;
    }
    if (w > 3840 || h > 2160) {
      if (!confirm(`Video is ${w}x${h}. This may be slow. 1080p recommended. Continue?`)) {
        URL.revokeObjectURL(url); return;
      }
    }
    initApp(v, name);
  });
  v.addEventListener('error', () => { alert('Could not decode video. Try a different format.'); URL.revokeObjectURL(url); });
}

/* ═══════════════ INIT APP ═══════════════ */
function initApp(v, name) {
  vidW = v.videoWidth; vidH = v.videoHeight; videoName = name;
  resetPointer();

  // Cancel the previous frame loop before starting a new one. Without this,
  // every video loaded while one is running leaves its own tick() chain alive
  // and the per-frame work multiplies.
  if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }

  if (running) {
    if (geom) { geom.dispose(); scene.remove(points); }
    if (mat) mat.dispose();
    if (videoTex) videoTex.dispose();
    if (video) { video.pause(); URL.revokeObjectURL(video.src); }
    renderer.domElement.remove();
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
  const initSz = visibleSize();
  renderer.setSize(initSz.width, initSz.height);
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
      uSize: { value: 1 },
      uTint: { value: new THREE.Vector3(1, 1, 1) },
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
  guide.onVideoRunning();
}

/* ═══════════════ CAMERA ═══════════════ */
// Orthographic fit-to-video. The canvas aspect comes from the *visible* draw
// surface (window minus controls panel), not the full window. Letterboxes
// (horizontal bars) when canvas is taller than the video; pillarboxes
// (vertical bars) when wider. Never stretches.
function makeCamera() {
  const sz = visibleSize();
  const sa = sz.width / sz.height, va = vidW / vidH;
  let l, r, t, b;
  if (sa > va) {
    const w = vidH * sa, p = (w - vidW) / 2;
    l = -p; r = vidW + p; b = 0; t = vidH;
  } else {
    const h = vidW / sa, p = (h - vidH) / 2;
    l = 0; r = vidW; b = -p; t = vidH + p;
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
const mouse = { x: -9999, y: -9999, active: false, left: false, pull: false, vx: 0, vy: 0, t: 0, hist: [] };
/* The iPhone's finger model (pointfield-ios field.js, TOUCH_*), carried to the pointer. Distances and speeds are the phone's,
   a field about 500 units across its short side, scaled by um = shortSide / 500 so the pointer covers the same share of
   the window as a finger covers of the glass. */
const TOUCH_STIR_V = 250;   // pointer speed (units/s) at which hovering is fully a stir
const TOUCH_DRAG = 0.6;     // share of the pointer's velocity handed to the points it passes over
const HOLD_PULL = 120, HOLD_CORE = 14;   // shift + hold pulls straight in and gathers into a band about this wide, not a point
const FLICK_V = 1467, FLICK_GAP_MS = 350;   // a stroke faster than this (the iPhone's 1100 px/s) throws the points near it
/* Pointer speed is measured over the last ~80 ms of EVENT timestamps, never per event or by handler time: a busy frame
   queues mouse events that then arrive back to back, and a per-event speed would read them as a huge jump. */
const SPEED_WIN_MS = 80, SPEED_MIN_SPAN_MS = 16, SPEED_CAP = FLICK_V * 4;
let lastFlick = 0;
/* The throw fires when a fast stroke ENDS, at the pointer, with the stroke's fastest velocity: the iPhone throws at finger
   release, so the points thrown are the ones where the pointer finished, not where it began. */
const stroke = { sp: 0, vx: 0, vy: 0 };
const PULL_R_RATIO = 260 / 180;   // the iPhone's hold-pull reaches 260 units against its 180-unit stir radius
function resetPointer() { mouse.active = false; mouse.vx = 0; mouse.vy = 0; mouse.t = 0; mouse.hist.length = 0; stroke.sp = 0; }
function endStroke(now) {
  if (stroke.sp > 0 && now - lastFlick > FLICK_GAP_MS && !fx.effect) { lastFlick = now; fx.flick(mouse.x, mouse.y, stroke.vx, stroke.vy); }   // never into a running effect
  stroke.sp = 0;
}
const fieldScale = () => Math.min(vidW, vidH) / 500;

/* ═══════════════ ACTIONS (explode, implode, tornado, drain, orbit, fall, rise, reset) ═══════════════ */
const fx = createActions({
  field: () => ({ N, baseX, baseY, mOffX, mOffY, W: vidW, H: vidH }),
  canvas: () => renderer && renderer.domElement,
});
const ARMED_TOOLS = ['explode', 'implode', 'tornado', 'drain', 'orbit'];   // arm one, then click the field
let armed = null;
/* Every fired action is announced, so the guide (and anything else) can follow what the user really did */
function announce(name) { window.dispatchEvent(new CustomEvent('pf-action', { detail: name })); }
function fireAt(name, clientX, clientY) {
  const w = screenToWorld(clientX, clientY);
  if (fx.fire(name, w.x, w.y)) announce(name);
}
function fireInstant(name) { if (name === 'reform' ? fx.reform() : fx.fire(name)) announce(name); }
function paintArmed() {
  document.body.classList.toggle('pf-armed', !!armed);
  document.querySelectorAll('#fx-grid button[data-arm]').forEach(b => b.classList.toggle('armed', b.dataset.arm === armed));
  const st = document.getElementById('fx-status');
  if (st) st.textContent = armed ? armed + ' armed: click the field. esc to stop.'
    : 'right-click explodes. arm a tool, then click the field. fall, rise and reset are instant.';
}
function setArmed(name) { armed = armed === name ? null : name; paintArmed(); }
const onChrome = t => !!(t && t.closest && t.closest('#controls, #ctrl-toggle, #pf-guide, #upload-overlay'));

function screenToWorld(sx, sy) {
  // Map screen coords (relative to window origin) into the orthographic world.
  // Match the same letterbox/pillarbox math used in makeCamera so mouse forces
  // land where the user sees them.
  const sz = visibleSize();
  const sa = sz.width / sz.height, va = vidW / vidH;
  if (sa > va) {
    const w = vidH * sa, p = (w - vidW) / 2;
    return { x: -p + sx / sz.width * w, y: sy / sz.height * vidH };
  }
  const h = vidW / sa, p = (h - vidH) / 2;
  return { x: sx / sz.width * vidW, y: -p + sy / sz.height * h };
}

addEventListener('mousemove', e => {
  if (!running) return;
  if (!(e.buttons & 1)) { mouse.left = false; mouse.pull = false; }   // a release outside the window sends no mouseup: do not stay latched
  const w = screenToWorld(e.clientX, e.clientY), now = e.timeStamp, um = fieldScale();
  if (!mouse.active) mouse.hist.length = 0;   // a fresh entry: no stale samples
  mouse.hist.push({ t: now, x: w.x, y: w.y });
  while (mouse.hist.length > 1 && now - mouse.hist[0].t > SPEED_WIN_MS) mouse.hist.shift();
  const old = mouse.hist[0], span = now - old.t;
  if (span >= SPEED_MIN_SPAN_MS) {   // too short a span (events bunched together) leaves the speed alone
    let vx = (w.x - old.x) / (span / 1000), vy = (w.y - old.y) / (span / 1000);
    const sp = Math.hypot(vx, vy), cap = SPEED_CAP * um; if (sp > cap) { vx *= cap / sp; vy *= cap / sp; }
    mouse.vx += (vx - mouse.vx) * 0.5; mouse.vy += (vy - mouse.vy) * 0.5;
  }
  mouse.t = now; mouse.x = w.x; mouse.y = w.y; mouse.active = true;
  if (!mouse.left && !mouse.pull && !armed) {
    const sp = Math.hypot(mouse.vx, mouse.vy);
    if (sp > FLICK_V * um && sp > stroke.sp) { stroke.sp = sp; stroke.vx = mouse.vx; stroke.vy = mouse.vy; }   // the fastest moment so far
    else if (stroke.sp > 0 && sp < stroke.sp * 0.5) endStroke(now);                                            // it has slowed to half: the stroke is over
  } else stroke.sp = 0;
});
addEventListener('mouseleave', resetPointer);
addEventListener('blur', () => { mouse.left = false; mouse.pull = false; resetPointer(); });
/* Mouse (D-0827, D-0831): left-hold pushes, shift + left-hold pulls in, a right click explodes at the pointer with no
   arming, and with a tool armed a left click fires it there instead. */
addEventListener('mousedown', e => {
  if (!running || onChrome(e.target)) return;
  if (e.button === 2) { fireAt('explode', e.clientX, e.clientY); return; }
  if (e.button !== 0) return;
  if (armed) { fireAt(armed, e.clientX, e.clientY); return; }
  if (e.shiftKey) mouse.pull = true; else mouse.left = true;
});
addEventListener('mouseup', e => { if (e.button === 0) { mouse.left = false; mouse.pull = false; } });
addEventListener('contextmenu', e => { if (running) e.preventDefault(); });

/* Mouse still runs on CPU but only updates the offset attribute.
   Turbulence is fully GPU. This is the right split: mouse affects
   a small radius of particles, turbulence affects all. */
function updateMouseOffsets(dt) {
  const offAttr = geom.getAttribute('aMouseOff');
  const offArr = offAttr.array;
  let dirty = false;

  fx.prep(dt);
  const fxOn = fx.state.on, fxKick = fx.state.kick, fxReform = fx.state.reforming;
  if (fxOn || fxKick || fxReform) dirty = true;

  // the pointer's velocity fades when it stops moving; everything is scaled to the window like the iPhone's
  if (stroke.sp > 0 && performance.now() - mouse.t > 60) endStroke(performance.now());
  if (performance.now() - mouse.t > 60) { const k = Math.exp(-dt * 12); mouse.vx *= k; mouse.vy *= k; }
  if (fxKick) fx.kickStep(dt);   // coasting after a throw: one tight loop, then the wake return in the loop below
  const um = fieldScale(), R = MOUSE_RADIUS * um * (mouse.pull ? PULL_R_RATIO : 1);
  const stir = Math.min(1, Math.hypot(mouse.vx, mouse.vy) / (TOUCH_STIR_V * um));

  for (let i = 0; i < N; i++) {
    // Mouse interaction
    if (mouse.active) {
      const curX = baseX[i], curY = baseY[i];
      const ddx = curX + mOffX[i] - mouse.x;
      const ddy = curY + mOffY[i] - mouse.y;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dist < R && dist > 0.5) {
        const nx = ddx / dist, ny = ddy / dist;
        const fo = 1 - dist / R;
        if (mouse.pull) {
          // the iPhone's hold-pull: straight in, gentler with distance, into a small band so the points never overshoot
          const core = HOLD_CORE * um;
          if (dist > core) { const f = Math.min(dist - core, fo * fo * HOLD_PULL * um * dt * 4); mOffX[i] -= nx * f; mOffY[i] -= ny * f; }
        } else if (mouse.left) {
          const f = fo * MOUSE_PUSH * um * dt * 4;
          mOffX[i] += nx * f; mOffY[i] += ny * f;
        } else {
          // hover is the finger on the glass: the swirl follows the pointer's speed, and the points it passes inherit its velocity
          const sf = fo * SWIRL_STRENGTH * um * dt * 4 * stir, inf = fo * SWIRL_INWARD * um * dt * 4 * stir, dk = fo * fo * TOUCH_DRAG * dt;
          mOffX[i] += -ny * sf - nx * inf + mouse.vx * dk;
          mOffY[i] += nx * sf - ny * inf + mouse.vy * dk;
        }
      }
    }

    // Actions integrate velocity into the offsets; while one runs the wake return is suspended, and a reset
    // eases every offset home instead (the homepage's rule).
    if (fxOn) fx.apply(i, dt);
    if (fxReform) fx.settle(i);

    // Wake return (decay offset back to zero)
    const disp = Math.sqrt(mOffX[i] * mOffX[i] + mOffY[i] * mOffY[i]);
    if (!fxOn && !fxReform && disp > 0.01) {
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
  if (!running) { rafId = 0; return; }
  rafId = requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.getElapsedTime();

  // Update uniforms (GPU handles turbulence)
  mat.uniforms.uTime.value = t;
  mat.uniforms.uBrightness.value = BRIGHTNESS;
  mat.uniforms.uOpacity.value = OPACITY;
  mat.uniforms.uTurbAmp.value = TURB_AMP;

  // Only CPU work: mouse offsets
  updateMouseOffsets(dt);

  // The explode's light (flash, swell, white-hot tint) rides on top of the user's own brightness
  const lk = fx.state.look;
  mat.uniforms.uBrightness.value = BRIGHTNESS * lk.b;
  mat.uniforms.uSize.value = lk.z;
  mat.uniforms.uTint.value.set(lk.tint[0], lk.tint[1], lk.tint[2]);

  renderer.render(scene, camera);

  frames++; fpsT += dt;
  if (fpsT >= 0.5) {
    fpsEl.textContent = Math.round(frames / fpsT) + ' fps';
    frames = 0; fpsT = 0;
  }
}

/* ═══════════════ RESIZE ═══════════════ */
addEventListener('resize', () => {
  resizeRenderSurface();
});

/* ═══════════════ KEYBOARD ═══════════════ */
addEventListener('keydown', e => {
  // Open works on the start screen too; every other key needs a loaded video.
  if ((e.metaKey || e.ctrlKey) && (e.key === 'o' || e.key === 'O')) { e.preventDefault(); fileInput.click(); return; }
  if (!running) return;
  if (e.key === ' ') { e.preventDefault(); toggleVideoPause(); }
  if (e.key === 'r' || e.key === 'R') { e.preventDefault(); toggleRecord(); }
  if (e.key === 'Escape') { if (armed) setArmed(armed); else togglePanel(); }   // esc stops an armed tool first
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
  // The controls exist before a video does. With nothing loaded there is no
  // scene or material to build into; the new values are picked up by
  // initApp when a video arrives.
  if (!running) return;
  rebuildTimer = setTimeout(() => { if (running) buildParticles(); }, 300);
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

  /* Actions: arm a tool then click the field (explode also on right-click); fall, rise and reset are instant.
     Icons are the homepage's. */
  if (hasVideo) {
    const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    const ACTIONS = [
      ['explode', 'arm', svg('<path d="M12 2v5M12 17v5M2 12h5M17 12h5M4.9 4.9l3 3M16.1 16.1l3 3M19.1 4.9l-3 3M7.9 16.1l-3 3"/>')],
      ['implode', 'arm', svg('<path d="M4 4l5 5M9 4H4v5M20 4l-5 5M15 4h5v5M4 20l5-5M9 20H4v-5M20 20l-5-5M15 20h5v-5"/>')],
      ['tornado', 'arm', svg('<path d="M3 4h18M5 8h13M8 12h9M11 16h5M13 20h2"/>')],
      ['drain', 'arm', svg('<path d="M20 12a8 8 0 1 1-5.3-7.5M12 6a6 6 0 1 0 6 6 4 4 0 0 0-7-2.6"/>')],
      ['orbit', 'arm', svg('<ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(-22 12 12)"/><circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none"/>')],
      ['fall', 'now', svg('<path d="M12 4v14M6 12l6 6 6-6"/>')],
      ['rise', 'now', svg('<path d="M12 20V6M6 12l6-6 6 6"/>')],
      ['reform', 'now', svg('<path d="M21 12a9 9 0 1 1-2.6-6.3M21 4v5h-5"/>'), 'reset'],
    ];
    const aSecX = addSection('actions');
    const grid = document.createElement('div'); grid.id = 'fx-grid';
    ACTIONS.forEach(([name, kind, icon, label]) => {
      const b = document.createElement('button'); b.type = 'button';
      b.innerHTML = icon + '<span>' + (label || name) + '</span>';
      if (kind === 'arm') b.dataset.arm = name; else b.dataset.act = name;
      if (name === 'reform') b.classList.add('fx-reset');
      b.addEventListener('click', () => {
        b.blur();
        if (kind === 'arm') setArmed(name);
        else { if (armed) setArmed(armed); fireInstant(name); }
      });
      grid.appendChild(b);
    });
    aSecX.appendChild(grid);
    const st = document.createElement('div'); st.id = 'fx-status'; aSecX.appendChild(st);
    paintArmed();
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

    const guideBtn = document.createElement('button'); guideBtn.id = 'guide-btn'; guideBtn.textContent = 'Guide';
    guideBtn.addEventListener('click', () => { guideBtn.blur(); guide.start(); }); body.appendChild(guideBtn);

    const newBtn = document.createElement('button'); newBtn.id = 'new-video'; newBtn.textContent = 'New video';
    newBtn.addEventListener('click', resetToUpload); body.appendChild(newBtn);
  }
}

/* ═══════════════ RECORD ═══════════════ */
let mediaRecorder = null, recordStart = 0, recordTimerInterval = null;

function toggleRecord() {
  if (mediaRecorder && mediaRecorder.state === 'recording') { stopRecord(); return; }
  startRecord();
}

function startRecord() {
  // The renderer is used as-is. This used to tear it down and rebuild it with
  // preserveDrawingBuffer: true, which did nothing: a canvas can only hold one
  // WebGL context, so getContext returned the existing one and ignored the new
  // attributes. What the swap did do was re-upload all geometry mid-record,
  // orphan the old GL buffers, and leave a window in which a pending onstop
  // could dispose a renderer that no longer belonged to it. Recordings work
  // without it, which is the proof the flag was never applying.
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
  // With no supported type WebKit falls back to its own encoder, which writes
  // an mp4 container on macOS. Naming that file .webm makes it unopenable.
  const ext = (!mime || mime.startsWith('video/mp4')) ? 'mp4' : 'webm';

  // Everything a take needs is bound to this recorder, not to the globals.
  // A recorder's final dataavailable and stop events are queued, so a take
  // started right after stopping the previous one would otherwise push the
  // old take's last chunk into the new take's array and build the old file
  // from the new take's data.
  const recorder = new MediaRecorder(stream, opts);
  const chunks = [];
  const takeName = videoName;
  mediaRecorder = recorder;
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = async () => {
    const blob = new Blob(chunks, { type: mime || 'video/mp4' });
    if (blob.size === 0) { alert('The recording was empty. Nothing was saved.'); return; }
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const defaultName = `Pointfield_${takeName}_${ts}.${ext}`;

    // Native save dialog (Tauri) or download fallback (browser)
    if (isTauri) {
      try {
        // Cancelling the save dialog used to drop the take without a word.
        // Ask before discarding, and offer the dialog again.
        const KEEP = 'Choose Location';
        let filePath = null;
        for (;;) {
          filePath = await invoke('plugin:dialog|save', {
            options: {
              defaultPath: defaultName,
              filters: [{ name: 'Video', extensions: [ext] }]
            }
          });
          if (filePath) break;
          const answer = await invoke('plugin:dialog|message', {
            title: 'Recording not saved',
            message: 'This recording has not been saved. If you discard it, it cannot be recovered.',
            kind: 'warning',
            buttons: { OkCancelCustom: [KEEP, 'Discard'] }
          });
          if (answer !== KEEP && answer !== 'Ok') break;
        }
        if (filePath) {
          // Write in bounded chunks, slicing the Blob per chunk so the whole
          // recording is never materialised a second time. Every byte
          // crossing the IPC boundary still becomes a JS number and then JSON
          // text (the transport is postMessage; see RUNBOOK), but that
          // overhead is now paid per 4 MB chunk rather than per recording.
          const CHUNK = 4 * 1024 * 1024;
          for (let off = 0; off < blob.size; off += CHUNK) {
            const buf = await blob.slice(off, Math.min(off + CHUNK, blob.size)).arrayBuffer();
            const part = Array.from(new Uint8Array(buf));
            await invoke('save_file', { path: filePath, data: part, append: off > 0 });
          }
        }
      } catch (err) {
        // A silent failure here means the user records, saves, and gets
        // nothing, with no explanation.
        console.error('save failed:', err);
        alert('Could not save the recording: ' + err);
      }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = defaultName; a.click();
      URL.revokeObjectURL(url);
    }

  };

  if (document.getElementById('full-loop').checked) {
    // The wrap is detected by watching currentTime, so a paused video would
    // never wrap and the recording would grow until stopped by hand. The
    // watcher is bound to this recorder and this video so a leftover watcher
    // from an earlier take can never stop a later one.
    const vid = video;
    vid.play().catch(() => {});
    vid.currentTime = 0;
    let prev = 0;
    const check = () => {
      if (mediaRecorder !== recorder || recorder.state !== 'recording') return;
      // A wrap is a real jump backwards, not jitter; this also works for loops
      // shorter than a second, which a fixed "prev > 1" threshold never caught.
      if (vid.currentTime + 0.25 < prev) { stopRecord(); return; }
      prev = vid.currentTime; requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }

  recorder.start();
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
  guide.close();
  fx.clear(); armed = null; paintArmed();
  running = false;
  clearTimeout(rebuildTimer);
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

/* ═══════════════ GUIDE ═══════════════ */
const guide = initGuide({
  mouse, screenToWorld, fireAt,
  resetField: () => { if (armed) setArmed(armed); fx.reform(); },
  running: () => running,
  isPaused: () => !!video && video.paused,
  togglePause: toggleVideoPause,
  panelClosed: () => ctrlPanel.classList.contains('closed'),
  togglePanel,
});

/* ═══════════════ INIT CONTROLS ON LOAD ═══════════════ */
buildControls();
loadSample(); // open on the bird, like the homepage; dropping a video replaces it



