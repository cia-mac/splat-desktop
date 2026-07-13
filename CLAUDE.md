# CLAUDE.md — splat-desktop (Pointfield)

## ⚑ PUBLIC NAME = POINTFIELD (canon decision 2026-05-29, Phase 0)

The public product name is **Pointfield** (one word, capital P, lowercase f). It supersedes **PixelCluster** (the prior locked public name) and **PointCluster** (considered + rejected 2026-05-28). Word-form rule: always `Pointfield`. Never `PointField`, `Point Field`, `pointfield`, or `point-field`.

**Status (updated 2026-07-12):** the phased rename is done on every public surface. Phase 0 (canon), Phase 1 (local launch docs + explainer diagrams, in `launch/`), Phase 2 (app/config/CI strings, 2026-05-29), Phase 3 (website: ciamac.com/pointfield live and clean; /pixelcluster 301s to it), Phase 4 (README + Pointfield-named GitHub releases: `pointfield-v0.1.1`, `pointfield-v0.1.2` with `Pointfield-*` assets; the homepage easter-egg download links now point at pointfield-v0.1.2). The old `pixelcluster-v0.1.0/v0.1.1` releases and their `PixelCluster_*` assets remain published as immutable history, by design. Still deferred: bundle ID `com.ciamac.ciafx`, Cargo crate name `ciafx`, and the GitHub repo name `splat-desktop`. Do not assume a deferred surface has been renamed; check, don't presume.

**Rationale (preserve):** Pointfield names the *phenomenon* the engine creates — moving images reconstituted as live fields of glowing points. PixelCluster described the *construction mechanism* (sampling grid → point clusters); Pointfield better describes the public experience and gives the project a stronger coined term. The mechanism language ("sampled regions spawn point clusters," "points," "point field") is unchanged and now reinforces the name.

**Reversal note:** Pointfield was previously *retired* (2026-05-27) as a weak Claude coinage; this decision deliberately revives it as the public name. Engine truth, "not a particle simulation / not AI / not Gaussian splatting / not a physics simulation" all unchanged.

## Project Identity

Pointfield (repo folder and crate still carry the splat/ciafx names, deferred by design) is a real-time video-to-points renderer. Drop a video in. Each region of every frame becomes a small cluster of glowing points. Clusters share the source color; members spread and jitter in size on a turbulence field. Three mouse modes: swirl (no button), push (left), attract (right).

- **Repo:** ~/Developer/splat-desktop/ (filesystem path unchanged)
- **Remote:** github.com/cia-mac/splat-desktop (unchanged for v0.1; rename deferred)
- **Product name:** **Pointfield** (public name, canon 2026-05-29). PixelCluster is the prior name, superseded. App strings/config read "Pointfield" (Phase 2, 2026-05-29); the website route is /pointfield and releases ship Pointfield-named assets (Phases 3 and 4, done as of 2026-07-12).
- **Renderer name:** internal use only is "the renderer" or "ParticleCore" (Swift package on iOS, not in this repo). ("Pointfield" is no longer an internal-only term — it is now the public product name.)
- **Stack:** Tauri v2 (Rust shell) + WebKit/Chromium webview + vanilla JS + Three.js (WebGL2, CDN-loaded)
- **Bundle ID:** com.ciamac.ciafx (unchanged in v0.1; paired with Cargo name rename for a later release)
- **Cargo crate name:** ciafx (unchanged in v0.1, coupled to bundle ID)
- **Distribution:** GitHub releases. Latest: Pointfield v0.1.2 (`pointfield-v0.1.2`). Historical: pointfield-v0.1.1, PixelCluster v0.1.0/v0.1.1 (rebrand of ciafx v2.0.2), ciafx v1.0.0 through v2.0.2. Old releases stay published under their original names.
- **Session state:** See SESSION_STATE.md in this directory.

## Naming history (so future sessions don't relitigate)

