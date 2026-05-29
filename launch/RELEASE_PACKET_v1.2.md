# Pointfield — Release Packet (v1.2, Pointfield rename overlay)

Created 2026-05-29. **Overlay on `RELEASE_PACKET_v1.1.md`** (kept). This version records the PixelCluster → **Pointfield** rename (canon 2026-05-29) for the launch packet. Everything in v1.1 still applies **except** the name-bearing items updated below. Read v1.1 for full structure (ITD plan, page structure, video plan, asset checklist); read this for what the rename changes.

## Name & vocabulary (locked 2026-05-29)
- Public product name: **Pointfield** (one word, capital P, lowercase f; never `PointField`/`Point Field`). Supersedes **PixelCluster** (prior name) and **PointCluster** (rejected).
- "points" precise · "point clusters" mechanism · "particle-like" visual only · never "particle simulation."
- Density registers unchanged: public "hundreds of thousands of points"; technical "685,965 = 417 × 235 × 7"; browser "lower density for real-time performance."
- Rationale: Pointfield names the phenomenon (moving images reconstituted as live fields of glowing points); PixelCluster named the mechanism. Same engine; reveal-not-build narrative intact.

## Canonical lines (replace the v1.1 PixelCluster lines)
- **Public:** "Pointfield redraws moving images as interactive fields of glowing points."
- **Mechanism:** "It lays a sampling grid over each video frame. Every grid cell reads the color at that part of the image, then spawns a small cluster of points that share that color."
- **Disclaimer:** "A renderer, not a filter. Not AI. Not Gaussian splatting. Not a physics simulation."
- **Technical:** "The desktop default renders 685,965 points: 417 × 235 sampled regions × 7 points per region. The browser version uses lower density for real-time performance."

## Route (updates v1.1 §2/§5 + audit Phase 3)
- Canonical route becomes **`/pointfield`**, with a **301 redirect `/pixelcluster` → `/pointfield`** to catch the homepage easter-egg link and any shared previews. Update the middleware bypass to `/pointfield*` and the homepage `EGG_URL`. **Implementation is Phase 3 (site), not done here.** Until then the live route remains `/pixelcluster`.

## Diagram assets (current Pointfield versions)
- Diagram 1: **`diagram-1_frame-grid-clusters_v1.2.svg`** (+ `_v1.2_review.png`) — kicker "POINTFIELD — HOW IT WORKS".
- Diagram 2: **`diagram-2_one-region-seven-points_v1.2.svg`** (+ `_v1.2_review.png`) — kicker "POINTFIELD — THE CORE STEP".
- Diagram 3: **`diagram-3_interaction-modes_v2.svg`** (+ `_v2_review.png`) — kicker "POINTFIELD — INTERACTION". Built by `diagram-3_build_v2.py`.
- The v1.1/v1 PixelCluster diagrams are retained (superseded).

## Copy blocks
- Public/social/GitHub/YouTube copy: see **`social-copy_v2.md`** (Pointfield). v1.1 §6 PixelCluster blocks are superseded.

## Release / download naming (audit Phases 4 carry over)
- Existing published assets stay `PixelCluster_0.1.1_*` (immutable). Pointfield-named assets (`Pointfield_*`) arrive at the **next release** under a `pointfield-v*` tag after the app `productName` change (Phase 2) + workflow trigger update. Do not repoint download links until those exist.

## What this overlay does NOT change
Page architecture (scroll-reveal, immersive screen one, below-fold explainers, no `/how`, no drawer), the diagram/ITD plan, the video capture plan, the asset checklist, and all guardrails — all per v1.1. Only the name, canonical lines, route, diagram filenames, and copy source change.

## Still pending (deferred to later phases, per rename audit)
App strings/config (Phase 2), site route + page + egg (Phase 3, stage first), GitHub Pointfield release (Phase 4), announce (Phase 5). Each gated; explicit go for any public/live step. The internal specs (`diagram-1/2/3_*_spec`, `mac-app-store`, website explainer spec) have now been swapped to Pointfield as versioned successors (Phase 1 closed 2026-05-29) — see `ASSET_INVENTORY_v2.md`.
