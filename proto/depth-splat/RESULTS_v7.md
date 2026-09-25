# Phase 0 results v7: color-guided depth snapping (negative result)

- Date: 2026-09-24. Author: Claude Opus 5.5. Follows `RESULTS_v6.md` (edge cutoff).
- Data: `results/run12/`. Sheet: `results/selected/snap_sweep.jpg`.
- Sheet layout: rows are frames 30, 270, 570, 690, 810. Columns are no snap, then snap window radius 4, 7 and 12 depth pixels. Every column has the edge cutoff at 0.10.
- Method as in v5/v6: ffmpeg frames, matched color and depth, surfels at yaw −15°.

## Method

Near any depth edge (local depth range > 0.08 in the window):
- split the window into clearly-near and clearly-far pixels (top and bottom quarter of the range);
- snap each pixel's depth to the group whose mean color is closer.

It runs as a CPU pass on the 518x294 depth map (`snapDepth` in `proto.js`). It is only active in the matched test (`&snap=`), not in playback.

## Result: it does not work. Reject this version.

| | Radius 4 | Radius 7 | Radius 12 |
| --- | --- | --- | --- |
| CPU time per frame | 66 to 131 ms | 127 to 169 ms | 403 to 520 ms |

- **The banana streak survives at every radius** (row 3). It gets fragmented rather than removed.
  - The motion-blurred banana's color is a mix of yellow and background, and it matches neither group cleanly.
  - The window is also narrower than the blur at small radii.
- **It adds new damage, getting worse as the radius grows:**
  - the tears break into shards;
  - black lines and holes appear across the background roofs;
  - holes appear in the hand and face (radius 12, row 1).
- **Why:** snapping turns every soft depth transition into a hard step, so the 0.10 cutoff then cuts along each new step.
- **Cost:** 66 to 520 ms per frame on the CPU, on top of about 100 ms of inference, so it would roughly double or quadruple bake time.

## What is left for the streak (untested ideas)

1. **Fade surfels by tilt.** A ramp shows up as surfels whose normal is steeply tilted away from the camera, even without a sharp jump. Risk: it would also fade legitimate receding surfaces such as floors and roofs.
2. **Motion mask.** Find motion-blurred regions from frame differences or flow, and lower their opacity or flatten their depth to the nearest stable neighbor.
3. **Accept it.** Fast thrown objects are a small fraction of footage. Keep the orbit small, where streaks read as motion trails.

## Where things stand

- **Keep:** the edge cutoff at 0.10 (v6).
- **Drop:** temporal smoothing (v5) and this snap (v7).
- The disocclusion-hole policy and Cia's look are still the open decisions.
