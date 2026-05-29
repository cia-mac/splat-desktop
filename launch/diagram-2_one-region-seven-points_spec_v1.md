# Diagram 2 Spec — "One sampled region becomes seven points" (v1)

Created 2026-05-29. Operator: Claude. **Build spec only — do NOT build the SVG yet.** No code, no publish, no README, no site write, no ITDs.
Parent: `RELEASE_PACKET_v1.1.md`. Companion: `diagram-1_frame-grid-clusters_spec_v1.md` (+ built master `diagram-1_frame-grid-clusters_v1.1.svg`). Engine truth: `~/Developer/splat-desktop/ui/app.js`. Vocabulary + density registers locked (packet §0).

---

## 1. Purpose & role

Isolate and explain the **core PixelCluster mechanism**: one sampled region of a frame becomes, by default, **seven rendered points** that all share one sampled color, scattered slightly and varied in size. Diagram 1 shows the whole frame; Diagram 2 zooms into a single cell and shows exactly what happens there.

**One-sentence takeaway:** "Each grid cell reads one color, then emits seven soft points around that spot — same color, slightly scattered, slightly different sizes."

**Continuity hook (recommended):** make Diagram 2 the literal zoom of **the same highlighted region carried in Diagram 1 v1.1** — the cell at grid position (col 9, row 3), sitting in the red building of the teaching frame, sampled color `#d8493a`. This lets the two diagrams chain: Diagram 1's callout → Diagram 2's whole subject.

---

## 2. Visual language (inherit from Diagram 1 v1.1)

