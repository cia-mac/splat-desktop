/* Pointfield guide: a step-by-step card over the live field (D-0831, modelled on the iPhone app's tutorial).
   One step per input the app really has: hover swirl, left-hold push, right-hold pull, Space, Esc, R.
   A ghost cursor demonstrates each mouse step through the app's real mouse state, so the points move for real,
   then the user tries it. The step passes on the real input and moves on after a short pause.
   Skip and close are always there, so no step can trap the user. */

const OFF_KEY = 'pf_guide_off';
const HOLD_MS = 700;          // right button held this long (without moving) passes "pull"
const SWIRL_PX = 600;         // hover path length that passes "swirl"
const PUSH_PX = 200;          // left-drag path length that passes "push"
const REDUCE = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const STEPS = [
  { id: 'swirl',  demo: 'sweep', say: 'move the mouse through the points',
    hint: 'no button needed: the points swirl with the pointer (hold Option for a fast throw)' },
  { id: 'push',   demo: 'push',  say: 'hold the left button and sweep to push them away',
    hint: 'press and hold the left button, then drag across the field' },
  { id: 'attract', demo: 'pull', keys: ['shift'], say: 'hold shift and the left button still and the points gather to it',
    hint: 'hold shift, press the left button on the field and keep it there for a second' },
  { id: 'explode', demo: 'blast', say: 'right-click the field for an explosion',
    hint: 'click the right button anywhere on the points' },
  { id: ['implode', 'tornado', 'drain', 'orbit'], say: 'arm a tool in the panel, then click the field',
    hint: 'under actions pick implode, tornado, drain or orbit, then click the points' },
  { id: ['fall', 'rise'], say: 'press fall or rise in the panel',
    hint: 'fall and rise are instant: no click on the field' },
  { id: 'reform', keepField: true, say: 'press reset to bring the points back',
    hint: 'reset is the green button under actions' },
  { id: 'pause',  keys: ['space'], say: 'press space to pause the video',
    hint: 'space pauses and plays the clip under the points' },
  { id: 'panel',  keys: ['esc'],   say: 'press esc to hide the controls',
    hint: 'esc hides the panel and brings it back' },
  { id: 'record', keys: ['R'],     say: 'press R to record the field',
    hint: 'R starts a recording, R again stops it and saves' },
];
const NOTES = { explode: 'boom', implode: 'swallowed', tornado: 'a tornado', drain: 'it drains', orbit: 'an orbit',
  fall: 'down it goes', rise: 'up it goes', reform: 'back in place' };

