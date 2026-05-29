# PixelCluster v0.1 — Launch Release Plan (v1)

Created 2026-05-28. Operator-maintained. Notion holds strategy; this is the working launch sheet.

## North star

ciamac.com is the home of PixelCluster. The public should feel they **discovered a strange rendering system already running** — not landed on a product page. Browser interaction is primary; downloads are secondary; the App Store is the long arc.

Narrative lock: **reveal, not build.** "PixelCluster already existed inside my tools; v0.1 is the version that calls itself by name." No iOS/visionOS promises in public copy yet (that track is real but unannounced).

## Current state (verified 2026-05-28)

- **GitHub releases live:** `pixelcluster-v0.1.0` + `pixelcluster-v0.1.1` (Latest). Mac (.dmg, Apple Silicon), Windows (.exe setup, .msi). Unsigned.
- **Web surface built (stage / local, not promoted):**
  - `/pixelcluster` — the **living render surface**. Full-bleed real-time renderer, auto-starts on a default source, drop-your-own-video anywhere, quiet download link, tuning panel hidden behind Esc. This is the demo AND the page.
  - Homepage easter egg (click the bird's head) rewired to PixelCluster + v0.1.1 downloads, opens `/pixelcluster`.
  - Middleware bypass so `/pixelcluster*` serves on mobile (with a low-power notice).
  - Cloudflare Web Analytics shared beacon (no duplicate).
- **Desktop app:** feature-complete, unsigned, Tauri v2 + WebGL2/Three.js.
- **iOS/visionOS app (`ciafx-app`):** scaffold only. Not feature-complete. Out of public v0.1 scope.

## Open decisions / blockers

| # | Item | Owner | Blocks |
|---|------|-------|--------|
| B1 | Default source clip for the living surface (temp = site bird video; want dedicated footage) | Cia | live polish, not launch |
| B2 | Cloudflare apex misroute — ciamac.com served by `deploy` Vercel project, not `ciamac-site` | Cia/infra | live promotion of /pixelcluster |
| B3 | Stage clone 1 commit behind main clone | operator | clean stage deploy |
| B4 | Apple Developer Program enrollment ($99/yr) | Cia | both App Store tracks |
| B5 | Mac App Store signing identity + provisioning profile | Cia (Apple acct) | Mac App Store submission |

## Track A — Web surface (closest to done)

1. Cia reviews `/pixelcluster` living surface on local/stage. Iterate on feel (motion, density, chrome restraint).
2. Swap default source clip when dedicated footage lands (`deploy/pixelcluster/default.mp4`, no code change).
3. Resolve apex misroute (B2) OR deploy via whichever Vercel project actually fronts ciamac.com.
4. On Cia's explicit "go": deploy live. Verify `/pixelcluster` renders, drop-video works, downloads resolve, easter egg routes, mobile notice shows.

## Track B — Social launch (copy ready, see `social-copy_v1.md`)

Sequence (single launch day, Cia fires when web is live):
1. **X** — short thread. Lead with motion (screen capture of the live surface), link to ciamac.com/pixelcluster.
2. **LinkedIn** — one post, slightly more context (the "reveal" framing), same link + a download mention.
3. **Substack note** — discovery surface; short, links to the live page.
- IG/X-as-feed: not active. Skip.
- Asset needed for all three: a 6–15s screen capture of the living surface in motion (this doubles as the eventual hero loop).

## Track C — Mac App Store (start now)

Goal: get the **feature-complete desktop app** into the Mac App Store. App is ready; the gap is Apple infra + sandboxing.

Steps (sequenced; ★ = human-only / needs Apple account):
1. ★ Enroll in Apple Developer Program ($99/yr). Get Team ID.
2. ★ In App Store Connect: create the app record, reserve the name "PixelCluster", bundle ID (see note below).
3. ★ Generate certs: "Apple Distribution" + "Mac App Distribution" + a Mac App Store provisioning profile.
4. **Bundle ID decision.** Current is `com.ciamac.ciafx` (coupled to Cargo crate name, deliberately frozen). Mac App Store wants a stable, branded ID. Options: keep `com.ciamac.ciafx` (no rename, ships fastest) or move to `com.ciamac.pixelcluster` (clean, but triggers the coupled Cargo + repo rename that's currently deferred). **Recommend: keep `com.ciamac.ciafx` for the first MAS submission; rename later as its own coordinated release.**
5. Add **App Sandbox** entitlements (`com.apple.security.app-sandbox = true`) plus a user-selected-file read/write entitlement for the video-open + save-render flows. Tauri's `save_file` IPC + dialog plugin must work inside the sandbox (user-selected scope, not arbitrary paths).
6. Configure Tauri macOS signing in `tauri.conf.json` (signing identity, provisioning profile, entitlements, hardened runtime as required by MAS).
7. Build a `.pkg` for Mac App Store (not the .dmg — MAS distribution is a signed .pkg uploaded via Transporter / `xcrun altool`/`notarytool` equivalent for MAS).
8. ★ Upload via Transporter. Fill App Store Connect metadata: screenshots, description, category (Graphics & Design or Photo & Video), privacy nutrition label (PixelCluster collects nothing — declare "no data collected"), age rating.
9. ★ Submit for review. Expect rejections on: sandbox file access, missing privacy declarations, or WebView/CDN usage (Three.js loads from jsdelivr — MAS reviewers sometimes flag remote code execution in webviews; may need to **bundle Three.js locally** instead of CDN for the MAS build).

**Likely real friction (flag early):** MAS + Tauri webview + remote-loaded JS (Three.js CDN) is the highest-risk item. The fix is to vendor Three.js into the app bundle for the MAS build. That's a small, contained change and should be done before first submission.

## Track D — iOS / visionOS (build, then submit — long arc)

This is a **build project**, not a submission. `ciafx-app` today: placeholder grid, single-frame sampling, no cluster mode, no hand tracking, shell visionOS target.

Build milestones (each its own session in `~/Developer/ciafx-app/`):
1. Looping video reader (`AVPlayerItemVideoOutput`) so particles re-color over time.
2. Cluster-mode port of the renderer to `ParticleCore` (match the desktop COLS×ROWS×PER_CLUSTER cluster model; today it's single-particle "Pointfield").
3. Touch forces (repulsion / attract / swirl) tuned for phone + iPad.
4. visionOS hand tracking (ARKit `HandTrackingProvider`) — pinch/swipe drive the field.
5. App icon set, launch screen, App Store screenshots (per device class), privacy label, description.
6. ★ Submit to iOS App Store, then visionOS App Store, under the same Apple account/Team ID from Track C.

Gate: do not announce iOS/visionOS publicly until milestone 5 is demoable.

## Risks

- **R1.** Apex misroute (B2) means a "live" deploy may not actually surface on ciamac.com. Verify routing before declaring launch.
- **R2.** 685k live particles can choke low-end machines and phones. Mobile notice ships; consider a particle-count auto-scale for the web surface later.
- **R3.** Unsigned desktop downloads trigger Gatekeeper. The page notes the `xattr -cr` workaround. MAS submission (Track C) is the real fix.
- **R4.** Three.js CDN dependency: offline first-launch fails; MAS review may flag remote JS. Vendor it for the MAS build.
- **R5.** Default-source clip is a temporary stand-in derived from existing site footage. Swap before heavy promotion to avoid a derivative read.

## Changelog
- v1 (2026-05-28): initial plan. Web surface pivoted from landing-page composition to living render surface per Cia's direction. Tracks C + D opened (Both — Mac now, iOS later).
