# Pointfield depth: plan v2 (after the Phase 0 prototype)

- Date: 2026-09-24. Author: Claude Sonnet 5. Replaces nothing: `SPLAT_DEPTH_PLAN_v1.md` stays as written. This file says what the prototype changed. Details: `proto/depth-splat/RESULTS_v1.md` to `RESULTS_v12.md`, `AUDIT_v1.md`, `AUDIT_v2.md`.
- Verdict of record (D-0453) is unchanged: **Reshape.** Depth parallax is a real upgrade, but "Pointfield with AI depth and splats" would break the shipped "Not AI. Not Gaussian splatting." claims.
- Machine for all numbers: M5 Max, 64 GB. A top-end Mac. iPhone and base Macs are unmeasured.

## What the prototype established

| Question | Answer | Confidence |
| --- | --- | --- |
| Is depth fast enough on a Mac? | Yes. DA-V2 Small fp16, 518x294 on WebGPU: 39 ms (39 to 119 ms across runs). Core ML via GPU: 7.6 ms. | Measured, one machine |
| Live depth? | About 20 Hz with WebGPU at a steady 60 fps render; sync around 2 frames, borderline. | Measured; not judged in motion |
| Bake on import? | 450 depth frames in 17.8 s (30 s of footage); WebCodecs decode at about 410 fps. | Measured, Safari only |
| Frame pipeline? | **WebCodecs**, not seek-and-draw. Verified against ffmpeg frames. | Measured |
| Renderer? | WebGL2 and the vendored Three.js r170 are enough: 686k surfels in 7 ms, 60 fps everywhere. | Measured |
| Best primitive? | Order-independent surfels. Sorted points are hazier. | By eye |
| Artifact fixes? | **Keep** the edge cutoff (0.10) for dots and fringes. **Optional** the motion mask (locked-off shots only). **Rejected:** temporal smoothing, color snap, tilt fade. | By eye, 4 to 8 frames each |
| Holes behind subjects? | Real and permanent with one depth layer. Options: leave, smaller orbit (does not remove them), or background fill (works to 25°, paler, seam). | By eye |
| Fast thin objects? | Streak (motion blur read as a coherent depth). Accept, or mask on locked-off shots. | By eye |

## Corrections since plan v1

- My AUDIT_v1 claim that the seek-based frame source returned stale frames 7 to 12% of the time was a false alarm from a bad check (AUDIT_v2). The pipeline decision (WebCodecs) still stands: it is faster and does not depend on window state.
- Inference is about 2x faster than v1 measured, cause unknown.
- Live depth was ruled out in v1 and is now viable on this Mac.

## Decisions that are Cia's

1. **The look.** Is ±15° parallax clearly better than today's flat field? If not, stop; D-0453's prediction resolves as a miss.
2. **The hole policy.** Leave them, limit the orbit, or fill. My read: fill at 15°.
3. **Naming.** A separate sibling app (can say "AI depth"), or a points-only depth mode inside Pointfield (only keeps "Not AI" true if depth comes from iPhone sensors, and looks hazier).

## Build plan, if the look wins

Nothing here touches Pointfield Studio 0.1.2 or Pointfield Camera 1.1 while they are in App Review.

1. **Measure the unknown hardware.** Run `proto/depth-splat` on a base-model Mac and an iPhone (WebGPU in WKWebView, inference time, thermals). This decides WebGPU versus Core ML.
2. **Mac v1, WebGPU in the webview.** Bake on import through WebCodecs, streamed (decode, infer, discard). Persist as the PFD1 sidecar plus source hash, model and settings, and per-frame timestamps. Surfels with the edge cutoff and the background fill. Deterministic export (MediaRecorder stalled once at near-4K).
3. **Core ML only if step 1 says WebGPU is too slow.** A native plugin, raw float output (the stock model normalizes each frame), and a measured bridge cost.
4. **iPhone.** Camera depth from the sensors where available (no model, "Not AI" intact), bake for imported clips, gyro parallax.

## Risks

1. **Claim contradiction** with the shipped copy unless the naming decision is made first.
2. **Hardware spread.** Every speed number is from an M5 Max.
3. **Holes** are permanent with one layer; fill quality is limited (pale, seam).
4. **Streaks** on fast thin objects have no clean fix.
5. **Webview differences.** Safari results were not repeated in Tauri or Capacitor webviews.
6. **Core ML output** is per-frame normalized 8-bit unless re-exported.
7. **Depth-model license** is fine (Apache-2.0); keep the model bundled, `allowRemoteModels = false`.
