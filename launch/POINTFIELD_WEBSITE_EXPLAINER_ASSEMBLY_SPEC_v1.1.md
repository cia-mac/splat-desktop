# Pointfield — Website Explainer Assembly Spec (v1.1)

v1.1 (2026-05-29): PixelCluster to Pointfield text swap of `PIXELCLUSTER_WEBSITE_EXPLAINER_ASSEMBLY_SPEC_v1.md` (kept). Product-name strings updated. Note: the live target route is still `ciamac.com/pixelcluster` and stays so until rename Phase 3; that string below is intentionally not swapped.

Created 2026-05-29. Operator: Claude. **Spec only — no code, no site edits, no publish.** Target page: `ciamac.com/pixelcluster` (route rename to `/pointfield` is Phase 3, not done).
Inputs: the three built diagram masters + review PNGs, `RELEASE_PACKET_v1.1.md` (§5 page structure, §6 copy), `ASSET_INVENTORY_v1.md`. Engine truth: `~/Developer/splat-desktop/ui/app.js`.

Existing surface (do not regress): `/pixelcluster` is already a full-bleed living render surface (`~/Developer/ciamac-site/deploy/pixelcluster/`) — autostart, drop-anywhere, panel hidden behind Esc, OS-aware download bottom-left, quiet `Pointfield` wordmark top-left, no nav, `noindex`, shared Cloudflare beacon, mobile low-power notice. This spec **adds a below-the-fold explainer**; it must not alter the immersive screen one.

## Locked decisions carried in (do not relitigate)
Scroll-reveal · screen one immersive · explainers/ITDs/downloads/GitHub/notes below the fold · no `/how` route · no overlay drawer as main explainer · public "hundreds of thousands of points" · technical "685,965 points: 417 × 235 sampled regions × 7 points per region" · browser "lower density for real-time performance" · "points" / "point clusters", never "particle simulation" · not AI, not Gaussian splatting, not a physics simulation.

---

## 1. Page section order

```
[ S0 ] IMMERSIVE SURFACE        full viewport, screen one (existing, unchanged)
        └ quiet chrome: wordmark (TL), OS-aware download (BL), scroll cue (BC, NEW)
── fold ───────────────────────────────────────────────────────────────────────
[ S1 ] WHAT IT IS               one short paragraph + disclaimer line
[ S2 ] HOW IT WORKS             Diagram 1 (frame → grid → point clusters)
[ S3 ] THE CORE STEP            Diagram 2 (one region → seven points)
[ S4 ] MOVE IT                  Diagram 3 (interaction modes) + "scroll up to try"
[ S5 ] THE NUMBERS              technical notes (density, primitive, color, size)
[ S6 ] TAKE IT WITH YOU         downloads (macOS DMG, Windows EXE/MSI) + GitHub
[ S7 ] WHERE IT CAME FROM       optional one-line ciafx/Splat lineage
[ S8 ] FOOTER                   GitHub · ciamac.com
```

S1–S8 form a single calm, dark, narrow-measure column (no feature grid, no pricing, no badges). Vertical rhythm generous; each diagram is a full-measure figure with a short caption.

---

## 2. Above-the-fold hero rules (S0)

- **Stays exactly as built.** Full-viewport live renderer, autostart, drop-anywhere, panel hidden (Esc to reveal), no nav, `noindex`.
- Hero source: the **bird engine output** is the intended primary (RELEASE_PACKET D3). The current `default.mp4` (Caspian plasma) is the **interim** until a clean bird capture lands. Swappable by replacing the file; no markup change.
- **Only one new element above the fold:** a faint, centered scroll cue at the bottom (e.g. a thin chevron + the words "what is this" or "how it works", `--bone-3`, low opacity, breathing). It must not compete with the render or read as a button/CTA.
- No headline, no marketing copy, no logo lockup over the render. The render carries the weight.
- The wordmark (TL) and the OS-aware download (BL) remain; do not add a top nav.

---

## 3. Where the browser app appears

