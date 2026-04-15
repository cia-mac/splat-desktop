---
workflow_step: v2_released_awaiting_ci_and_easter_egg_swap
agent_type: execute
token_budget: standard
last_updated: 2026-04-14
---

# SESSION_STATE.md — splat-desktop (ciafx)

> Tactical handoff between sessions. Update at every session exit.
> Notion holds strategy. This file holds working state.

## Last Updated
- Date: 2026-04-14
- Session summary: ciafx v2.0.0 verified end-to-end and shipped. Native save dialog confirmed (Tauri v2 plugin expects args wrapped in `options` key). Debug overlay stripped. Committed as single commit `0a8051d` on main. Added `macos-14` ARM build to CI. Tagged v2.0.0, pushed — CI release workflow queued.

## Current Objective
Wait for CI release build (~15 min). Once the draft GitHub release contains the ciafx v2 DMGs (Intel + ARM), update the easter egg link on ciamac.com from the old `splat/releases/v1.0.0/Splat_1.0.0_aarch64.dmg` to the new ciafx v2 DMG.

## Last Completed Action
Pushed `main` (commit 0a8051d) and tag `v2.0.0` to `github.com/cia-mac/splat-desktop`. CI run 24430042772 queued. Verified save dialog wrote a 24MB mp4 to `~/Movies/ciafx_Cia-bird_slow-motion-animation-request_2026-04-15T00-22-44.mp4`.

## Open Blockers
- [ ] CI run 24430042772 not yet complete. Watch for build failures on macos-14 ARM (first time that runner is in the matrix).
- [ ] No code signing / notarization for the DMG. Gatekeeper will warn users. Defer until downloads start failing in the wild.
- [ ] Three.js is loaded from CDN (CSP allows jsdelivr). First launch without network will fail. Consider bundling to `ui/vendor/` before any App Store submission.
- [ ] Easter egg on ciamac.com still points at old `cia-mac/splat/releases/v1.0.0/Splat_1.0.0_aarch64.dmg`. Update only after ciafx v2 draft release is published.

## Next Actions (Ordered)
1. Poll `gh run list --repo cia-mac/splat-desktop` until v2.0.0 run completes. Download + locally test the draft release DMG.
2. Publish the draft GitHub release once DMGs look correct.
3. Swap the easter egg DMG URL on ciamac.com (ciamac-site repo) to the v2 release asset URL.
4. Consider renaming repo `cia-mac/splat-desktop` -> `cia-mac/ciafx` (low-priority cosmetic).
5. Bundle Three.js locally to remove CDN dependency before any Mac App Store attempt.

## Decisions Made This Session
- **Tauri v2 dialog plugin args wrapper**: `invoke('plugin:dialog|save', { options: { defaultPath, filters } })`. Top-level spread was rejected with "missing required key options". Recorded the exact shape so future dialog/open calls don't re-hit the same wall.
- **Single squash-style commit for the v2 rebrand**: preserves history boundary (v1 = splat, v2 = ciafx). Commit 0a8051d, 28 files, +2087/-619.
- **Added a second Mac runner (macos-14, ARM) to CI** in parallel with existing macos-13 (Intel). Both artifacts feed the release job; the draft release now carries `ciafx-mac-intel-dmg` and `ciafx-mac-arm-dmg`.

## Active Branches / Files in Play
- Branch: `main` (clean, pushed to origin)
- HEAD: `0a8051d` ciafx v2.0.0: rebrand from splat-desktop, modular rewrite, native save dialog
- Tag: `v2.0.0` (pushed)

## Known Fragile Areas
- **macos-14 runner is new to this repo**. First CI run on that runner may surface ARM-specific toolchain issues (universal binary config, code-sign placeholders). Check the run log if it fails.
- **CSP allows CDN for Three.js** (`https://cdn.jsdelivr.net`). Offline first-launch will render nothing.
- **Tauri capabilities manifest** grants `dialog:default`, `dialog:allow-save`, `core:default`. If adding more plugins (file open, fs, shell), the capability must be added here or the plugin call will be rejected at runtime.

## Context the Next Session Needs
- ciafx = rebranded splat-desktop. Not splatplayer (separate 3D PLY viewer at ~/Developer/splatplayer/).
- Bundle ID: `com.ciamac.ciafx`. Window title: `ciafx`. Filename template: `ciafx_{videoname}_{iso-timestamp}.{ext}`.
- Repo still named `cia-mac/splat-desktop` on GitHub. Renaming is optional, not blocking.
- Save dialog confirmed working end-to-end on 2026-04-14 with test clip written to ~/Movies/.
- Easter egg on ciamac.com is untouched. Do not swap its DMG link until the v2 draft release is published and tested.

## Files Changed Summary (this session)
| File | Change |
|---|---|
| `ui/app.js` | Wrapped Tauri save invoke args in `options` key; stripped debug overlay |
| `.github/workflows/build.yml` | Added `build-mac-arm` job on `macos-14`, wired into release artifacts |
| SESSION_STATE.md | Advanced workflow_step to `v2_released_awaiting_ci_and_easter_egg_swap` |
