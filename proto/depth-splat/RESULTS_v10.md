# Phase 0 results v10: the three hole options, side by side

- Date: 2026-09-24. Author: Claude Opus 5.5. Follows `RESULTS_v9.md`, which found every working artifact fix leaves holes.
- Data: `results/run15/`. Sheet: `results/selected/holes.jpg`.
- Sheet layout: rows are frames 30, 270, 570 and 810. Columns:
  1. holes at 15°
  2. holes at 7.5°
  3. filled at 15°
  4. filled at 25°
- Every column has the 0.10 edge cutoff. Same matched-frame method (ffmpeg frames, matched color and raw depth).

## Fill method

A background layer of surfels is built from a "farthest nearby pixel" map: for each depth pixel, the depth and color of the farthest pixel within 40 depth pixels (separable argmin). It is pushed 0.1 world units back and drawn under the foreground. The foreground's depth pass hides it wherever foreground exists, so it only shows inside holes. It adds a CPU pass of **17 to 29 ms per frame** and a second surfel draw (98k). The render cost of that draw is not measured.

## What I see

| Option | Look |
| --- | --- |
| Holes at 15° | Large black silhouettes behind the subject. Strong and graphic, but they dominate the frame. |
| Holes at 7.5° | The silhouettes shrink to thick black outlines. Still clearly visible, and parallax is roughly halved. |
| **Filled at 15°** | **No black.** The hole shows stretched, paler background (roofs, sky) as a faint "ghost" of the subject, with a thin light seam at its outline. It reads as plausible scenery at a glance. |
| Filled at 25° | Still no black, even at a wider orbit than before. The stretch becomes blocky smears, and a few gaps remain at the bottom edge. |

- The fill is paler than the true background, because the farthest pixel within 40 px is often sky or a white building. A median or blend of the far pixels would likely be closer (untested).
- The banana streak is unchanged by every option (see v8 and v9).

## My read, for Cia's decision

- **Filling at 15° looks the most like the original footage.** It costs about 20 ms per baked frame, plus a second draw.
- Holes can be a deliberate look, but at 15° they dominate.
- A smaller orbit alone does not make them go away. Halving the angle leaves thick outlines and halves the effect.
- The fill also makes a wider orbit (25°) possible, if the blockier stretch is acceptable.
- This is a taste call; the sheet is the evidence.

## Limits

- 4 frames, one clip, judged by eye.
- The fill is a simple stretch, not real inpainting.
- The seam and the paler tone are known cosmetic issues.
