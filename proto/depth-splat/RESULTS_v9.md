# Phase 0 results v9: motion mask (partial success)

- Date: 2026-09-24. Author: Claude Opus 5.5. Follows `RESULTS_v8.md`.
- Data: `results/run14/`. Sheet: `results/selected/motion_sweep.jpg`.
- Sheet layout: rows are frames 30, 270, 570, 690, 810. Columns are mask off, then thresholds 60, 30 and 15. Every column has the edge cutoff at 0.10.
- Same matched-frame method as v5 to v8.

## Method

Per depth pixel, the motion value is `|L(F) − L(F−1)| + |L(F+1) − L(F)|` (luma, 0 to 510), then a max-filter of radius 2 so the mask covers the soft edges of the blur. A surfel is dropped where the value exceeds the threshold. It is a mask texture plus one test in the surfel shader (`uMotion`, `uMotionT`); it is only active in the matched test (`&motion=`).

Pixels flagged as moving:

| Frame | > 60 | > 30 | > 15 |
| --- | --- | --- | --- |
| 30 | 0.19% | 0.47% | 2.25% |
| 270 | 1.42% | 5.75% | **17.19%** |
| 570 | 1.48% | 1.95% | 3.22% |
| 690 | 0.46% | 0.97% | 1.56% |
| 810 | 0.38% | 1.34% | 2.06% |

## Result

- **It is the first fix that removes most of the streak.** At 60 (row 3, frame 570), the long banana streak is mostly gone; only thin white dashes remain. Lower thresholds do not remove more of it.
- **It does not remove it cleanly.**
  - Dashes remain.
  - Where the blurred banana covered the face, the removed area becomes a **black hole** in the face (row 3). Nothing is behind it, because single-layer depth has nothing to show there.
- **Low thresholds are unusable.** At 30 and 15, frame 270 flags 6 to 17% of the image, from small subject motion and compression noise. The result is black lines across the roofs and holes in the face and shirt (row 2).
- **Threshold 60 is the only usable setting.** Its damage elsewhere is small (rows 1, 4, 5 barely change).

## Caveats

- **Locked-off camera only.** With a moving or handheld camera, every pixel changes, so a raw frame difference flags everything. Real use would need the camera motion removed first (global motion compensation or optical flow), which is untested.
- The threshold is in raw luma units, so it depends on footage brightness, noise and compression.
- Five frames, one clip, judged by eye.

## The pattern across v6 to v9

Every fix that works (edge cutoff, motion mask) works by **removing** floating surfels, and every removal leaves a **black hole**, because single-layer depth has nothing behind the foreground.

So the artifact problem has turned into the hole problem. **The disocclusion-hole policy is now the gating decision.** Holes can be:
1. a look;
2. kept small with a smaller orbit or less depth strength;
3. filled, for example by stretching the nearby background into the gap.

Every other cleanup depends on which one.

## Where things stand

- **Keep:** the edge cutoff at 0.10.
- **Optional:** the motion mask at 60, for locked-off shots only; it would need a mask per baked frame.
- **Drop:** temporal smoothing, color snap, tilt fade.
