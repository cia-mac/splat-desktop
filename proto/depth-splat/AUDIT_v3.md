# Audit v3: after the 834 grid, Look presets, gallery mode and new panel

- Date: 2026-09-24/25. Auditor: Claude Sonnet 5, then Opus 5.5 (session model), read-only. Second reviewer: Claude Opus 5.5 as a separate subagent with no session context (merged, marked [Opus]; where I re-checked a claim in code I say so). Third reviewer: astra (ChatGPT, via the consult lane), section 6. **Section 6 corrects several statements below.** Fourth reviewer: Gemini, section 7.
- Intended location: `proto/depth-splat/AUDIT_v3.md` in worktree gallant-tharp-e4bf77. This session's hook forbids writing into another worktree, so the file is in this session's scratchpad; copy it over on Cia's word.
- Machine for every number in the write-ups: MacBook Pro, M5 Max, 64 GB, Safari 27.2. Nothing transfers to other hardware.
- Not decided here, by rule: the look, the hole policy, the product name.
- Evidence limits: I could NOT run the page. The sandbox blocks local port binding and `open`/Safari, so no server, no screen capture, no `canvas.toDataURL`. Everything is from code, existing renders, and one offline re-computation of the surfel-normal maths from `results/default-10s.pfd` (pure Python, not committed).

## 1. Claims after the recent changes

| Claim | Status | Evidence |
| --- | --- | --- |
| Plan v2 "686k surfels in 7 ms, 60 fps everywhere"; v14 loop 15 "6 to 7 ms (686k)" | **Unsupported at the new default** | "686k" is 417x235x7. Interactive default is now 834x470x1 = 392k; 1112 is 697k. No timing exists for either (`results/run32/gallery.json` has `syncFrameMs: {}`). Fill layer is drawn with the same N at 2x radius (`proto.js:604`, `uBgScale` 2). The 417 measurements stay valid for their own configuration. |
| Per-cell selector labels "1 (98k) / 4 (392k) / 7 (686k)" (`index.html:134`) | **Wrong at the new grid (still in the UI)** | Counts are COLS*ROWS*K: at 834 they are 391,980 / 1,567,920 / 2,743,860. |
| Sort cost "2 to 3 ms, 98k keys" (RESULTS_v1) | **Unsupported above 417** | `sortworker.js:13`: one key per cell (cols*rows), N = cells*K indices emitted. 392k keys at 834. Unmeasured. |
| v14 eval PSNR / seam / hole deltas; gauss, bgScale, cov, edge 0.20 tunings | **Unsupported at 834** | Measured at 417, Splat size 2.4. "cov has no effect" cannot be assumed at small Splat size. |
| Edge cutoff: "finer grids cut the same edges" (fixed 1/417 offset) | **Stands for the predicate; incomplete** | Same UV gives the same cut, but grids sample different UV centres. Normals still use `du = 1/uCols` (`proto.js:487`). [Opus] measured dark dots at 834/1112 about 1.7 to 2x the 417 level (crude JPEG count, not re-run by me). |
| Fill CPU cost 17 to 29 ms, 3 ms at half res | **Stands** | Works at depth-map resolution. |
| v11 "1 to 2 ms" | **Unsupported at 392k/697k** | Measured at 98k; and it is total frame time with or without fill, not an incremental fill cost. |
| Live depth about 20 Hz at steady 60 fps (v12, v14 loop 7) | **Unsupported at the new default** | Measured at 98k splats. |
| v14 loop 16 "autoload snapshots clean" | **Stands for 417 only** | `results/autoload.json`: `cols 417, N 97995`, surfScale 2.4, DPR 2. |
| Depth model 39 ms, WebCodecs decode, PFD2 hash check, Core ML 7.6 ms | **Stands (one machine)** | Untouched by the changes. |
| Finer grids improve the image | **Partly unsupported** | Depth map is 518x294, nearest-sampled (`proto.js:238`). Finer grids cannot add depth information; they change centre sampling, normals and coverage. [Opus, astra] |
| Runs 29 to 32 sheets | **Not comparable** | run29 is 1280 wide, 30 to 32 are 1920; no results note describes them. |

