# Phase 0 results v8: tilt fade (negative result)

- Date: 2026-09-24. Author: Claude Opus 5.5. Follows `RESULTS_v7.md`.
- Data: `results/run13/`. Sheet: `results/selected/tilt_sweep.jpg`.
- Sheet layout: rows are frames 30, 270, 570, 690, 810. Columns are tilt cutoff off, 0.3, 0.5 and 0.7. Every column has the edge cutoff at 0.10.
- Same matched-frame method as v5 to v7.

## Method

A surfel is dropped when its true surface normal (from the lifted depth, before the flatten step) points away from the original camera: n.z < threshold. It is 2 lines in the surfel vertex shader (`uTilt`), with a page slider (default off).

| Threshold | Surfels dropped (5 frames) |
| --- | --- |
| 0.3 | 3.2 to 4.3% |
| 0.5 | 4.9 to 6.5% |
| 0.7 | 8.4 to 11.1% |

## Result: it does not remove the streak. Reject.

- **The banana streak survives every threshold** (row 3). It thins a little at 0.3; it is still there at 0.7.
- **It damages real surfaces:**
  - At 0.3, black lines already appear along the roof and parapet edges.
  - At 0.5 and 0.7, holes open in the face and speckled black edges run along the shirt folds, which are genuine curved surfaces.

## What the three negative results say together

The edge cutoff (v6), color snap (v7) and tilt fade (v8) all fail on the streak. So the streak is **neither a sharp jump nor a steep ramp.** The model gives the motion-blurred banana a coherent, fairly flat depth at an in-between distance, and the long shape is the blur itself, placed in space.

No local geometric filter can tell that apart from a real object, because to the depth map it *is* an object.

The remaining options are not filters:
1. **Accept it.** Under a small orbit it reads as a motion trail, which may even suit the look.
2. **Motion mask.** Use frame differences to find fast-moving regions and fade them. This is a temporal signal, not a geometric one, and it is untested.

**Recommendation:** stop the streak work here and treat it as a known limitation. Revisit only if Cia judges the look and the streaks bother him.

## Where things stand

- **Keep:** the edge cutoff at 0.10.
- **Drop:** temporal smoothing (v5), color snap (v7) and tilt fade (v8).
- **Open, and all Cia's:** the disocclusion-hole policy, the look, and the naming direction.
