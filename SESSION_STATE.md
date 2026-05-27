---
workflow_step: v0_1_1_released_latest_phase_d_awaiting_hero_footage
agent_type: execute
token_budget: standard
last_updated: 2026-05-27
---

# SESSION_STATE.md — splat-desktop (PixelCluster)

> Tactical handoff between sessions. Update at every session exit.
> Notion holds strategy. This file holds working state.

## Last Updated

- Date: 2026-05-27
- Session summary: Shipped PixelCluster v0.1.0 (rebrand of ciafx v2.0.2) and v0.1.1 (two bug fixes: aspect-ratio preservation, canvas leak on video switch). Both are live releases; v0.1.1 is Latest. CI green on both. Phase D (landing page, easter egg, social posts) deferred — awaiting Cia's hero footage.

## Current Objective

Hold. PixelCluster v0.1.1 is live and Latest. Next move belongs to Cia: deliver hero footage for the ciamac.com/pixelcluster landing page (Phase D).

## Last Completed Action

GitHub release `pixelcluster-v0.1.1` published 2026-05-27T08:01:14Z. Promoted to Latest. CI run 26498034543 all green (mac-arm + windows + release jobs). 3 artifacts uploaded; all HEAD-verified HTTP 200.

## Open Blockers

- None for shipped releases.
- Phase D blocker: Cia's hero footage delivery for landing page. Specs in [release plan](https://www.notion.so/36df87ed3fbb8108ba42ec44adeffcae) section 9.

## Next Actions (Ordered)

1. Wait for Cia's hero footage.
2. When delivered, encode to specs (1280×720 or 1920×1080 H.264 muted MP4, 6-10s, under 4 MB).
3. Build `ciamac.com/pixelcluster` landing page on the `ciamac-site` stage branch.
4. Repoint stage easter egg from `ciafx_2.0.2_aarch64.dmg` to `PixelCluster_0.1.1_aarch64.dmg`.
5. Cia reviews stage; on explicit "go", promote stage → live.
6. Post LinkedIn + X (one-time launch, per `[[project_outlet_stack]]` + `[[project_pixelcluster_v01]]`).

## Decisions Made This Session

- **v0.1.0 rebrand strategy.** "PixelCluster already existed inside ciafx; v0.1 reveals it." Engine unchanged; product surface new. See `[[project_pixelcluster_v01]]`.
- **Repo, bundle ID, Cargo name all stay** for v0.1.x. Coupled rename deferred to v0.2 or later.
- **Pointfield retired** as an internal name. Always say PixelCluster.
- **v0.1.1 patch release** triggered by visible bugs in v0.1.0 (aspect ratio + canvas leak). Both fixed in single patch.
- **Workflow tag trigger widened** to `['v*', 'pixelcluster-v*']` — necessary for the new tag pattern to fire CI.
- **CI workflow artifact bundle names** renamed `ciafx-*` → `pixelcluster-*` (cosmetic, both upload + download steps updated).
- **GitHub release body must be populated manually.** The workflow uses `softprops/action-gh-release@v2` with `draft: true` but does NOT pass a `body:`, so auto-drafts are empty. Manual `gh release edit --notes` step needed every release. Worth fixing in workflow eventually.

## Active Branches / Files in Play

- Branch: `main` clean, pushed to origin/main at `2e8f05a`
- Branch `fix/preserve-aspect-ratio` exists locally (ff-merged into main; safe to delete with `git branch -d`)
- Tags pushed: `v1.0.0`, `v2.0.0`, `v2.0.1`, `v2.0.2`, `pixelcluster-v0.1.0`, `pixelcluster-v0.1.1`
- Latest GitHub release: `pixelcluster-v0.1.1`
- App icon, CSS, body markup, all stable from v0.1.0 except `style.css:138` (controls header text-transform removed) and `ui/app.js` (aspect + canvas-leak)

## Known Fragile Areas

- **No code signing.** Unsigned DMG triggers Gatekeeper "damaged" on first launch. `xattr -cr` workaround documented in release notes and README.
- **Three.js CDN dependency.** Offline first-launch fails silently. CSP whitelists `cdn.jsdelivr.net`.
- **CI matrix is ARM-only on Mac.** Intel Macs unsupported. Intentional.
- **Bundle ID still `com.ciamac.ciafx`.** Coupled to Cargo name and repo rename for a future release.
- **Workflow tag trigger requires `pixelcluster-v*`** — already widened, but worth remembering if anyone simplifies.
- **GitHub auto-draft bodies are empty.** Manual populate step needed each release (above).

## Context for Next Session

- **Phase D is the gate.** Landing page + easter egg repoint + LinkedIn/X launch posts. All blocked on Cia's hero footage. No code work needed; this is content + ciamac-site repo work.
- **iOS / visionOS work is OUT of v0.1.x.** When Cia is ready to extend, that's a separate session in `~/Developer/ciafx-app/` (Swift Metal). Needs cluster-mode port to ParticleCore (see parent audit on Notion).
- **In-browser demo at /pixelcluster/demo** is the highest-leverage v0.2 candidate (lifts ui/app.js out of Tauri webview into a standalone web page). Held until after Phase D ships.
- **CLAUDE.md and SESSION_STATE versioning:** current SESSION_STATE.md is what you're reading; prior versions are SESSION_STATE_v1.md, _v2.md, _v3.md. Current CLAUDE.md is the v0.1 narrative; _v1.md and _v2.md are historical.
- **Planning artifacts on Notion:**
  - Audit: https://www.notion.so/36cf87ed3fbb816db148dbb27f6189e3
  - Code excerpts: https://www.notion.so/36df87ed3fbb81f68274e9604866b268
  - Release plan: https://www.notion.so/36df87ed3fbb8108ba42ec44adeffcae
  - Phase A: https://www.notion.so/36df87ed3fbb81fa9068e3eb317c9a62
  - Phase B prep: https://www.notion.so/36df87ed3fbb81059fd4c2d29195e557
