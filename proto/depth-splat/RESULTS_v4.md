# Phase 0 results v4: longer bakes, artifact check

- Date: 2026-09-24. Continues v1 to v3 (unchanged). Author: Claude Sonnet 5.
- Same machine and page. Data: `results/run7/`. Sheets: `results/selected/long_default30.jpg` (15 frames, one every 2 s, 3 columns) and `long_luchi.jpg` (5 frames).
- All frames are surfels at yaw −15°, pitch 4°, depth strength 0.8, from a bake of the whole clip.

## Numbers

| Clip | Length | Baked frames | Bake time | Per baked frame | Memory (float32) | Flicker raw / smoothed |
| --- | --- | --- | --- | --- | --- | --- |
| luchi (night, dancer) | 10 s | 150 | 35 s | 235 ms | 91 MB | 0.093% / 0.055% |
| default (city, man), 30 s cut | 30 s | 450 | 94 s | 209 ms | 274 MB | 0.645% / 0.436% |

- **Bake speed varies from 1.5 to 3.6 s of bake per second of footage.** v2 measured 102 ms per baked frame (1.5x); these runs measured 209 to 235 ms (about 3.3x), on the same page and machine. I do not know why. So "15 to 36 s per 10 s clip" stands.
- Memory scales linearly and float32 is the wrong in-memory format for long clips: 274 MB for 30 s. Keep the 8-bit data as loaded (about 68 MB for 30 s) and convert per frame when blending. This is an easy fix, not a blocker.
- Smoothing again cuts flicker by about a third to a half.

## What the frames show

- **Night clip (luchi): clean in all 5 frames.** Stable, no halos. The water reflection reads as a smoothly receding surface, which orbits plausibly (a slight bend at the right edge).
- **City clip (default), 15 frames:**
  - **The head halo from v3 did not reproduce.** The same source frame (1.0 s) is clean in this bake. The halo therefore depends on the bake (a different clip-wide range or run variance) and is not a fixed property of that frame. I have not pinned the cause. Do not assume it is fixed.
  - **A different artifact appears:** the thrown banana and hand stretch into slivers and streaks that reach along the depth axis in about **6 of 15 frames** (rows 2 to 5). It is a fast, thin object crossing a large depth edge, so the splats connecting foreground and background stretch. This is the most visible defect at ±15°.
  - The subject's body, the skyline and the sign are stable.

## What this means

- The effect holds on two different clips. It looks best on slow, broad subjects (the dancer, the seated skyline) and worst on fast, thin objects near a depth edge.
- **Cheap mitigation to try next, untested:** clamp or fade splats whose neighbors differ sharply in depth ("edge-aware" cutoff), so a thin object stops stretching into a sliver. It also removes the black tears' scattered dots.
- Nothing here changes the plan verdict. The open item is still Cia's judgment on the look.
