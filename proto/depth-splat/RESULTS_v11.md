# Phase 0 results v11: fill color averaging, and the fill's render cost

- Date: 2026-09-24. Author: Claude Opus 5.5. Follows `RESULTS_v10.md`.
- Data: `results/run16/`. Sheet: `results/selected/fillcolor.jpg`.
- Sheet layout: rows are frames 30, 270, 570 and 810. Columns:
  1. holes at 15°
  2. fill at 15°, single farthest pixel (the v10 method)
  3. fill at 15°, averaged far colors
  4. fill at 25°, averaged
- Every column has the 0.10 edge cutoff.

## Method

`avgFarColor` averages the colors of every pixel within 0.05 of the window's farthest depth, sampled on a stride-4 grid over the same 40 px window. The v10 fill copied the single farthest pixel, which was often sky or a white wall, so it looked pale.

## Numbers

| | Result |
| --- | --- |
| Background-layer CPU (farthest depth + color) | 17 to 26 ms per frame (as in v10) |
| Averaged color, extra CPU | **56 to 59 ms per frame** |
| Render cost of the fill layer (sync frame, 20 samples) | **1 to 2 ms with or without the fill.** No measurable cost at Safari's 1 ms timer resolution. |

## What I see

- **Averaging is not better. Keep the single-pixel fill.**
  - The averaged fill is smooth, but it turns into a flat grey-beige smudge in the shape of the subject.
  - At 25° it becomes a large grey blob.
  - The single-pixel fill is paler and streakier, but it keeps background texture (roof lines, building bits), so it blends into a busy scene better.
- The thin seam at the fill outline is in both versions.

## Conclusion

- The fill option stands as in v10 (single farthest pixel, 15°).
- It adds no measurable render cost and about 20 ms per baked frame.
- Getting a truly natural fill needs real inpainting: patch-based synthesis, or a learned inpainting model, which brings license and size questions like the depth model did. That is a bigger step and not worth taking until Cia has picked the hole policy.
- The averaged mode stays in the code (`holes=2` in the matched test) for reference only.
