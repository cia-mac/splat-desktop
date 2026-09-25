# Audit v1: depth prototype, RESULTS v1 to v4

- Date: 2026-09-24. Auditor: Claude Opus 5.5 (session model).
- Second opinions:
  - ChatGPT via /consult with read access to this folder, logged at `~/Developer/agent-notes/consults/20260924_122755.md`.
  - **Gemini was unavailable.** Two attempts returned HTTP 503 from the Gemini API, so this is a one-voice consult.
- RESULTS_v1 to v4 are left unchanged as the record. This file says which of their claims stand.

## New evidence gathered during the audit

Frame-freshness instrumentation was added to `bake()`: `requestVideoFrameCallback` media time, plus a hash of each model input. Data: `results/run8/` and the `fresh1` run, reported inline below.

| Run | Safari visible? | Clip | Bake time | Repeated input frames | rVFC timeouts |
| --- | --- | --- | --- | --- | --- |
| v2 (earlier) | yes, just relaunched | 10 s | 15 s | not measured | not measured |
| fresh1 | no (Cia in Contacts, Mail, Photos) | 10 s | 94 s | **11 / 150 (7%)** | 10 |
| fresh1 | no | 30 s | 270 s | **53 / 450 (12%)** | 26 |
| fix2 | no | 30 s | 105 s | most of the clip (flicker 0.105%; 12 of 15 screenshots show one pose) | not measured |

**Finding A (mine, measured): the prototype's frame source is unreliable.** It seeks a paused `<video>` and then calls `drawImage`. In Safari that returned the previous frame 7 to 12% of the time with the window in the background, and in one run returned nearly the same frame for most of a clip. Bake time depends on window visibility (15 s visible vs 94 s hidden for the same 10 s clip), which explains the "unexplained" 15 to 36 s spread in v3 and v4.

**Consequence:** every bake-quality observation is contaminated to an unknown degree. That covers the flicker numbers, the v3 "head halo", the v4 "banana slivers", and the bake times.

## Claims: what stands and what does not

| Claim (source) | Status | Why |
| --- | --- | --- |
| DA-V2 Small at 518x294 is 66 to 119 ms warm on the WebGPU EP in Safari (v1) | **Stands, as workload-specific** | Measured with Safari visible, render loop running. Only 10 samples by 2 runs, so it does not rank fp16 vs q4f16; "no demonstrated q4 speed advantage" is the defensible form. (ChatGPT) |
| Rendering holds 60 fps up to 686k splats (v1, v2) | **Stands**, based on real rAF frame intervals (p95 17 to 18 ms) | The "sync frame ms" numbers are weak: synchronous loop, no fresh depth upload or sort upload, 1 ms timer resolution. Do not quote 1 vs 2 ms rankings. (ChatGPT, agreed) |
| Worker sort about 2 ms | **Stands as compute time only** | Excludes delivery and upload; approximate order (Euclidean center distance, members share the cell key). (ChatGPT) |
| Live depth 8.7 Hz with lag smear (v1) | **Stands** | Directly observed, and it follows from the inference time. |
| Flicker: raw 0.91 → 0.42% with EMA; baked 0.72 → 0.48% (v1, v2) | **Withdrawn as a quality measure** | The metric scores a constant wrong depth map as perfect, and it cannot tell model instability from real motion. Smoothing lowers it partly by blurring real motion. Live and baked numbers are aggregated differently, and bake inputs had 7 to 12% repeated frames. (ChatGPT plus Finding A) |
| Bake on import: "no lag" (v2) | **Overstated** | No causal lag, yes. But smoothing mixes depth from about ±67 ms, so moving edges get anticipatory or trailing depth. And frame correspondence was never verified; FPS was hardcoded to 30. (ChatGPT plus Finding A) |
| Bake time 15 to 36 s per 10 s (v3, v4) | **Wrong framing** | 15 s visible and 94 s hidden, for the same clip. The measurement also excluded post-processing. |
| Sidecar: 22.8 MB / 10 s, 53 ms load (v3) | **Stands** | |
| Quantization error "a quarter of an 8-bit level" (v3) | **Arithmetic error** | 0.00196 ≈ 0.5/255 is **half** a level. "Not visible" is also unproven, because depth differentiation for surfel normals amplifies it. (ChatGPT) |
| Head halo "is a model error" (v3) | **Unsupported** | Never isolated. It did not reproduce in a later bake. |
| Banana slivers in about 6 of 15 frames, "stretched splats" (v4) | **Unsupported cause; weak count** | Surfel radius is fixed and does not scale with gradient, so a bad edge normal (not stretching) is the more likely renderer cause if it is one. The inputs were partly stale. And 15 sparse screenshots do not estimate duration. |
| I flagged "missing `VideoTexture.needsUpdate`" as a bug | **My claim, withdrawn** | Three.js r170 `VideoTexture` updates itself through `requestVideoFrameCallback` (`vendor/three.module.js` around line 35607). The real problem is the bake's input path (Finding A), not the display texture. (ChatGPT) |
| Sorted points look hazy (v2) | **Stands only for these parameters** | Opacity 0.55, brightness 2.4, and coverage differ from surfels. Depth-tested opaque points are untested. (ChatGPT) |

## Where I disagree with ChatGPT

- ChatGPT says "the product decision is unchanged" is not supported. **Partly disagree.** The product-level verdict (Reshape: depth parallax, protect the "not AI" line, and Cia's visual judgment as the gate) does not rest on the contaminated measurements. What changes is the **technical recommendation**: "bake in the browser by seeking a `<video>`" is not a viable pipeline. The bake must use a deterministic decoder with real timestamps: WebCodecs `VideoDecoder` in the webview, or AVFoundation `AVAssetReader` natively in Tauri.

## Items ChatGPT raised that belong in the plan

1. **Disocclusion policy is a product decision, not a bug.** Holes behind subjects are permanent with single-layer depth. Choose one: holes as a visual style, smaller orbit or depth strength, or background fill. Measure hole area against orbit and depth strength.
2. **Export.** MediaRecorder stalled Safari once at near-4K. For a filmmaking tool, deterministic export matters more than it did in the prototype.
3. **Sidecar identity.** Store the source hash, model, settings and per-frame timestamps. The 16-bit frame count caps a clip at about 73 min at 15 samples/s.
4. **Test footage:** cuts (temporal smoothing across a cut is wrong), hair, fingers, motion blur, camera translation.

## What would settle the open questions (next test, not run)

**A matched-frame test.**
1. Extract frames deterministically: ffmpeg now, WebCodecs or native later.
2. Infer depth on those exact pixels and render that exact color frame, with no smoothing and no turbulence.
3. Then deliberately pair depth with color shifted ±1, ±2 and ±4 frames.

How to read it:
- If the halo or slivers are already present on matched raw depth, it is the model.
- If they appear only after smoothing, it is the temporal filter.
- If they follow the deliberate offset, it is synchronization.

This replaces another contact-sheet run, which would not resolve anything.

## Bottom line

- Inference speed and render headroom are sound.
- Flicker, bake-quality and artifact claims are not.
- The next step is the matched-frame test, with a deterministic frame source.
- Cia's visual judgment remains the gate, and should be made on footage produced by a correct frame pipeline.
