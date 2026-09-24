# Pointfield depth splats: plan v1

- Date: 2026-09-24
- Lane: Pointfield (app). Reads Pointfield MAS worktree and Pointfield Camera for context.
- Author: Claude Opus 5.5, planning session. No code, build, deploy, push or App Store Connect action was taken.
- Status: PROPOSED. Nothing here is a decision until Cia says so. The verdict is recorded in DECISION_LOG.md.
- Second opinion: ChatGPT via /consult, logged at `~/Developer/agent-notes/consults/20260924_005421.md`. Where I disagree with it, this document says so.

---

## 0. The flaw in the premise (read this first)

The ask is "a new version that uses splats instead of particles, and estimates depth." Two parts of the shipped public claim become false the moment this ships as Pointfield:

1. **"Not Gaussian splatting."** The claim appears on ciamac.com/pointfield (`index.html` lines 214 and 256), in both diagram specs, and in the paper. Per-cell anisotropic Gaussians with depth-sorted alpha are Gaussian splatting in any reader's understanding, even without a trained 3DGS scene. The consult agreed.
2. **"Not AI."** The same sentence says it. Monocular depth estimation runs a neural network (Depth Anything V2 is a ViT). A second violated claim was not in the brief, and it is the bigger one. "A renderer, not AI" is Pointfield's most distinctive line in a market full of AI video apps.

The visual value Cia is after is **depth and parallax**, not the splat primitive itself. Depth can be added to the existing points without changing the primitive. So the plan separates two questions the ask bundles together:

- Does depth parallax make the field better? (Depth, needs AI or hardware depth.)
- Does a splat primitive look better than the glowing points in 3D? (Primitive, triggers "splatting".)

The 48-hour prototype answers both side by side (section 6).

---

## 1. What "splats" means here

| Option | What it is | Real time from video? | Verdict |
| --- | --- | --- | --- |
| A. Per-pixel 2D Gaussians, screen-space | What Pointfield already draws: soft `gl_PointCoord` discs, no depth | Yes, shipping | Not new |
| **B. Per-cell depth surfels ("2.5D splats")** | One anisotropic Gaussian per grid cell, lifted to 3D by a depth map, flattened along the surface normal taken from the depth gradient, color from the cell | Yes, if depth runs at 10 to 30 Hz | **Recommended** |
| C. Feed-forward single-image to 3DGS (Apple SHARP, Flash3D, Splatter Image) | A network regresses full 3D Gaussians from one photo | No. SHARP is under 1 s per image on a desktop GPU, and its weights are **research-only** (Apple ML Research Model License, `LICENSE_MODEL` in apple/ml-sharp, checked 2026-09-24). Cannot ship. | Excluded |
| D. True 3DGS reconstruction | Multi-view capture plus minutes of optimization | No. One video frame has one viewpoint. | Excluded |

**Why B.** It is the only option that is real-time, license-clean and honest about what it is. It is also a direct extension of the existing sampling grid: the 417x235 grid already gives one color per cell, and depth adds one z per cell.

Its fundamental limit, stated up front: **a single depth layer has nothing behind the foreground.** Orbit far enough and the background tears open behind a subject ("disocclusion"). Soft, larger splats hide small tears by smearing foreground color; they do not reconstruct anything. So orbit must be **bounded** (starting range ±15° yaw, ±8° pitch; the prototype tunes it). Treat this as a design constraint, not a bug to fix later.

Surfel detail (for B):
- Position: unproject cell center `(u, v)` with a fixed virtual FOV and depth `z = near + (1 - d) * range`, where `d` is DA-V2's relative inverse depth, normalized **per clip, not per frame** (per-frame min/max normalization causes global "pumping", a point the consult raised).
- Orientation: normal from central differences of the depth map. Covariance = a disc of radius about the cell size, squashed along the normal. Optional: stretch along the image structure-tensor direction for a brushstroke look.
- Count: **one surfel per cell to start** (97,995 at the default grid). The current 7-per-cell cluster adds rendering cost without adding measured geometry. Keep the cluster as an artistic option (members jittered in depth for a volumetric look) once the base works.

---

## 2. Monocular depth options

All numbers are cited. "Measured" means measured in this session.

