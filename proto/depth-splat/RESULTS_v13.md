# Phase 0 results v13: the look video

- Date: 2026-09-24. Author: Claude Sonnet 5. Follows `RESULTS_v12.md`.
- Output: `results/look_v1.mp4` (local, git-ignored; 960x1096, 10 s at 30 fps, 3.8 MB). The 300 frames are in `results/run25/`.
- Made for Cia to judge the look without running anything. It is the deliverable for the "is the depth clearly better than flat" gate.

## What is in it

- Top half: the original clip (source frames 150 to 449 of the 30 s cut: the man, the banana throw).
- Bottom half: the depth render of the same frames, **frame by frame, deterministic** (ffmpeg frames, no video seeking, no MediaRecorder).
- Render config: surfels, edge cutoff 0.10, background fill (single-pixel farthest, 40 px window), per-frame raw depth normalized over the excerpt (no temporal smoothing), orbit ±15° yaw and ±5° pitch on a 6 s and 8 s cycle, depth strength 0.8, Safari 27.2 at 3452x1996.

## Numbers

- Depth for 300 frames: 14.3 s (48 ms per frame including image load).
- Render of 300 frames: 20.4 s (68 ms per frame, dominated by screenshot capture and upload, not by rendering).
- These are throughput numbers for producing the video, not playback speed. Playback rendering was already shown to hold 60 fps (v1, v2).

## What to look at

- **Parallax:** whether the orbit makes the subject clearly separate from the skyline.
- **The seam:** the pale outline around the man and the sign, where the background fill meets the foreground. It is visible in the bottom half.
- **Fill quality:** the region behind the subject. It is paler and blurrier than the true background.
- **Streaks:** the banana when it is thrown. The motion-blurred banana can smear along the depth axis. This config has no motion mask.
- **Flicker:** depth is per frame with no smoothing, so any depth shimmer at edges is visible here.

## Known limits of this render

- One excerpt, one clip.
- The screenshots were captured at 3452x1996 and downscaled to 960 wide, so fine artifacts look smaller than on a large screen.
- The flat panel is the source frames, not today's Pointfield renderer, so it says nothing about how depth compares with the shipping particle look. That comparison still needs the real renderer.