export function initGuide(api) {
  let auto = true; try { auto = localStorage.getItem(OFF_KEY) !== '1'; } catch (e) {}
  let on = false, idx = 0, state = 'idle', t0 = 0, gen = 0, timer = 0, autoTried = false;
  const ghost = { on: false, raf: 0, timer: 0 };

  /* ---------- DOM ---------- */
  const el = document.createElement('div');
  el.id = 'pf-guide'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-live', 'polite');
  el.innerHTML = `
    <div class="prog"><span class="n"></span><button type="button" class="close" tabindex="-1">close</button></div>
    <div class="say"></div>
    <div class="caps"></div>
    <div class="hint"></div>
    <div class="row">
      <button type="button" class="pri" tabindex="-1" hidden></button>
      <button type="button" class="sec again" tabindex="-1" hidden>show me again</button>
      <button type="button" class="sec skip" tabindex="-1">skip this step</button>
    </div>
    <button type="button" class="auto" tabindex="-1"></button>`;
  document.body.appendChild(el);

  const dot = document.createElement('div');
  dot.id = 'pf-guide-dot'; dot.hidden = true;
  dot.innerHTML = '<i></i><svg viewBox="0 0 24 34" width="22" height="31" aria-hidden="true">' +
    '<path class="l" d="M12 2A10 10 0 0 0 2 12V14H12Z"/><path class="r" d="M12 2A10 10 0 0 1 22 12V14H12Z"/>' +
    '<rect x="2" y="2" width="20" height="30" rx="10" fill="none" stroke="#fff" stroke-width="2"/>' +
    '<line x1="12" y1="2" x2="12" y2="14" stroke="#fff" stroke-width="2"/></svg>';
  document.body.appendChild(dot);

  const q = s => el.querySelector(s);
  const ui = { n: q('.n'), say: q('.say'), caps: q('.caps'), hint: q('.hint'),
    pri: q('.pri'), again: q('.again'), skip: q('.skip'), close: q('.close'), auto: q('.auto') };

  const inUi = t => !!(t && t.closest && t.closest('#controls, #ctrl-toggle, #pf-guide, #upload-overlay'));
  const fieldW = () => api.panelClosed() ? innerWidth : innerWidth - 320;

  function paintAuto() {
    ui.auto.textContent = (auto ? '☑' : '☐') + ' open the guide when the app starts';
    ui.auto.setAttribute('aria-pressed', String(auto));
  }
  function setAuto(v) { auto = v; try { localStorage.setItem(OFF_KEY, v ? '0' : '1'); } catch (e) {} paintAuto(); }

  /* ---------- ghost cursor ---------- */
  function place(x, y, kind) {
    dot.style.transform = `translate(${x}px, ${y}px)`;
    const w = api.screenToWorld(x, y), m = api.mouse, now = performance.now();
    if (m.active && m.t) { const sec = Math.max(1, now - m.t) / 1000; m.vx = (w.x - m.x) / sec; m.vy = (w.y - m.y) / sec; }   // the swirl follows the pointer's speed
    m.t = now; m.x = w.x; m.y = w.y; m.active = true; m.left = kind === 'push'; m.pull = kind === 'pull';
  }
  function ghostStop() {
    cancelAnimationFrame(ghost.raf); clearTimeout(ghost.timer);
    if (ghost.on) { const m = api.mouse; m.left = m.pull = m.active = false; m.vx = m.vy = 0; m.t = 0; }
    ghost.on = false; dot.hidden = true;
  }
  function ghostRun(kind) {
    ghostStop();
    if (REDUCE || !api.running()) return;
    const W = fieldW(), H = innerHeight, start = performance.now();
    const dur = kind === 'pull' ? 2400 : kind === 'blast' ? 1700 : 2600;
    let fired = false;
    ghost.on = true; dot.hidden = false;
    dot.className = kind === 'push' || kind === 'pull' ? 'hold-l' : kind === 'blast' ? 'hold-r' : '';
    const frame = now => {
      if (!ghost.on) return;
      const t = Math.min(1, (now - start) / dur);
      if (kind === 'pull' || kind === 'blast') {
        place(W * 0.5, H * 0.45, kind);
        if (kind === 'blast' && !fired && now - start > 450) { fired = true; api.fireAt('explode', W * 0.5, H * 0.45); }   // the real explode
      } else place(W * (0.18 + 0.64 * t), H * (0.45 + 0.09 * Math.sin(t * Math.PI * 3)), kind);
      if (t < 1) ghost.raf = requestAnimationFrame(frame); else ghostStop();
    };
    ghost.raf = requestAnimationFrame(frame);
    ghost.timer = setTimeout(ghostStop, dur + 400);   // frames can stall (hidden window): the demo must still end and give the mouse back
  }

  /* ---------- steps ---------- */
  function restore() {   // put back what a step changed, so no step leaves the app in an odd state
    if (api.isPaused()) api.togglePause();
    if (api.panelClosed()) api.togglePanel();
  }
  function ids(st) { return [].concat(st.id); }
  function show() {
    const st = STEPS[idx];
    state = 'waiting'; t0 = performance.now();
    ui.n.textContent = (idx + 1) + ' of ' + STEPS.length;
    ui.say.textContent = st.say; ui.hint.textContent = '';
    ui.caps.innerHTML = (st.keys || []).map(k => `<kbd>${k}</kbd>`).join('');
    ui.again.hidden = true; ui.skip.hidden = false; ui.pri.hidden = true;
    if (st.demo) ghostRun(st.demo);
    resetProgress();
  }
  function done(note) {
    if (state !== 'waiting') return;
    state = 'done'; ghostStop();
    ui.say.innerHTML = '<span class="ok">✓</span> ' + (note || 'nice');
    ui.caps.innerHTML = ''; ui.hint.textContent = '';
    ui.again.hidden = true; ui.skip.hidden = true;
    const g = ++gen;
    setTimeout(() => { if (on && g === gen) advance(); }, 1600);
  }
  function advance() {
    restore(); idx++;
    // the field is put back before every step except reset, which needs something to reset
    if (idx >= STEPS.length) finish(); else { if (!STEPS[idx].keepField) api.resetField(); show(); }
  }
  function finish() {
    state = 'finished'; ghostStop();
    ui.n.textContent = 'done';
    ui.say.textContent = 'that is every control. drop a video, or press ⌘O, to use your own.';
    ui.caps.innerHTML = ''; ui.hint.textContent = 'the guide button in the panel opens this again';
    ui.again.hidden = true; ui.skip.hidden = true;
    ui.pri.hidden = false; ui.pri.textContent = 'start'; ui.close.hidden = true;
  }
  function start() {
    if (!api.running()) return;
    gen++; ghostStop(); restore(); api.resetField();
    on = true; idx = 0; el.hidden = false; ui.close.hidden = false; paintAuto();
    show();
    clearInterval(timer);
    timer = setInterval(() => {
      if (!on || state !== 'waiting') return;
      if (document.hidden) { t0 += 500; return; }
      const st = STEPS[idx], dt = performance.now() - t0;
      if (dt > 8000 && !ui.hint.textContent) ui.hint.textContent = st.hint;
      if (dt > 20000 && st.demo) ui.again.hidden = false;
    }, 500);
  }
  function close() {
    gen++; ghostStop(); restore(); clearInterval(timer);
    if (on) api.resetField();
    on = false; state = 'idle'; el.hidden = true;
  }

  /* ---------- detecting the real input ---------- */
  let lx = 0, ly = 0, swirlPx = 0, pushPx = 0, holdTimer = 0, holdX = 0, holdY = 0;
  const waiting = id => on && state === 'waiting' && !ghost.on && STEPS[idx].id === id;
  function resetProgress() { swirlPx = 0; pushPx = 0; clearTimeout(holdTimer); }

  addEventListener('mousemove', e => {
    if (ghost.on) { e.stopImmediatePropagation(); return; }   // the demo owns the mouse until it ends
    const d = Math.hypot(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY;
    if (!on || state !== 'waiting' || inUi(e.target) || !api.running()) return;
    if (waiting('swirl') && e.buttons === 0) { swirlPx += d; if (swirlPx >= SWIRL_PX) done('that is the swirl'); }
    if (waiting('push') && (e.buttons & 1) && !e.shiftKey) { pushPx += d; if (pushPx >= PUSH_PX) done('pushed'); }
    if (holdTimer && Math.hypot(e.clientX - holdX, e.clientY - holdY) > 60) { clearTimeout(holdTimer); holdTimer = 0; }
  }, true);
  addEventListener('mousedown', e => {
    if (ghost.on) { e.stopImmediatePropagation(); return; }
    if (e.button === 0 && e.shiftKey && waiting('attract') && !inUi(e.target)) {
      holdX = e.clientX; holdY = e.clientY;
      holdTimer = setTimeout(() => { holdTimer = 0; if (waiting('attract')) done('they gather'); }, HOLD_MS);
    }
  }, true);
  addEventListener('mouseup', e => {
    if (ghost.on) { e.stopImmediatePropagation(); return; }
    if (e.button === 0) { clearTimeout(holdTimer); holdTimer = 0; }
  }, true);
  /* explode, the armed tools, fall, rise and reset: the app announces each real action */
  addEventListener('pf-action', e => {
    if (!on || state !== 'waiting' || ghost.on) return;
    if (ids(STEPS[idx]).includes(e.detail)) done(NOTES[e.detail] || 'nice');
  });
  addEventListener('keydown', e => {
    if (!on || state !== 'waiting' || e.repeat || !api.running() || e.metaKey || e.ctrlKey) return;
    if (e.key === ' ' && waiting('pause')) done('the clip pauses; it plays again in a moment');
    else if (e.key === 'Escape' && waiting('panel')) done('the controls come back in a moment');
    else if ((e.key === 'r' || e.key === 'R') && waiting('record')) done('recording: press R again to stop and save');
  }, true);

  /* ---------- buttons ---------- */
  const tap = (btn, fn) => btn.addEventListener('click', e => { e.stopPropagation(); btn.blur(); fn(); });
  tap(ui.close, close);
  tap(ui.pri, () => { if (state === 'finished') close(); });
  tap(ui.again, () => { const st = STEPS[idx]; ui.hint.textContent = st.hint; t0 = performance.now(); resetProgress(); api.resetField(); ghostRun(st.demo); });
  tap(ui.skip, () => { gen++; ghostStop(); state = 'done'; advance(); });
  tap(ui.auto, () => setAuto(!auto));
  paintAuto();

  return {
    start, close,
    isOpen: () => on,
    /* called once a video is running: open on first run unless the user switched it off */
    onVideoRunning() {
      if (autoTried) return; autoTried = true;
      if (auto) setTimeout(() => { if (!on && api.running()) start(); }, 900);
    },
  };
}
