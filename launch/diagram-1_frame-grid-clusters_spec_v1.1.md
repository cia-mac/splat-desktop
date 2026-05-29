# Diagram 1 Spec — "Frame → sampling grid → point clusters" (v1.1)

v1.1 (2026-05-29): PixelCluster to Pointfield text swap of `diagram-1_frame-grid-clusters_spec_v1.md` (kept). Spec substance, mechanism, and the 685,965 figure unchanged; only product-name strings updated.

Created 2026-05-29. Operator: Claude. **Build spec only — the SVG is NOT authorized to be built yet.** No code, no publish, no README, no site write.
Parent: `RELEASE_PACKET_v1.1.md`. Engine truth: `~/Developer/splat-desktop/ui/app.js`. Vocabulary + density registers locked (see packet §0 D2).

---

## 1. Purpose & role

The single canonical image that explains Pointfield in one glance and kills the three biggest misconceptions: "it's a filter," "it's AI," "one pixel = one point." It is the lead asset for the website "How it works" section, the GitHub README, decks, and social. It is also the static fallback / storyboard for the interactive ITD-1 (grid inspector).

**One-sentence takeaway the viewer should leave with:** "A grid samples each frame, and every cell becomes a little cluster of same-colored points."

---

## 2. Source images (per packet D3)

Two renders of the same diagram, same layout:
- **Teaching variant (primary for explanation):** a simple source with obvious, well-separated color regions (Q8.1 — clip/still TBD). Chosen so the grid→cluster color mapping is unmistakable. This is the version used in the "How it works" section and README.
- **Hero / brand variant:** the ciamac.com bird engine output. Naturally Caspian, recognizable as the Pointfield look. Used where brand resonance matters (social, deck cover).

Both variants are blocked on their source frame: teaching clip (Q8.1) and a clean bird still (export from the homepage surface). Do not fabricate frames.

---

## 3. Composition

**Format:** three panels, left → right, equal width, connected by two arrows. Authored as **SVG** (vector chrome + grid; raster source frames placed as embedded images). Dark canvas.

```
┌──────────────┐   →   ┌──────────────┐   →   ┌──────────────┐
│   PANEL 1     │       │   PANEL 2     │       │   PANEL 3     │
│  Source frame │       │  + grid       │       │  Point clusters│
└──────────────┘       └──────────────┘       └──────────────┘
   "One frame"          "Grid samples         "Each cell → a
                         each region"          cluster of points"
```

### Panel 1 — Source frame
- The raw video still (teaching or hero variant), full-bleed within the panel.
- Caption beneath: **"One video frame."**

### Panel 2 — Sampling grid
- Same frame, dimmed ~20%, with a **faint grid overlay** (lines in `--bone-3` at ~30% opacity).
- **Do NOT draw all 417×235 lines** (unreadable + implies literal pixel grid). Draw a **representative coarse grid** (e.g. ~24×14 visible cells) and label it as illustrative. One cell highlighted (stroke `--accent`, subtle glow `--accent-glow`) — this is the cell that "explodes" conceptually into Panel 3 / Diagram 2.
- Caption: **"A sampling grid is laid over the frame. Each cell reads the color at that spot."**
- Small technical annotation (technical register, D2), set apart in mono type: *"Default grid: 417 × 235 sampled regions (illustrative grid shown)."*

### Panel 3 — Point clusters
- The frame reconstructed as glowing point clusters: each cell rendered as a small cluster of soft points sharing that cell's sampled color. Additive glow look matching the real renderer (gaussian-soft points, `OPACITY`-like falloff).
- The highlighted cell from Panel 2 shown as its own little cluster (ties to Diagram 2).
- Caption: **"Each cell spawns a small cluster of points that share that color."**

### Footer strip (technical register, full width)
> "685,965 points by default: 417 × 235 sampled regions × 7 points per region. The browser version uses lower density for real-time performance."

(Public-register variant of the asset, if needed for social, replaces the footer with: *"Hundreds of thousands of glowing points, redrawn every frame."*)

---

## 4. Exact values to honor (engine-true)

- Grid default: **COLS 417 × ROWS 235 = 97,995 sampled regions.**
- Points per region: **PER_CLUSTER 7** → **685,965 points** total (desktop default).
- Cluster scatter (for the Panel 3 cluster look and the highlighted cell): random polar offset, radius ≤ **CLUSTER_SPREAD = 4.0** source px.
- Point look: soft **gaussian** disc (matches `FRAG` `exp(-r²·uGaussExp)`, `uGaussExp = 5.0`), **additive** blend, varied size (`1.7–5.4`, biased small).
- Color: each cluster = the **single live color** sampled at the cell's UV. All members share it.
- Grid is a **subsample** of source pixels (98k cells vs ~2M px at 1080p). The coarse illustrative grid must be labeled so no one reads it as the literal sampling resolution.

---

## 5. Style

- **Canvas:** `--ink #0a0a0b`. Panels separated by thin `--rule #1d1d20` or generous negative space (no heavy boxes).
- **Accents:** Caspian only — highlighted cell `--accent #4d7fe0`, glow `--accent-glow #78b4ff`, arrows `--bone-3`/`--accent-sky`.
- **Type:** captions in Helvetica Neue / system, light weight, `--bone`; technical annotations in mono (`--bone-2`), uppercase tracking for labels. Restrained — diagram-led, not text-led.
- **Arrows:** thin, simple, `--bone-3`; optional verb labels ("sample," "spawn").
- Matches brand v5.5.1 mono-hue Caspian; consistent with the live surface aesthetic.

---

## 6. Deliverables (on build approval)

- **SVG master** (editable; source frames embedded or linked).
- **PNG @2x** exports: **16:9** (deck, YouTube thumb, README), **1:1** (X/IG), **4:5** (LinkedIn).
- **PDF** (print/deck).
- **Two content variants** per aspect: teaching (technical footer) and hero/bird (public footer).
- **Alt text** (ship with the asset): "Three panels showing a video frame, the same frame with a sampling grid laid over it, and the frame rebuilt as clusters of glowing colored points."

---

## 7. Accuracy guardrails (must-not-imply)

- ❌ Not "each pixel → a point." Cell = sampled region; grid subsamples pixels; 7 points per cell.
- ❌ Not a filter / not AI / not Gaussian splatting / not physics. (The only "gaussian" is the soft point edge.)
- ❌ Not 3D/volumetric — panels read flat (orthographic).
- ❌ The visible grid is illustrative, not the literal 417×235 (label it).
- ❌ No exact point count in the public-register variant (use "hundreds of thousands").
- Color in Panel 3 should read as **sampled-from-source**, not recolored — if the teaching variant uses true color, keep it true; only the bird/brand variant is naturally Caspian.

---

## 8. Acceptance criteria

A correct Diagram 1:
1. Reads left-to-right as frame → grid → clusters without reading the captions.
2. Makes "one cell → a cluster of same-colored points" obvious (highlighted cell carried across panels).
3. States the density in the correct register (technical footer with the 685,965 breakdown, or public footer with "hundreds of thousands").
4. Labels the visible grid as illustrative.
5. Uses only Caspian accents on a dark canvas; type stays restrained.
6. Ships with alt text and in 16:9 / 1:1 / 4:5.
7. Contains nothing from the claims-to-avoid list.

---

## 9. Blocked on (before build)

- **Teaching clip/still** with obvious color regions (Q8.1).
- **Clean bird still** exported from the homepage surface (panel/FPS hidden).
- **Reference resolution** if a pixel-count annotation is wanted (Q8.2; suggest 1080p).
- **Explicit approval to build the SVG.** This document is spec-only.
