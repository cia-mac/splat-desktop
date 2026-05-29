# Pointfield v0.1 — Social Launch Copy (v2)

Created 2026-05-29. Supersedes `social-copy_v1.md` (PixelCluster era, kept). Public name is now **Pointfield** (canon 2026-05-29). Fire on Cia's go, after the web surface + Pointfield-named release are live.

**Naming/vocabulary (locked):** public name **Pointfield** (one word, capital P, lowercase f). "points" = precise primitive; "point clusters" = mechanism; "particle-like" = visual only; never "particle simulation." Density registers: public "hundreds of thousands of points"; technical "685,965 = 417 × 235 sampled regions × 7 points per region"; browser "lower density for real-time performance."

**Sequencing dependency (do NOT fire early):** these drafts use `ciamac.com/pointfield`. That route + a Pointfield-named GitHub release (`Pointfield_*` assets) must land first (rename Phases 3–4). Until then the live route is `/pixelcluster` and assets are `PixelCluster_0.1.1_*`. Posting before the cutover would point at the old name.

**Canonical lines**
- Public: "Pointfield redraws moving images as interactive fields of glowing points."
- Mechanism: "It lays a sampling grid over each video frame. Every grid cell reads the color at that part of the image, then spawns a small cluster of points that share that color."
- Disclaimer: "A renderer, not a filter. Not AI. Not Gaussian splatting. Not a physics simulation."

---

## X (thread, 3)
> **1/** Pointfield.
> It redraws moving images as interactive fields of glowing points, in real time.
> Running quietly in my work for a while. Now it has a name.
> ciamac.com/pointfield
>
> **2/** A sampling grid goes over each frame. Every cell reads one live color and spawns a small cluster of points that share it. Hundreds of thousands of points, redrawn every frame. Move your cursor and the field moves.
>
> **3/** Runs live in your browser, nothing to install. Or take the app, free, Mac + Windows.
> ciamac.com/pointfield

## LinkedIn (single post)
> For a while I've had a renderer buried in my imaging work that does one thing: it redraws moving images as fields of glowing points.
>
> I named it. Pointfield.
>
> It lays a sampling grid over each video frame. Every cell reads the color at that part of the image, then spawns a small cluster of points that share it. Hundreds of thousands of them, redrawn every frame. They drift, and they respond to your cursor.
>
> Run it in your browser right now, no install. Drop in any clip and watch it resolve into points. The desktop app is free for Mac and Windows.
>
> ciamac.com/pointfield
>
> (A renderer, not AI. Not a filter.)

## Substack (note)
> New thing on the site.
>
> Pointfield turns any video into a live field of glowing points. Drop a clip in and watch it resolve, live, in the browser.
>
> ciamac.com/pointfield

## YouTube description
> Pointfield redraws moving images as interactive fields of glowing points.
>
> Drop a video in. Pointfield lays a sampling grid over each frame, reads the color at every cell, and spawns a small cluster of glowing points that share that color — hundreds of thousands of them, redrawn every frame in real time. They drift on a turbulence field and respond to your cursor: swirl, push, attract.
>
> It is a renderer, not a filter, not AI, not Gaussian splatting, not a physics simulation. The same engine has shipped since April 2026; v0.1 is the release that names it.
>
> Technical note: the desktop default renders 685,965 points (417 × 235 sampled regions × 7 points per region); the browser version uses lower density for real-time performance.
>
> Try it in your browser: ciamac.com/pointfield
> Download (Mac + Windows): https://github.com/cia-mac/splat-desktop/releases/latest

## Claims to avoid
❌ "each pixel becomes a point" / "one pixel one particle" · ❌ "particle simulation / physics / gravity / collisions" · ❌ "3D / depth / volumetric" · ❌ "AI / generative / neural" · ❌ "edge/brightness detection drives the points" · ❌ "Gaussian splatting" · ❌ exact point count in public copy (use "hundreds of thousands").

## Notes
- Do not mention iOS or visionOS (real but unannounced).
- Reveal, not "app launch": same engine that shipped as ciafx; v0.1 names it Pointfield.
- Desktop builds unsigned (Gatekeeper: `xattr -cr`); MAS track parked.
