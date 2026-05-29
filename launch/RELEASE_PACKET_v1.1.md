# PixelCluster — Release Packet & Explainer System (v1.1)

Created 2026-05-29. Operator: Claude. Supersedes `RELEASE_PACKET_v1.md` (kept per version rule). Planning artifact only — no code, no publish, no final graphics, no ITD implementation.

**v1.1 changelog:** records three controller decisions (page architecture, density language, source clips). Resolves former open questions §8.1, §8.2, §8.5. Diagram 1 promoted to its own build spec: `launch/diagram-1_frame-grid-clusters_spec_v1.md`.

Source of truth for engine behavior: read-only extraction from `~/Developer/splat-desktop/ui/app.js` + `README.md`. Vocabulary locked 2026-05-28 (PixelCluster; "points" precise; "point clusters" mechanism; "particle-like" visual-only; never "particle simulation").

---

## 0. Controller decisions (locked 2026-05-29)

**D1 — Page architecture: scroll-reveal.** Screen one stays an immersive living PixelCluster surface. Explainers, ITDs, downloads, GitHub links, and technical notes live below the fold. **No separate `/how` route for v1. No overlay drawer as the primary explainer.**

**D2 — Density language (three registers):**
- **Public copy:** "hundreds of thousands of points." (No exact number in marketing-facing lines.)
- **Technical copy:** "The desktop default renders 685,965 points: 417 × 235 sampled regions × 7 points per region."
- **Browser version:** "The browser version uses lower density for real-time performance." (Do not quote a browser point count in public copy.)

**D3 — Source clips:**
- **Primary release source / hero:** the ciamac.com homepage visual (the bird engine output). This is the recognizable PixelCluster image.
- **Teaching source:** one simple clip/still with obvious, well-separated color regions, used for the diagrams and ITDs (so the grid→cluster mapping reads clearly).
- **Plasma (`deploy/pixelcluster/default.mp4`):** fallback / dev only. Not the release hero unless explicitly approved later.

---

## 1. Release packet outline

| # | Bucket | Status | Gating dependency |
|---|--------|--------|-------------------|
| A | ITD plan | spec'd (§2) | none to spec; build needs approval + teaching source |
| B | 3 diagram specs | Diagram 1 promoted to own file; 2 & 3 spec'd (§3) | teaching/hero source for final art |
| C | Video capture plan | spec'd (§4) | hero = bird output (available); teaching clip needed |
| D | Website page structure | locked to scroll-reveal (§5) | none — buildable on approval |
| E | Copy blocks | drafted (§6) | none |
| F | Asset checklist + sequencing | §7 | source clips |
| G | Open questions | §8 (reduced) | Cia |

Sequencing rule unchanged: source → diagrams → video + ITDs → page → launch. Copy can finalize in parallel now.

---

## 2. ITD plan for ciamac.com/pixelcluster

### 2.1 Placement (resolved by D1)
ITDs live in the **below-the-fold explainer column** of `/pixelcluster` (scroll-reveal). The immersive surface is screen one and never shares the frame with explainer UI. No `/how` route. No drawer.

### 2.2 ITD inventory (priority order)
Engine-true, in-browser, reuse real `app.js` logic where possible.

| ITD | Teaches | Approach | Priority |
|-----|---------|----------|----------|
| **ITD-1 Grid inspector** | frame → grid → one cell → 7 points | static teaching frame + canvas/SVG overlay; hover a cell to spawn its cluster | P0 |
| **ITD-2 Cluster spread** | PER_CLUSTER (1–8) + polar spread | one-cell live build; sliders | P0 |
| **ITD-3 Three forces** | swirl / push / attract + decay wake | small live renderer instance; mode toggle | P0 |
| **ITD-4 Turbulence decomposer** | 3 sine octaves, amp/speed | toggle octaves; scrub time | P1 |
| **ITD-5 Density / numbers** | desktop default vs browser density | density slider + the technical breakdown (D2) | P1 |
| **ITD-6 Density ladder** | 200k / 686k / 1.2M | thumbnails or live slider | P2 |

(Former ITD-5 "point-vs-pixel counter" folded into ITD-5 numbers; the public-facing framing is now "hundreds of thousands," with the precise breakdown shown only as technical detail.)

