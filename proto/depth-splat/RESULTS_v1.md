# Phase 0 results: depth prototype v1

- Date: 2026-09-24
- Plan: `docs/SPLAT_DEPTH_PLAN_v1.md` (section 6, Phase 0). Verdict of record: D-0453.
- Author: Claude Opus 5.5.
- Machine: Cia's Mac, macOS 26.7.1, Safari 27.2 (WebKit 605.1.15).
- Canvas: 3452x1996 / 3452x2156 device px (1726x998 CSS at DPR 2). That is roughly 4K, so harder than a typical app window.
- Stack:
  - Three.js r170 (the same vendored copy the Mac app ships), WebGL2.
  - onnxruntime-web 1.30.0, WebGPU execution provider.
  - Depth Anything V2 Small from onnx-community (Apache-2.0): fp16 49.6 MB, q4f16 19.1 MB.
- Footage: 10 s cuts of `default.mp4` (a man in front of a city skyline) and `luchi.mp4` (a dancer at night with a water reflection), from ciamac-site/deploy/pointfield.
- Everything below is `[observed]` from `results/` unless marked otherwise.

## How to look at it yourself

```
cd <this folder>
python3 server.py 8791
```

Then open http://127.0.0.1:8791/ in Safari.
- Buttons switch between Points / Points sorted / Surfels / Sorted.
- "Per cell" switches 98k / 392k / 686k.
- Play runs live depth on the video. Drag to orbit (±30°). H hides the panel.
- `?bench=1` runs the automated measurement.

## 1. Depth inference (still frame, warm, median of 10)

| Model | Input | Run 1 | Run 2 | Cold load |
| --- | --- | --- | --- | --- |
| fp16 | 518x294 | **73 ms** (p90 80) | 92 ms (p90 95) | 600 ms |
| q4f16 | 518x294 | 66 ms (p90 100) | 119 ms (p90 125) | 430 ms |
| fp16 | 924x518 | 539 ms | 617 ms | |
| q4f16 | 924x518 | 594 ms | 637 ms | |

- Preprocessing (canvas draw, readback, normalize) adds 9–13 ms.
- The render loop was running at the same time, which is realistic for the app. Run-to-run spread is about 25%.
- q4f16 is **not faster** than fp16 on this Mac. It is only smaller.
- **Phase 0 threshold (≤ 150 ms warm): met at 518x294 by both variants. Missed at 924x518 (about 4x over).**

## 2. Live depth on playing video (fp16, 518x294)

| Smoothing (EMA) | Depth updates/s | Inference | Flicker, raw | Flicker, shown |
| --- | --- | --- | --- | --- |
| none | 8.7 | 98 ms | 0.91% | 0.91% |
| 0.5 | 8.7 | 94 ms | 0.93% | 0.58% |
| 0.3 | 8.8 | 95 ms | 0.89% | 0.42% |

- Flicker is the mean absolute change of normalized depth per update. It includes real motion, so it is a relative measure only.
- **The 15 Hz target was not reached.** The ceiling is about 8.7 Hz, because inference plus pre- and post-processing is about 110 ms.
- **Lag artifact** (seen in `run3/rec_surfels_K1.mp4` around 4 s): color updates at 30 fps, but depth updates at 8.7 Hz with smoothing. On fast motion, the hand's color is drawn on the face's older depth and smears. Smoothing reduces flicker and makes this lag worse; the two trade off against each other.

## 3. Rendering (orbit sweeping ±15° yaw / ±6° pitch)

Every configuration held the 60 fps rAF cap. "Sync ms" is one frame rendered and then forced to finish with a 1-pixel read, which shows the real headroom.