| Model | Params | Size | Latency | License | App Store shippable? |
| --- | --- | --- | --- | --- | --- |
| **Depth Anything V2 Small** | 24.8M | CoreML F16 49.8 MB (F32 99.2 MB); ONNX fp16 49.6 MB, q8 27.3 MB, q4f16 19.1 MB | CoreML on the Neural Engine, 518x396 input: iPhone 12 Pro Max 31.10 ms, iPhone 15 Pro Max 33.90 ms, M1 Max 32.80 ms, M3 Max 24.58 ms | **Apache-2.0** | **Yes** |
| DA-V2 Base / Large / Giant | 97.5M / 335M / 1.3B | larger | slower | CC-BY-NC-4.0 | No |
| Video Depth Anything Small | 28.4M | ~similar | 7.5 ms/frame FP16 on an **A100**, 32-frame 518x518 window, 6.8 GB VRAM. No phone numbers exist. Experimental streaming mode loses accuracy (ScanNet δ1 0.926 to 0.836). | **Apache-2.0** (Base/Large are NC) | License yes; phone performance unproven |
| Apple Depth Pro | ~504M (secondhand) | large | 0.3 s for 2.25 MP on "a standard GPU" | Weights: Apple ML Research license (HF tag `apple-amlr`), research only | **No** |
| MiDaS v2.1 small 256 | 21M | small | "90 FPS" in the repo's own table (desktop GPU) | MIT | Yes, but clearly weaker quality. Fallback only. |

Sources: github.com/DepthAnything/Depth-Anything-V2; huggingface.co/apple/coreml-depth-anything-v2-small (latency table confirmed independently by the research agent and the consult); huggingface.co/onnx-community/depth-anything-v2-small (file tree); github.com/DepthAnything/Video-Depth-Anything; huggingface.co/apple/DepthPro; github.com/isl-org/MiDaS; github.com/apple/ml-sharp `LICENSE_MODEL`.

**Not found or unverified:** no trustworthy in-browser WebGPU latency for DA-V2 Small. The only public figure is an unpinned "<200 ms" claim with no device or resolution. The prototype measures it (section 6).

**Pick: Depth Anything V2 Small.** It is the only candidate that is commercial-clean, has an Apple-published on-device conversion, and has a real latency table. MiDaS is the fallback if DA-V2 cannot hit budget on the oldest supported device.

**Delivery path (a place where I partly disagree with the consult):**
- The consult picks CoreML through a native plugin and warns, correctly, that WKWebView has **no public API to hand a native `MTLTexture` to WebGL**. The depth map has to cross the bridge as bytes: at one 16-bit channel per cell, 417x235 is 195,990 bytes, about 5.9 MB/s at 30 Hz. The raw bandwidth is fine; the serialization is the cost. Pointfield already paid for base64/serde overhead on the Tauri IPC path during recording (the 2026-09-04 audit), so this is a known risk, not a guess.
- For **imported video on the Mac**, the frames already live in the webview. Running ONNX on WebGPU there (onnxruntime-web / transformers.js) **avoids the bridge entirely**. The only copy is reading back a ~196 KB depth buffer into a WebGL texture, or none at all if the renderer moves to WebGPU. Measured this session: a `WKWebView` on macOS 26.7.1 exposes `navigator.gpu` with a working adapter, `shader-f16` and `timestamp-query`. Apple's WebKit blog puts WebGPU on by default from Safari 26 / macOS 26 / iOS 26. There are forum reports of WKWebView not exposing it in some iOS configurations, so iOS stays **unverified until tested on a device**.
- **Recommendation:** use WebGPU in the webview for the Mac prototype and the Mac v1 (no bridge, one codebase with the browser). Keep CoreML behind a native plugin as the **fallback** if WebGPU inference misses budget, and as the **likely iPhone path** (Neural Engine, lower thermals, and on iPhone the camera frames originate natively anyway). The prototype's numbers decide.

**Per frame vs keyframes:**
- DA-V2 has no temporal constraint. Expect "breathing" depth and unstable edges on moving subjects. Nobody publishes a flicker figure that transfers to this footage, so measure it on Cia's clips, **in rendered parallax** rather than on grayscale previews. Flicker that is invisible at 0° of orbit becomes visible at 15°.
- Start at **15 Hz depth updates, decoupled from render rate**. Keep one inference in flight and drop stale frames; never queue.
- Smoothing, in order of cost:
  1. Per-clip normalization (free, mandatory).
  2. EMA on depth with an edge-aware reset: cheap, but it trails behind motion.
  3. Flow-guided warp of the previous depth plus scale/shift alignment, with history rejected at occlusions and reset on cuts. Better, but flow is itself a second model or a second cost.
