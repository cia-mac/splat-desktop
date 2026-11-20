#!/bin/bash
# Build the Mac App Store package for Pointfield Studio (bundle id com.ciamac.ciafx, team 3AUT8DTWP3).
#
#   mas/build-mas.sh [--version 0.1.5] [--build 7] \
#       [--profile ~/path/Pointfield_MAS.provisionprofile] \
#       [--app-identity "Apple Distribution: ... (3AUT8DTWP3)"] \
#       [--installer-identity "3rd Party Mac Developer Installer: ... (3AUT8DTWP3)"]
#
# With the profile and both identities it makes mas/out/Pointfield-<version>-<build>.pkg, ready for upload.
# With any of them missing it makes a LOCAL TEST build instead: same universal app, same sandbox, ad-hoc signed.
# It runs on this Mac but cannot be uploaded. Nothing here uploads, submits or sends anything to Apple.
set -euo pipefail
export PATH="/opt/homebrew/opt/rustup/bin:$HOME/.cargo/bin:$PATH"

VERSION=0.1.5; BUILD=7; PROFILE=""; APP_ID=""; PKG_ID=""
while [ $# -gt 0 ]; do case "$1" in
  --version) VERSION="$2"; shift 2;; --build) BUILD="$2"; shift 2;; --profile) PROFILE="$2"; shift 2;;
  --app-identity) APP_ID="$2"; shift 2;; --installer-identity) PKG_ID="$2"; shift 2;;
  *) echo "unknown option $1"; exit 2;; esac; done

REPO="$(cd "$(dirname "$0")/.." && pwd)"; OUT="$REPO/mas/out"; ENT="$REPO/mas/entitlements.plist"
BUNDLE_ID=com.ciamac.ciafx; TEAM=3AUT8DTWP3; NAME=Pointfield
mkdir -p "$OUT"; cd "$REPO"

echo "== 1/5 build universal app $VERSION ($BUILD)"
cargo tauri build --target universal-apple-darwin --bundles app --config "{\"version\":\"$VERSION\"}" 2>&1 | grep -v '^\s*Compiling' | tail -4
SRC="$REPO/src-tauri/target/universal-apple-darwin/release/bundle/macos/$NAME.app"
[ -d "$SRC" ] || { echo "build output missing: $SRC"; exit 1; }
APP="$OUT/$NAME.app"; rm -rf "$APP"; ditto "$SRC" "$APP"; xattr -cr "$APP"

echo "== 2/5 Info.plist for the store"
P="$APP/Contents/Info.plist"
pb() { /usr/libexec/PlistBuddy -c "$1" "$P" 2>/dev/null || true; }
pb "Delete :CFBundleVersion"; pb "Add :CFBundleVersion string $BUILD"
pb "Set :CFBundleShortVersionString $VERSION"
pb "Delete :ITSAppUsesNonExemptEncryption"; pb "Add :ITSAppUsesNonExemptEncryption bool false"
[ "$(pb 'Print :CFBundleIdentifier')" = "$BUNDLE_ID" ] || { echo "bundle id is not $BUNDLE_ID"; exit 1; }
pb "Print :LSMinimumSystemVersion" >/dev/null
echo "   $(pb 'Print :CFBundleShortVersionString') ($(pb 'Print :CFBundleVersion'))  archs: $(lipo -archs "$APP/Contents/MacOS/ciafx")"

if [ -z "$PROFILE" ] || [ -z "$APP_ID" ] || [ -z "$PKG_ID" ]; then
  echo "== 3/5 LOCAL TEST build (missing: ${PROFILE:+}$([ -z "$PROFILE" ] && echo profile) $([ -z "$APP_ID" ] && echo app-identity) $([ -z "$PKG_ID" ] && echo installer-identity))"
  TMP="$(mktemp -d)"; cp "$ENT" "$TMP/ent.plist"
  # the two team keys are restricted: they only run with a real provisioning profile
  /usr/libexec/PlistBuddy -c "Delete :com.apple.application-identifier" -c "Delete :com.apple.developer.team-identifier" "$TMP/ent.plist"
  codesign --force --sign - --entitlements "$TMP/ent.plist" "$APP"
  codesign --verify --deep --strict "$APP" && echo "   ad-hoc signed, sandboxed: $APP"
  echo "NOT uploadable. For the store build supply --profile, --app-identity and --installer-identity."
  exit 0
fi

echo "== 3/5 check the provisioning profile"
[ -f "$PROFILE" ] || { echo "profile not found: $PROFILE"; exit 1; }
security cms -D -i "$PROFILE" > "$OUT/profile.plist"
python3 - "$OUT/profile.plist" "$TEAM.$BUNDLE_ID" "$APP_ID" <<'PY'
import plistlib, sys, datetime, hashlib, subprocess, re
p = plistlib.load(open(sys.argv[1], 'rb')); want = sys.argv[2]; ident = sys.argv[3]
ent = p.get('Entitlements', {}); ok = True
def chk(c, msg):
    global ok
    print(('   ok   ' if c else '   FAIL ') + msg); ok = ok and c
chk(ent.get('com.apple.application-identifier') == want, f"profile app id is {ent.get('com.apple.application-identifier')} (want {want})")
chk(p['ExpirationDate'] > datetime.datetime.utcnow(), f"profile expires {p['ExpirationDate']:%Y-%m-%d}")
chk('ProvisionedDevices' not in p, "distribution profile (no device list)")
chk(any('OSX' in x or 'macOS' in x for x in p.get('Platform', [])), f"platform {p.get('Platform')}")
out = subprocess.run(['security', 'find-identity', '-v', '-p', 'codesigning'], capture_output=True, text=True).stdout
m = [l for l in out.splitlines() if ident in l]
sha = re.search(r'\b([0-9A-F]{40})\b', m[0]).group(1) if m else None
chk(sha is not None, f"signing identity '{ident}' is in the keychain")
chk(sha in {hashlib.sha1(c).hexdigest().upper() for c in p.get('DeveloperCertificates', [])}, "profile includes that signing certificate")
sys.exit(0 if ok else 1)
PY

echo "== 4/5 sign the app with the profile embedded"
cp "$PROFILE" "$APP/Contents/embedded.provisionprofile"
codesign --force --timestamp --sign "$APP_ID" --entitlements "$ENT" "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"
codesign -d --entitlements - "$APP" 2>&1 | grep -E 'application-identifier|app-sandbox|network.client|user-selected' | sed 's/^/   /'

echo "== 5/5 package"
PKG="$OUT/$NAME-$VERSION-$BUILD.pkg"; rm -f "$PKG"
productbuild --sign "$PKG_ID" --component "$APP" /Applications "$PKG"
pkgutil --check-signature "$PKG" | head -6
echo "built: $PKG   (NOT uploaded. Uploading to App Store Connect needs your go.)"
