# Diagram 3 Spec — "Interaction modes: drift / swirl / push / attract / return" (v1)

Created 2026-05-29. Operator: Claude. Build spec for the interaction diagram. No code, no publish, no README, no site, no ITDs.
Parent: `RELEASE_PACKET_v1.1.md`. Companions: Diagram 1 (`diagram-1_frame-grid-clusters_v1.1.svg`), Diagram 2 (`diagram-2_one-region-seven-points_v1.1.svg`). Engine truth: `~/Developer/splat-desktop/ui/app.js` (`updateMouseOffsets`, `tick`, the `VERT` turbulence, config constants).

---

## 1. Purpose & role

Explain **only the interaction behavior** of the point field: how it moves on its own and how the cursor moves it. No grid/sampling/color content (Diagrams 1 & 2 own that). Five behaviors:

1. **Drift** — the field is always gently moving (GPU turbulence), with or without the cursor.
2. **Swirl** — cursor with no button: points orbit the cursor (tangential) with a slight inward pull.
3. **Push** — left click: points are pushed radially away from the cursor.
4. **Attract** — right click: points are pulled radially toward the cursor.
5. **Return** — displaced points decay back to their home positions, leaving a brief settling wake.

**One-sentence takeaway:** "The field always drifts; the cursor swirls, pushes, or pulls the points near it, and they settle back when you leave."

---

## 2. Visual language (inherit Diagram 1 v1.1 / Diagram 2 v1)

- 16:9, `--ink #0a0a0b`. Same kicker / headline / subhead / mechanism-card / footer system.
- Chrome accents Caspian only: `--accent #4d7fe0`, `--accent-sky #8fb5e8`, glow `#78b4ff`, rules `#1d1d20`, panel borders `#2a2a30`, mono labels `#6b665e`/`#9a948a`, captions `#ece8df`.
- **This diagram is about motion, not color.** Use a single neutral point color (`#8fb5e8`, soft gaussian disc) so the eye reads vectors, not hues. (Do not use the teaching-frame colors here.)
- Cursor drawn as a small Caspian ring/dot. Force vectors as thin arrows (`--accent-sky`) with the shared arrowhead marker. Falloff shown as a dashed `MOUSE_RADIUS` ring.
- Kicker: `PIXELCLUSTER — INTERACTION`.

---

## 3. Suggested 16:9 composition (1600 × 900)

**Five mini-panels in a row** (one per behavior), each a small abstract point field, with two annotation cards and a footer below.

```
[ DRIFT ] [ SWIRL ] [ PUSH ] [ ATTRACT ] [ RETURN ]
   no       no-btn    left      right      decay
  cursor                                   to home
```

Per panel (~250 × 180 field, nested SVG, dark bg, thin border):
- A loose field of ~20–25 neutral soft points.
- **Drift:** no cursor; each point carries a short gentle wander arrow (layered-sine direction). Caption "DRIFT", sub "turbulence, always on".
- **Swirl:** cursor at center; tangential arrows curving around it + a slight inward lean; dashed falloff ring. Caption "SWIRL", sub "no button".
- **Push:** cursor at center; arrows pointing radially outward, longer near the cursor (falloff). Dashed ring. Caption "PUSH", sub "left click".
- **Attract:** cursor at center; arrows pointing radially inward. Dashed ring. Caption "ATTRACT", sub "right click".
- **Return:** points shown displaced off their home grid, with a faint dashed trail and an arrow back toward home. Caption "RETURN", sub "decays back · wake".

Arrow length scales with the distance falloff (longer near cursor, nothing past the radius) so the `MOUSE_RADIUS` behavior reads visually.

**Two annotation cards below (mirror Diagram 2):**
- **MECHANISM (left):** mono list of exact values.
- **NOTES (right):** the conceptual rules (falloff, drift-vs-cursor scope, wake, not-physics).

**Footer (light technical):** one line of the constants + the not-a-physics-sim disclaimer.

---

## 4. Exact values to honor (engine-true, from `ui/app.js`)

