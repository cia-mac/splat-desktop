# Phase 0 results v5: matched-frame test

- Date: 2026-09-24. Author: Claude Opus 5.5. This is the test proposed in `AUDIT_v1.md`.
- Data: `results/run10/` (48 renders plus `matched.json`). Sheets: `results/selected/matched_A.jpg` (frames 30, 210, 270, 330) and `matched_B.jpg` (frames 570, 690, 810, and 450 in row 1).
- In each sheet, one row per target frame. Columns, left to right:
  1. matched raw depth
  2. matched smoothed depth
  3. color +1 frame
  4. color +2 frames
  5. color +4 frames
  6. color −2 frames

## Method

- **Frame source:** ffmpeg decoded all 900 frames of the 30 s clip to JPEG (`frames/f_NNNN.jpg`). Color and depth come from the same decoded image, so their match is guaranteed by construction. No `<video>` seeking was involved anywhere.
- **Depth:** DA-V2 Small fp16 on WebGPU at 518x294 (inference median 102 ms). Normalized with one fixed range for the whole set, no smoothing, turbulence off.
- **Render:** surfels, yaw −15°, pitch 4°, depth strength 0.8.
- **Smoothed variant:** the bake's [0.25 0.5 0.25] filter over frames F−2, F, F+2.
- **Shifted variants:** the same raw depth of F, paired with color from another frame.
- **Targets:** 8 frames chosen to include frame 30 (the v3 halo frame) and the hand/banana throw frames where v4 saw slivers.

## Findings

| Question | Answer | Evidence |
| --- | --- | --- |
| Is the v3 head halo a model error? | **No.** Frame 30 renders with a clean head in matched raw depth. The halo came from the pipeline, most likely a stale input frame. One frame, so this is supported, not proven. | matched_A row 1, column 1 |
| Are the banana slivers caused by color/depth sync? | **No.** They are already present in matched raw depth (frames 570, 690, 810), and shifting color by up to ±2 frames barely changes them. | matched_B column 1 vs 3, 4, 6 |
| So what causes the slivers? | **The depth at a thin, motion-blurred object crossing a large depth edge.** The model gives the blurred banana and fingers intermediate depths between the hand and the skyline, so their surfels float in the gap ("flying pixels"). A depth-map property, possibly amplified by edge normals in the renderer. | matched_B rows 1 to 3 |
| Does temporal smoothing help? | **It makes moving thin objects worse.** The smoothed column adds shards and doubled edges around the moving hand and banana (frames 30, 690, 810), because it averages depths from three different object positions. It is harmless on static areas. | column 2 vs 1 |
| How much sync error is tolerable? | **About 2 frames (67 ms at 30 fps).** ±1 and ±2 look almost the same as matched. +4 visibly puts banana color on the wrong depth. Live depth at about 110 ms (3.3 frames) is past this, which matches the v1 smear. | columns 3 to 6 |
| How common are depth edges? | About 1% of depth-map pixels per frame are sharp edges (neighbor difference > 0.1). They are a small area but hold all the visible defects. | `matched.json` edgePct 0.93 to 1.16 |

## What this changes

1. **Drop temporal smoothing as the default.** Use per-frame raw depth as the baseline. If smoothing comes back, it must be motion-aware (static regions only).
2. **The remaining defect is flying pixels at depth edges.** The standard fix is to discard or fade surfels where the local depth gradient is large (an edge-aware cutoff). That also cleans the scattered dots in the black tears. It is the next thing worth testing, and it is a shader change.
3. **Sync spec for the app:** color and depth within 2 frames, and deterministic frame decoding (WebCodecs or native). Seek-then-draw is out (AUDIT_v1).
4. The v3 and v4 artifact write-ups are superseded by this file. They stay as the record.

## Limits

- 8 frames from one clip. One halo frame. Judged by eye; no numeric defect measure.
- Hair, cuts, camera motion and other footage are still untested.
