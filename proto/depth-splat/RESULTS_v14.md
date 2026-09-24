# Phase 0 results v14: improvement loops (autonomous)

- Date: 2026-09-24. Author: Claude Sonnet 5, running test-and-improve loops while Cia was away, inside the same gates (no push, no App Store, no sudo, no look, hole or naming decision).
- Machine: MacBook Pro, Apple M5 Max, 64 GB, Safari 27.2. Data: `results/run27/` (eval JSONs, look frames), `loops/` (config files and runner), contact sheets in `results/selected/`.
- The new tool: an **objective eval harness** (`?eval=1&cfgfile=...`). It renders at the source size (1280x720) so the front view lines up pixel for pixel with the source frame, and scores each config on fidelity (mean abs difference and PSNR at yaw 0), hole area, dark-dot count and a luminance-drop "seam" count at yaw ±15°. Hole area is measured on a central crop (the plane's own margin was inflating it in the first round). `loops/run_eval.sh` runs a config file and prints nothing until it finishes.

## Loop results

| # | Loop | Result | Kept? |
| --- | --- | --- | --- |
| 1 | Cia's screenshot showed big black holes at pitch 20° | Not the recommended look: the page had no fill toggle and allowed a ±20° pitch. Added **Recommended** and **Fill** buttons, orbit limits ±15°/±6°, and the page now opens in that look. | yes |
| 2 | Objective harness | Built. Round 1 exposed that `hole15` counted the plane margin (12.6% in every config). Fixed. | yes |
| 3 | Blur (`gauss`) falloff 2.5 → 1.0 | **+3 dB fidelity** on the city clip and about 63% fewer seam dots. The dark dotted outline in the fill boundary was partial-coverage darkening from the sharp falloff. | yes |
| 4 | Coverage curve `cov` 3/6/12 | No effect at gauss 1.0 (identical results). | no change |
| 5 | Background layer radius `bgScale` 2.0 | About 60% less hole area, 80% fewer dots, fidelity unchanged. | yes |
| 6 | Fill layer at half resolution | 16 ms → **3 ms** per update, metrics unchanged (PSNR 30.73 vs 30.65). | yes |
| 7 | Live depth with the fill on | **18.8 Hz vs 19.9 Hz** without; render steady at 58.8 fps. | fine |
| 8 | Streaming bake | Decode, infer, discard. **Bit-identical** to the in-memory bake (max diff 0), same time (18.4 s vs 18 to 20 s for 30 s of footage), decoder queue at most 10 frames instead of 450 held. | yes |
| 9 | Baked depth stored as 8-bit | **274 MB → 68.5 MB** for 30 s. Sidecar load is zero-copy (0 ms decode, 30 ms fetch). | yes |
| 10 | PFD2 sidecar | Header with source SHA-256, model, input size, normalization, per-frame timestamps. Load with the expected hash: match loads, **a wrong hash is rejected**. Timestamps exact (frame step 66.7 ms). File 68.5 MB for 30 s. | yes |
| 11 | Fill color blur (to smooth striping) | Worse: flat grey smudges. Current fill keeps building texture. | **rejected** |
| 12 | Do the new defaults generalize? (3 clips) | Yes, see below. | yes |
| 13 | Edge cutoff 0.10 → 0.20 | Fidelity better on all 3 clips (+0.9, +2.0, +0.9 dB); with the fill on, 0.10 to 0.30 look identical by eye. | yes, 0.20 |
| 14 | Look video v2 | Same clip, pale seam outlines gone. `results/look_v2.mp4`, sent to Cia. | yes |
| 15 | Render regression | 60 fps held at every count; surfels with the fill on 2 to 4 ms (98k) and 6 to 7 ms (686k). | ok |
| 16 | Interactive page end to end | **Bake depth** now uses the streaming decoder; **Load bake** verifies the source hash before loading; a working PFD2 sidecar for the default clip is installed (`results/default-10s.pfd`, local, git-ignored). `?autoload=1` loads it and snapshots frames at 1, 4, 7 s: clean, filled, depth follows the video clock. Snapshots: `results/auto_t*.jpg`. | yes |

## Generalization (loop 12)

Old defaults (gauss 2.5, bgScale 1, full-res fill) vs new (gauss 1.0, bgScale 2.0, half-res fill), edge 0.1 for both:

| Clip | PSNR at yaw 0 (old → new) | Seam count (old → new) |
| --- | --- | --- |
| City (default) | 27.5 → 30.7 dB | dots −63% |
| Night (luchi) | 30.26 → 30.28 dB | 0.127 → 0.070 (−45%) |
| Pool (claudia) | 30.62 → 32.24 dB | 0.670 → 0.022 (−97%) |

- On the night clip, `hole%` is meaningless because the scene is mostly black, so it is not reported.
- `gauss` 1.5 scores slightly better mean abs difference than 1.0 (about 4%) and about equal PSNR; it has worse seams on the pool clip. I kept 1.0.

## New defaults in code

`S.gauss` 1.0, `uBgScale` 2, `bgDown` 2 (fill at half resolution), `uEdge` 0.20, `uBgPush` 0.1, surfel size 2.4, flatten 0.5. Temporal smoothing is off in the bake (`?smooth=1` re-enables it). Depth is stored as 8-bit.

## Supersedes

- `docs/SPLAT_DEPTH_PLAN_v2.md` rows "Keep the edge cutoff (0.10)" and the fill description: now 0.20 with the new fill defaults and the seam fix.
- `RESULTS_v10` and `v11` fill images: made before the falloff and radius fixes; their seam was the darkening artifact described in loop 3.
- `RESULTS_v3`'s persist bench (`parts=persist`) assumes float frames and no longer runs as written; the PFD2 tests in `parts=streambake` replace it.

## Limits

- The fidelity metric only sees the front view. It cannot see flying pixels or streaks, so cutoff choices were made by eye on 5 frames.
- Three clips, one machine (M5 Max). No base Mac or iPhone.
- The look is still a taste call: the video is the evidence, and the decision is Cia's.
