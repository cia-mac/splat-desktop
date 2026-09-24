# Audit v2: corrections to AUDIT_v1

- Date: 2026-09-24. Author: Claude Sonnet 5 (session model at the time). AUDIT_v1 stays as the record; this file corrects it.
- Machine for everything in this file and in RESULTS_v1 to v12: **MacBook Pro, Apple M5 Max, 64 GB, macOS 26.7.1, Safari 27.2.** That is a top-end Mac. No number here transfers to a typical Mac or an iPhone without re-measuring.

## Correction: the "stale frame" rates in AUDIT_v1 are retracted

AUDIT_v1 "Finding A" said the seek-then-`drawImage` frame source returned the previous frame 7% and 12% of the time. **Those two percentages were false alarms.**

- The check hashed only the top-left 64x36 pixels of each frame. In this footage that corner is static sky, so an unchanged corner counted as a "repeated frame".
- A correct decoder (WebCodecs, below) tripped the same check on 45 of 450 frames (10%), with the frames verifiably distinct. That is the false-positive rate of the metric.
- With a whole-frame hash, re-measured this session:

| Frame source | Window state | 10 s clip bake | Repeated inputs | rVFC timeouts |
| --- | --- | --- | --- | --- |
| seek + `drawImage` | visible | 7.6 s | **0** | 0 |
| seek + `drawImage` | Safari process hidden (page load throttled; bake ran hidden) | 14.6 s | **0** | 3 |
| WebCodecs decode | visible | 17.8 s for 30 s of footage | **0** | n/a |

What survives from Finding A:
- Bake speed depends on window visibility. Hidden, the page load alone stalled: a run did not finish within 552 s of wall time (visible: 7.6 s). The bake itself took 2× longer once it started.
- One earlier run (`fix2`, 30 s clip) showed nearly one pose across 12 of 15 screenshots. I could not reproduce it. Its cause is unexplained. It happened while Cia's other apps were in front.

What is withdrawn:
- The 7 to 12% stale rates.
- The implied claim that all v3 and v4 bake-quality numbers were contaminated. The decoded 30 s bake gives flicker 0.655% raw and 0.435% smoothed. The seek-based 30 s bake in v4 gave 0.645% and 0.436%. **They agree**, so those numbers were not badly corrupted.
- The v3 "head halo" has no established cause. It was not stale-frame evidence, and it did not reproduce on matched or decoded frames.

## What AUDIT_v1 got right and still stands

- The flicker metric is not a quality metric.
- "Sync frame ms" is weak; the 60 fps cap results (real frame intervals) are the sound ones.
- The seek-based path is still fragile in a hidden window, and a deterministic decoder is the right pipeline for the product.
- The disocclusion policy, export, sidecar identity and harder-footage items all still apply.

## Lesson for the record

I built a verification metric and did not test it against a case where the answer was known. Testing the check on frames I knew were distinct would have caught this immediately. Any "is this frame stale" check must hash the whole frame and be validated on known-distinct input first.