- The browser app **is** screen one (S0). There is no separate "try it" section — the live surface is the demo. S4's "Move it" caption invites the reader to **scroll back up** to interact, rather than embedding a second instance.
- Do **not** instantiate a second renderer below the fold (one 325k-point WebGL context per page is enough; a second would tax low-end machines).

---

## 4. Where downloads appear

Downloads live in **two places, both secondary to the render**:
- **S0 (persistent, quiet):** the existing bottom-left OS-aware link ("↓ download for mac/windows"). Unchanged.
- **S6 "Take it with you" (explicit block below the fold):** all platforms listed plainly:
  - macOS (Apple Silicon): `Pointfield_0.1.1_aarch64.dmg`
  - Windows (x64): `Pointfield_0.1.1_x64-setup.exe` / `Pointfield_0.1.1_x64_en-US.msi`
  - Each links to the GitHub release asset URL (`.../releases/download/pointfield-v0.1.1/<file>`).
  - Include the unsigned/Gatekeeper note (see §8).
- No pricing, no email gate, no "sign up." Free.

---

## 5. Where GitHub appears

- **S6 + S8.** In S6, a "Source & releases" link to `https://github.com/cia-mac/splat-desktop` and a "Latest release" link to `.../releases/latest`. In S8 footer, a quiet `github` link.
- Not above the fold. Not a badge wall (no shields.io rows).

---

## 6. Where Diagram 1, 2, and 3 appear

| Section | Diagram | Asset (primary) | Fallback |
|---|---|---|---|
| **S2 How it works** | Diagram 1 | `diagram-1_frame-grid-clusters_v1.1.svg` | `..._v1.1_review.png` |
| **S3 The core step** | Diagram 2 | `diagram-2_one-region-seven-points_v1.1.svg` | `..._v1.1_review.png` |
| **S4 Move it** | Diagram 3 | `diagram-3_interaction-modes_v1.svg` | `..._v1_review.png` |

- One diagram per section, full measure, 16:9, centered, with a short caption beneath (§7).
- **Embed as inline `<img src="...svg">`** (or `<object>`); the SVGs are self-contained and crisp at any width. Ship the matching review PNG as a `<noscript>`/`onerror` fallback for SVG-blocking contexts.
- Diagrams are decorative-of-meaning, not interactive here (ITDs are out of scope for v1). They sit in `deploy/pixelcluster/assets/` (or similar) when the implementation slice runs — **copying the files is an implementation step, not done in this spec.**
- Order is fixed: 1 → 2 → 3 (whole → core step → behavior).

---

## 7. Caption copy for each diagram (page-level, under each figure)

Keep captions to one line; the diagrams carry their own internal labels and technical footers.

- **Diagram 1 (S2):**
  > "A sampling grid is laid over each frame. Every cell reads the color at that spot, then spawns a small cluster of points that share it."
- **Diagram 2 (S3):**
  > "One sampled region becomes seven points by default — same color, slightly scattered, slightly different sizes."
- **Diagram 3 (S4):**
  > "The field always drifts. Your cursor swirls, pushes, or pulls the points nearby, and they settle back. Scroll up to try it."

(Public register. The "685,965" figure stays inside the diagrams and in S5, not in these captions.)

---

## 8. Technical notes section copy (S5 "The numbers" + S6 notes)

S5 body (technical register allowed here):

> **The numbers.** The desktop default renders **685,965 points** — a **417 × 235** sampling grid, **7 points per region**. The browser version uses **lower density for real-time performance**.
>
> Each point is a soft, glowing dot drawn as a WebGL point (`GL_POINTS` / `THREE.Points`). Its color is read **live from the video** every frame; all points in a region share that one color. Point size is random and procedural — not driven by brightness. Motion is layered-sine drift plus your cursor's pull.
>
> Pointfield is **a renderer** — not a filter, not AI, not Gaussian splatting, not a physics simulation.

S6 download notes (small, under the buttons):