| Primitive | 98k | 392k | 686k |
| --- | --- | --- | --- |
| Points (today's shader, lifted) | 1 ms | 1 ms | 1 ms |
| Surfels (depth pass + accumulate + normalize) | 2 ms | 3 ms | **7 ms** (p90 10) |
| Sorted Gaussians (premultiplied over) | 2 ms | 2 ms | 3 ms |

- Worker sort: median **2 ms** at all three counts, p95 3 to 13 ms. Every member of a cell shares its cell's key, so the sort always handles 98k keys.
- **Rendering is not the bottleneck. WebGL2 and the vendored Three.js r170 are enough; there is no case here for WebGPU rendering or Metal.**

## 4. What it looks like

See `results/selected/sheet_default.jpg` and `sheet_luchi.jpg`. Each sheet shows four panels:
- top left: flat points (today);
- top right: points lifted by depth, yaw −15°;
- bottom left: surfels, yaw −15°;
- bottom right: sorted Gaussians, yaw −15°.

The full set is in `results/run3/`, with 6 s recordings of three primitives.

- **Surfels:** clean, photographic, with strong and convincing parallax. The man separates from the skyline, and the arm and banana come forward. On the night clip, the model reads the water reflection as a receding surface, which looks plausible. The disocclusion tear behind the subject is a black silhouette edged with scattered dots, exactly as the plan predicted.
- **Sorted Gaussians:** almost the same look, slightly grainier, with the same tear.
- **Today's points lifted by depth:** they **break**. With no sort and no depth test, background points draw over the man's face at −15°. So the plan's "keep the points, add depth" option cannot simply lift the points; it needs back-to-front order.
  - I built a sorted-points variant ("Points sorted": the same Pointfield shader, drawn in the worker's order, at about 2 ms per sort). Its benchmark and screenshots did **not** complete; see section 5. It runs in the page and can be checked by eye.
- The flat baseline in this page is a stand-in, not the shipping renderer. Point sizes are the app's 1.7–5.4 px at DPR 2 on a near-4K canvas, so it looks sparser than the app does in a normal window.

## 5. What failed or was not measured

- The fourth recording (flat baseline, 3452x2156) stalled Safari's tab in MediaRecorder. After that, neither Safari nor a fresh standalone WKWebView would complete another run. I stopped under STOP rule 1 rather than keep retrying. Closing and reopening Safari should clear it (not verified).
- Not measured:
  - sorted-points timings and screenshots;
  - screenshots at +15° and +30° (an early run lost them to a filename bug that is now fixed);
  - the flat-baseline recording.
- In a standalone WKWebView, swapping from the fp16 session to the q4f16 session aborted inside ORT's WASM. Safari did the same swap without a problem. For the app: **load one model once; never swap at runtime.**
- CoreML / Neural Engine was not tested. Apple's published figure is 25–34 ms, about 3x faster than WebGPU here.
- The iPhone was not tested.

## 6. Against the Phase 0 kill criteria

| Criterion | Result |
| --- | --- |
| Warm WebGPU inference ≤ 150 ms | **Passed** at 518x294 (66–119 ms). Failed at 924x518. |
| Cia finds ±15° parallax clearly better than flat | **Pending Cia.** This is the half of D-0453's 65% prediction that is still open. |
| Flicker tameable with EMA | **Partly.** EMA halves the measured flicker but adds visible lag smear on fast motion. Live depth at 8.7 Hz is the weak link. |

## 7. What the numbers change in the plan

1. **The bottleneck is depth, not rendering.** Rendering 686k surfels costs 7 ms on a near-4K canvas. Depth costs about 100 ms per update.
2. **For imported video, bake depth on import** (per frame, so it stays aligned with the frame, with no lag and no live flicker). Plan Phase 1 had this as the fallback; the data make it the lead option. At about 100 ms per frame, a 10 s clip at 30 fps bakes in about 30 s with this model on WebGPU. CoreML, at Apple's 25–34 ms, would be about 3x faster (not measured here).
3. **Live depth** (camera, scrubbing) needs CoreML on the Neural Engine or iPhone hardware depth to get past about 9 Hz.
4. **Pick surfels as the default primitive.** They have the best look and are order-independent. Sorted Gaussians are a close second and cost 3 ms at 686k.
5. **"Keep today's points" requires sorting,** which is cheap. The naming split in the plan (sibling app vs hardware-depth-only points mode) still stands, but the points mode is not free: it needs the sort.
6. **Load one model and never swap it at runtime** (the WKWebView abort).