## 2. The grain: reproduction

**Not reproduced by me. The earlier "could not reproduce" claim is unsupported as stated.**

- The recorded attempt (`autoload.json` `dbg`) was at the old 417 grid, Splat size 2.4 (default), DPR 2. The screenshot was at low Splat size, so the attempt did not vary the named factor.
- `cmp_live_vs_baked.jpg` compares different clip moments, so it cannot isolate baked versus live depth. Both halves look clean at 2.4.
- The real-capture versus `toDataURL` comparison was not possible here and nothing in the repo shows it was done.

Candidate mechanisms in code (none confirmed on screen):

1. **Turbulence is on in the page.** `uTurb` defaults to 1 (`proto.js:409`); eval, render and gallery paths set 0 (lines 1192, 1335, 1421, 1459). Amplitude 0.004 world units in x and y (`:449`) against a cell width of 0.0085 (417), 0.0043 (834), 0.0032 (1112): about half a cell at 417, a full cell or more at 834/1112. It keeps moving while the video is paused (`:668-676`). Autoload runs interactive with the wobble ON, and its 417/size-2.4 snapshots look clean (see section 6). Test: `__pf.U.uTurb.value = 0` in the console.
2. **Gaps between discs.** Radius = 0.5 x cellW x Splat size x (0.85..1.15) (`:519`). An idealised flat, stationary K=1 square lattice is gap-free at Splat size about 1.41 nominal, about 1.66 with the smallest jitter. Slider goes down to 0.6. Gaps composite black (`:577`), hard `discard` edges, `antialias: false`.
3. **Normals from sub-texel offsets on nearest-filtered depth.** Offline, frame 60 of `default-10s.pfd` (exact baked frame, no interpolation), depth strength 0.8:

| Flatten | Grid 417 / 834 / 1112: surfels with n.z < 0.8 | Mean adjacent-cell change in n.z |
| --- | --- | --- |
| 0.5 (default) | 2.3% / 2.4% / 2.8% | 0.0109 / 0.0136 / 0.0134 |
| 0 | 13.2% / 23.6% / 28.9% | 0.040 / 0.050 / 0.049 |
| 0, strength 1.5 | 29.3% / 34.4% / 30.4% | 0.065 / 0.075 / 0.070 |

   Small at default Flatten; grows with finer grids when Flatten is lowered. One frame, one clip.
4. **DPR 2.** Discs at 834 resolve at a few device pixels; the gallery renders at pixel ratio 1 (`:1457`).

Conclusion: plausible causes exist in the live page and not in the gallery/eval renders. Unproven.

## 3. Blobs, Dots, Blend as "splats"

- **Blobs/Dots**: sorted, premultiplied-over, truncated-Gaussian oriented discs on a per-cell lattice; nothing fitted. Honest in form. They lack a background fill (holes stay black), lattice irregularity, an EWA screen-space prefilter, and per-splat fitted size/opacity. Positions come from a neural depth map.
- **Bug (confirmed in code): gallery Blobs/Dots sort with stale depth.** `gallery()` writes `disp` but never posts it to the sort worker (only `proto.js:160` and `:401` do). Live, the same happens switching to a sorted look while paused (`:395-401`). Treat run29/run30 Blobs/Dots as invalid evidence of correct sorted compositing.
- **Blend** (depth pre-pass, weighted accumulation, normalise) is surface splatting in plan v1's sense with a Gaussian weight. "EWA-style" is loose. Stands.
- The Look button "Flat" is depth-lifted unsorted points (`:707`), not flat; clashes with the Playback "Flat" (depth 0).

## 4. Naming and public-copy risk (evidence, no decision)

