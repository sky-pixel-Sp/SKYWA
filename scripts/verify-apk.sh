#!/usr/bin/env bash
set -euo pipefail

APK="app/build/outputs/apk/debug/app-debug.apk"
if [[ ! -f "$APK" ]]; then
  echo "ERROR: expected debug APK not found: $APK" >&2
  find app/build/outputs -maxdepth 5 -type f -name '*.apk' -print 2>/dev/null || true
  exit 1
fi

if command -v aapt >/dev/null 2>&1; then
  aapt dump badging "$APK" | grep -F "package: name='com.skywa.app'" >/dev/null
elif [[ -n "${ANDROID_HOME:-}" && -x "${ANDROID_HOME}/build-tools/34.0.0/aapt" ]]; then
  "${ANDROID_HOME}/build-tools/34.0.0/aapt" dump badging "$APK" | grep -F "package: name='com.skywa.app'" >/dev/null
else
  echo 'ERROR: aapt not available; cannot verify package ID.' >&2
  exit 1
fi

entries="$(unzip -Z1 "$APK")"
for required in \
  "lib/arm64-v8a/libnode.so" \
  "lib/arm64-v8a/libskywa-node-bridge.so" \
  "assets/nodejs-project/apps/server/src/runner/server.js" \
  "assets/nodejs-project/packages/whatsapp-engine/src/engine.js" \
  "assets/nodejs-project/node_modules/@whiskeysockets/baileys/lib/index.js"; do
  if ! grep -Fxq "$required" <<<"$entries"; then
    echo "ERROR: standalone APK is missing required entry: $required" >&2
    exit 1
  fi
done

echo 'APK artifact verification: PASS (package ID, embedded Node.js, native bridge, backend, and Baileys engine)'
