# Phase 0 results v6: edge-aware surfel cutoff

- Date: 2026-09-24. Author: Claude Opus 5.5. Follows `RESULTS_v5.md` (the matched-frame test).
- Data: `results/run11/`. Sheet: `results/selected/edge_sweep.jpg`.
- Sheet layout: rows are frames 30, 270, 570, 690, 810. Columns are cutoff off, 0.10, 0.06, 0.03.
- Same method as v5: ffmpeg-decoded frames, matched color and raw depth, surfels at yaw −15° / pitch 4°, no smoothing, no turbulence.

## What it does

A surfel is dropped when the normalized depth of its neighbors (one cell each side, horizontally or vertically) differs by more than the threshold. It is 6 lines in the surfel vertex shader (`uEdge`); a slider in the page, now default 0.10.

| Threshold | Surfels dropped (5 frames) |
| --- | --- |
| 0.10 | 2.0 to 2.3% |
| 0.06 | 2.5 to 3.1% |
| 0.03 | 3.3 to 4.2% |

## What I see

- **Fixed:**
  - The scattered dots inside the disocclusion tears are gone. The tears become clean solid shapes.
  - The ghost fringes around the fingers and head are gone. Silhouettes are crisp.
  - This is the clear win, and 0.10 gets all of it.
- **Not fixed: the long banana streak (frame 570, row 3).** It survives every threshold. The motion-blurred banana gets a *smooth ramp* of in-between depth, with no single sharp jump to cut. A gradient cutoff cannot see it.
  - The next idea is to snap depth at boundaries toward either the foreground or the background, guided by color (a joint bilateral / "depth sharpening" pass). **Untested.**
- **New cost:**
  - Where the thrown banana crosses the face (frame 270, row 2), the cut leaves a solid black hole inside the subject. It was a torn patch before; now it is more visible.
  - At 0.06 and 0.03, thin black lines appear along background roof edges, because real but small depth steps get cut too.
- **Pick 0.10.** It gets all of the dot and fringe cleanup with the fewest new cuts.
- **Cost of the extra texture reads:** not measured. It is 4 fetches per vertex, alongside the 4 the normal computation already does.

## What this changes

1. Keep the cutoff (0.10) as the default for surfels.
2. With the dots gone, **the holes behind subjects are now the dominant visible artifact.** That makes the disocclusion policy (AUDIT_v1 item 1) the next real decision: holes as a look, a smaller orbit, or fill (for example, stretch the background edge into the hole).
3. Motion-blurred thin objects still streak. Color-guided depth snapping is the candidate fix; it is not tested.

## Limits

- 5 frames, one clip, judged by eye.
