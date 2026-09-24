# Phase 0 results v3: persisted bake (sidecar file) and scrubbing

- Date: 2026-09-24. Continues `RESULTS_v1.md` and `RESULTS_v2.md` (both unchanged). Author: Claude Sonnet 5.
- Same machine and page: Safari 27.2, macOS 26.7.1, DA-V2 Small fp16 on WebGPU, 518x294.
- Data: `results/run6/bench_persist.json`, `results/selected/persist.jpg`. The .pfd file itself is git-ignored.

## Sidecar format "PFD1"

- A 24-byte header (magic, width, height, frame count, frame step, fps, clip range), then one 8-bit frame per baked frame.
- Values are the clip-normalized, time-smoothed depth in 0..1, quantized to 8 bits.
- Implemented in `proto.js` (`encodeBake`, `loadBakeFrom`) with "Save bake" and "Load bake" buttons in the page.

## Results

| | Result |
| --- | --- |
| File size, 10 s clip, 518x294, every 2nd frame | **22.8 MB** (150 frames) |
| Load: fetch + decode | **23 ms + 30 ms = 53 ms** (local server; a bundled file is the same order) |
| Quantization error vs the in-memory bake | max **0.00196**, mean **0.00066** (a quarter of one 8-bit level at worst; not visible) |
| Scrub (seek, look up depth, render, finish) over 40 seeks incl. both clip ends | median **26 ms**, p90 78 ms, max 149 ms |
| Bad depth values after any seek | **0** |
| Bake time, same clip | **36 s this run**, 15 s in v2. Unexplained (no thermal event recorded; possibly Safari scheduling). Treat as **15 to 36 s per 10 s clip**. |

- Bake once, then every reopen costs about 50 ms and 23 MB. About 137 MB per minute of footage. Going to 4x4 spatial downsampling or every 3rd frame is the obvious lever if that is too big.
- Scrub time is dominated by the browser seek, not by the depth lookup.

## What I saw

`results/selected/persist.jpg` (reloaded from the file, surfels at yaw −15°, 1.0 s and 6.5 s):
- 6.5 s is clean.
- **1.0 s has a depth artifact:** a flat slab of background depth clings around the head, giving a pale halo with a hard edge. It is a model error in that frame (it is not in the v2 frames at 2, 5 and 8 s), and the quantization error is far too small to cause it. This is the kind of thing a viewer at ±15° will see. Worth checking how often it happens before trusting the effect on other footage.

## Still open

- Cia's visual call: is ±15° parallax clearly better than flat? (The open half of D-0453.)
- Core ML speed and the iPhone remain untested; so does the night clip (`luchi`) with baked depth.
- Halo frequency: bake a longer clip and look for frames like 1.0 s.
- Nothing here changes the plan's verdict. The persisted bake removes the file-format question.
