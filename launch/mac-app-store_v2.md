# Pointfield — Mac App Store Submission (v2)

v2 (2026-05-29): PixelCluster to Pointfield text swap of `mac-app-store_v1.md` (kept). Substance unchanged; the MAS track remains parked. App `productName` is still "PixelCluster" until rename Phase 2.

Created 2026-05-28. Execution-ready checklist for getting the desktop app into the Mac App Store.

The app is feature-complete. The work here is Apple infrastructure + sandboxing, not features. Nothing below mutates the product build yet — apply the code steps (5–7) only after enrollment (step 1) is done, so the signing identity actually exists.

## 0. Decision locked in plan: bundle ID

Keep `com.ciamac.ciafx` for the first MAS submission. It is coupled to the Cargo crate name and is deliberately frozen. Renaming to `com.ciamac.pixelcluster` triggers a coordinated Cargo + repo rename that is deferred to its own release. The App Store **display name** can still be "Pointfield" regardless of bundle ID.

## 1. ★ Apple Developer Program enrollment (human-only)

- Enroll at developer.apple.com ($99/yr). Individual or organization.
- Record the **Team ID** (10-char). Everything downstream needs it.
- Blocker B4 in the release plan. Nothing else in this track can complete until this is done.

## 2. ★ App Store Connect record (human-only)

- Create a new macOS app. Display name: **Pointfield**.
- Bundle ID: `com.ciamac.ciafx` (register it under the Team if not already).
- Primary category: **Graphics & Design** (alt: Photo & Video).
- SKU: free choice, e.g. `pixelcluster-mac`.

## 3. ★ Certificates + provisioning (human-only, via Apple Developer portal or Xcode)

- "Apple Distribution" certificate.
- "Mac App Distribution" + "Mac Installer Distribution" certificates (MAS needs the installer cert to sign the .pkg).
- A **Mac App Store provisioning profile** bound to `com.ciamac.ciafx`.

## 4. Vendor Three.js locally (code — do before first submission)

MAS review frequently rejects webview apps that load executable JS from a remote origin (here, `three.module.js` from cdn.jsdelivr.net). It also fixes the known offline-first-launch bug.

- Download `three.module.js@0.170.0`, place at `ui/vendor/three.module.js`.
- Change `ui/app.js` line 1 import to `'./vendor/three.module.js'`.
- Update the CSP in `tauri.conf.json` to drop the jsdelivr allowance for `script-src` (keep only `'self'`).
- Test `cargo tauri dev` + a production build before proceeding.
- This is a guarded change (CLAUDE.md: don't change Three.js source/version without instruction) — treat the version as pinned; only the load path changes.

## 5. App Sandbox entitlements (code)

Create `src-tauri/entitlements.mas.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.app-sandbox</key>
  <true/>
  <key>com.apple.security.files.user-selected.read-write</key>
  <true/>
</dict>
</plist>
```

Rationale: the app opens a user-picked video and saves a user-picked render. Both go through the file dialog, so `user-selected.read-write` is sufficient. No network entitlement needed once Three.js is vendored (step 4). No camera/mic.

## 6. Tauri macOS signing config (code)

In `src-tauri/tauri.conf.json`, extend the `bundle.macOS` block (fill `<TEAM_ID>` and identities from steps 1/3):

```jsonc
"macOS": {
  "minimumSystemVersion": "10.15",
  "entitlements": "entitlements.mas.plist",
  "signingIdentity": "Apple Distribution: Ciamac Parhizi (<TEAM_ID>)",
  "providerShortName": "<TEAM_ID>"
}
```

For the MAS .pkg, the installer is signed with "3rd Party Mac Developer Installer" / "Mac Installer Distribution". Tauri's MAS path may need a manual `productbuild`/`productsign` step if the bundler doesn't emit a store-ready .pkg directly — verify with the installed Tauri CLI version.

## 7. Build + package (code, after 1–6)

- `cargo tauri build` to produce the signed `.app`.
- Wrap into a signed `.pkg` for the store (productbuild + Mac Installer Distribution cert).
- Validate the .pkg signature and entitlements (`codesign -dvvv`, `spctl -a -t install`).

## 8. ★ Upload + metadata + submit (human-only)

- Upload the .pkg via **Transporter** (Mac App Store app) or `xcrun`.
- App Store Connect metadata:
  - Screenshots: capture the live render at required macOS sizes.
  - Description: reuse the LinkedIn copy, trimmed.
  - **Privacy nutrition label: "Data Not Collected."** Pointfield collects nothing; processing is fully local.
  - Age rating: 4+.
- Submit for review.

## Expected rejection points (pre-empt them)

1. **Remote JS in webview** → fixed by step 4 (vendor Three.js). Highest risk; do not skip.
2. **Sandbox file access** → covered by step 5 entitlement; make sure open + save still work inside the sandbox build (test before upload).
3. **Missing privacy declaration** → declare "Data Not Collected" (step 8).
4. **Unsigned / wrong cert** → use the Mac App Distribution + Installer certs, not Developer ID (Developer ID is for direct distribution, not MAS).

## What ships in parallel (not MAS)

The direct-download .dmg/.exe/.msi on GitHub releases stays as-is for non-MAS users. MAS is an additional channel, not a replacement. The unsigned-Gatekeeper note on ciamac.com/pixelcluster stays until MAS is approved (then add an "also on the Mac App Store" link).
