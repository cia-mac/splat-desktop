# Pointfield — Launch Asset Inventory (v2)

Created 2026-05-29. Supersedes `ASSET_INVENTORY_v1.md` (PixelCluster era, kept). Scope: local explainer + launch assets in `~/Developer/splat-desktop/launch/`. Nothing here is published.

**Public name: Pointfield** (canon 2026-05-29; supersedes PixelCluster, which superseded the retired-then-revived Pointfield; PointCluster rejected). One word, capital P, lowercase f. Rename is **phased** — this inventory reflects Phase 1 (local docs + diagrams). App strings, site route/page, README, and GitHub releases still say PixelCluster (Phases 2–4, not done).

Visual language master direction = Diagram 1 (dark canvas, mono-hue Caspian chrome, true source color for content, minimal labels, technical accuracy over decoration).

## Explainer diagrams — current = Pointfield

| Diagram | Subject | Current master (Pointfield) | Review PNG | Superseded (kept) |
|---|---|---|---|---|
| **1** | Frame → sampling grid → point clusters | `diagram-1_frame-grid-clusters_v1.2.svg` | `..._v1.2_review.png` | `_v1.1.svg`/`_v1.svg` (PixelCluster) |
| **2** | One sampled region → seven points | `diagram-2_one-region-seven-points_v1.2.svg` | `..._v1.2_review.png` | `_v1.1.svg`/`_v1.svg` (PixelCluster) |
| **3** | Interaction modes: drift/swirl/push/attract/return | `diagram-3_interaction-modes_v2.svg` | `..._v2_review.png` | `_v1.svg` (PixelCluster) |

All masters: 16:9, 1600 × 900, self-contained SVG, teaching variant only, kicker now "POINTFIELD — …". Only the visible kicker (+ file comment) changed from the v1.1/v1 PixelCluster versions; mechanism, labels, footers, and the 685,965 figure are unchanged.

## Build tooling
| File | Purpose |
|---|---|
| `diagram-3_build_v2.py` | Deterministic generator for Diagram 3 v2 (Pointfield kicker, seed 42). |
| `diagram-3_build.py` | Prior (PixelCluster) generator, kept. |

## Release / planning docs

| File | Purpose | Status |
|---|---|---|
| `RELEASE_PACKET_v1.2.md` | Pointfield rename overlay on v1.1 | **Current** (Pointfield). |
| `social-copy_v2.md` | Pointfield X/LinkedIn/Substack/YouTube copy | **Current** (Pointfield). |
| `RELEASE_PLAN_v2.md` | Master launch plan (4 tracks), Pointfield | **Current** (Pointfield). Swapped from `_v1`. |
| `mac-app-store_v2.md` | MAS track (parked), Pointfield | **Current** (Pointfield). Swapped from `_v1`. |
| `RELEASE_PACKET_v1.1.md`, `RELEASE_PACKET_v1.md`, `social-copy_v1.md`, `RELEASE_PLAN_v1.md`, `mac-app-store_v1.md` | PixelCluster-era | Superseded, kept. |

## Diagram + website specs — current = Pointfield

| File | Subject | Status |
|---|---|---|
| `diagram-1_frame-grid-clusters_spec_v1.1.md` | Diagram 1 build spec | **Current** (Pointfield). Swapped from `_v1`. |
| `diagram-2_one-region-seven-points_spec_v1.1.md` | Diagram 2 build spec | **Current** (Pointfield). Swapped from `_v1`. |
| `diagram-3_interaction-modes_spec_v1.1.md` | Diagram 3 build spec | **Current** (Pointfield). Swapped from `_v1`. |
| `POINTFIELD_WEBSITE_EXPLAINER_ASSEMBLY_SPEC_v1.1.md` | Website explainer assembly spec | **Current** (Pointfield). Swapped from `PIXELCLUSTER_..._v1.md` (name-bearing filename retired). |
| `diagram-1/2/3_*_spec_v1.md`, `PIXELCLUSTER_WEBSITE_EXPLAINER_ASSEMBLY_SPEC_v1.md` | PixelCluster-era specs | Superseded, kept. |

## PixelCluster → Pointfield text swap — COMPLETE (Phase 1 closed 2026-05-29)

The internal docs previously deferred are now swapped as versioned successors (originals kept). Method: copy to next version, then replace product-name strings (`PixelCluster`→`Pointfield`, `PIXELCLUSTER`→`POINTFIELD`, `pixelcluster-v*`→`pointfield-v*`); each verified 0 residual `PixelCluster`. Substance unchanged in every case (the name was already canon-locked). Done: `RELEASE_PLAN_v2.md`, `mac-app-store_v2.md`, the three `diagram-*_spec_v1.1.md`, `POINTFIELD_WEBSITE_EXPLAINER_ASSEMBLY_SPEC_v1.1.md`.

Phase 1 (local docs + diagrams) is now fully closed: diagrams + public copy + master packet + all internal specs are Pointfield. Remaining `PixelCluster` strings inside `launch/` are intentional only: (a) superseded v1/v1.1 originals, kept by the version-preservation rule; (b) accurate history/sequencing references in current docs (e.g. "live route is still `/pixelcluster`", "published assets stay `PixelCluster_0.1.1_*` immutable"). No live surface is renamed; Phases 2 to 5 are not started.

## Naming / vocabulary (locked)
Public **Pointfield**. "points" precise · "point clusters" mechanism · "particle-like" visual only · never "particle simulation." Density: public "hundreds of thousands"; technical "685,965 = 417 × 235 × 7"; browser "lower density." Reference resolution 1920 × 1080. Not AI, not Gaussian splatting, not a physics simulation.

## Rename phase status (per rename audit + canon)
- Phase 0 (canon) — **done** (`splat-desktop/CLAUDE.md`, memory `project_pixelcluster_v01.md`, `MEMORY.md`).
- Phase 1 (local docs + diagrams) — **DONE / closed 2026-05-29** (this inventory): diagrams + public copy + master packet + all internal specs swapped to Pointfield. Originals kept. See the "text swap COMPLETE" section above.
- Phase 2 (app strings/CI), Phase 3 (site route `/pointfield` + redirect + egg), Phase 4 (GitHub Pointfield release), Phase 5 (announce) — **not started**; each gated, explicit go for public/live.

## Carried non-blocking note
`splat-desktop/CLAUDE.md` historically described turbulence as "hash noise"; the shader uses layered sine (`hash()/noise()` defined but unused). Diagram copy says "sine." Unchanged.
