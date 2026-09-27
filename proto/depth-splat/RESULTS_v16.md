# Phase 0 results v16: corrections to v15, Reset fix

- Date: 2026-09-25. Corrects `RESULTS_v15.md` (left unchanged as the record) after the independent audit of HEAD.
- Machine: MacBook Pro, Apple M5 Max, 64 GB, Safari 27.2. One machine, one clip set.

## 1. Numbers in v15 that had no file, now measured and saved

Run: gallery mode, frames 270/570/690 of the default clip, Blend, yaw 10, canvas 3452x1942 (device pixels), `?time=1`, private server on its own port, Safari in front. Files: `results/timing_far.json` and `results/timing_inpaint.json`.

| Item | v15 said | Measured |
| --- | --- | --- |
| One frame, render then force completion, grid 417 / 834 / 1112 | 2 / 2 / 3 ms | **3 / 4 / 6 ms** (fill layer: copy far) and **3 / 5 / 8 ms** (fill layer: inpainted) |
| Fill update, copy far pixel | about 3 ms (v14 loop 6) | **42, 15, 10 ms** for three consecutive updates (first call includes JIT warm-up). v14's 3 ms is not reproduced in this run. |
| Fill update, inpainted | 17 ms (44 ms first call) | **54, 30, 30 ms** |

- The inpainted fill is about 2 to 3 times the copy-far fill in this run, not the 6 times v15 implied, and both are slower than v15 stated. Three samples each; no steady-state claim beyond that.
- The frame times are synchronous render costs at the full 3452 px canvas, not rAF intervals. AUDIT_v3 section 9 remains the source for whether a grid holds 60 fps in the live page (1112 does not).
- v15 section 1's "2 ms / 3 ms" is therefore **superseded** by the table above.

## 2. Still without an artifact

- v15 section 4 (normal-offset floor, speck shares at 834 and 1112): the numbers were printed in the terminal; the saved run34 folders hold grids 417 and 208 only. Treat the result as reported, not re-checkable. The floor was removed.

## 3. Code fixes

- **Reset** (`applyRecommended`) now calls `setLook('blend')`, so it restores the primitive, Splat size 2.4, the falloff, the fill, and the highlighted Look button. Before: Dots then Reset gave Blend at size 1.0 with the Dots button still lit. Checked in Safari: Dots, Reset gives look=blend, size 2.4, primitive surfels.
- `?fillT=0` is now accepted (the parse used `||`, which turned 0 into the default).

## 4. From the audit, not fixed here

- Baked playback with the inpainted fill reruns the fill each time the blended baked frames change (about 30 times a second); at 30 ms per update that is roughly the whole main thread. Unmeasured, likely too slow. Use the copy-far fill for baked playback until measured.
- The inpaint threshold 0.35 was tuned by eye on the default clip only.
- A stale sort can be drawn for one frame after a grid change when the splat counts happen to match (417x235x4 = 834x470x1).
- AUDIT_v3 section 12 says run38 came from `main` at ddf7d72; the run38 JSON contains `fillMs`, which only exists on this branch from 3c23148.
- Keyboard: Space activates a focused button; shortcuts stop while a slider or select has focus.