- Shipped claims "Not AI. Not Gaussian splatting.": main checkout `launch/social-copy_v2.md:12`, `launch/ASSET_INVENTORY_v2.md:52`, `launch/mas/LISTING_v1.md:44`, `launch/mas/set_metadata.py:19`.
- "Not AI" is contradicted by every look: all lift by Depth Anything V2 Small via ONNX. Only phone-sensor depth keeps it true.
- "Not Gaussian splatting" is contradicted by Blobs and Dots under the plan's own definition, arguably by Blend.
- The prototype panel is titled "Pointfield"; screenshots would read as a Pointfield mode.

## 5. Other wrong, untested or overstated

- One machine, Safari only, 1 ms timer resolution.
- No write-up covers runs 29 to 32, the 834 default, Look presets or gallery mode.
- Unverified by anyone: frame and sort times at 834/1112, live-page grain, the screenshot itself.

## 6. Third reviewer: astra (ChatGPT) and corrections

Logged at `~/Developer/agent-notes/consults/20260924_205741.md`. Re-checked in code; overrides sections above where they conflict.

- **Wrong in my draft: "no image used to judge the look had the wobble on".** Autoload never sets `uTurb` 0, so `auto_t*.jpg` / `snap_live.jpg` had it on (417, size 2.4) and look clean.
- **Wrong in my draft: "v14 metrics see the front view only".** Fidelity at yaw 0; holes, dots, seams at yaw ±15°, pitch ∓4° (`:1367-1385`).
- **New: v14 "PSNR" is non-standard.** `q += d*d/3` squares the sum of the three absolute channel errors (`:1365`). Absolute dB not comparable with standard PSNR; delta sizes unverified.
- "8-bit depth": baked frames are uint8 but interpolated in float during playback (`:392-401`); live is not 8-bit.
- Sorting is approximate: one key per cell, squared camera distance, wobble ignored.
- Attribution of run29/run30 to the current code is not proven.
- The Safari A/B isolates the wobble at one setting; it does not settle the whole cause.
- Astra's nuance for naming: shipped points are already soft Gaussian discs (plan v1:31), so Gaussian weighting alone is not 3DGS; the conflict arises only if this ships as Pointfield.

## 7. Fourth reviewer: Gemini

Gemini (Pro, via the Gemini desktop app, 2026-09-25) was given this audit plus code excerpts; raw answer in the scratchpad as `gemini_answer.md`. It confirmed the grid counts, the fixed edge offset, the gallery stale-sort bug, and the public-copy conflict. Its new points, each re-checked in code:

- **Nearest-filter mechanism, more precise: accepted.** At 834, `du = 1/834 = 0.00120` is smaller than one depth texel (1/518 = 0.00193). The central difference spans 2du = 0.0024, just over one texel. So it often reads the same texel on both sides, which gives a zero gradient (normal straight at the camera), with spikes where it straddles a texel boundary. This is consistent with [Opus]'s finding that 72 to 81% of cells have exactly zero x-slope. It is the likeliest mechanical source of a speckled normal field at fine grids.
- **"Lattice irregularity" is missing only at K=1: accepted as a nuance.** With K > 1 each member gets a random offset (`splatInfo`, `proto.js:437-440`). The Look presets and the gallery all run at K=1 (the gallery sets `S.K = 1`; `setLook` does not change K), so the statement holds for what was judged.
- **My radius formula was abbreviated: accepted.** The full expression is `0.5 * cellW * uSurfScale * bgS * s * (uK > 1 ? 0.8 : 1) * jitter` (`:519`).
- **"Gaps become severely exaggerated in the background because of `s`": rejected.** `liftTop` scales the x and y positions by the same `s` (`:431`), so the spacing between neighbours shrinks with the radius. The ratio of radius to spacing does not depend on `s`. Perspective does not open gaps by itself; the idealised gap threshold in section 2 stands.
- Minor: Gemini called Blend "EWA-style"; sections 3 and 6 already note that there is no screen-space prefilter, so "EWA" overstates it. Its line numbers are approximate because it saw excerpts.

