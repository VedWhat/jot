#!/usr/bin/env bash
set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
APP_NAME="Jot"
VERSION=$(grep '"version"' apps/desktop/package.json | head -1 | sed 's/.*"\([0-9.]*\)".*/\1/')
APP_BUNDLE="apps/desktop/src-tauri/target/release/bundle/macos/${APP_NAME}.app"
OUTPUT_DIR="release"
DMG_NAME="${APP_NAME}-${VERSION}.dmg"
BACKGROUND="scripts/dmg-background.png"
VOLUME_ICON="apps/desktop/src-tauri/icons/icon.icns"

# ── Sanity checks ─────────────────────────────────────────────────────────────
if [ ! -d "$APP_BUNDLE" ]; then
  echo "Error: $APP_BUNDLE not found. Run 'pnpm build' first."
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
rm -f "$OUTPUT_DIR/$DMG_NAME"

echo "→ Creating DMG: $DMG_NAME (v$VERSION)"

# ── create-dmg ────────────────────────────────────────────────────────────────
# Window: 600×400. App icon at (150, 175), Applications at (450, 175).
# Background is 1200×800 rendered at @2x for retina crispness.

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
  "$OUTPUT_DIR/$DMG_NAME" \
  "$APP_BUNDLE"

echo "✓ Done: $OUTPUT_DIR/$DMG_NAME ($(du -sh "$OUTPUT_DIR/$DMG_NAME" | cut -f1))"
