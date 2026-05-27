---
workflow_step: pixelcluster_rebrand_branch_complete_awaiting_pr
agent_type: execute
token_budget: standard
last_updated: 2026-05-27
---

# SESSION_STATE.md — splat-desktop (PixelCluster)

> Tactical handoff between sessions. Update at every session exit.
> Notion holds strategy. This file holds working state.

## Last Updated

- Date: 2026-05-27
- Session summary: Phase B of the PixelCluster v0.1 rebrand executed. Local branch `pixelcluster-rename` created off main at `d03b9ee`. User-visible strings renamed from `ciafx` to `PixelCluster`. Version bumped from 2.0.2 to 0.1.0 across `tauri.conf.json`, `Cargo.toml`, `package.json`. CI workflow trigger widened to include `pixelcluster-v*` tags. `privacy-policy.html` removed (had no inbound references; was titled "Gsplat" which conflicted with the new brand). Old `CLAUDE.md` versioned to `CLAUDE_v2.md`; new `CLAUDE.md` written. Old `SESSION_STATE.md` versioned to `SESSION_STATE_v2.md`; this file is the new `SESSION_STATE.md`. New `README.md` created. No push. No tag. Awaiting Cia's review and explicit go for Phase C.

## Current Objective

Cia reviews the `pixelcluster-rename` branch locally, then proceeds with Phase C (PR, merge, tag, release) when ready.

## Last Completed Action

Phase B file edits committed locally on branch `pixelcluster-rename`. Working tree clean. `package-lock.json` regenerated to match new package.json version.

## Open Blockers

- None for Phase B itself.
- Phase C blockers: same as Phase A documented (DMG signing absent, Three.js CDN dependency, ARM-only Mac matrix).

## Next Actions (Ordered)

1. Cia reviews the rebrand branch.
2. Local smoke test: `cargo tauri build`, verify the resulting DMG is named `PixelCluster_0.1.0_aarch64.dmg`, launch the app, confirm window title, upload screen, status bar, panel header all read PixelCluster.
3. Open PR for `pixelcluster-rename` to `main`. Squash-merge.
4. Tag `pixelcluster-v0.1.0`. Push tag. CI fires (trigger widening confirmed).
5. Draft GitHub release per the release-plan template. Pre-release flag ON.
6. Smoke test from the actual release URLs. Promote to Latest on Cia's go.
7. Append one-line tombstone to v2.0.2 release notes (no artifact edits).

## Decisions Made This Session

- Privacy-policy.html deleted (zero inbound references; legacy "Gsplat" title conflicted with the new brand).
- Upload-brand markup: option B (camelCase split, `Pixel<span>Cluster</span>`). Reuses existing CSS span styling.
- CI workflow display name renamed from "Build ciafx" to "Build PixelCluster".
- CI artifact bundle names renamed from `ciafx-*` to `pixelcluster-*`. Both upload and download steps updated in lockstep.
- Cosmetic strings updated: CSS comment header, Rust panic message, Tauri capability description, all from `ciafx` to `PixelCluster`. Cargo and package.json descriptions updated to lead with "PixelCluster:".

## Active Branches / Files in Play

- Branch: `pixelcluster-rename` (local only, not pushed)
- Base: main at `d03b9ee chore: sync package-lock.json version field to 2.0.2`
- Files changed: see commit log on the branch.

## Known Fragile Areas

- **No code signing.** Unsigned DMG triggers Gatekeeper "damaged" warning on first launch. Same `xattr -cr` workaround as ciafx v2.x.
- **Three.js CDN dependency.** Offline first-launch fails silently.
- **CI matrix is ARM-only on Mac.** Intel Macs unsupported.
- **Bundle ID still `com.ciamac.ciafx`.** Intentional. Paired with Cargo name and repo rename for a future release.

## Context for Next Session

- PixelCluster v0.1.0 is a rebrand release. Engine unchanged from ciafx v2.0.2. Public framing: "PixelCluster already existed inside ciafx; v0.1 reveals it."
- Repo, bundle ID, Cargo name all still reference the v1/v2 era. That is intentional and documented.
- "Pointfield" is retired; do not use in new copy.
- ciafx-app (iOS + visionOS) is a separate repo, out of v0.1 scope.
- Planning artifacts on Notion:
  - Audit: https://www.notion.so/36cf87ed3fbb816db148dbb27f6189e3
  - Code excerpts: https://www.notion.so/36df87ed3fbb81f68274e9604866b268
  - Release plan: https://www.notion.so/36df87ed3fbb8108ba42ec44adeffcae
  - Phase A: https://www.notion.so/36df87ed3fbb81fa9068e3eb317c9a62
  - Phase B prep: https://www.notion.so/36df87ed3fbb81059fd4c2d29195e557