All four reviewers agree on these:
- Every look contradicts "Not AI".
- Blobs and Dots contradict "Not Gaussian splatting".
- The gallery Blobs/Dots images are invalid evidence of correct sorting.
- Nothing measured at 834/1112 exists for performance.

## 8. Safari run, 2026-09-25 (partial)

Cia gave the go for a Safari run. **Only a partial test was possible:** Safari refuses scripted JavaScript until "Allow JavaScript from Apple Events" is enabled (Safari Settings, Developer), which is Cia's setting to change. Without it, only URL parameters work. So Splat size, `uTurb` and baked depth could not be set; `?autoload=1` was avoided because it would overwrite the existing `auto_t*` evidence.

Run: `?grid=834&snap=audit3_834`. Interactive page, 834x470 grid, live depth, Recommended look (Blend, size 2.4, fill on), wobble ON, DPR 2, yaw 11, pitch 4, video paused near the start. Files are in `results/audit3/`.

| Test | Result |
| --- | --- |
| Screen capture (`screencapture -l`, Safari window) vs page `canvas.toDataURL` (JPEG 0.9), same frame region | Mean abs difference 2.63/255. Laplacian energy 3.28 (screen) vs 3.73 (dataURL; JPEG ringing likely). Dark pixels 0.01% vs 0.02%. **No material difference; the capture method does not explain the grain.** |
| Live page at 834 (`cmp_834_crop.png`) vs gallery render at 834 (`run32_crop.png`, wobble off, pixel ratio 1, 1920 wide) | **The live page looks clearly worse.** Individual disc outlines are visible, and pale slivers and specks are scattered across the face and hair, even at the default size 2.4. The gallery render of the same grid is clean and sharp. |
| Live page at 417 (`auto417_crop.png`, from the earlier autoload) | Large visible discs (blobby), no specks. |

What this establishes:
- **The grain-like texture is reproducible in the live page at the 834 default, without lowering Splat size.** The earlier "could not be reproduced" claim is withdrawn.
- **The gallery sheets (runs 29 to 32) do not represent the live page.** Any look judgement from them is judging a cleaner image than the page shows.
- Section 9 separates the causes.
- One frame, one clip, one machine.

## 9. Safari A/B run, 2026-09-25 (scripted)

Cia enabled "Allow JavaScript from Apple Events". The page was driven through `do JavaScript` with a helper (`results/audit3/helper.js`). The helper:
- sets the grid, look, Splat size, `uTurb` and pixel ratio;
- fixes the camera at yaw 11, pitch 4;
- captures `canvas.toDataURL('image/png')` inside a requestAnimationFrame callback, so it gets the frame that was just drawn.

The video was paused at t=0. Live configs ran first. Then the PFD2 bake was loaded (hash verified, 150 frames), because switching back to live does not re-infer depth. Section 8 showed that `toDataURL` matches a real screen capture.

Metric, measured over the central 68% x 76% of the frame:
- "Specks": share of pixels that differ from a 5x5 median by more than 40/255.
- "Black": share of pixels below 20/255.
- Pixel-ratio-1 captures were upscaled 2x before measuring.

Face crops are in `results/audit3/audit3_sheet.jpg`: row 1 is B1 to B4, row 2 is L1 to L4, row 3 is L5 to L8, row 4 is L9.