- **Alternative that removes the live-depth problem for imported clips: bake on import.** Run Video Depth Anything Small offline once per clip on the Mac (temporally consistent, Apache-2.0), store the depth track beside the video, and play it back live. The render stays fully interactive; only depth is precomputed. This is likely the highest-quality Mac path and should be tested in Phase 1 if the live flicker is unacceptable.
- **iPhone live camera: do not use a model at all where hardware depth exists.** Use `AVCaptureDepthDataOutput` plus `AVCaptureDataOutputSynchronizer` (dual-camera / TrueDepth / LiDAR), or ARKit `smoothedSceneDepth` on LiDAR Pro models. It is metric, temporally smoothed and free, and on that path **"Not AI" stays true**. The catch is that it needs a native Capacitor plugin (`getUserMedia` does not deliver depth) and only covers devices with the hardware.

---

## 3. Renderer architecture

**Can it stay WebGL2 / Three.js r170?** Yes, for the recommended design, if the transparency problem is solved without a global sort.

The current material is premultiplied "over" blending (`One, OneMinusSrcAlpha`, `depthWrite: false`, `ui/app.js` in the MAS tree). That order dependence is harmless today because everything sits at z = 0. In 3D it is not harmless. Three options, cheapest first:

1. **Surface-splatting passes (EWA / Botsch-style), no sort.** Pass 1 writes depth only, offset by ε. Pass 2 additively accumulates weighted color for every splat within ε of the front surface into a float target. Pass 3 normalizes. Order-independent, exactly suited to a single-layer surface, and possible in WebGL2 with `EXT_color_buffer_float`. **Recommended default.**
2. **Weighted blended OIT (McGuire 2013), no sort.** A single pass plus a composite. Approximate, and cheaper than (1), but mixes foreground and background at edges. It is the fallback if (1) is too expensive.
3. **True depth-sorted alpha.** Needed only for the "volumetric cluster" art mode.
   - Sort cost: a 16-bit counting sort in a Worker (the approach of antimatter15/splat and GaussianSplats3D, whose WASM counting sort runs on WebGL2). **No published per-sort timings exist for ~1M splats (research agent: not found).**
   - My estimate, to be measured: low single-digit ms at 98k and around 10 ms at 700k on an M-series CPU, plus index re-upload. It runs asynchronously, so a one-frame-stale order is acceptable.
   - Sort only when the camera moves past a threshold or the depth map updates.
   - A GPU radix sort needs WebGPU (third-party WebGPU viewers claim 1M+ Gaussians at 50+ fps; unverified).

The scale sweep matters: 98k (one per cell), 400k, and 700k (the current default particle count). The prototype measures fps at each and for each compositing option.

**Camera.** Three.js `PerspectiveCamera` replaces the current flat view. Bounded orbit around a pivot at the median scene depth, eased return to front view on release, and a subtle idle sway so depth reads without input.

**CPU hot loop.** `updateMouseOffsets` loops over all N on the CPU every frame (686k today). In 3D the cursor becomes a ray, and this loop must move to the GPU. Two routes:
- Stateless: cursor ray and hit point as uniforms, offset computed in the vertex shader.
- Stateful: a ping-pong float texture holding offset and velocity, to keep the "wake return" decay.

This is required work, not an optimization.

