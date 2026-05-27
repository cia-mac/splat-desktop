# CLAUDE.md — splat-desktop (PixelCluster)

## Project Identity

PixelCluster is a real-time video-to-particle renderer. Drop a video in. Each region of every frame becomes a small cluster of glowing points. Clusters share the source color; members spread and jitter in size on a turbulence field. Three mouse modes: swirl (no button), push (left), attract (right).

- **Repo:** ~/Developer/splat-desktop/ (filesystem path unchanged)
- **Remote:** github.com/cia-mac/splat-desktop (unchanged for v0.1; rename deferred)
- **Product name:** PixelCluster (locked 2026-05-27)
- **Renderer name:** internal use only is "the renderer" or "ParticleCore" (Swift package on iOS, not in this repo). Do not use "Pointfield" in new copy (retired 2026-05-27).
- **Stack:** Tauri v2 (Rust shell) + WebKit/Chromium webview + vanilla JS + Three.js (WebGL2, CDN-loaded)
- **Bundle ID:** com.ciamac.ciafx (unchanged in v0.1; paired with Cargo name rename for a later release)
- **Cargo crate name:** ciafx (unchanged in v0.1, coupled to bundle ID)
- **Distribution:** GitHub releases. Latest: PixelCluster v0.1.0 (rebrand of ciafx v2.0.2). Historical: ciafx v1.0.0 through v2.0.2.
- **Session state:** See SESSION_STATE.md in this directory.

## Naming history (so future sessions don't relitigate)

- v1.x: shipped under the name "Splat" (Gaussian-splat-adjacent framing). Legacy.
- v2.x (April 2026): rebranded to "ciafx". Same engine.
- v0.1.0 (May 2026): rebranded to "PixelCluster". Same engine. Version reset because the public surface is new, not the engine.

The repo name and bundle ID still reference the v1/v2 era. That is intentional and stays through v0.1.

## Architecture

### Frontend (ui/)

- `index.html` — main UI (upload overlay, controls panel, status bar)
- `app.js` — Three.js renderer, GLSL shaders, particle build loop, mouse interaction, recording
- `style.css` — styling, dark theme, CSS custom properties (`--surface`, `--accent`, etc.)

### Backend (src-tauri/)

- `src/main.rs` — Tauri entry point + one IPC command (`save_file`)
- `tauri.conf.json` — productName "PixelCluster", window title "PixelCluster", version 0.1.0
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
- Do not use the term "Pointfield" in any new copy.

## Failure Patterns (Learned From Prior Sessions)

- Rust build artifacts in `target/` consume massive disk space. Clean periodically but never commit.
- Mixing rename energy with feature energy. Rebrands take one session each; do not bundle with new renderer work.
- CDN-loaded Three.js means offline first-launch fails silently. Known v0.1 limitation, documented.

## Related Projects

- **ciafx-app** (~/Developer/ciafx-app/): iOS + visionOS Metal port. Currently a single-particle Pointfield (one per UV); needs cluster expansion to become PixelCluster on those platforms. Out of v0.1 scope.
- **splatplayer** (~/Developer/splatplayer/): Gaussian-splat .ply sequence viewer. Unrelated despite the shared "splat" string.