### 2.3 Shared conventions
- **Engine-true values:** `COLS×ROWS×PER_CLUSTER`, `CLUSTER_SPREAD=4.0`, `SIZE_MIN/MAX=1.7/5.4`, `SIZE_POW=2.4`, additive blend, gaussian point alpha (`uGaussExp=5.0`). No invented numbers.
- **Palette:** brand v5.5.1 Caspian — `--ink #0a0a0b`, `--ink-2 #0f0f12`, `--bone #ece8df`, `--bone-2 #9a948a`, `--bone-3 #6b665e`, `--accent #4d7fe0`, `--accent-sky #8fb5e8`, `--accent-glow #78b4ff`.
- **Performance:** ITD instances cap well below the surface density; teaching layer never janks.
- **Vocabulary:** "points," "point cluster," "sampling grid," "sampled region." Never "particle simulation."
- **noindex** for now.

---

## 3. Diagram specs

### 3.1 DIAGRAM 1 — "Frame → sampling grid → point clusters"
**Promoted to a dedicated build spec:** `launch/diagram-1_frame-grid-clusters_spec_v1.md`. Summary: three-panel left→right (source frame → grid overlay → reconstructed point clusters), teaching source for clarity, hero (bird) variant for brand, density language per D2. Build is NOT authorized yet (spec only).

### 3.2 DIAGRAM 2 — "One sampled region becomes seven points"
Zoomed single cell, exploded into 7 points by random polar offset (angle random, distance ≤ `CLUSTER_SPREAD = 4.0` px); all share the cell color; sizes random (`1.7–5.4`, biased small via `pow 2.4`); soft gaussian discs. Callouts: ① shared color ② random angle ③ random radius ④ random size (not brightness-driven) ⑤ soft gaussian edge. Footer (technical register, D2): "Default 7 points per region. Adjustable 1–8." Accuracy: size is procedural, NOT luminance/edge-driven; no physics. Deliverables: 16:9, 1:1, 4:5.

### 3.3 DIAGRAM 3 — "Mouse interaction: swirl / push / attract"
Three mini-panels with cursor + force vectors: swirl (tangential `25` + inward `6`), push (radial out `29`), attract (radial in `30`); shared inset shows `MOUSE_RADIUS = 278` falloff and the decaying "wake." Callouts: force falls off with distance; displaced points spring back; "kinematic offset + decay, not a physics solver" (decay `RETURN_SPEED 1.2`, slow `WAKE_RETURN 0.35`). Deliverables: 16:9 + per-mode 1:1.

(Diagrams 2 & 3 get their own build specs when promoted; not authorized to build yet.)

---

## 4. Video capture plan

Primary tool: the app's canvas recorder (`r` / Record, with "Record full loop") — clean, no OS chrome. Fallback: ScreenStudio/QuickTime for cursor-visible shots. Panel + FPS hidden for hero shots.

| Surface | Aspect | Length | Spec | Source (D3) | Beats |
|---------|--------|--------|------|-------------|-------|
| **Website hero loop** | 16:9 | 8–12s seamless | muted, H.264+WebM, ≤4MB, autoplay-loop | **bird output (primary)** | resolve → slow swirl → settle; no cursor |
| **YouTube** | 16:9 | 60–90s | 1080p/4K, VO/captions | bird hero + teaching clip for the how-it-works beat | surface → drop video → swirl/push/attract → grid→cluster → download |
| **LinkedIn** | 1:1 / 4:5 | 20–40s | 1080², muted, captioned | bird output | reveal → interact → name |
| **X** | 16:9 / 1:1 | 10–20s | ≤512MB, muted, loop feel | bird output | one hypnotic interaction beat + link |
| **GitHub GIF/WebM** | 16:9 | 4–8s | WebM (GIF fallback ≤5MB) | bird output | drop → field → one swirl |

Per-take checklist: panel hidden, FPS hidden, density "standard" for hero / lower for smooth capture, seed 42, consistent source across cuts. Teaching clip (D3) is required only for the how-it-works beats and the diagrams/ITDs, not the hero.

---

## 5. Website page structure (locked: scroll-reveal, D1)

**Screen 1 — Living surface (immersive, unchanged):** full-viewport renderer, autostart, drop-anywhere, panel hidden, no nav. Quiet chrome: `PixelCluster` wordmark (top-left), OS-aware download (bottom-left), faint downward "scroll to understand it" cue (bottom-center) — the only added element. Hero source = bird output (D3).

