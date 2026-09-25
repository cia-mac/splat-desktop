# Phase 0 results v2: bake on import, sorted points

- Date: 2026-09-24. Continues `RESULTS_v1.md` (unchanged). Author: Claude Sonnet 5.
- Same machine and page: Safari 27.2 on macOS 26.7.1, canvas 3452x1996 device px, DA-V2 Small fp16 on the WebGPU EP at 518x294.
- Data: `results/run5/` (`bench_render-shots-bake.json`, screenshots). Contact sheets in `results/selected/`.
- This run completed cleanly (no recorder stall). I did not run the 4K MediaRecorder recordings again.

## 1. Bake on import works, and it is cheap

Clip: the 10 s `default` cut, depth for every 2nd frame (150 frames), normalized over the whole clip, then smoothed [0.25 0.5 0.25] across neighboring frames.

| | Result |
| --- | --- |
| Bake time, 10 s clip | **15.4 s** (102 ms per baked frame; inference median 87 ms, the rest is seek and readback) |
| Bake time at every frame (extrapolated, not run) | about 31 s |
| Memory, float32 | 91 MB for 150 frames (about 0.6 MB per frame). Quantizing to 8 or 16 bit is an easy next cut. |
| Flicker (mean abs change per baked frame) | raw **0.72%**, smoothed **0.48%** (about a third lower) |
| Playback | surfels 98k: 60 fps cap, 2 ms sync frame. Sorted points 686k: 60 fps cap, 1 ms sync frame, sort 3 ms. |

- Two things live depth cannot do, both now confirmed:
  - **No lag.** Depth is looked up on the video clock (two nearest baked frames blended), so color and depth are the same instant. Compare the hand and banana in `results/selected/sheet_bake.jpg` with the smear in the v1 recording.
  - **The smoothing uses future frames.** Live smoothing only has the past, and pays for it with lag.
- Whole-clip normalization removed the per-frame "pumping" the plan warned about. Raw flicker also fell from 0.91% (live, run 2) to 0.72% (baked), because per-frame range adaptation no longer contributes. The two runs used different clip sections, so this is suggestive, not a controlled comparison.
- Bake speed is the WebGPU ceiling from v1 (about 9 to 10 frames/s). Apple's published Core ML figure (25 to 34 ms) would be about 3x faster; **not measured**.

## 2. Sorted points ("keep today's Pointfield look, add depth")

Render cost at 98k / 392k / 686k (sync ms per frame): **1 / 2 / 2 ms.** Sort median 2 to 3 ms, p95 3 to 4 ms. It holds 60 fps.

Look (`results/selected/sheet2_default.jpg`: top left unsorted points, top right sorted points, bottom left surfels, bottom right sorted points at +15°):
- Sorting helps only a little. Points from behind still show through the subject, because each point is only 55% opaque and softly edged.
- It reads as **hazy and noisy** next to surfels, especially on the face.
- So "just add depth to the points" is **viable, but a different, softer, grainier look.** It is not a shortcut to the surfel look.

Which one you like is the deciding question for the naming split in the plan.

## 3. Updated summary against the plan

| Question | Answer now |
| --- | --- |
| Is depth fast enough on this Mac? | Yes at 518x294: 66 to 119 ms per frame. |
| Best way to use it on imported video? | **Bake on import.** 15 s for a 10 s clip; no lag; smoothed. |
| Best primitive? | **Surfels.** Cleanest, cheapest to reason about, 7 ms at 686k. |
| Can it stay in WebGL2 / Three.js r170? | Yes, no WebGPU renderer needed. |
| Live depth (camera, scrubbing)? | Still about 9 Hz with smear. Needs Core ML or iPhone hardware depth. |
| Points-only depth mode? | Works, but looks hazier. Needs the sort (2 to 3 ms). |

## 4. Still not done

- **Your eyes.** Whether ±15° parallax is clearly better than the flat field is the open half of D-0453's prediction. Open `http://127.0.0.1:8791/` in Safari (Bake depth, then Depth: baked, then Play).
- Core ML / Neural Engine speed.
- iPhone: WebGPU inside WKWebView, hardware depth, thermals.
- Baked playback on the night clip (`luchi`); scrubbing and seeking behavior; a persisted depth file format (today the bake lives in memory only).
- MediaRecorder at 4K stalled once in v1. The cause is not established.

## 5. Suggested next step

Persist the bake and pick a format:
- 8-bit quantized depth, with the clip's low and high stored beside it;
- a small binary sidecar file next to the video (about 23 MB for 10 s at 8 bit, 518x294, every 2nd frame);
- load it in the page instead of computing.

That is what the app would need for scrubbing and seeking. If the look is approved, this is the last piece before choosing between "sibling app" and "points-only mode".
