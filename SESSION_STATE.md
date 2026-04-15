---
workflow_step: ciafx_rebrand_v2_in_progress
agent_type: execute
token_budget: standard
last_updated: 2026-04-14
---

# SESSION_STATE.md — splat-desktop (rebranding to ciafx)

> Tactical handoff between sessions. Update at every session exit.
> Notion holds strategy. This file holds working state.

## Last Updated
- Date: 2026-04-14
- Session summary: Rebranded splat-desktop to **ciafx** v2.0.0. Refactored monolith HTML into modular files. Moved turbulence to GPU. Redesigned GUI. Regenerated icon set with fine-particle aesthetic. Added native save dialog via Tauri dialog plugin.

## Current Objective
Ship ciafx v2.0.0: renamed, modular codebase, GPU-accelerated particle engine, native file saves, polished GUI. Keep the live easter egg DMG on ciamac.com untouched until v2 is verified. `splatplayer` remains the canonical Gaussian Splat viewer (App Store candidate); ciafx is the creative video-particle tool.

## Last Completed Action
Added Tauri dialog plugin (native save dialog for recordings), fixed `withGlobalTauri` config error, rebuilt. Last verified build succeeded (exit 0); final verification after dialog plugin integration is pending, app needs manual relaunch.

## Open Blockers
- [ ] Final build with dialog plugin not visually verified. Relaunch with `npm run tauri dev` and test recording flow.
- [ ] Windows ARM and Mac ARM builds not configured in CI (only Intel Mac + Windows x64 currently).
- [ ] No code signing / notarization for the DMG. Gatekeeper will warn users.
- [ ] Easter egg on ciamac.com still points at old `cia-mac/splat/releases/v1.0.0/Splat_1.0.0_aarch64.dmg`. Update only after ciafx v2 tagged and released.

## Next Actions (Ordered)
1. Relaunch `npm run tauri dev` in ~/Developer/splat-desktop/, drop a video in, test recording end-to-end (save dialog should appear).
2. If save dialog works, commit the v2 rebrand as a single commit on main.
3. Decide whether to rename the repo on GitHub (`cia-mac/splat-desktop` -> `cia-mac/ciafx`) or keep repo name and just retag.
4. Add `macos-14` (ARM) to `.github/workflows/build.yml` matrix alongside existing `macos-13`.
5. Tag v2.0.0 to trigger CI release build, then update easter egg DMG link on ciamac-site.
6. Consider adding: preset save/load, color grading controls, fullscreen toggle, window menu bar.

## Decisions Made This Session
- **Rename to ciafx**: unified brand for both web version (ciamac.com easter egg) and desktop DMG. Rejected: `cia-fx` (hyphen awkward for filenames/URLs), `cmfx` (less readable).
- **Keep splatplayer and splat-desktop as separate repos**: they solve different problems (3D PLY viewer vs video particle renderer). No code overlap.
- **Work on splat-desktop in isolation**: do not touch the live easter egg DMG on ciamac.com until v2 tested.
- **Monolith split**: ui/index.html (markup), ui/style.css (styles), ui/app.js (logic + shaders).
- **Version bump**: splat 1.0.0 -> ciafx 2.0.0 (signals rebrand + significant rewrite).
- **GPU turbulence**: 3-octave Perlin turbulence moved from CPU per-frame loop (686K particles) to vertex shader. Mouse offsets stay CPU-side (only affect particles within radius).
- **Recording pipeline**: `preserveDrawingBuffer` toggled only during recording; native save dialog via tauri-plugin-dialog; filename template `ciafx_{videoname}_{iso-timestamp}.{ext}`.
- **Browser fallback retained**: if `window.__TAURI_INTERNALS__` missing, download trick still works.

## Active Branches / Files in Play
- Branch: `main` (2 commits behind/unchanged since last session, all changes uncommitted)
- Uncommitted (modified): `.github/workflows/build.yml`, `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/src/main.rs`, `src-tauri/tauri.conf.json`, `src-tauri/icons/*.png`, `src-tauri/icons/icon.icns`, `src-tauri/icons/icon.ico`, `src-tauri/gen/schemas/*`, `ui/index.html`
- Uncommitted (new): `ui/app.js`, `ui/style.css`, `ui/index_v1.html`, `src-tauri/capabilities/default.json`, `CLAUDE.md`, `CLAUDE_v1.md`, `SESSION_STATE.md`, `SESSION_STATE_v1.md`

## Known Fragile Areas
- **Tauri API surface at runtime**: frontend reaches Tauri via `window.__TAURI_INTERNALS__.invoke`. If this is missing at runtime (some Tauri v2 setups require the @tauri-apps/api script tag or bundler imports), the native save dialog will silently fall back to the browser download. Test the save flow before shipping.
- **CSP allows CDN for Three.js** (`https://cdn.jsdelivr.net`). First launch without network won't load Three.js. Consider bundling three.js into ui/vendor/ for offline startup before App Store distribution.
- **Cargo clean was run** (797MB removed); next `tauri dev` will full-rebuild (~2-3 min).
- **Build workflow still targets `macos-13` (Intel)**. Apple Silicon DMG needs `macos-14` runner.

## Context the Next Session Needs
- ciafx = the rebranded splat-desktop. Not to be confused with splatplayer (separate 3D PLY viewer repo at ~/Developer/splatplayer/, bundle ID `com.ciamac.splatplayer`).
- Bundle ID is `com.ciamac.ciafx`. Window title simply `ciafx`.
- The live easter egg on ciamac.com detects a yellow bird in the homepage video and spawns a sealed envelope modal linking to the DMG. Do NOT change the modal or DMG link until v2 is released.
- User wants finer particles in the icon (done), wanted the upload overlay centered relative to the controls panel (done: overlay shifts 320px when panel open, syncs via `togglePanel()`).
- User was annoyed I claimed work was done without verifying. Always relaunch + screenshot before claiming success.

## Files Changed Summary
| File | Change |
|---|---|
| `ui/index.html` | Rewrote as clean markup; links to style.css + app.js |
| `ui/style.css` | NEW: extracted styles, bumped font sizes, polished panel |
| `ui/app.js` | NEW: extracted logic, GPU turbulence, native save via Tauri invoke |
| `ui/index_v1.html` | Archived original 615-line monolith |
| `src-tauri/src/main.rs` | Added `save_file` command + dialog plugin init |
| `src-tauri/Cargo.toml` | Added `tauri-plugin-dialog = "2"`; renamed package `splat` -> `ciafx` |
| `src-tauri/tauri.conf.json` | productName `Gsplat` -> `ciafx`, bundle id `com.ciamac.splat` -> `com.ciamac.ciafx`, v1.0.0 -> v2.0.0 |
| `src-tauri/capabilities/default.json` | NEW: grants dialog:default + dialog:allow-save + core:default |
| `src-tauri/icons/*` | Regenerated fine-particle set (1024/512/256/128/128@2x/32 PNG + .icns + .ico) |
| `.github/workflows/build.yml` | Renamed `Build Gsplat` -> `Build ciafx`, artifact names splat-* -> ciafx-* |
| `package.json` | name `gsplat` -> `ciafx`, version 1.0.0 -> 2.0.0 |
