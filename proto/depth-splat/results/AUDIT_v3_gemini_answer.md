**1. Stale claims (834 grid and edge cutoff)**

* **Grid calculations are correct:** The audit accurately computes the new 834 interactive default counts. At `K=1`, `834 * 470 = 391,980` (proto.js:15-16).
* **Edge cutoff is correct:** The audit correctly identifies that the threshold uses a hardcoded reference grid. Code (`proto.js:500-501`) explicitly overrides the per-cell `du/dv` with fixed 417-based offsets: `float eu = 1.0 / 417.0, ev = 1.0 / 235.0;`.

**2. Causes of heavy grain (Turbulence, Gaps, Normals)**

* **Omission in the Gap/Radius formula:** The auditÕs formula for disc radius (`0.5 x cellW x Splat size x (0.85..1.15)`) is wrong and omits crucial variables. Code (`proto.js:519`) is `float r = 0.5 * cellW * uSurfScale * bgS * s * (uK > 1.0 ? 0.8 : 1.0) * mix(0.85, 1.15, j);`. The audit misses `s` (perspective scale: `(uD - p.z) / uD`), `bgS` (background scale), and the `uK` multiplier. Because `s` shrinks splats as they recede into the depth map, gaps become severely exaggerated in the background at low splat sizes.
* **Incomplete explanation of Normals/Nearest Filtering:** The audit observes bad normals at finer grids when Flatten is lowered, but misses the mechanical cause. The depth texture is strictly `THREE.NearestFilter` and 518x294 (`proto.js:238`, `proto.js:31`). At 834 columns, the sampling delta `du = 1.0 / uCols` (0.00119) is smaller than a single depth texel width (0.00193). Consequently, finite differencing (`proto.js:507`) often samples the exact same flat texel value, resulting in zero-gradients (normals pointing straight at the camera) interrupted by massive spikes at texel boundaries.

**3. The `gallery()` sort worker bug**

* **Confirmed.** The audit correctly caught a severe bug that invalidates runs 29/30 as evidence for sorted compositing. In `gallery()`, `disp.set(nd)` updates the depth array (`proto.js:1471`), and rendering is triggered. However, `maybeSort()` (`proto.js:627-635`) only messages the worker with the camera pose and `sort: true`. It does not send the depth array itself. The depth array is only dispatched to the worker in `applyBaked()` (`proto.js:401`). Therefore, `gallery()` evaluates Blobs and Dots using whatever depth map the sort worker was previously holding.

**4. Blobs, Dots, Blend as "splats"**

* **Overstated claim (Lattice Irregularity):** The audit claims the Blobs/Dots lack "lattice irregularity". This is false for multi-sample configurations. The vertex shader (`proto.js:433-436`) explicitly applies a randomized spatial offset (`memT += vec2(...) * d`) when `uK > 1.0`. The audit is only correct for `K=1`.
* **Accurate on form:** The audit correctly states Blobs and Dots lack fitted size/opacity (they use a uniform `uSortGauss` and `uSortAlpha` applied to a quad distance metric in the fragment shader, `proto.js:560-565`). Blend is correctly identified as an order-independent EWA-style surface splat via a depth pre-pass and weighted accumulation (`proto.js:534-547`).

**5. Conflict with public claims ("Not AI. Not Gaussian splatting.")**

* **Accurate assessment:** The audit correctly flags the liability. "Not AI" is completely contradicted by `depthStats.inf` (inference) timings (`proto.js:688`) and the ONNX depth model lift driving the entire geometry (`proto.js:424` `liftTop`). "Not Gaussian splatting" is structurally contradicted if Blobs/Dots (which use `exp(-r2 * uSortGauss)` to render oriented, sorted, premultiplied Gaussian discs) ship as a selectable mode.