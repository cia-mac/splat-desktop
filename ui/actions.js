/* Pointfield actions for the Mac app: explode, implode, tornado, drain, orbit, fall, rise, reset.
   Sources (D-0765, D-0827, D-0829, D-0831):
   - tornado, drain, orbit, fall, rise and the reset ("reform") are the homepage's action layer (ciamac-site
     deploy/index.html, applyAction and the fx functions), which is the reference for every Pointfield.
   - explode and implode are the iPhone app's cinematic versions (pointfield-ios www/field.js, the CINE block), which
     D-0827 rules are the explode and implode for every Pointfield. Two deliberate differences, Cia 2026-11-19 ("the
     explosion is bad ... no flash, it doesn't explode all particles, only a layer"): (1) the explode has no light
     effects (no flash, swell or tint); (2) the smoke layer, 72% of the points, brakes at half the iPhone's drag so every
     point is blasted far, not just the debris and embers, and explode distances scale with the field's short side.
   Per-point velocity integrates into the same mOffX / mOffY offsets the mouse uses, so the GPU path is unchanged.
   Distances and speeds are tuned for a field about 1200 units on its long side (the phone spec; the homepage's table
   is close), so they are scaled by U = longSide / 1200 for other video sizes. */

const BASE = 1200;
const FX = {
  GRAVITY: 1100, VEL_DAMP: 2.2, REFORM_RATE: 1.7,
  TORNADO_SPIN: 320, TORNADO_PULL: 40, TORNADO_EASE: 3.0, TORNADO_RADIUS_FRAC: 0.20,
  DRAIN_SPIN: 210, DRAIN_PULL: 200, DRAIN_EASE: 2.4,
  ORBIT_SPIN: 300, ORBIT_EASE: 2.6,
};
const CINE = {
  SUCK_S: 0.09, SUCK_V: 300, FRONT_V: 3000, BLAST_V: 3500, SCATTER: 0.5,
  SMOKE: { p: 0.72, k: 0.95, lin: 1.0, quad: 0.012 }, DEBRIS: { p: 0.24, k: 1.2, lin: 0.6, quad: 0.007 },
  EMBER: { k: 1.9, lin: 0.7, quad: 0.0015 },
  CURL_A: 50, CURL_K: 0.012, CURL_T0: 0.2, CURL_T1: 1.6,
  SHAKE_PX: 7, SHAKE_TAU: 0.12,
};
const WELL = { D: 1.0, T: 1.3, SPIN: 1.1, KEEP: 0.015 };   // implode: an eased swallow into the tap
const CURL_G = 32;

function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const cineEase = u => { u = u < 0 ? 0 : u > 1 ? 1 : u; return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };

export function createActions(api) {
  /* field references, refreshed from the engine every frame (the engine replaces its arrays on a rebuild) */
  let N = 0, W = 1, H = 1, U = 1, Uc = 1, baseX, baseY, mOffX, mOffY, lastOff = null;
  let velX = null, velY = null;
  let cineVX = null, cineVY = null, cineDel = null, cineMatI = null;
  let effect = null;        // 'tornado' | 'drain' | 'orbit' | 'fall' | 'rise' | 'explode' | 'implode' | null
  let cine = null;
  let fxCx = 0, fxCy = 0, reformT = 0;
  let velDamp = 1, tornRad = 1, reformDecay = 1;
  let curlGX = null, curlGY = null, curlCW = 1, curlCH = 1;
  const CINE_LIN = new Float32Array(3), CINE_QUAD = new Float32Array(3);
  const look = { b: 1, z: 1, tint: [1, 1, 1] };
  const out = { on: false, reforming: false, look };

  function refresh() {
    const f = api.field();
    if (!f || !f.mOffX) return false;
    if (f.mOffX !== lastOff) {          // a rebuild: new arrays, old effect makes no sense
      lastOff = f.mOffX; clear();
      if (!velX || velX.length !== f.N) { velX = new Float32Array(f.N); velY = new Float32Array(f.N); }
      else { velX.fill(0); velY.fill(0); }
      reformT = 0;
    }
    N = f.N; W = f.W; H = f.H; baseX = f.baseX; baseY = f.baseY; mOffX = f.mOffX; mOffY = f.mOffY;
    U = Math.max(W, H) / BASE;
    Uc = Math.min(W, H) / 500;   // explode / implode: the iPhone's field is about 500 units across its short side
    return true;
  }
  function clear() {
    effect = null; cine = null;
    const cv = api.canvas && api.canvas();
    if (cv && cv.style.transform) cv.style.transform = '';
    look.b = 1; look.z = 1; look.tint = [1, 1, 1];
  }
  function origin(px, py) {
    if (typeof px === 'number' && typeof py === 'number') return { ox: px, oy: py };
    return { ox: W / 2, oy: H / 2 };
  }

  /* ---------- explode / implode: the iPhone app's cinematic versions ---------- */
  function cineMatOf(i) {
    const h = ((Math.imul(i, 2654435761) >>> 8) & 1023) / 1023;
    return h < CINE.SMOKE.p ? 0 : h < CINE.SMOKE.p + CINE.DEBRIS.p ? 1 : 2;
  }
  const MATS = [CINE.SMOKE, CINE.DEBRIS, CINE.EMBER];
  function cineLight(kind, t, tp) {
    if (kind === 'explode') {   // no flash, swell or tint (Cia, 2026-11-19); the screen shake stays
      const tb = t - CINE.SUCK_S;
      return { b: 1, z: 1, tint: [1, 1, 1], shake: tb >= 0 && tb < 0.6 ? CINE.SHAKE_PX * Math.exp(-tb / CINE.SHAKE_TAU) : 0 };
    }
    const pre = Math.min(1, t / 1.2), g = tp < 0 ? 0 : tp < 0.06 ? tp / 0.06 : Math.exp(-(tp - 0.06) / 0.14);
    const settle = tp < 0 ? 0 : Math.min(1, tp / 0.4);   // the packed knot dims smoothly so it keeps its colours
    return { b: 1 + 0.15 * pre + 0.8 * g - 0.4 * settle, z: 1 + 0.2 * g, tint: [1, 1 - 0.1 * g, 1 - 0.2 * g], shake: CINE.SHAKE_PX * 0.5 * g };
  }
  function cineStart(kind, x, y) {
    clear(); reformT = 0; velX.fill(0); velY.fill(0);
    effect = kind;
    const r = mulberry32((performance.now() * 7717) | 0);
    cine = { kind, t: 0, ox: x, oy: y, tb: -1, tp: -1, curl: false, rng: r };
    if (!cineVX || cineVX.length !== N) { cineVX = new Float32Array(N); cineVY = new Float32Array(N); cineDel = new Float32Array(N); cineMatI = new Uint8Array(N); }
    if (kind === 'implode') {
      let far = 1;
      for (let i = 0; i < N; i += 7) { const dx = baseX[i] + mOffX[i] - x, dy = baseY[i] + mOffY[i] - y; far = Math.max(far, dx * dx + dy * dy); }
      far = Math.sqrt(far);
      for (let i = 0; i < N; i++) {
        const dx = baseX[i] + mOffX[i] - x, dy = baseY[i] + mOffY[i] - y;
        cineVX[i] = mOffX[i]; cineVY[i] = mOffY[i]; cineDel[i] = Math.min(1, Math.sqrt(dx * dx + dy * dy) / far);
      }
      return;
    }
    const reach = Math.max(W, H) * 0.5;
    for (let i = 0; i < N; i++) {   // one pass: intake velocity now, blast velocity and front delay stored for later
      let dx = baseX[i] + mOffX[i] - x, dy = baseY[i] + mOffY[i] - y, d = Math.hypot(dx, dy);
      if (d < 1e-3) { dx = r() - 0.5; dy = r() - 0.5; d = Math.hypot(dx, dy) || 1; }
      const nx = dx / d, ny = dy / d, k = CINE.SUCK_V * Uc * Math.exp(-d / (260 * Uc));
      velX[i] = -nx * k; velY[i] = -ny * k;
      const a = (r() - 0.5) * CINE.SCATTER, ca = 1 - a * a * 0.5, sa = a;   // small-angle rotation
      const m = cineMatOf(i); cineMatI[i] = m;
      const u1 = r(), v = CINE.BLAST_V * Uc * MATS[m].k * (0.55 + 0.9 * Math.exp(-d / reach)) * (0.35 + u1 * Math.sqrt(u1));
      cineVX[i] = (nx * ca - ny * sa) * v; cineVY[i] = (nx * sa + ny * ca) * v; cineDel[i] = d / (CINE.FRONT_V * Uc);
    }
  }
  function cinePrep(dt) {
    if (!cine) { look.b = 1; look.z = 1; look.tint = [1, 1, 1]; return; }
    cine.t += dt;
    if (cine.kind === 'explode') {
      if (cine.t >= CINE.SUCK_S) cine.tb = cine.t - CINE.SUCK_S;
      for (let j = 0; j < 3; j++) { CINE_LIN[j] = MATS[j].lin * dt; CINE_QUAD[j] = MATS[j].quad / Uc * dt; }   // quad per unit speed: speeds scale with Uc
      cine.curl = cine.tb > CINE.CURL_T0 && cine.tb < CINE.CURL_T1;
      if (cine.curl) {
        if (!curlGX) { curlGX = new Float32Array(CURL_G * CURL_G); curlGY = new Float32Array(CURL_G * CURL_G); }
        curlCW = W / (CURL_G - 1); curlCH = H / (CURL_G - 1);
        const tb = cine.tb, f = Math.min(1, (tb - CINE.CURL_T0) / 0.25) * (1 - (tb - CINE.CURL_T0) / (CINE.CURL_T1 - CINE.CURL_T0)), k = CINE.CURL_K / Uc, A = CINE.CURL_A * Uc * f * dt;
        for (let gy = 0; gy < CURL_G; gy++) for (let gx = 0; gx < CURL_G; gx++) {
          curlGX[gy * CURL_G + gx] = A * Math.sin(gy * curlCH * k + tb * 1.3);
          curlGY[gy * CURL_G + gx] = A * Math.cos(gx * curlCW * k - tb * 1.1);
        }
      }
    } else if (cine.tp < 0 && cine.t >= WELL.D + WELL.T * 0.9) cine.tp = 0;   // the last points arrive
    else if (cine.tp >= 0) cine.tp += dt;
    const L = cineLight(cine.kind, cine.t, cine.tp);
    look.b = L.b; look.z = L.z; look.tint = L.tint;
    const cv = api.canvas && api.canvas();   // a CSS transform on the canvas is composited, no layout
    if (cv) {
      if (L.shake > 0.3) cv.style.transform = 'translate(' + ((cine.rng() - 0.5) * 2 * L.shake).toFixed(1) + 'px,' + ((cine.rng() - 0.5) * 2 * L.shake).toFixed(1) + 'px)';
      else if (cv.style.transform) cv.style.transform = '';
    }
  }
  function cineStep(i, dt) {
    if (cine.kind === 'explode') {
      const tb = cine.tb;
      if (tb < 0) return;                                   // intake
      const del = cineDel[i];
      if (del >= 0) { if (tb < del) { velX[i] *= 0.9; velY[i] *= 0.9; return; } velX[i] = cineVX[i]; velY[i] = cineVY[i]; cineDel[i] = -1; }   // the front arrives
      const m = cineMatI[i], vx = velX[i], vy = velY[i];
      const x = CINE_LIN[m] + CINE_QUAD[m] * Math.sqrt(vx * vx + vy * vy), k = 1 / (1 + x + 0.5 * x * x);
      let nx = vx * k, ny = vy * k;
      if (m === 0 && cine.curl) {   // smoke: nearest cell of the frame's curl grid
        let gx = ((baseX[i] + mOffX[i]) / curlCW + 0.5) | 0, gy = ((baseY[i] + mOffY[i]) / curlCH + 0.5) | 0;
        gx = gx < 0 ? 0 : gx >= CURL_G ? CURL_G - 1 : gx; gy = gy < 0 ? 0 : gy >= CURL_G ? CURL_G - 1 : gy;
        nx += curlGX[gy * CURL_G + gx]; ny += curlGY[gy * CURL_G + gx];
      }
      velX[i] = nx; velY[i] = ny;
      return;
    }
    // eased well: from the start position, rotate by share x spin and scale toward the tap by share x ease
    const sx = baseX[i] + cineVX[i] - cine.ox, sy = baseY[i] + cineVY[i] - cine.oy;
    const pr = cineEase((cine.t - WELL.D * cineDel[i]) / WELL.T), k = 1 - pr * (1 - WELL.KEEP);
    const an = WELL.SPIN * pr, a2 = an * an, ca = 1 - a2 * 0.5 + a2 * a2 / 24, sa = an * (1 - a2 / 6);
    mOffX[i] = cine.ox + (sx * ca - sy * sa) * k - baseX[i]; mOffY[i] = cine.oy + (sx * sa + sy * ca) * k - baseY[i];
    velX[i] = 0; velY[i] = 0;
  }

  /* ---------- the homepage's actions ---------- */
  function fire(name, px, py) {
    if (!refresh()) return false;
    if (name === 'explode' || name === 'implode') {
      const o = origin(px, py); cineStart(name, o.ox, o.oy);
    } else if (name === 'tornado' || name === 'drain' || name === 'orbit') {
      const o = origin(px, py); fxCx = o.ox; fxCy = o.oy; clear(); effect = name; reformT = 0;
    } else if (name === 'fall' || name === 'rise') {
      const up = name === 'rise', rng = mulberry32((performance.now() * (up ? 6113 : 5039)) | 0);
      for (let i = 0; i < N; i++) {
        velX[i] += (rng() - 0.5) * 130 * U;
        velY[i] += up ? -(rng() * rng() * 220 + 30) * U : (rng() * rng() * 220 - 30) * U;
      }
      clear(); effect = name; reformT = 0;
    } else return false;
    return true;
  }
  function reform() {
    if (!refresh()) return false;
    const wasFall = effect === 'fall';
    clear(); reformT = 3.4;
    if (wasFall) {
      // after a fall the reset reads as a fall-in from above: lift every point above its home, staggered, let the decay lower it
      const rng = mulberry32((performance.now() * 7919) | 0);
      for (let i = 0; i < N; i++) {
        mOffX[i] = (rng() - 0.5) * 40 * U;
        mOffY[i] = -(baseY[i] + 60 * U + rng() * H * 0.7);
        velX[i] = 0; velY[i] = 0;
      }
    } else { velX.fill(0); velY.fill(0); }
    return true;
  }

  /* per frame, before the point loop */
  function prep(dt) {
    if (!refresh()) { out.on = false; out.reforming = false; return; }
    out.on = effect !== null;
    out.reforming = reformT > 0;
    velDamp = Math.exp(-FX.VEL_DAMP * dt);
    tornRad = Math.min(W, H) * FX.TORNADO_RADIUS_FRAC;
    reformDecay = Math.exp(-FX.REFORM_RATE * dt);
    if (reformT > 0) reformT = Math.max(0, reformT - dt);
    if (cine) cinePrep(dt);
  }
  /* per point, only while an effect runs */
  function apply(i, dt) {
    const e = effect;
    if (e === 'tornado' || e === 'drain' || e === 'orbit') {
      const dx = (baseX[i] + mOffX[i]) - fxCx, dy = (baseY[i] + mOffY[i]) - fxCy;
      const r = Math.sqrt(dx * dx + dy * dy) || 1, nx = dx / r, ny = dy / r;
      let tvx, tvy, ease;
      if (e === 'tornado') {
        const gain = Math.exp(-r / tornRad) * U;
        tvx = (-ny * FX.TORNADO_SPIN - nx * FX.TORNADO_PULL) * gain;
        tvy = (nx * FX.TORNADO_SPIN - ny * FX.TORNADO_PULL) * gain;
        ease = FX.TORNADO_EASE;
      } else if (e === 'drain') {
        // per-point stable randomness so the drain churns instead of spinning like clockwork
        const h1 = ((Math.imul(i, 2246822519) >>> 8) & 1023) / 1023, h2 = ((Math.imul(i, 3266489917) >>> 7) & 1023) / 1023;
        const spin = FX.DRAIN_SPIN * U * (0.62 + h1 * 0.76), pull = FX.DRAIN_PULL * U * (0.55 + h2 * 0.90), wob = (h1 - h2) * 0.5;
        const wnx = nx + ny * wob, wny = ny - nx * wob;
        tvx = -wny * spin - wnx * pull; tvy = wnx * spin - wny * pull;
        ease = FX.DRAIN_EASE;
      } else {
        // orbit: pure tangential velocity, so each point circles the pivot at its radius (a galaxy swirl)
        const h = ((Math.imul(i, 40503) >>> 9) & 1023) / 1023, spin = FX.ORBIT_SPIN * U * (0.8 + h * 0.4);
        tvx = -ny * spin; tvy = nx * spin; ease = FX.ORBIT_EASE;
      }
      const k = Math.min(1, dt * ease);
      velX[i] += (tvx - velX[i]) * k; velY[i] += (tvy - velY[i]) * k;
    } else if (e === 'fall' || e === 'rise') {
      const h = ((Math.imul(i, 2654435761) >>> 8) & 1023) / 1023, g = FX.GRAVITY * U * (0.5 + h * 1.1) * dt;
      velY[i] += e === 'fall' ? g : -g;
      velX[i] += (h - 0.5) * 26 * U * dt;
      velX[i] *= velDamp; velY[i] *= velDamp;
    } else if (cine) cineStep(i, dt);
    else { velX[i] *= velDamp; velY[i] *= velDamp; }
    mOffX[i] += velX[i] * dt; mOffY[i] += velY[i] * dt;
  }
  /* after apply(): while reforming, ease every offset home instead of the wake return */
  function settle(i) { mOffX[i] *= reformDecay; mOffY[i] *= reformDecay; }

  return { fire, reform, prep, apply, settle, clear, state: out,
    get effect() { return effect; } };
}