> Free. macOS builds are unsigned — on first launch you may see a Gatekeeper warning; run `xattr -cr /Applications/Pointfield.app`. An internet connection is needed on first launch (the renderer library loads from a CDN). Apple Silicon only; Windows 10+ x64.

(S7 optional lineage, one line: "Pointfield has been shipping since April 2026 as ciafx. v0.1 is the version that names it.")

---

## 9. Mobile behavior

- **Screen one:** keep the existing **low-power notice** ("Best on a laptop or desktop… try anyway / download"). On "try anyway," the renderer runs at the reduced mobile density (~55k). The notice and reduced density are already built — do not regress.
- **Explainer column (S1–S8):** fully available on mobile, single column. Diagrams reflow to **100% width** (16:9 letterbox), stacked, with captions beneath. Generous vertical spacing; type scales down per the brand tokens.
- **Downloads on mobile:** OS sniff yields neither Mac nor Windows desktop binaries usefully on a phone — show the full platform list in S6 and a line "Desktop app — open on a Mac or PC to install." Do not hide downloads.
- **Scroll cue:** present on mobile too (the page is scrollable).
- Respect `prefers-reduced-motion`: pause/limit the hero drift and the scroll-cue animation when set.

---

## 10. Asset requirements still missing

Blocking a polished build:
1. **Clean bird hero capture** (primary `default.mp4` replacement) — panel/FPS hidden, no cursor, seamless loop. Until then the interim plasma stands in.
2. **Web placement of the diagram files** — the SVGs exist in `launch/`; the implementation slice must copy them into the site's `deploy/pixelcluster/assets/` (or chosen path). (Mechanical; not a creative blocker.)
3. **OG / social preview image** for the page — currently `noindex` with no `og:image`; if/when shared, a static preview (e.g., a diagram-1 crop or hero still) is wanted. (Out of scope now; flagged.)
4. **Scroll-cue micro-copy** — confirm wording ("what is this" vs "how it works" vs a bare chevron).

Not blocking (deferred): diagram aspect variants / PDFs, Caspian/bird diagram variants, hero/teaching video for YouTube/social, ITDs.

---

## 11. What not to implement (v1)

- ❌ A second WebGL renderer below the fold (reuse screen one; "scroll up to try").
- ❌ ITDs / interactive diagrams (static SVGs only in v1).
- ❌ A `/how` route or an overlay drawer as the main explainer.
- ❌ Top nav, menu, pricing, email capture, badge walls, feature grid.
- ❌ Changing the immersive renderer engine or its defaults; changing app code.
- ❌ New graphics or social crops (use the three existing masters; placeholders only if strictly needed).
- ❌ Editing README, GitHub release notes, or publishing.
- ❌ Exact point counts in the public-register captions (keep "hundreds of thousands"; precise figure only in S5/diagrams).

---

## 12. Recommended first website implementation slice

**Slice W1 — static below-the-fold explainer, no renderer changes.** (Separate approval required; this spec does not implement it.)
1. In `deploy/pixelcluster/`, add the below-the-fold column markup/CSS **after** the existing surface, without touching the renderer DOM/JS.
2. Copy the three diagram SVGs (+ PNG fallbacks) into `deploy/pixelcluster/assets/`.
3. Add S1–S8 with the copy from §7/§8; embed diagrams per §6; add the scroll cue (§2).
4. Wire S6 download/GitHub links to the v0.1.1 release URLs.
5. Verify: screen one unchanged; scroll reveals the column; diagrams crisp at desktop + mobile widths; `prefers-reduced-motion` respected; still `noindex`.
6. Deploy to the **stage preview** (vercel preview, as before) — not live. Cia reviews. Live promotion stays gated on explicit go + the apex-routing check.

Smallest valuable step; ships the explainer using assets that already exist, with zero risk to the living surface, and defers the bird-hero swap and ITDs.

---

Spec only. Nothing built or published. Next action would be "approve Slice W1," at which point implementation moves to the `ciamac-site` repo (outside `launch/`).
