#!/usr/bin/env bash
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
APP_NAME="Jot"
VERSION=$(grep '"version"' apps/desktop/package.json | head -1 | sed 's/.*"\([0-9.]*\)".*/\1/')
APP_BUNDLE="apps/desktop/src-tauri/target/release/bundle/macos/${APP_NAME}.app"
OUTPUT_DIR="release"
DMG_OUT="${OUTPUT_DIR}/${APP_NAME}-${VERSION}.dmg"
BACKGROUND="scripts/dmg-background.png"
VOLUME_ICON="apps/desktop/src-tauri/icons/icon.icns"

# ── Sanity checks ─────────────────────────────────────────────────────────────
if ! command -v create-dmg &>/dev/null; then
  echo "Error: create-dmg not found. Install with: brew install create-dmg"
  exit 1
fi

if [ ! -d "$APP_BUNDLE" ]; then
  echo "Error: $APP_BUNDLE not found."
  echo "Run 'pnpm tauri:build' first (or just 'pnpm release' which does both)."
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
rm -f "$DMG_OUT"

# ── Ad-hoc code sign ──────────────────────────────────────────────────────────
# No Developer ID needed. This prevents the "damaged" Gatekeeper error when
# someone downloads the DMG — they'll see "unidentified developer" instead,
# which they can bypass via System Settings → Privacy & Security → Open Anyway.
echo "→ Signing ${APP_NAME}.app (ad-hoc)..."
codesign --deep --force --sign - "$APP_BUNDLE"

# ── Create DMG ────────────────────────────────────────────────────────────────
echo "→ Creating ${DMG_OUT}..."
create-dmg \
  --volname "$APP_NAME" \
  --volicon "$VOLUME_ICON" \
  --background "$BACKGROUND" \
  --window-pos 200 100 \
  --window-size 600 400 \
  --icon-size 110 \
  --icon "${APP_NAME}.app" 150 185 \
  --hide-extension "${APP_NAME}.app" \
  --app-drop-link 450 185 \
  --no-internet-enable \
  "$DMG_OUT" \
  "$APP_BUNDLE"

echo "✓ Done: ${DMG_OUT} ($(du -sh "$DMG_OUT" | cut -f1))"
echo ""
echo "Next: upload to GitHub — see .internal_README.md § Releasing"