**Below the fold — calm dark explainer column (single measure):**
1. **What it is** — public line + mechanism line (§6.1); disclaimer line. Public density register ("hundreds of thousands").
2. **How it works** — Diagram 1 / ITD-1 (grid → clusters).
3. **One region → seven points** — Diagram 2 / ITD-2. Technical density register allowed here.
4. **Move it** — Diagram 3 / ITD-3; invite scroll back up to try.
5. **The numbers** — ITD-5: technical line "685,965 points: 417 × 235 sampled regions × 7 points per region" + "The browser version uses lower density for real-time performance."
6. **Take it with you** — downloads (macOS DMG Apple Silicon, Windows EXE/MSI), GitHub link, unsigned/Gatekeeper note.
7. **Where it came from** — optional one-line ciafx/Splat lineage ("reveal not build").

Constraint: explainer column stays calm/dark/type-light/diagram-led. No feature grid, no pricing, no badges. noindex for now.

---

## 6. Release-safe copy drafts (density language applied per D2)

### 6.1 Canonical lines
- **Public:** "PixelCluster redraws moving images as interactive fields of glowing point clusters."
- **Mechanism:** "It lays a sampling grid over each video frame. Every grid cell reads the color at that part of the image, then spawns a small cluster of points that share that color."
- **Disclaimer:** "A renderer, not a filter. Not AI. Not Gaussian splatting. Not a physics simulation."
- **Technical density:** "The desktop default renders 685,965 points: 417 × 235 sampled regions × 7 points per region. The browser version uses lower density for real-time performance."

### 6.2 Website "What it is" (public register)
> PixelCluster redraws moving images as interactive fields of glowing point clusters.
>
> It lays a sampling grid over each video frame. Every grid cell reads the color at that part of the image, then spawns a small cluster of points that share that color. Hundreds of thousands of points, scattered slightly, varied in size, drifting on a turbulence field. The video plays through them in real time, and your cursor pushes them around.
>
> A renderer, not a filter. Not AI. Not Gaussian splatting. Not a physics simulation.

### 6.3 Website "The numbers" (technical register)
> The desktop default renders 685,965 points: 417 × 235 sampled regions × 7 points per region. The browser version uses lower density for real-time performance.

### 6.4 GitHub release body (technical audience; do NOT retag/edit live without go)
> **PixelCluster v0.1.1**
>
> PixelCluster redraws moving images as interactive fields of glowing point clusters. Drop a video in. A sampling grid is laid over each frame; every cell reads one live color and spawns a small cluster of points that share it. They drift on a turbulence field and respond to your cursor — swirl, push, attract.
>
> The desktop default renders 685,965 points (417 × 235 sampled regions × 7 points per region). Same engine that has shipped since April 2026 (as Splat, then ciafx); v0.1 names it.
>
> **Downloads**
> - macOS (Apple Silicon): `PixelCluster_0.1.1_aarch64.dmg`
> - Windows (x64): `PixelCluster_0.1.1_x64-setup.exe` / `PixelCluster_0.1.1_x64_en-US.msi`
>
> **v0.1.1 fixes:** aspect-ratio preservation; canvas leak on video switch.
> **Note:** Mac builds are unsigned (`xattr -cr /Applications/PixelCluster.app`). Internet required on first launch (Three.js via CDN). Apple Silicon only.

### 6.5 LinkedIn (public register)
> For a while I've had a renderer buried in my imaging work that does one thing: it redraws moving images as fields of glowing point clusters.
>
> I named it. PixelCluster.
>
> It lays a sampling grid over each video frame. Every cell reads the color at that part of the image, then spawns a small cluster of points that share it. Hundreds of thousands of them, redrawn every frame. They drift, and they respond to your cursor.
>
> Run it in your browser right now, no install. Drop in any clip and watch it resolve into points. The desktop app is free for Mac and Windows.
>
> ciamac.com/pixelcluster
>
> (A renderer, not AI. Not a filter.)

