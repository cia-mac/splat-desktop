# Pointfield launch · SESSION_STATE

Lane memory for the Pointfield launch (the outcome session). Read on entry,
write on exit. Seeded 2026-06-02 from the launch-brief session. Full brief:
~/Developer/POINTFIELD_LAUNCH_BRIEF_2026-06-02.md. Canonical copy lives in
social-copy_v2.md in this folder.

## Current state
- Copy: LinkedIn block in social-copy_v2.md reworked 2026-06-02. DRAFT, not
  locked. Ciamac is iterating on it. X thread and Instagram caption still to be
  reworked (IG is "skip" per RELEASE_PLAN_v2; activate only if Ciamac decides).
- Gallery tile: drafted (fields in the brief). Needs before go-live:
  (a) prod route confirmation, (b) a hosted thumbnail still, (c) badge decision.
- Badge decision 2026-06-02: yes to a proper `app` badge in the gallery, as a
  one-line handoff to the Gallery lane. It must never block the launch; if not
  ready on launch day, ship with `web` and swap after.
- Motion capture: Ciamac is doing it himself (macOS Cmd-Shift-5), 6 to 15s of
  the live surface in motion. Lead asset for every channel.

## Blockers to go-live
1. ciamac.com/pointfield does not resolve on prod (Phase 3 route + 301 not done;
   stage has both routes). Everything links there.
2. No Pointfield_* release built yet (shipped assets still PixelCluster_0.1.1_*;
   forward-only rename: next release ships as Pointfield_*, never retro-rename).
3. Tile thumbnail still missing (grab a frame or shoot a still).
4. Hero motion capture not yet delivered (Ciamac, Cmd-Shift-5).

## Decided
- Name is settled: Pointfield (canon 2026-05-29). The gate is the cutover, not
  the naming.
- Internal identifiers stay frozen per RELEASE_PLAN_v2.md line 58: bundle id
  com.ciamac.ciafx, crate ciafx, folder splat-desktop. User-facing surfaces only.
- Launch sequence: capture first; tile live with the web cutover before any
  post; X leads; LinkedIn a few hours later same day; Substack note trails;
  Instagram held.

## Distribution roadmap (recorded 2026-06-03, not for launch copy)
- v0.1 launch: unsigned .dmg (Mac) + .exe (Windows) via GitHub releases as
  Pointfield_* assets. Gatekeeper workaround stays (xattr -cr).
- Post-launch: Mac App Store (un-parks the MAS track) and iOS App Store.
  Both require Apple signing/notarization; not launch blockers, separate beats.
- Rule: launch copy never hints at roadmap. No "coming soon," no platforms
  beyond Mac + Windows desktop and browser.

## Next
- Ciamac iterates the LinkedIn copy, then X, then decides on IG.
- Confirm prod routing (apex/Vercel project) and cut /pointfield + 301.
- Hand "add app badge" to the Gallery lane.

---

## 2026-06-10 — Blocker 1 verified RESOLVED on prod (Fable 5, architecture session)

Live checks 2026-06-10 ~17:50 PT:
- https://ciamac.com/pointfield -> HTTP 200
- https://ciamac.com/pixelcluster -> 308 redirect to https://ciamac.com/pointfield
Blocker 1 (prod route + 301) is DONE; this lane's 06-02 blocker list was stale.
Note: the local ciamac-site repo is 13 commits ahead of origin/main (incl. an
unrelated atelier month fix from today); prod serves the routes regardless.

Launch blockers remaining: (2) Pointfield_* release build — naming plumbing
dispatched today as an AI Room command (worker B, splat-desktop); the build
itself stays a supervised Ciamac step. (3) tile thumbnail (Ciamac).
(4) hero motion capture (Ciamac, Cmd-Shift-5). Copy iteration: Ciamac.
Gallery app badge: dispatched today (worker A, ciamac-gallery-stage).

---

## 2026-06-10 — Blocker 2 plumbing DONE (exec-handoff, worker B)

**What produces Pointfield_* names:**
- `src-tauri/tauri.conf.json` `productName` is already `"Pointfield"` (Phase 2,
  completed 2026-05-29). Tauri v2 derives every output artifact filename directly
  from `productName`. No change was needed here.
- `.github/workflows/build.yml` CI artifact container names were still
  `pixelcluster-windows-msi`, `pixelcluster-windows-exe`, `pixelcluster-mac-arm-dmg`,
  `pixelcluster-mac-arm-app`. These were renamed to `pointfield-*` (the matching
  glob patterns in the release step were updated too). These are internal CI labels
  and do not affect the user-facing filenames, but they are now consistent.

**Name-origin finding:**
Tauri reads `productName` from `tauri.conf.json` and writes it verbatim into every
bundle output: `{productName}_{version}_{arch}.dmg`, `{productName}_{version}_x64_en-US.msi`,
`{productName}_{version}_x64-setup.exe`. With `productName: "Pointfield"` the next
build will emit `Pointfield_0.1.1_*.dmg`, `Pointfield_0.1.1_*.msi`,
`Pointfield_0.1.1_*-setup.exe` automatically.

**Files changed:**
- `.github/workflows/build.yml` — artifact container names `pixelcluster-*` → `pointfield-*`

**Frozen identifiers confirmed untouched:**
`com.ciamac.ciafx` (bundle id), `ciafx` (Cargo name), `splat-desktop` (folder).

**What the next supervised build must verify:**
Ciamac runs `cargo tauri build` (or the CI workflow fires on a `pointfield-v*` tag)
and confirms the produced `.dmg` / `.msi` / `.exe` filenames begin with `Pointfield_`.
That is the proof. No verification short of an actual build can substitute.

**Commit hash:** see git log (committed immediately after this entry).

**Blocker 2 status:** plumbing complete. The supervised build + GitHub release
(gate G2) remains a Ciamac step.
