// Back-to-front order for the sorted-Gaussian primitive.
// Key = squared distance from the camera to the lifted cell center; every member
// of a cell shares its cell's key. 16-bit counting sort over all N splats.
let depth = null, dW = 0, dH = 0;

self.onmessage = (e) => {
  const m = e.data;
  if (m.depth) { depth = m.depth; dW = m.dW; dH = m.dH; }
  if (!m.sort || !depth) return;

  const t0 = performance.now();
  const { cols, rows, K, aspect, D, depthAmt, cam } = m;
  const cells = cols * rows, N = cells * K;

  // Per-cell distance (the lift must match liftTop() in the vertex shader).
  const dist = new Float32Array(cells);
  let lo = Infinity, hi = -Infinity;
  for (let r = 0; r < rows; r++) {
    const v = (r + 0.5) / rows;
    const ty = Math.min(dH - 1, Math.floor(v * dH));
    for (let c = 0; c < cols; c++) {
      const u = (c + 0.5) / cols;
      const tx = Math.min(dW - 1, Math.floor(u * dW));
      const dn = depth[ty * dW + tx];
      const z = depthAmt * (dn - 0.5) * 2.0;
      const s = (D - z) / D;
      const x = (u * 2 - 1) * aspect * s, y = (1 - v * 2) * s;
      const dx = x - cam[0], dy = y - cam[1], dz = z - cam[2];
      const d2 = dx * dx + dy * dy + dz * dz;
      dist[r * cols + c] = d2;
      if (d2 < lo) lo = d2; if (d2 > hi) hi = d2;
    }
  }

  // Counting sort, far first.
  const B = 65536, scale = (B - 1) / Math.max(1e-9, hi - lo);
  const key = new Uint16Array(cells);
  const count = new Uint32Array(B);
  for (let i = 0; i < cells; i++) {
    const q = Math.min(B - 1, Math.max(0, Math.floor((dist[i] - lo) * scale)));
    const k = (B - 1) - q; // far -> small key
    key[i] = k; count[k] += K;
  }
  let acc = 0;
  for (let b = 0; b < B; b++) { const c = count[b]; count[b] = acc; acc += c; }
  const order = new Float32Array(N);
  for (let i = 0; i < cells; i++) {
    let p = count[key[i]]; const base = i * K;
    for (let k = 0; k < K; k++) order[p++] = base + k;
    count[key[i]] = p;
  }
  const ms = performance.now() - t0;
  self.postMessage({ order, ms, N, seq: m.seq }, [order.buffer]);
};
