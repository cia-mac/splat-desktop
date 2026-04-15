---
workflow_step: v2_0_2_released_stage_live_awaiting_prod_promote
agent_type: execute
token_budget: standard
last_updated: 2026-04-14
---

# SESSION_STATE.md — splat-desktop (ciafx)

> Tactical handoff between sessions. Update at every session exit.
> Notion holds strategy. This file holds working state.

## Last Updated
- Date: 2026-04-14
- Session summary: ciafx v2.0.0 verified, committed, tagged. Parallel session did two follow-on releases: v2.0.1 (new particle-burst icon) and v2.0.2 (dropped deprecated macos-13 Intel runner, ARM-only mac DMG). GitHub release `v2.0.2` is Latest. Easter egg on ciamac.com stage already points at v2.0.2 DMG; prod untouched awaiting "touch prod".

## Current Objective
Hold. ciafx v2 is shipped. Next action belongs to the ciamac-site session: user tests stage easter egg, says "touch prod" when ready, ciamac-site session promotes stage -> main.

## Last Completed Action
CI run `24431039191` for v2.0.2 finished successfully in 15m27s. Release published with `ciafx_2.0.2_aarch64.dmg`, `ciafx_2.0.2_x64-setup.exe`, `ciafx_2.0.2_x64_en-US.msi`. Stage site (`https://ciamac-site-stage.vercel.app`) serves the new DMG; prod (`https://ciamac.com`) still serves old `Splat_1.0.0_aarch64.dmg`.

## Open Blockers
- [ ] No code signing / notarization. Gatekeeper shows "damaged, move to Trash" on unsigned DMG. Workaround: `xattr -cr /Applications/ciafx.app`. Consider $99/yr Apple Developer ID cert to kill the warning.
- [ ] Three.js still loaded from CDN (`cdn.jsdelivr.net`). First-launch without network renders nothing. Bundle locally before any Mac App Store submission.
- [ ] Prod easter egg not swapped. Wait for explicit "touch prod".

## Next Actions (Ordered)
1. User tests stage easter egg end-to-end (watch for yellow bird -> click envelope -> DMG downloads and launches).
2. If stage passes: user says "touch prod", ciamac-site session merges stage -> main.
3. Long-term: bundle Three.js locally, decide on Apple Developer ID cert, optionally rename repo `cia-mac/splat-desktop` -> `cia-mac/ciafx`.

## Decisions Made This Session (ciafx work across sessions)
- **Tauri v2 dialog plugin args wrapper**: `invoke('plugin:dialog|save', { options: { defaultPath, filters } })`. Logged to Notion Decision Log as Operational.
- **Single squash-style commit for v2 rebrand**: commit `0a8051d`, +2087/-619 across 28 files. Preserves v1 (splat) vs v2 (ciafx) boundary.
- **Dropped macos-13 Intel runner**: v2.0.2 CI matrix is macos-14 ARM + windows-latest only. Parallel session's call, committed in `3fe93ba`.
- **New particle-burst app icon**: v2.0.1, commit `55f74bd`.

## Active Branches / Files in Play
- Branch: `main` (clean, up to date with origin)
- HEAD: `3fe93ba` v2.0.2: drop macos-13 Intel runner (deprecated), ARM-only mac DMG
- Tags: v1.0.0, v2.0.0, v2.0.1, v2.0.2 (all pushed). v2.0.2 is the Latest release.

## Known Fragile Areas
- **No code signing**. Unsigned DMG triggers Gatekeeper "damaged" warning on first launch. Workaround only.
- **Three.js CDN dependency**. Offline first-launch fails silently.
- **CI matrix is ARM-only on Mac**. Users on Intel Macs (pre-2020) will need Rosetta or an older Splat DMG. Acceptable tradeoff per parallel session's call (Intel Mac install base is shrinking and the runner was causing CI churn).

## Context the Next Session Needs
- ciafx = rebranded splat-desktop. Not splatplayer (separate 3D PLY viewer at ~/Developer/splatplayer/).
- Bundle ID: `com.ciamac.ciafx`. Filename template: `ciafx_{videoname}_{iso-timestamp}.{ext}`.
- Save dialog confirmed working end-to-end on 2026-04-14 (24MB test mp4 in ~/Movies/).
- Stage easter egg points at v2.0.2 DMG via commit `03b342b` on `ciamac-site` repo's `stage` branch.
- Prod easter egg untouched. Promoting requires merging `stage` -> `main` in the `ciamac-site` repo.
- GitHub release URL for the DMG: `https://github.com/cia-mac/splat-desktop/releases/download/v2.0.2/ciafx_2.0.2_aarch64.dmg`.
