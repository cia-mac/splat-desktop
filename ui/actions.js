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
   Distances and speeds are the iPhone's, which has a field about 500 units across its short side (landscape: 1083 x 500).
   Everything is scaled by U = shortSide / 500, so each action covers the same share of the screen as on the phone
   (measured 2026-11-19 against the real iPhone engine: before this, tornado turned 2.4x slower, orbit moved 2.5x less
   and fall 1.4x slower, relative to the screen). */

const BASE = 500;
const TWIST_GAIN = 1.8;   // the iPhone launches tornado and orbit from a gesture at 1.8x spin; a click is the gesture here
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
  let N = 0, W = 1, H = 1, U = 1, baseX, baseY, mOffX, mOffY, lastOff = null;
  let velX = null, velY = null;
  let cineVX = null, cineVY = null, cineDel = null, cineMatI = null;
  let effect = null;        // 'tornado' | 'drain' | 'orbit' | 'fall' | 'rise' | 'explode' | 'implode' | null
  let cine = null;
  let fxCx = 0, fxCy = 0, reformT = 0, spinGain = 1, kickT = 0;
  let velDamp = 1, tornRad = 1, reformDecay = 1;
  let curlGX = null, curlGY = null, curlCW = 1, curlCH = 1;
  const CINE_LIN = new Float32Array(3), CINE_QUAD = new Float32Array(3);
  const look = { b: 1, z: 1, tint: [1, 1, 1] };
  const out = { on: false, kick: false, reforming: false, look };

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
    U = Math.min(W, H) / BASE;
    return true;
  }
  function clear() {
    effect = null; cine = null; kickT = 0; flickJob = null; impulseJob = null;
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
      const nx = dx / d, ny = dy / d, k = CINE.SUCK_V * U * Math.exp(-d / (260 * U));
      velX[i] = -nx * k; velY[i] = -ny * k;
      const a = (r() - 0.5) * CINE.SCATTER, ca = 1 - a * a * 0.5, sa = a;   // small-angle rotation
      const m = cineMatOf(i); cineMatI[i] = m;
      const u1 = r(), v = CINE.BLAST_V * U * MATS[m].k * (0.55 + 0.9 * Math.exp(-d / reach)) * (0.35 + u1 * Math.sqrt(u1));
      cineVX[i] = (nx * ca - ny * sa) * v; cineVY[i] = (nx * sa + ny * ca) * v; cineDel[i] = d / (CINE.FRONT_V * U);
    }
  }
  function cinePrep(dt) {
    if (!cine) { look.b = 1; look.z = 1; look.tint = [1, 1, 1]; return; }
    cine.t += dt;
    if (cine.kind === 'explode') {
      if (cine.t >= CINE.SUCK_S) cine.tb = cine.t - CINE.SUCK_S;
      for (let j = 0; j < 3; j++) { CINE_LIN[j] = MATS[j].lin * dt; CINE_QUAD[j] = MATS[j].quad / U * dt; }   // quad per unit speed: speeds scale with U
      cine.curl = cine.tb > CINE.CURL_T0 && cine.tb < CINE.CURL_T1;
      if (cine.curl) {
        if (!curlGX) { curlGX = new Float32Array(CURL_G * CURL_G); curlGY = new Float32Array(CURL_G * CURL_G); }
        curlCW = W / (CURL_G - 1); curlCH = H / (CURL_G - 1);
        const tb = cine.tb, f = Math.min(1, (tb - CINE.CURL_T0) / 0.25) * (1 - (tb - CINE.CURL_T0) / (CINE.CURL_T1 - CINE.CURL_T0)), k = CINE.CURL_K / U, A = CINE.CURL_A * U * f * dt;
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
  /* ---------- the homepage's actions ---------- */
  function fire(name, px, py) {
    if (!refresh()) return false;
    if (name === 'explode' || name === 'implode') {
      const o = origin(px, py); cineStart(name, o.ox, o.oy);
    } else if (name === 'tornado' || name === 'drain' || name === 'orbit') {
      const o = origin(px, py); fxCx = o.ox; fxCy = o.oy; clear(); effect = name; reformT = 0; spinGain = name === 'drain' ? 1 : TWIST_GAIN;
    } else if (name === 'fall' || name === 'rise') {
      const up = name === 'rise';
      clear(); effect = name; reformT = 0;
      impulseJob = { up, salt: (performance.now() * 2654435) | 0, pass: 0 };   // the scatter is spread over a few frames (see impulsePass)
      impulsePass();
    } else return false;
    return true;
  }

  /* fall / rise start with a random scatter on every point. Applied in IMPULSE_PASSES interleaved passes (every 4th point), the
     first on the click and one per frame after, so the click costs a quarter of a pass; the randoms are per-point hashes. */
  const IMPULSE_PASSES = 4;
  let impulseJob = null;
  function impulsePass() {
    const { up, salt, pass } = impulseJob, sx = 130 * U, sy = 220 * U, oy = 30 * U;
    for (let i = pass; i < N; i += IMPULSE_PASSES) {
      const a = ((Math.imul(i ^ salt, 2246822519) >>> 8) & 1023) / 1023, b = ((Math.imul(i + salt, 3266489917) >>> 7) & 1023) / 1023, c = ((Math.imul(i * 3 + salt, 668265263) >>> 9) & 1023) / 1023;
      velX[i] += (a - 0.5) * sx;
      velY[i] += up ? -(b * c * sy + oy) : (b * c * sy - oy);
    }
    if (++impulseJob.pass >= IMPULSE_PASSES) impulseJob = null;
  }
  /* A fast stroke throws the points near it (the iPhone's flickJet, scaled by U). No persistent effect: the points are
     thrown, then coast on a damped velocity for a moment while the wake return pulls them home. At Dense (1.2M points)
     one pass over every point costs about a frame, so the throw is applied in FLICK_PASSES interleaved passes (every 4th
     point), the first on the stroke and one per frame after it, like the homepage's explode impulse. */
  const FLICK_PASSES = 4;
  let flickJob = null;
  function flickPass() {
    const { x, y, nx, ny, v, R } = flickJob;
    for (let i = flickJob.pass; i < N; i += FLICK_PASSES) {
      const dx = baseX[i] + mOffX[i] - x; if (dx >= R || dx <= -R) continue;   // cheap box test first: most points are far away
      const dy = baseY[i] + mOffY[i] - y; if (dy >= R || dy <= -R) continue;
      const d = Math.hypot(dx, dy); if (d >= R) continue;
      const h = ((Math.imul(i, 2246822519) >>> 8) & 1023) / 1023, f = (1 - d / R) * (0.5 + h);
      velX[i] += nx * v * f + (h - 0.5) * 80 * U;
      velY[i] += ny * v * f + (((Math.imul(i, 3266489917) >>> 7) & 1023) / 1023 - 0.5) * 80 * U;
    }
    if (++flickJob.pass >= FLICK_PASSES) flickJob = null;
  }
  function flick(x, y, vx, vy) {
    if (!refresh()) return;
    const sp = Math.hypot(vx, vy); if (sp < 1) return;
    while (flickJob) flickPass();   // a second stroke mid-throw: finish the first one
    // smaller and gentler than the iPhone's jet (reach 230, cap 1600, 0.9 of the stroke speed; here reach 100, cap 900, 0.55): a mouse stroke is not a finger swipe
    flickJob = { x, y, nx: vx / sp, ny: vy / sp, v: Math.min(900 * U, sp * 0.55), R: 100 * U, pass: 0 };
    flickPass(); kickT = 2.4;
  }
  /* While the points coast after a throw (no persistent effect running): one tight loop per frame instead of a function
     call per point. The wake return in the engine's loop pulls them home at the same time. */
  function kickStep(dt) {
    const k = velDamp;
    for (let i = 0; i < N; i++) {
      const vx = velX[i] * k, vy = velY[i] * k; velX[i] = vx; velY[i] = vy;
      mOffX[i] += vx * dt; mOffY[i] += vy * dt;
    }
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
    if (!refresh()) { out.on = false; out.kick = false; out.reforming = false; return; }
    out.on = effect !== null;
    if (kickT > 0) { kickT = Math.max(0, kickT - dt); if (kickT === 0 && effect === null) { velX.fill(0); velY.fill(0); } }
    out.kick = kickT > 0 && effect === null;
    out.reforming = reformT > 0;
    velDamp = Math.exp(-FX.VEL_DAMP * dt);
    tornRad = Math.min(W, H) * FX.TORNADO_RADIUS_FRAC;
    reformDecay = Math.exp(-FX.REFORM_RATE * dt);
    if (reformT > 0) reformT = Math.max(0, reformT - dt);
    if (flickJob) flickPass();
    if (impulseJob) impulsePass();
    if (cine) cinePrep(dt);
  }
  /* One tight loop per effect (no per-point function call or branch), run after the mouse pass: each point is independent,
     so this is the same maths as doing mouse, effect and wake return point by point. */
  function stepAll(dt) {
    const e = effect;
    if (e === 'tornado') {
      const k = Math.min(1, dt * FX.TORNADO_EASE), gu = U * spinGain, invR = 1 / tornRad, SP = FX.TORNADO_SPIN, PU = FX.TORNADO_PULL;
      for (let i = 0; i < N; i++) {
        const dx = baseX[i] + mOffX[i] - fxCx, dy = baseY[i] + mOffY[i] - fxCy;
        const r = Math.sqrt(dx * dx + dy * dy) || 1, nx = dx / r, ny = dy / r, g = Math.exp(-r * invR) * gu;
        const vx = velX[i] + ((-ny * SP - nx * PU) * g - velX[i]) * k, vy = velY[i] + ((nx * SP - ny * PU) * g - velY[i]) * k;
        velX[i] = vx; velY[i] = vy; mOffX[i] += vx * dt; mOffY[i] += vy * dt;
      }
    } else if (e === 'drain') {
      const k = Math.min(1, dt * FX.DRAIN_EASE), SP = FX.DRAIN_SPIN * U, PU = FX.DRAIN_PULL * U;
      for (let i = 0; i < N; i++) {
        const dx = baseX[i] + mOffX[i] - fxCx, dy = baseY[i] + mOffY[i] - fxCy;
        const r = Math.sqrt(dx * dx + dy * dy) || 1, nx = dx / r, ny = dy / r;
        // per-point stable randomness so the drain churns instead of spinning like clockwork
        const h1 = ((Math.imul(i, 2246822519) >>> 8) & 1023) / 1023, h2 = ((Math.imul(i, 3266489917) >>> 7) & 1023) / 1023;
        const spin = SP * (0.62 + h1 * 0.76), pull = PU * (0.55 + h2 * 0.90), wob = (h1 - h2) * 0.5;
        const wnx = nx + ny * wob, wny = ny - nx * wob;
        const vx = velX[i] + ((-wny * spin - wnx * pull) - velX[i]) * k, vy = velY[i] + ((wnx * spin - wny * pull) - velY[i]) * k;
        velX[i] = vx; velY[i] = vy; mOffX[i] += vx * dt; mOffY[i] += vy * dt;
      }
    } else if (e === 'orbit') {
      // pure tangential velocity, so each point circles the pivot at its radius (a galaxy swirl)
      const k = Math.min(1, dt * FX.ORBIT_EASE), SP = FX.ORBIT_SPIN * U * spinGain;
      for (let i = 0; i < N; i++) {
        const dx = baseX[i] + mOffX[i] - fxCx, dy = baseY[i] + mOffY[i] - fxCy;
        const r = Math.sqrt(dx * dx + dy * dy) || 1, nx = dx / r, ny = dy / r;
        const h = ((Math.imul(i, 40503) >>> 9) & 1023) / 1023, spin = SP * (0.8 + h * 0.4);
        const vx = velX[i] + (-ny * spin - velX[i]) * k, vy = velY[i] + (nx * spin - velY[i]) * k;
        velX[i] = vx; velY[i] = vy; mOffX[i] += vx * dt; mOffY[i] += vy * dt;
      }
    } else if (e === 'fall' || e === 'rise') {
      const sgn = e === 'fall' ? 1 : -1, G = FX.GRAVITY * U * dt * sgn, DX = 26 * U * dt, kd = velDamp;
      for (let i = 0; i < N; i++) {
        const h = ((Math.imul(i, 2654435761) >>> 8) & 1023) / 1023;
        const vy = (velY[i] + G * (0.5 + h * 1.1)) * kd, vx = (velX[i] + (h - 0.5) * DX) * kd;
        velX[i] = vx; velY[i] = vy; mOffX[i] += vx * dt; mOffY[i] += vy * dt;
      }
    } else if (cine && cine.kind === 'explode') {
      const tb = cine.tb;
      if (tb < 0) {   // intake
        for (let i = 0; i < N; i++) { mOffX[i] += velX[i] * dt; mOffY[i] += velY[i] * dt; }
        return;
      }
      const curl = cine.curl && curlGX, cw = curlCW, ch = curlCH;
      for (let i = 0; i < N; i++) {
        let vx = velX[i], vy = velY[i];
        const del = cineDel[i];
        if (del >= 0) {
          if (tb < del) { vx *= 0.9; vy *= 0.9; velX[i] = vx; velY[i] = vy; mOffX[i] += vx * dt; mOffY[i] += vy * dt; continue; }   // waiting for the front
          vx = cineVX[i]; vy = cineVY[i]; cineDel[i] = -1;   // the front arrives
        }
        const m = cineMatI[i], x = CINE_LIN[m] + CINE_QUAD[m] * Math.sqrt(vx * vx + vy * vy), k = 1 / (1 + x + 0.5 * x * x);
        vx *= k; vy *= k;
        if (m === 0 && curl) {   // smoke: nearest cell of the frame's curl grid
          let gx = ((baseX[i] + mOffX[i]) / cw + 0.5) | 0, gy = ((baseY[i] + mOffY[i]) / ch + 0.5) | 0;
          gx = gx < 0 ? 0 : gx >= CURL_G ? CURL_G - 1 : gx; gy = gy < 0 ? 0 : gy >= CURL_G ? CURL_G - 1 : gy;
          vx += curlGX[gy * CURL_G + gx]; vy += curlGY[gy * CURL_G + gx];
        }
        velX[i] = vx; velY[i] = vy; mOffX[i] += vx * dt; mOffY[i] += vy * dt;
      }
    } else if (cine) {   // implode: eased well, from the start position, rotate by share x spin and scale toward the tap by share x ease
      const ox = cine.ox, oy = cine.oy, t = cine.t;
      for (let i = 0; i < N; i++) {
        const sx = baseX[i] + cineVX[i] - ox, sy = baseY[i] + cineVY[i] - oy;
        const pr = cineEase((t - WELL.D * cineDel[i]) / WELL.T), k = 1 - pr * (1 - WELL.KEEP);
        const an = WELL.SPIN * pr, a2 = an * an, ca = 1 - a2 * 0.5 + a2 * a2 / 24, sa = an * (1 - a2 / 6);
        mOffX[i] = ox + (sx * ca - sy * sa) * k - baseX[i]; mOffY[i] = oy + (sx * sa + sy * ca) * k - baseY[i];
        velX[i] = 0; velY[i] = 0;
      }
    } else {
      const k = velDamp;
      for (let i = 0; i < N; i++) { const vx = velX[i] * k, vy = velY[i] * k; velX[i] = vx; velY[i] = vy; mOffX[i] += vx * dt; mOffY[i] += vy * dt; }
    }
  }
  /* while reforming, ease every offset home instead of the wake return */
  function settleAll() { const k = reformDecay; for (let i = 0; i < N; i++) { mOffX[i] *= k; mOffY[i] *= k; } }

  return { fire, flick, kickStep, reform, prep, stepAll, settleAll, clear, state: out,
    get effect() { return effect; } };
}
