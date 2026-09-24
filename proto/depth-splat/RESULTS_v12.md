# Phase 0 results v12: deterministic decode, faster inference, live depth, Core ML

- Date: 2026-09-24. Author: Claude Sonnet 5. Follows `RESULTS_v11.md`. Corrections to earlier claims are in `AUDIT_v2.md`.
- Machine: **MacBook Pro, Apple M5 Max, 64 GB**, macOS 26.7.1, Safari 27.2. A top-end Mac; nothing here proves speed on typical hardware or iPhone.
- Data: `results/run17` to `run24`; the Core ML script is `tools/coreml_bench.py`.

## 1. Deterministic decode with WebCodecs works

`decodeClip()` in `proto.js`: mp4box demuxes (vendored, BSD-3), `VideoDecoder` decodes in order, each frame carries its presentation timestamp, and every 2nd frame is kept at the model input size.

| | Result (30 s clip, 900 frames, H.264 1280x720) |
| --- | --- |
| Decode speed | **900 frames in 2.1 s (about 410 fps)** |
| Timestamps | **0 of 900 out of place**, checked relative to the first frame (the file starts at 66.7 ms = 1024/15360, a 2-frame offset that a naive check flags) |
| Pixel alignment vs ffmpeg frames | 4 of 4 checkpoints: the decoded frame matches the ffmpeg frame at its own index better than at ±1 and ±2 (mean abs diff about 2.0 to 2.4 vs 2.2 to 3.7) |
| Repeated inputs | 0 (whole-frame hash) |
| Bake: 450 depth frames | **17.8 s** (39 ms per frame; inference median 39 ms) |
| Flicker, raw / smoothed | 0.655% / 0.435% (matches the v4 seek-based numbers) |

- Alignment margins between adjacent frames are small (for example 2.03 vs 2.18 at frame 30) because neighboring frames are similar. The check is correct at all four points, but it proves alignment more strongly at high-motion frames (270: 2.08 vs 2.54) than at low-motion ones.
- **This replaces seek-then-drawImage as the frame source for the bake.** It is faster, independent of window state, and has real timestamps. It has been tested in Safari only; the Tauri and Capacitor webviews are the same WebKit but were not tested.
- Memory: the bake held all 450 decoded frames as pixel arrays (274 MB) before inference. A product version would stream: decode, infer and discard.

## 2. Inference is about 2x faster than reported in v1

Re-measured with the render loop running, Safari in front, median of 10:

| Model / input | Now | v1 |
| --- | --- | --- |
| fp16 518x294 | **39 ms** (p90 40) | 73 to 92 ms |
| q4f16 518x294 | 46 ms | 66 to 119 ms |
| fp16 924x518 | 211 ms | 539 to 617 ms |
| q4f16 924x518 | 227 ms | 594 to 637 ms |

- I do not know why v1 was slower. The run-to-run spread then was about 25%, and now it is under 3%. System load during the earlier runs is the likeliest cause, but that is untested. **The honest range on this machine is 39 to 119 ms at 518x294.**
- q4f16 is still no faster than fp16.

## 3. Live depth is viable at about 20 Hz on this Mac

Video playing, live depth, fp16 518x294, render loop at 58.8 fps:

| Depth rate cap | Achieved | Flicker raw / shown (EMA 0.3) |
| --- | --- | --- |
| 15 Hz (v1 setting) | 13.3 Hz | 0.67% / 0.33% |
| 30 Hz | **19.8 Hz** | 0.52% / 0.26% |

- v1 reported 8.7 Hz and concluded live depth needed Core ML or phone sensors. On the corrected inference speed, live depth reaches about 20 Hz.
- **Sync is borderline.** Depth is about 46 ms old when displayed (inference and readback), then held up to 50 ms until the next update. That averages about 70 ms (2 frames) with a worst case near 96 ms (3 frames). The matched-frame test showed ±2 frames is barely visible and 4 is not. Not judged by eye in motion.

## 4. Core ML is about 5x faster than WebGPU on this Mac

Apple's F16 model (`apple/coreml-depth-anything-v2-small`, Apache-2.0, 49 MB), through `coremltools` in Python, 30 timed runs after 3 warmups. Input 518x392, output an 8-bit image.

| Compute units | Median | p90 | Load |
| --- | --- | --- | --- |
| ALL (default) | **7.6 ms** | 8.1 | 0.9 s |
| CPU + GPU | 7.6 ms | 8.1 | 0.5 s |
| CPU + Neural Engine | 19.3 ms | 19.6 | 5.7 s |
| CPU only | 44.9 ms | 45.7 | 0.4 s |

- On this Mac the default picks the GPU, and the GPU beats the Neural Engine 2.5x. On other chips and on iPhone the ranking may differ; Apple's published numbers use the Neural Engine at 25 to 34 ms.
- The number includes Python's image conversion overhead, so a native call would be equal or faster. It excludes moving the result into the webview.
- **The output is a normalized 8-bit image, so the model normalizes each frame itself.** That reintroduces the per-frame range "pumping" the bake avoids by normalizing over the whole clip, and it loses depth precision. Fixing it needs a different export (raw float output) or accepting it. Not tested.
- It needs a native plugin and a bridge. Cost and effort are unmeasured. Compared with WebGPU (39 ms, no bridge, one codebase) it is 5x faster but a lot more work.

## 5. What this changes

1. **The frame pipeline question is closed.** WebCodecs decode works; use it for the bake.
2. **Live depth is back on the table** for the Mac, at about 20 Hz with WebGPU, pending a look at motion sync. Bake on import is still better for quality (non-causal, no lag), but it is no longer the only option.
3. **Core ML is a speed option, not a necessity.** Reach for it if a base Mac or an iPhone cannot hold WebGPU speeds. That is the next unknown.
4. **Do not treat any number as general.** M5 Max, 64 GB, one clip family. The next measurement that matters is a base-model Mac and an iPhone.

## 6. Not done

- Any measurement on an iPhone or a non-Max Mac.
- Tauri or Capacitor webview tests of WebCodecs and WebGPU.
- A look at live depth in motion.
- A raw-float Core ML export, and the bridge cost.
- Committing: git is blocked by the Xcode license (see the session state).