- **Canvas:** 16:9, `--ink #0a0a0b`. Same kicker/headline/subhead/footer system.
- **Chrome accents:** Caspian only — `--accent #4d7fe0`, highlight/glow `--accent-glow #78b4ff`, arrows `--accent-sky #8fb5e8`, rules `--rule #1d1d20`, panel borders `#2a2a30`.
- **Text:** captions `--bone #ece8df` (Helvetica Neue, light); technical annotations mono (`--bone-2 #9a948a` / `--bone-3 #6b665e`, uppercase tracking).
- **Source color is true** (teaching frame). The sampled region color in this diagram is the red building's `#d8493a`. Caspian is chrome only — never recolor the points.
- **Point look:** soft gaussian disc (matches `FRAG`: `alpha = exp(-r² · uGaussExp) · uOpacity`, `uGaussExp = 5.0`), additive feel. Same dot styling as Diagram 1 Panel 3 / its callout.
- **Kicker:** `PIXELCLUSTER — THE CORE STEP` (parallel to Diagram 1's `HOW IT WORKS`).

---

## 3. Suggested 16:9 composition (1600 × 900)

Left → right, three zones, two arrows ("sample" then "spawn"), mirroring Diagram 1's grammar. Captions under each zone; technical annotation block; footer.

```
┌─────────────┐         ┌──────────────┐          ┌────────────────────┐
│  ZONE A      │   →     │  ZONE B       │   →      │  ZONE C             │
│ frame +      │ sample  │ one region,   │ spawn    │ seven points        │
│ zoom on cell │         │ one color     │          │ (scatter + sizes)   │
└─────────────┘         └──────────────┘          └────────────────────┘
```

### Zone A — Locate the region (left, ~ x 64–470)
- Small teaching frame (same composition as Diagram 1), with the **carried highlighted cell** (`#78b4ff` square) over the red building.
- A zoom/leader (dashed `--accent`) expanding that one cell toward Zone B (a "magnify" cone).
- Caption: **"One sampled region."**
- Mono annotation: `one grid cell · default grid 417 × 235`.

### Zone B — One region, one color (center, ~ x 600–1010)
- The single cell drawn large as a square (`#78b4ff` border), filled with the **single sampled color** `#d8493a` (flat).
- A small **color swatch chip** + label showing the sampled value, and a **UV marker** at the cell center: `UV (u, v) → one texel, bilinear`.
- Caption: **"Reads one live color."**
- Mono annotation: `color sampled live from the video texture, every frame`.

### Zone C — Seven points (right, ~ x 1096–1536)
- The same cell square (faint `#78b4ff` outline, low opacity) with its **center marked** (small crosshair).
- **Seven** soft gaussian points, all `#d8493a`, scattered by random polar offset around the center; **visibly varied sizes**; clearly countable as seven.
- Numbered callouts (Caspian leader lines) to representative points:
  1. **shared color** — "all seven share the one sampled color"
  2. **random angle** — offset direction is random
  3. **random radius ≤ 4.0 px** — distance from center, capped at cluster spread
  4. **random size** — procedural, not brightness-driven
  5. **soft gaussian edge** — each point is a soft disc, not a hard dot
- Show the **center vs. one offset** with a small radial measure annotated `≤ 4.0 px (cluster spread)`.
- Caption: **"Becomes seven points."**
- Mono annotation: `PER_CLUSTER = 7 (default) · adjustable 1–8`.

### Technical annotation block (lower band, e.g. left half under zones)
A compact mono list (label : value), `--bone-2` on `--ink-2 #0f0f12` card or plain:
- `OUTPUT PRIMITIVE — GL_POINTS (THREE.Points)`
- `POINTS PER REGION — 7 default · 1–8`
- `CLUSTER SPREAD — 4.0 px (random polar offset)`
- `POINT SIZE — random / procedural (≈1.7–5.4, biased small), NOT brightness-driven`
- `COLOR — sampled live from the video texture (texture2D); all members share it`
- `POINT SHAPE — soft gaussian disc (gl_PointCoord), additive blend`

### Footer (technical register, full width)
> "PER_CLUSTER = 7 by default. Across the frame that is 417 × 235 regions × 7 = 685,965 points. A renderer — not a filter, not AI, not a physics simulation."

(Public-register variant, if needed: replace with "Seven glowing points per sampled region, by default.")

---

## 4. Exact values to honor (engine-true, from `ui/app.js`)

- **Points per region:** `PER_CLUSTER = 7` (default; UI "Per cell" slider 1–8). Inner loop `for (k = 0; k < PER_CLUSTER; k++)`.
- **Scatter:** per member, `angle = random·2π`, `distance = random · CLUSTER_SPREAD`, `CLUSTER_SPREAD = 4.0` video px. Linear radius → denser toward center. `baseX = cx + cos(a)·d`, `baseY = cy + sin(a)·d`.
- **Shared color:** all members of the cell use the same UV (the cell center, clamped), so they sample the **same** texel. Color read in `FRAG`: `texture2D(uVideo, vUV).rgb`, live every frame.
- **Size:** `aSize = SIZE_MIN + (SIZE_MAX − SIZE_MIN) · pow(random, SIZE_POW)`, defaults `1.7 / 5.4 / 2.4`. Rendered `gl_PointSize = aSize · uPixelRatio`. Random/procedural; **not** derived from brightness, luminance, edges, or the color value.
- **Primitive:** `THREE.Points` → WebGL `GL_POINTS`. Each point is one GL point; the fragment shader shapes it into a soft gaussian disc (`exp(-r² · uGaussExp)`, `uGaussExp = 5.0`) with additive blending.
- **Region ≠ pixel:** the region is one **grid cell** of the `COLS × ROWS` sampling grid (default `417 × 235`), a subsample of the source pixels — not a single source pixel.

---

## 5. Accuracy guardrails (must-not-imply)

- ❌ "One pixel = one point." It is one **region/cell** → seven points; the grid subsamples pixels.
- ❌ Size driven by brightness/luminance/contrast/edges. Size is random/procedural and independent of the sampled color.
- ❌ Each point samples its own color. All seven share the **one** cell color (same UV).
- ❌ "Particle simulation / physics / gravity / collisions." The scatter is a fixed random offset, not a physics solve.
- ❌ "3D / depth / volumetric." Points are placed in the flat (orthographic) field; `z = 0`.
- ❌ "Gaussian splatting." The only gaussian is the soft point alpha falloff.
- ❌ Hard-edged dots. Points are soft discs.
- ❌ Exact point counts in any public-register variant (use "seven points per region").
- ✅ Seven must be unambiguously countable (this is the diagram's whole job).

---

## 6. Acceptance criteria

A correct Diagram 2:
1. Reads left → right as region → one color → seven points without the captions.
2. Shows **exactly seven** countable points in Zone C.
3. Makes it obvious all seven are **the same color** (the one sampled color).
4. Shows **slight position scatter** (random offsets ≤ 4.0 px) and **slight size variation** between the seven.
5. States the engine facts accurately: `PER_CLUSTER = 7 (1–8)`, `cluster spread 4.0 px`, size random/procedural, color sampled live, primitive `GL_POINTS / THREE.Points`.
6. Labels the region as a grid cell (not a pixel); contains nothing from §5.
7. Uses Diagram 1 v1.1 visual language (dark canvas, Caspian chrome, true source color for the points, soft gaussian discs).
8. Ships as a 16:9 master (other aspects/variants only on separate approval).
9. (Recommended) the subject cell matches Diagram 1 v1.1's carried highlight (col 9, row 3, `#d8493a`) so the two diagrams chain.

---

## 7. Deliverables & sequencing (on separate build approval)

- **16:9 master SVG** first (this spec). Render to a review PNG (Chrome headless, 1600 × 900) and inspect before reporting — same workflow as Diagram 1.
- Other aspect ratios (1:1, 4:5), PDF, and any Caspian/brand variant: **not now** — separate approval, like Diagram 1.
- Generation note: if the seven points use randomized scatter, generate deterministically (seed 42) for reproducibility, as in Diagram 1 v1.1's Panel 3.

---

## 8. Open questions / notes

1. **Subject cell:** confirm using Diagram 1's carried region (col 9, row 3, red `#d8493a`) for continuity (recommended), or a different region.
2. **Public vs technical footer:** this spec defaults to the technical footer (with 685,965). Confirm if a public-register variant is also wanted.
3. **Scatter arrangement of the seven:** Diagram 1's callout used a clean hex (1 center + 6 ring) for countability. Diagram 2 can either reuse that clean arrangement or show a truer random scatter ≤ 4.0 px — truer is more accurate, hex is more countable. Recommend a **moderate random scatter that still reads as seven** (label the spread radius).
4. Non-blocking doc nit (carried): `CLAUDE.md` calls turbulence "hash noise"; the shader uses layered sine. Not relevant to Diagram 2's content; noted for consistency.

---

Spec only. Nothing built. Next step would be "build Diagram 2 as a 16:9 master SVG," on separate approval.
