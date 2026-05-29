# PixelCluster — Release Packet & Explainer System (v1)

Created 2026-05-29. Operator: Claude. Planning artifact only — no code, no publish, no final graphics.
Source of truth for engine behavior: read-only extraction from `~/Developer/splat-desktop/ui/app.js` + `README.md` (see `launch/` and the technical-extraction report in session history). Vocabulary locked 2026-05-28 (PixelCluster; "points" precise; "point clusters" mechanism; "particle-like" visual-only; never "particle simulation").

Companion docs (do not duplicate, cross-reference):
- `RELEASE_PLAN_v1.md` — master launch plan, 4 tracks, blockers.
- `social-copy_v1.md` — earlier X/LinkedIn/Substack drafts (this packet's §6 supersedes + extends them; keep both, v-rule).
- `mac-app-store_v1.md` — MAS track (parked).

---

## 1. Release packet outline

The packet has seven deliverable buckets. Status: S = spec'd here, ✎ = copy drafted here, ⏳ = needs Cia input/asset.

| # | Bucket | This doc | Gating dependency |
|---|--------|----------|-------------------|
| A | ITD plan for `/pixelcluster` | §2 (S) | design reconciliation (see §2.0) |
| B | 3 release-critical diagram specs | §3 (S) | none to spec; build needs approval |
| C | Video capture plan | §4 (S) | ⏳ source clip + hero footage |
| D | Website page structure | §5 (S) | ⏳ immersive-vs-explainer decision |
| E | Release-safe copy (web/GitHub/LinkedIn/X/YouTube) | §6 (✎) | none |
| F | Asset checklist + sequencing | §7 (S) | ⏳ several assets |
| G | Open questions | §8 | ⏳ Cia |

Nothing here ships until: (1) source footage lands, (2) the immersive-vs-explainer page architecture is decided, (3) Cia gives explicit go. All copy is release-safe against the locked claims-to-avoid (§6.7).

---

## 2. ITD plan for ciamac.com/pixelcluster

### 2.0 Design reconciliation (flag — needs Cia decision)

Two locked directives are in tension:
- **Lock A (2026-05-28):** `/pixelcluster` is an immersive living render surface. "Living render surface dominates, browser interaction primary, no product-page feeling, no panel separations, art-tech installation not SaaS."
- **Handoff (2026-05-29):** the page should carry "menu/sections, explainers, ITDs, download links."

Proposed reconciliation (recommended): **the live surface stays screen one, full-viewport, untouched.** Explainers + ITDs live *below the fold* or behind a single quiet "how it works" affordance, revealed only on intent. The first impression remains the installation; the teaching layer is opt-in. Three viable structures, ranked:

1. **Scroll-reveal (recommended).** Screen 1 = full-bleed live surface (current build). A faint downward cue. Scrolling past it enters a calm, dark explainer column (ITDs + downloads). The surface never shares the frame with marketing.
2. **Separate route.** `/pixelcluster` = pure surface; `/pixelcluster/how` (or `/about`) = explainers + ITDs. Cleanest separation, but splits the URL story.
3. **Overlay drawer.** A quiet "how it works" toggle opens a panel over a dimmed surface. Risks the "panel separation" feeling Cia rejected.

**Do not implement until Cia picks 1, 2, or 3.** Everything in §2.1–2.3 assumes the explainer layer exists somewhere; placement is the open decision.

### 2.1 ITD inventory (priority order)

ITDs are interactive, in-browser, reuse the real `app.js` engine where possible (no fabricated mockups — accuracy is the point).

| ITD | What it teaches | Build approach | Priority |
|-----|-----------------|----------------|----------|
| **ITD-1 Grid inspector** | frame → grid → one cell → 7 points | Static frame + SVG/canvas overlay; hover a cell to spawn its cluster | P0 |
| **ITD-2 Cluster spread** | PER_CLUSTER (1–8) + polar spread | Reuse `buildParticles` logic on one cell; sliders | P0 |
| **ITD-3 Three forces** | swirl / push / attract + decay wake | Live mini-instance of the renderer; mode toggle | P0 |
| **ITD-4 Turbulence decomposer** | 3 sine octaves, amp/speed | Toggle octaves; scrub time | P1 |
| **ITD-5 Point-vs-pixel counter** | source pixels vs sample cells vs total points | Pick resolution; live arithmetic | P1 (kills the #1 misconception) |
| **ITD-6 Density ladder** | 200k / 686k / 1.2M same frame | Three thumbnails or one live density slider | P2 |

### 2.2 ITD shared conventions

- **Engine-true:** ITDs that show points must use the real defaults — `COLS×ROWS×PER_CLUSTER`, `CLUSTER_SPREAD=4.0`, `SIZE_MIN/MAX=1.7/5.4`, `SIZE_POW=2.4`, additive blend, gaussian point alpha (`uGaussExp=5.0`). No invented values.
- **Palette:** brand v5.5.1 mono-hue Caspian — `--ink #0a0a0b`, `--ink-2 #0f0f12`, `--bone #ece8df`, `--bone-2 #9a948a`, `--bone-3 #6b665e`, `--accent #4d7fe0`, `--accent-sky #8fb5e8`, `--accent-glow #78b4ff`.
- **Performance:** ITD instances cap well below the 686k surface (e.g. one cell, or ≤50k) so the teaching layer never janks.
- **Labels use locked vocabulary:** "points," "point cluster," "sampling grid," "sampled region." Never "particle simulation."
- **noindex** like the rest of the surface for now.

### 2.3 ITD → diagram dependency

ITD-1/2/3 are the interactive counterparts of the three release-critical static diagrams in §3. Build the static diagrams first (they double as social/GitHub assets and as ITD fallbacks where WebGL is unavailable).

---

## 3. Diagram specs — the three release-critical diagrams

Format for all: authored as **SVG** (crisp, editable), exported to **PNG @2x** (social/GitHub) and **PDF** (print/deck). Dark canvas `--ink`. Mono-hue Caspian accents. Restrained type (Helvetica Neue / system). No final art here — these are build specs; building needs separate approval.

### 3.1 DIAGRAM 1 — "Frame → sampling grid → point clusters"

**Purpose:** the canonical one-image explanation. Defeats "it's a filter / it's AI."

**Layout:** three panels left→right with arrows between.
- **Panel 1 — Source frame.** A still video frame (placeholder until Cia's clip). Caption: "One video frame."
- **Panel 2 — Sampling grid.** Same frame with a faint grid overlay. Label the grid `417 × 235 cells` (note: "default; adapts to video aspect"). Caption: "A sampling grid is laid over the frame. Each cell reads one live color."
- **Panel 3 — Point clusters.** The frame reconstructed as glowing point clusters (Caspian-tinted ok for brand, or true-color — see open Q8.4). Caption: "Each cell spawns a small cluster of points that share that color."

**Footer strip:** "417 × 235 cells × 7 points = 685,965 points (default)."
**Accuracy notes:** grid is a *subsample* of source pixels (do not imply 1 pixel = 1 cell). Color is read live every frame.
**Deliverables:** 16:9 (deck/YouTube thumb), 1:1 (IG/X), 4:5 (LinkedIn).

### 3.2 DIAGRAM 2 — "One sampled region becomes seven points"

**Purpose:** the multiplicity fact (1 region → 7 points), the heart of the name.

**Layout:** zoomed single cell, exploded.
- **Left:** one highlighted grid cell over a small patch of the frame, with its sampled color swatch and UV note `(u, v)`.
- **Arrow:** "spawns."
- **Right:** the same cell center with **7 points** scattered by random polar offset (angle random, distance ≤ `CLUSTER_SPREAD = 4.0` px). Show: all 7 share the cell color; sizes vary (random, `1.7–5.4`, biased small via `pow 2.4`); each is a soft gaussian disc.

**Callouts (numbered):** ① shared color (one sample) ② random angle ③ random radius ≤ 4px ④ random size (not brightness-driven) ⑤ soft gaussian edge.
**Footer:** "Default 7 points per cell. Adjustable 1–8."
**Accuracy notes:** size is procedural/random, NOT derived from brightness/luminance/edges. Position = grid center + random offset. Avoid implying physics.

### 3.3 DIAGRAM 3 — "Mouse interaction: swirl / push / attract"

**Purpose:** the interactivity, the thing that makes it feel alive.

**Layout:** three mini-panels, each a small point field with the cursor and force vectors.
- **Swirl (no button):** tangential arrows + slight inward. Label `SWIRL 25 / inward 6`.
- **Push (left click):** radial outward arrows. Label `PUSH 29`.
- **Attract (right click):** radial inward arrows. Label `ATTRACT 30`.
- **Shared inset:** the falloff radius `MOUSE_RADIUS = 278` and a small "wake" tail showing points decaying back to rest.

**Callouts:** "Force falls off with distance." "Displaced points spring back — a settling wake." "Kinematic offset + decay, not a physics solver."
**Accuracy notes:** explicitly NOT mass/velocity/collision. Decay is exponential (`RETURN_SPEED 1.2`, slow `WAKE_RETURN 0.35` when far).
**Deliverables:** 16:9 + a 1:1 single-mode variant per platform.

---

## 4. Video capture plan

Primary capture tool: the app's built-in recorder (`r` key / Record button, with "Record full loop"), which captures the canvas directly (clean, no OS chrome). Fallback: ScreenStudio/QuickTime for cursor-visible interaction shots. Hide the controls panel (`Esc`) and FPS readout for hero shots.

| Surface | Aspect | Length | Spec | Content beats |
|---------|--------|--------|------|---------------|
| **Website hero loop** | 16:9 | 8–12s, seamless | muted, H.264 + WebM, ≤4MB, autoplay-loop | A clip resolving into points; slow swirl; settle. No cursor. (Replaces the current plasma stand-in.) |
| **YouTube** | 16:9 | 60–90s | 1080p/4K, with VO or captions | (1) live surface (2) drop a video (3) swirl/push/attract (4) the grid→cluster idea (5) download CTA |
| **LinkedIn** | 1:1 or 4:5 | 20–40s | 1080², muted, captioned | reveal → interact → name card. Lead with motion. |
| **X** | 16:9 or 1:1 | 10–20s | ≤512MB, muted, looping feel | the single most hypnotic interaction beat + link |
| **GitHub README GIF/WebM** | 16:9 | 4–8s | WebM preferred (GIF fallback ≤5MB) | drop → cluster field → one swirl. Tiny, fast. |

**Capture checklist per take:** panel hidden, FPS hidden, density = "standard" (686k) for hero / lower for smooth screen-capture, deterministic seed (42) so framing is repeatable, same source clip across cuts for coherence.
**Source dependency:** all of the above want Cia's intended source clip(s). The current web default is a generated Caspian plasma stand-in (`deploy/pixelcluster/default.mp4`), explicitly interim.

---

## 5. Website page structure (assumes §2.0 reconciliation = option 1 unless Cia says otherwise)

**Screen 1 — Living surface (unchanged, immersive).**
- Full-viewport real-time renderer, autostart on default source, drop-anywhere, panel hidden, no nav.
- Quiet chrome: `PixelCluster` wordmark (top-left), OS-aware download (bottom-left), faint "scroll to understand it" cue (bottom-center) — the only new element.

**Below the fold — calm explainer column (dark, single measure):**
1. **What it is** — public line + mechanism line (§6.1). One short paragraph. "A renderer, not a filter, not AI, not Gaussian splatting."
2. **How it works** — Diagram 1 (or ITD-1). The grid → cluster idea.
3. **One region → seven points** — Diagram 2 / ITD-2.
4. **Move it** — Diagram 3 / ITD-3. Invitation to scroll back up and try.
5. **The numbers** — ITD-5 (point-vs-pixel counter) + the 685,965 default line, honestly framed.
6. **Take it with you** — downloads (macOS DMG Apple Silicon, Windows EXE/MSI), GitHub link, version + unsigned/Gatekeeper note.
7. **Where it came from** — one line of "reveal not build" history (engine shipped since April under ciafx; v0.1 names it). Optional.

**Footer:** GitHub, ciamac.com. noindex for now.
**Constraint:** explainer column must stay calm and dark — no SaaS feature-grid, no pricing, no badges. Type-light, diagram-led.

---

## 6. Release-safe copy drafts

All aligned to locked vocabulary. "points" precise; "point clusters" mechanism; "particle-like" only as a visual simile; never "particle simulation."

### 6.1 Canonical lines (reusable everywhere)
- **Public line:** "PixelCluster redraws moving images as interactive fields of glowing point clusters."
- **Mechanism line:** "It lays a sampling grid over each video frame. Every grid cell reads the color at that part of the image, then spawns a small cluster of points that share that color."
- **Disclaimer line:** "A renderer, not a filter. Not AI. Not Gaussian splatting. Not a physics simulation."

### 6.2 Website "What it is" block
> PixelCluster redraws moving images as interactive fields of glowing point clusters.
>
> It lays a sampling grid over each video frame. Every grid cell reads the color at that part of the image, then spawns a small cluster of points that share that color. The points scatter slightly, vary in size, and drift on a turbulence field. The video plays through them, in real time, and your cursor pushes them around.
>
> A renderer, not a filter. Not AI. Not Gaussian splatting. Not a physics simulation.

### 6.3 GitHub release body (for `pixelcluster-v0.1.1`; do NOT retag/edit live without go)
> **PixelCluster v0.1.1**
>
> PixelCluster redraws moving images as interactive fields of glowing point clusters. Drop a video in. A sampling grid is laid over each frame; every cell reads one live color and spawns a small cluster of points that share it. They drift on a turbulence field and respond to your cursor — swirl, push, attract.
>
> Same engine that has shipped since April 2026 (as Splat, then ciafx). v0.1 is the version that names it.
>
> **Downloads**
> - macOS (Apple Silicon): `PixelCluster_0.1.1_aarch64.dmg`
> - Windows (x64): `PixelCluster_0.1.1_x64-setup.exe` / `PixelCluster_0.1.1_x64_en-US.msi`
>
> **v0.1.1 fixes:** aspect-ratio preservation; canvas leak on video switch.
> **Note:** Mac builds are unsigned (Gatekeeper workaround: `xattr -cr /Applications/PixelCluster.app`). Internet required on first launch (Three.js via CDN). Apple Silicon only.

### 6.4 LinkedIn (single post)
> For a while I've had a renderer buried in my imaging work that does one thing: it redraws moving images as fields of glowing point clusters.
>
> I named it. PixelCluster.
>
> It lays a sampling grid over each video frame. Every cell reads the color at that part of the image, then spawns a small cluster of points that share it. Around 685,000 of them, redrawn every frame. They drift, and they respond to your cursor.
>
> You can run it in your browser right now, no install. Drop in any clip and watch it resolve into points. The desktop app is free for Mac and Windows.
>
> ciamac.com/pixelcluster
>
> (A renderer, not AI. Not a filter.)

### 6.5 X (thread, 3)
> **1/** PixelCluster.
> It redraws moving images as interactive fields of glowing point clusters, in real time.
> Running quietly in my work for a while. Now it has a name.
> ciamac.com/pixelcluster
>
> **2/** A sampling grid goes over each frame. Every cell reads one live color and spawns a small cluster of points that share it. ~685,000 points, redrawn every frame. Move your cursor and the field moves.
>
> **3/** Runs live in your browser, nothing to install. Or take the app, free, Mac + Windows.
> ciamac.com/pixelcluster

### 6.6 YouTube description
> PixelCluster redraws moving images as interactive fields of glowing point clusters.
>
> Drop a video in. PixelCluster lays a sampling grid over each frame, reads the color at every cell, and spawns a small cluster of glowing points that share that color — around 685,000 points by default, redrawn every frame in real time. They drift on a turbulence field and respond to your cursor: swirl, push, attract.
>
> It is a renderer, not a filter, not AI, not Gaussian splatting, not a physics simulation. The same engine has shipped since April 2026; v0.1 is the release that names it.
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

### 6.7 Claims to avoid (gate every copy block against this)
❌ "each pixel becomes a point" / "one pixel one particle" (it's region→cluster, and the grid subsamples pixels)
❌ "particle simulation," "physics," "gravity," "collisions," "fluid"
❌ "3D," "depth," "volumetric" (core is flat/orthographic)
❌ "AI," "generative," "neural"
❌ "edge/contrast/brightness detection drives the points" (only flat color is sampled)
❌ "Gaussian splatting" (the only gaussian is the soft point alpha)
❌ implying "fully GPU" without noting mouse offsets are CPU

---

## 7. Asset checklist & sequencing

**Phase 1 — Source (blocks everything visual):**
- [ ] ⏳ Cia's intended source clip(s) for hero + diagrams + video. (Current default is interim plasma.)
- [ ] Decide canonical density figure for public use (686k default? range? web ~325k?). (Q8.2)

**Phase 2 — Static diagrams (after source, needs build approval):**
- [ ] Diagram 1 (frame→grid→clusters) — SVG + PNG@2x (16:9, 1:1, 4:5) + PDF
- [ ] Diagram 2 (one region→7 points) — same export set
- [ ] Diagram 3 (swirl/push/attract) — same export set

**Phase 3 — Video (after source):**
- [ ] Website hero loop (16:9, ≤4MB, mp4+webm)
- [ ] YouTube master (60–90s)
- [ ] LinkedIn cut (1:1/4:5, 20–40s)
- [ ] X cut (10–20s)
- [ ] GitHub README GIF/WebM (4–8s)

**Phase 4 — ITDs (after diagrams, needs build approval + §2.0 decision):**
- [ ] ITD-1 grid inspector, ITD-2 cluster spread, ITD-3 forces (P0)
- [ ] ITD-4 turbulence, ITD-5 point-vs-pixel, ITD-6 density (P1–P2)

**Phase 5 — Page assembly (after §2.0 decision):**
- [ ] Explainer layer wired per chosen structure (scroll-reveal / route / drawer)
- [ ] Copy blocks placed (§6)
- [ ] Stage preview, Cia review

**Phase 6 — Launch (explicit go only):**
- [ ] Apex routing verified, live deploy
- [ ] GitHub release body updated (§6.3)
- [ ] Social fired (X/LinkedIn), YouTube published, Substack note

Sequencing rule: source → diagrams → video + ITDs → page → launch. Copy (§6) can be finalized in parallel now.

---

## 8. Open questions / missing facts

1. **Page architecture (§2.0):** scroll-reveal, separate route, or drawer? Blocks the website section build. (Recommend scroll-reveal.)
2. **Canonical density number:** the "685,965 / 686k" headline is the desktop default; the web surface runs ~325k; presets go 200k–1.2M. What number does public copy quote? (Recommend "~685,000 (default)" with an honest "adjustable" note.)
3. **Pixel↔cell ratio for ITD-5/Diagram 1:** pick a reference resolution to make "X pixels → Y cells → Z points" concrete (no fixed ratio). Suggest 1080p.
4. **Diagram color fidelity:** point clusters rendered in true source color, or Caspian-tinted for brand cohesion? Affects all three diagrams + hero.
5. **Source clip(s):** still pending. Hero, diagrams, and all video depend on it. Is there a clip you want to be "the PixelCluster clip," or several?
6. **Internal doc nit (non-blocking):** `splat-desktop/CLAUDE.md` says turbulence is "3-octave hash noise"; the shader actually uses 3-octave layered sine (hash/noise defined but unused). Diagram/ITD copy should say "layered sine." Flagged; not edited (read-only).
7. **GitHub release body:** §6.3 is drafted but editing the live release notes requires your go (and is currently empty per the workflow gotcha). Apply when ready.
8. **History line in public copy:** include the ciafx/Splat lineage ("reveal not build") on the page, or keep it GitHub-only?

---

## 9. Recommended next command

Resolve the two cheapest, highest-leverage blockers so the visual pipeline can start, in this order:
1. **Decide §2.0 page architecture** (scroll-reveal recommended) and **§8.2 the canonical density number.** These unblock the page build and all copy/diagram numbers — no asset needed.
2. **Provide or name the source clip** (§8.5). This unblocks every diagram and video.

Once both are answered, the natural next executable step (separate approval) is: **build Diagram 1 as SVG** (frame → grid → clusters) using the real defaults, since it is the single highest-leverage asset and seeds both the static set and ITD-1.

Stop condition respected: no code, no publish, no rename, no retag, no README change, no final graphics. Awaiting the §8 answers before any implementation.