- v1.x: shipped under the name "Splat" (Gaussian-splat-adjacent framing). Legacy.
- v2.x (April 2026): rebranded to "ciafx". Same engine.
- v0.1.0 (May 2026): rebranded to "PixelCluster". Same engine. Version reset because the public surface is new, not the engine.
- 2026-05-29: public name changed to **Pointfield** (canon decision; supersedes PixelCluster). Same engine. Implementation phased — PixelCluster strings/assets remain in place until each phase runs. "Pointfield" had been retired 2026-05-27 and is deliberately revived here. Pre-Pointfield snapshot of this file: `CLAUDE_v3_pixelcluster_pre_pointfield.md`.

The repo name and bundle ID still reference the v1/v2 era. That is intentional and stays through v0.1.

## Architecture

### Frontend (ui/)

- `index.html` — main UI (upload overlay, controls panel, status bar)
- `app.js` — Three.js renderer, GLSL shaders, particle build loop, mouse interaction, recording
- `style.css` — styling, dark theme, CSS custom properties (`--surface`, `--accent`, etc.)

### Backend (src-tauri/)

- `src/main.rs` — Tauri entry point + one IPC command (`save_file`)
- `tauri.conf.json` — productName "Pointfield", window title "Pointfield", version 0.1.1 (productName/title swapped in Phase 2; bundle ID and version unchanged)
- `Cargo.toml` — Rust deps (Tauri 2, dialog plugin)
- `capabilities/default.json` — dialog save permission
- `icons/` — particle-burst app icon set (32, 64, 128, 128@2x, 256, 512, 1024 PNG + .icns + .ico)

### Renderer behavior (from app.js)

- Cluster build: `N = COLS * ROWS * PER_CLUSTER` particles. Defaults: 417 × 235 × 7 = 685,965.
- Per-cluster shared UV, per-member polar offset (CLUSTER_SPREAD = 4.0 video pixels), per-member size jitter.
- GPU turbulence in the vertex shader (3-octave hash noise).
- CPU updates only the mouse-offset attribute per frame.

## Build Protocol

1. `cargo tauri dev` for development (hot reload on JS, Rust rebuilds on save)
2. `cargo tauri build` for production binary
3. `target/` is in .gitignore. Never commit build artifacts.

## Guardrails (Do Not Touch Without Explicit Instruction)

- Never commit the `target/` directory.
- Never force-unwrap in Rust code.
- Do not load Three.js from a path that isn't whitelisted in `tauri.conf.json` CSP.
- Do not change the Tauri bundle identifier (`com.ciamac.ciafx`) without an explicit "go" — coupled to update channels and historical installations.
- Do not change the Cargo `name` (`ciafx`) without renaming the bundle ID at the same time.
- Do not rename the GitHub repo without an explicit "go" — paired with bundle ID and Cargo changes for a future release.
- Do not update Tauri, Rust toolchain, or Three.js version without explicit instruction.
- Public name is "Pointfield" (canon 2026-05-29) — one word, capital P, lowercase f; never "PointField"/"Point Field". (This reverses the prior "do not use Pointfield" rule.) Implementation of the rename is phased; do not rename app strings/files/site/releases ahead of their phase.

## Failure Patterns (Learned From Prior Sessions)

- Rust build artifacts in `target/` consume massive disk space. Clean periodically but never commit.
- Mixing rename energy with feature energy. Rebrands take one session each; do not bundle with new renderer work.
- CDN-loaded Three.js means offline first-launch fails silently. Known v0.1 limitation, documented.

## Related Projects

- **ciafx-app** (~/Developer/ciafx-app/): iOS + visionOS Metal port. Currently single-particle (one per UV); needs cluster expansion to become the full Pointfield renderer on those platforms. Out of v0.1 scope.
- **splatplayer** (~/Developer/splatplayer/): Gaussian-splat .ply sequence viewer. Unrelated despite the shared "splat" string.