**When WebGPU or Metal become necessary:**
- WebGPU if (a) the sorted art mode must reach 700k at 60 fps, or (b) the ONNX output should stay GPU-resident. Cost: Three.js `WebGPURenderer` means a Three.js upgrade (a guardrail in the project CLAUDE.md: needs Cia's explicit go), and **minimum OS becomes macOS 26 / iOS 26**. The MAS lane's pending item sets minimum macOS to 12.0, so WebGPU forks the audience.
- Native Metal only if both webview paths fail. It would be a rewrite. The ciafx-app iOS/visionOS Metal port exists as a starting point, but it is a different codebase.

---

## 4. Interaction in 3D

| Today (2D) | In 3D |
| --- | --- |
| No button: swirl | Cursor ray hits the depth surface (look up the depth map at the ray's screen UV). Swirl rotates splats **around the surface normal** at the hit point, so it reads as a vortex on the surface. |
| Left button: push | Push **along the view ray**: splats dent away from the viewer into depth, then spring back. This is the new effect only depth makes possible. |
| Right button: attract | Attract toward the hit point, pulling splats forward off the surface toward the viewer. |
| (none) | **Orbit**, which needs a new input because all three buttons are taken. Mac: cursor position drives a bounded parallax (head-tracking feel, no click) while a modifier is held or in a "Look" toggle mode; Option-drag or two-finger trackpad drag for manual orbit; scroll to dolly. |
| iPhone: touch gestures | One finger keeps the existing gestures. Two-finger drag orbits, pinch dollies. **Gyro parallax** (tilt the phone, the scene shifts) is the strongest iPhone depth demo, via DeviceMotion (permission prompt) or a native plugin. |

Recording must capture the 3D view as shown, including orbit. The existing record path records the canvas, so this should carry over, but re-verify it.

---

## 5. Platforms and order

**Mac first.**
- The desktop engine and the Three.js code live here.
- WebGPU is measured present in WKWebView on this Mac.
- Thermal headroom is larger, and the dev loop is fastest.
- Depth-on-import (bake) is natural on a desktop.

**iPhone second**, as a camera-first product: hardware depth on the live camera where available (no AI, metric depth), and CoreML DA-V2 for imported clips.

**Sequencing with the two apps in review.** Pointfield Studio 0.1.2 (ASC 6808532018) and Pointfield Camera 1.1 (ASC 6786228313) are both in App Review. **Nothing in this plan touches `mas/app-store`, the pointfield-ios tree, or either submission.** The prototype lives in a new folder in this repo on its own branch. Integration starts only after both reviews resolve.

App Store implications:
- **Model size:** +20 to 50 MB (ONNX q4f16 19.1 MB or CoreML F16 49.8 MB). Bundling in the binary is the simplest option and fine at this size. The model is data, not executable code, so bundled weights are compatible with guideline 2.5.2.
- **transformers.js** fetches from the Hugging Face Hub by default. It must be configured to `allowRemoteModels = false` with a local path, or the app makes a network call Apple will see and the privacy answers become false.
- **CSP:** onnxruntime-web needs WASM (`'wasm-unsafe-eval'`) and a local model path. Any CSP change is a guardrail item.
- **Privacy:** depth runs on device, nothing is uploaded, App Privacy stays "Data Not Collected". Camera depth on iPhone needs no new permission beyond camera access.
- **Minimum OS:** WebGPU means macOS 26 / iOS 26. The CoreML path means roughly macOS 14 / iOS 17 for the mlprogram (unverified; check the package's deployment target).
- **Review risk:** a "3D photo from AI depth" feature is ordinary. No guideline issue is expected.

**Naming and positioning** (Cia's call; the plan lays out the options):

| Option | Keeps "Not AI" and "Not splatting" true? | Cost |
| --- | --- | --- |
| A mode inside Pointfield | No. Site, both listings, paper and diagrams must be rewritten, and "a renderer, not AI" is lost. | Lowest engineering cost |
| "Pointfield 2" | No. Same claim break, with a version jump that implies the old engine was superseded. | Same |
| **A separate sibling app** sharing the engine, under its own name | **Yes.** Pointfield keeps its identity; the sibling can say "AI depth" openly. | Two listings, two review tracks |
| A depth mode in Pointfield **using only hardware depth and the existing point primitive** | **Yes**, if it stays points and uses LiDAR/TrueDepth only | iPhone Pro/LiDAR only; no depth for imported video |

**Recommendation: decide after the prototype**, because the prototype says whether the splat primitive earns its name. If depth-lifted points look as good as surfels, the last row keeps Pointfield's claims intact on iPhone, and the AI-depth Mac feature goes to a sibling. If surfels clearly win, it is a sibling app. **Do not ship it as a Pointfield mode that silently contradicts the site.**

---

## 6. Phased plan

### Phase 0: the 48-hour prototype (proves or kills)

A standalone HTML page in Safari 26 on this Mac. Safari uses the same WebKit as the WKWebView, so the numbers transfer to Tauri.

1. Load one still frame (plus one 10 s clip for step 5).
2. Run DA-V2 Small via transformers.js on WebGPU, local weights, q4f16 and fp16. **Measure** cold load and warm inference ms.
3. Build one surfel per cell from the depth map. Render with a bounded orbit.
4. Put three primitives side by side (toggle):
   - (i) the **current points**, depth-lifted, same shader;
   - (ii) surfels with the surface-splatting passes;
   - (iii) sorted alpha Gaussians.
   **Measure** fps at 98k / 400k / 700k, and the Worker sort ms for (iii).
5. On the clip, per-frame depth at 15 Hz with per-clip normalization and EMA. Judge flicker at 0° and at 15° of orbit.

**Kill criteria** (any one kills the live-depth path):
- Cia does not find the ±15° parallax clearly better than today's flat field on real footage.
- Warm WebGPU inference is over 150 ms at the grid's input size, and CoreML is not available to test in the 48 h.
- Flicker at 15° is visible and the EMA cannot tame it (this moves the live path to Phase 1's bake-on-import rather than killing depth outright).

**Deliverable:** a short results note (numbers, screenshots, and a 10 s screen recording of each primitive) plus Cia's pick.

### Phase 1: video depth (1 to 2 weeks)

- Live 15 Hz depth with flow-guided smoothing vs bake-on-import with Video Depth Anything Small. Pick on quality at 15° of orbit and on import wait time.
- Move the mouse loop to the GPU. Build the 3D interaction set from section 4.

### Phase 2: Mac integration (after both reviews resolve)

- New branch off `main` (not `mas/app-store`). Bundled local weights, CSP changes, `allowRemoteModels = false`, recording in 3D.
- Decide the WebGPU renderer vs WebGL2 and the minimum OS.
- Needs Cia's go on the Three.js upgrade if WebGPU is chosen.

### Phase 3: naming decision and Mac ship

Per section 5, canon-appended before any public copy changes. Copy and site update in the same release as the feature, never before.

### Phase 4: iPhone

- A native Capacitor plugin for `AVCaptureDepthDataOutput` / ARKit depth on the camera path.
- CoreML DA-V2 for imported clips; gyro parallax.
- **Measure sustained fps and thermals on the oldest supported iPhone.** A 34 ms model benchmark does not mean a 30 fps app.

---

## 7. Risks

1. **Claim contradiction** ("Not AI", "Not Gaussian splatting") across the site, two listings, paper and diagrams. Mitigation: section 5, decided before shipping.
2. **Disocclusion tears** under orbit. This is a hard limit of single-layer depth. Mitigation: bounded orbit and soft splats; no promise of free 3D.
3. **Temporal flicker** of per-frame depth, amplified by parallax. Mitigation: per-clip normalization, smoothing, bake-on-import.
4. **Webview bridge cost** for native CoreML output (no zero-copy texture path). Mitigation: WebGPU in the webview on Mac; measure before choosing.
5. **Minimum OS jump** to macOS 26 / iOS 26 if WebGPU becomes required.
6. **CPU interaction loop** does not scale to 3D. It must move to the GPU; the work is required.
7. **WKWebView WebGPU on iOS** is unverified (forum reports of it being unavailable in some configurations). It needs a device test before any iPhone architecture is chosen.
8. **Scope creep into renderer rewrites** while two apps are in review. Past failure pattern: "mixing rename energy with feature energy". Mitigation: the prototype is out-of-tree, and integration waits for both reviews.
9. **Relative depth is not metric.** A wrong FOV or depth range distorts faces badly in orbit. Mitigation: fixed FOV, per-clip range, a depth-strength slider.
10. **Unmeasured numbers in this plan:** WebGPU inference latency, sort ms, surfel fps, flicker. Every one is a Phase 0 measurement, not a fact.

---

## 8. Forced verdict

The bias-guard pass:
- Anti-anchoring: the ask anchors on "splats". Re-derived from the goal, the value is depth, and the primitive is secondary.
- Anti-omission: this plan names the "Not AI" break, which the brief did not.
- Anti-mirroring: this is a genuinely strong visual idea. It still does not belong inside Pointfield as currently described.

**VERDICT: Reshape.**

**WHY:** The core is alive: a depth-parallax point field is a real upgrade, and it is achievable in the existing WebGL2 stack with DA-V2 Small (Apache-2.0, 25 to 34 ms on the Neural Engine). But "Pointfield with splats and AI depth" breaks two shipped public claims. The reframe is "a depth-parallax renderer, primitive and product name decided by a side-by-side prototype", with Pointfield's "not AI" line protected, either by a sibling app or a hardware-depth-only mode.

**CHEAPEST TEST:** The 48-hour browser prototype in section 6, Phase 0. One frame and one 10 s clip; DA-V2 Small on WebGPU in Safari 26; points vs surfels vs sorted Gaussians at 98k / 400k / 700k under a ±15° orbit. Measure inference ms, fps and sort ms, and put the three in front of Cia.

**CONFIDENCE:** 65% that the Phase 0 prototype, run by 2026-10-08, shows warm DA-V2 Small WebGPU inference ≤ 150 ms on this Mac **and** Cia judges the ±15° parallax clearly better than the flat field. Scored on the Phase 0 results note.