### 6.6 X (thread, 3 — public register)
> **1/** PixelCluster.
> It redraws moving images as interactive fields of glowing point clusters, in real time.
> Running quietly in my work for a while. Now it has a name.
> ciamac.com/pixelcluster
>
> **2/** A sampling grid goes over each frame. Every cell reads one live color and spawns a small cluster of points that share it. Hundreds of thousands of points, redrawn every frame. Move your cursor and the field moves.
>
> **3/** Runs live in your browser, nothing to install. Or take the app, free, Mac + Windows.
> ciamac.com/pixelcluster

### 6.7 YouTube description
> PixelCluster redraws moving images as interactive fields of glowing point clusters.
>
> Drop a video in. PixelCluster lays a sampling grid over each frame, reads the color at every cell, and spawns a small cluster of glowing points that share that color — hundreds of thousands of them, redrawn every frame in real time. They drift on a turbulence field and respond to your cursor: swirl, push, attract.
>
> It is a renderer, not a filter, not AI, not Gaussian splatting, not a physics simulation. The same engine has shipped since April 2026; v0.1 is the release that names it.
>
> Technical note: the desktop default renders 685,965 points (417 × 235 sampled regions × 7 points per region); the browser version uses lower density for real-time performance.
>
> Try it in your browser: ciamac.com/pixelcluster
> Download (Mac + Windows): https://github.com/cia-mac/splat-desktop/releases/latest
>
> Chapters:
> 0:00 The live field
> 0:15 Drop a video
> 0:30 Swirl / push / attract
> 0:50 How it works (grid → clusters)
> 1:10 Download

### 6.8 Claims to avoid (gate every block)
❌ "each pixel becomes a point" / "one pixel one particle" · ❌ "particle simulation / physics / gravity / collisions / fluid" · ❌ "3D / depth / volumetric" · ❌ "AI / generative / neural" · ❌ "edge/contrast/brightness detection drives the points" · ❌ "Gaussian splatting" · ❌ implying "fully GPU" without noting mouse offsets are CPU · ❌ quoting an exact number in public copy (use "hundreds of thousands").

---

## 7. Asset checklist & sequencing

**Phase 1 — Source (D3):**
- [x] Primary hero source decided: bird output (available — it is the homepage visual).
- [ ] ⏳ Export a clean hero capture from the bird engine output (no cursor, panel/FPS hidden).
- [ ] ⏳ Choose/create the teaching clip/still with obvious color regions (for diagrams + ITDs).
- [x] Density language locked (D2).

**Phase 2 — Static diagrams (after source; build needs approval):**
- [ ] Diagram 1 (spec ready: `diagram-1_frame-grid-clusters_spec_v1.md`) — SVG + PNG@2x (16:9,1:1,4:5) + PDF
- [ ] Diagram 2, Diagram 3 — promote specs, then build

**Phase 3 — Video (after source):** hero loop, YouTube, LinkedIn, X, GitHub GIF/WebM (§4).

**Phase 4 — ITDs (after diagrams + approval):** ITD-1/2/3 (P0), then 4/5/6.

**Phase 5 — Page assembly:** wire scroll-reveal explainer column (D1), place copy (§6), stage preview, Cia review.

**Phase 6 — Launch (explicit go):** apex routing verified, live deploy, GitHub body updated (§6.4), social fired, YouTube published, Substack note.

---

## 8. Open questions (reduced)

Resolved by this version: page architecture (D1), density language (D2), source direction (D3).

Remaining:
1. **Teaching clip identity:** what specific simple clip/still with obvious color regions should diagrams/ITDs use? (A color-blocked test card, a simple real scene, or a synthetic one?)
2. **Reference resolution for "how it works":** to make grid-vs-pixel concrete, pick a resolution (suggest 1080p).
3. **Diagram color fidelity:** point clusters in true source color, or Caspian-tinted for brand? (Bird hero is naturally Caspian-ish; teaching clip may not be.)
4. **GitHub release body:** §6.4 ready; applying it edits live release notes — needs your go.
5. **History line on the page:** include the ciafx/Splat lineage in §5.7, or keep GitHub-only?
6. **Doc nit (non-blocking):** `CLAUDE.md` says turbulence is "hash noise"; shader uses layered sine. Diagram/ITD copy says sine. Flagged, not edited.

---

## 9. Recommended next command

Diagram 1 spec is ready (`diagram-1_frame-grid-clusters_spec_v1.md`). The smallest unblocking input now is **the teaching clip (Q8.1)** + **reference resolution (Q8.2)**, since Diagram 1's middle/right panels and ITD-1 depend on a source with clear color regions. The bird hero is already available for the hero loop and the brand-variant of Diagram 1.

Once the teaching clip is named, the next executable step (separate approval) is **building Diagram 1 as SVG** per its spec.

Stop condition respected: no code, no publish, no rename, no retag, no README, no SVG build, no ITD implementation.