- **Drift = GPU turbulence**, always on, affects every point. 3 layered sine octaves; `TURB_AMP = 2.0`, `TURB_SPEED = 0.5`. (Note: the shader uses layered sine, not value-noise — say "sine," see §6.)
- **Cursor falloff:** only points within `MOUSE_RADIUS = 278` (world px) are affected; strength `fo = 1 − dist / MOUSE_RADIUS` (stronger near cursor).
- **Swirl (no button):** tangential `SWIRL_STRENGTH = 25` + slight inward `SWIRL_INWARD = 6`.
- **Push (left):** radial outward `MOUSE_PUSH = 29`.
- **Attract (right):** radial inward `ATTRACT_STRENGTH = 30`.
- **Return / wake:** per-point offset decays exponentially toward zero each frame: `decay = exp(−k·dt)`, with `k = RETURN_SPEED = 1.2` normally, or the slower `k = WAKE_RETURN = 0.35` while displacement `> WAKE_THRESHOLD = 3` (larger pushes linger → a visible wake). Points return to their **base grid positions**.
- **Compute split:** cursor offsets are CPU (`updateMouseOffsets`); turbulence is GPU (`VERT`). Forces accumulate into a per-point offset attribute, then decay.
- **Not physics:** displacement + exponential decay, **no** mass, velocity integration, or collisions.

---

## 5. Accuracy guardrails (must-not-imply)

- ❌ "Physics / gravity / collisions / fluid simulation." It is force-shaped offsets + exponential decay.
- ❌ Drift only happens with the cursor. Drift (turbulence) is always on, independent of the cursor.
- ❌ The cursor affects the whole field. Only points within `MOUSE_RADIUS` are affected; effect falls off with distance.
- ❌ Points permanently relocate. They decay back to home (return/wake).
- ❌ Color meaning here. This diagram is intentionally monochrome; color belongs to Diagrams 1 & 2.
- ❌ 3D depth. Field is flat (orthographic).
- ✅ Show falloff (vector length vs distance) and the radius ring so "near the cursor" reads.

---

## 6. Acceptance criteria

1. Five clearly separated behaviors, left → right: drift, swirl, push, attract, return.
2. Drift panel has **no cursor** and shows gentle, all-over motion.
3. Swirl shows tangential-plus-slight-inward; push shows outward; attract shows inward — directions unambiguous.
4. Return shows points off-home with a trail/arrow back to home (the wake).
5. Falloff is visible (arrows longer near the cursor; a dashed `MOUSE_RADIUS` ring on the cursor panels).
6. Exact values present: `MOUSE_RADIUS 278`, `SWIRL 25 (+inward 6)`, `PUSH 29`, `ATTRACT 30`, `RETURN decay 1.2 / slow 0.35`, drift `TURB_AMP 2.0`.
7. States "kinematic offset + decay, not a physics simulation." No item from §5.
8. Monochrome neutral points; Diagram 1 v1.1 visual language; 16:9 master only.

---

## 7. Deliverables & build notes

- **16:9 master SVG** + a Chrome-headless review PNG (1600 × 900), inspected before reporting — same workflow as Diagrams 1 & 2.
- Vectors/points are computed (force directions + falloff per point), so generate deterministically (seed 42) for reproducibility, like Diagram 1 v1.1's Panel 3.
- The drawn falloff radius and arrow lengths are **schematic / scaled for legibility** (the panels are tiny relative to the real 278 px radius) — label the radius value rather than implying canvas scale.
- No other aspect ratios, no brand variant, no ITDs.

---

## 8. Open questions / notes

1. Five panels in one row is dense at 250 px wide; if labels crowd, a 2-row layout (3 + 2) is an acceptable fallback — flagged as a possible cleanup, not a blocker.
2. Non-blocking doc nit (carried): `CLAUDE.md` says turbulence is "hash noise"; the shader uses layered sine. Diagram copy uses "sine." Left untouched per scope.

Spec only. Build is the next step in this batch.