| Run | Depth | Grid | Look | Splat size | Wobble | DPR | Specks | Black |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | live | 834 | Blend | 2.4 | on | 2 | 0.22% | 0.02% |
| L2 | live | 834 | Blend | 2.4 | off | 2 | 0.07% | 0.00% |
| L3 | live | 834 | Blend | 2.4 | on | 1 | 0.09% | 0.00% |
| L4 | live | 834 | Blend | 0.8 | on | 2 | 14.9% | 8.5% |
| L5 | live | 834 | Blend | 0.8 | off | 2 | 24.8% | 2.0% |
| L6 | live | 417 | Blend | 2.4 | on | 2 | 0.04% | 0.00% |
| L7 | live | 417 | Blend | 2.4 | off | 2 | 0.03% | 0.00% |
| L8 | live | 834 | Flat (points) | n/a | on | 2 | 25.7% | 42.7% |
| L9 | live | 834 | Flat (points) | n/a | off | 2 | 34.8% | 32.0% |
| B1 | baked | 834 | Blend | 2.4 | on | 2 | 0.24% | 0.02% |
| B2 | baked | 834 | Blend | 2.4 | off | 2 | 0.08% | 0.00% |
| B3 | baked | 834 | Blend | 0.8 | on | 2 | 15.0% | 8.4% |
| B4 | baked | 834 | Blend | 0.8 | off | 2 | 24.7% | 1.9% |

Findings (one frame, one clip, one machine):
- **Baked depth is not the cause.** Every baked/live pair matches within 0.02 percentage points (B1/L1, B2/L2, B3/L4, B4/L5). The "8-bit baked depth" hypothesis is withdrawn.
- **The capture method is not the cause** (section 8).
- **A small Splat size is the dominant cause.**
  - At 0.8, specks are 15 to 25%, against 0.07 to 0.24% at 2.4. That fits the gap threshold of about 1.4 to 1.7.
  - With the wobble on, the gaps show as black dots (8.5% black).
  - With the wobble off, they show as a regular lattice, with the fill layer blocky behind it.
- **The Flat look is grainy by construction:** 26 to 35% specks and 32 to 43% black, and Splat size has no effect on it. If Cia's screenshot was taken in Flat, that explains it.
- **The wobble is a real but minor factor at default size.**
  - At 834, size 2.4, it triples specks (0.07% to 0.22%). These are the pale slivers in section 8.
  - At 417 it barely registers (0.03% to 0.04%).
  - So the new 834 default is what makes the wobble visible. Whether to keep it is Cia's look call.
- **DPR 2 vs 1:** 0.22% vs 0.09% with the wobble on. The gallery sheets were rendered at DPR 1 with the wobble off, which is why they look cleaner than the live page.

Frame timing, same session: sweep on, baked depth, DPR 2, canvas 3452x2080. Read from the page's stats panel after 6 s.

| Grid | Look | N | fps | Frame p50 / p95 | Sort |
| --- | --- | --- | --- | --- | --- |
| 417 | Blend + fill | 98k | 58.8 | 17 / 63 ms | n/a |
| 834 | Blend + fill | 392k | 58.8 | 17 / 72 ms | n/a |
| 1112 | Blend + fill | 697k | **52.6** | 19 / 63 ms | n/a |
| 834 | Dots | 392k | 58.8 | 17 / 38 ms | 4 ms |
| 1112 | Dots | 697k | 58.8 | 17 / 48 ms | 6 ms |

- These are requestAnimationFrame intervals capped at the display rate, not GPU times.
- The 6 s window includes the grid rebuild and the AppleScript calls, so p95 is unreliable.
- **1112 with Blend and fill does not hold 60 fps on the M5 Max at DPR 2.** 834 does.
- Sorting takes 4 to 6 ms at 392k to 697k keys. This replaces the old "2 to 3 ms at 98k" figure.
- "infer 381 ms" in the stats is a single cold boot inference, not comparable with v12's warm 39 ms.

## Open items for Cia

1. Done 2026-09-25 (section 9). The Developer settings in Safari can be switched back off; they are no longer needed. "Allow unsigned extensions" especially should go back off.
2. Done: copied into the gallant-tharp worktree 2026-09-25 on Cia's go.
3. Look questions raised by section 9, which are Cia's to decide:
   - Splat size values below about 1.5 open gaps.
   - The wobble becomes visible at 834.
   - The Flat look is grainy by construction.

CANON: NONE
