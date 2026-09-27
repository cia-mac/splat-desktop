# Phase 0 results v15: fine grids, sort fix, inpainted fill layer

- Date: 2026-09-25. Author: Claude (Sonnet 5 / Opus 5.5 session model, alternating). Read together with `AUDIT_v3.md`, which corrects several earlier claims.
- Machine for every number: MacBook Pro, Apple M5 Max, 64 GB, Safari 27.2. Nothing here transfers to other hardware.
- The look, the hole policy and the product name are Cia's calls (D-0453, D-0465). This file reports what was built and measured.
- Evidence: `results/run29` to `run36`, `results/selected/` (`sheet_fine_crop.jpg`, `sheet_edgefix_crop.jpg`, `sheet_sortfix.jpg`, `sheet_fill_far_vs_inpaint.jpg`).

## 1. Finer grids (Grid selector: 1112, 834, 626, 417, 278, 208, 139, 104 columns)

- Disc size follows cell size, so a finer grid gives a sharper image with the same Splat size.
- The interactive page now opens at **834** (392k splats). The eval and render modes stay at 417 so old numbers remain comparable.
- One frame at 3452 px wide, one clip: about 2 ms at 417 and 834, 3 ms at 1112 (`syncFrameMs` in the gallery run). **Superseded by AUDIT_v3 section 9**: rAF measurements in the live page show 1112 with Blend and fill at 52.6 fps, so 1112 does not hold 60 fps here; 834 does.
- The depth map is 518x294 and nearest-sampled. A finer grid cannot add depth information; it changes sampling, normals and coverage (AUDIT_v3 section 1).

## 2. Edge cutoff at fine grids

- The cutoff read neighbours one *grid cell* away, so finer grids cut fewer edges and stray specks appeared at hair and shoulder edges at 834 and 1112.
- Fix: the cutoff samples a fixed 1/417 by 1/235 offset. Specks around the hair are mostly gone in `sheet_edgefix_crop.jpg`.
- Limit (AUDIT_v3): the same UV cut does not mean the same cells are cut, and normals still use one grid cell.

## 3. Stale sort depth (Blobs, Dots, sorted primitives)

- Cause: the sort worker keeps its own copy of the depth map. The gallery, Look switching, and the Advanced primitive buttons changed the page's depth without posting it, so the first sort used the previous frame's depth.
- Fix: one helper, `pushSortDepth()`, called wherever depth changes.
- Check: `results/run33` against `run29`. Before, a chunk of hair and forehead beside the face was missing; after, it composes correctly, at grids 417 and 208, Blobs and Dots.
- `run29` and `run30` Blobs and Dots images are **invalid evidence** of correct sorted compositing. `run36` re-renders run29.

## 4. Negative result: flooring the normal offset at one depth texel

- Hypothesis (AUDIT_v3 section 7): at 834 the normal offset is smaller than one depth texel, so normals are flat or spiky, causing specks.
- Test: gallery, 834 and 1112, two frames, floor on vs off, speck share (pixels differing from a 5x5 median by more than 40/255, central crop): 0.137% vs 0.132%, 0.171 vs 0.167, 0.183 vs 0.180, 0.212 vs 0.205.
- Result: no effect in this setup (no wobble, pixel ratio 1). **Removed.** It does not test the live page at pixel ratio 2 with the wobble on, where AUDIT_v3 measured the specks.

## 5. Inpainted second fill layer (new option, default unchanged)

- The current fill ("copy far pixel") copies the farthest nearby pixel's colour and depth across a hole, which draws stripes and rectangular bands.
- New fill ("inpainted", `?fill=inpaint` or Advanced, Fill layer): mark pixels clearly nearer than the far side of their window as foreground (depth more than `fillT` nearer, default 0.35, then dilate one pixel), drop them, and fill colour and depth by push-pull diffusion from the remaining pixels, at half resolution.
- Thresholds tried: 0.10 to 0.20 removed rooftops as well and left a flat grey wash (worse than the current fill by eye); 0.35 removed the stripes and read as a softly defocused continuation of the skyline and rooftops.
- Cost: about 17 ms per fill update (44 ms first call), three updates on one frame set, against about 3 ms for the current fill (RESULTS_v14 loop 6, not re-measured). The effect on live depth rate is not measured.
- Trade-off: the fill is smoother and loses fine texture; a faint pale smudge remains beside the head in one frame.
- Evidence: three moments of the default clip, grid 834, camera yaw 14, Blend. Judged by eye. No ground truth exists for what is behind a person, so there is no objective score.
- The default stays "copy far pixel". Choosing between them is the look call.

## 6. Interface

- Panel restyled to the desktop app's design language (`ui/style.css`): right side glass panel, accent 140,170,255, Look row (Blend, Blobs, Dots), Grid, Splat size, Depth, Playback, collapsed Depth source, Advanced, Stats.
- Keys: Space play, S sweep, F front, 1 to 3 looks, H or Esc hide the panel.
- The Flat look was removed (D-0465). Splat sizes below 1.5 and the per-splat wobble stay (D-0465).

## 7. Process notes (so they are not repeated)

- Two other sessions used the same Safari and results folder during this work. A shared results folder and `osascript quit` clobber each other's runs. The later runs used a private server on another port with its own results folder, and a new Safari window without quitting Safari.
- The gallery renders only when Safari is in front; a hidden window stops `requestAnimationFrame`.
- Gallery images are pixel ratio 1, wobble off, so they look cleaner than the live page (AUDIT_v3 section 9).

## 8. Still open

- Banana (fast motion blur) streaks: not addressed.
- Live-page comparison of the two fill modes, in motion.
- Performance on other hardware, and the live depth rate with the inpainted fill on.
- Whether the smoother fill or the striped one is preferred: Cia's call.
