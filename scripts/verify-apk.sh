#!/usr/bin/env bash
set -euo pipefail

APK="app/build/outputs/apk/debug/app-debug.apk"
if [[ ! -f "$APK" ]]; then
  echo "ERROR: expected debug APK not found: $APK" >&2
  find app/build/outputs -maxdepth 5 -type f -name '*.apk' -print 2>/dev/null || true
  exit 1
fi

VERSION_NAME="$(sed -nE 's/^[[:space:]]*versionName[[:space:]]+"([^"]+)".*/\1/p' app/build.gradle | head -n1)"
VERSION_CODE="$(sed -nE 's/^[[:space:]]*versionCode[[:space:]]+([0-9]+).*/\1/p' app/build.gradle | head -n1)"
if [[ -z "$VERSION_NAME" || ! "$VERSION_CODE" =~ ^[0-9]+$ ]]; then
  echo "ERROR: cannot read Gradle versionName/versionCode." >&2
  exit 1
fi

if command -v aapt >/dev/null 2>&1; then
  BADGING="$(aapt dump badging "$APK")"
elif [[ -n "${ANDROID_HOME:-}" && -x "${ANDROID_HOME}/build-tools/34.0.0/aapt" ]]; then
  BADGING="$("${ANDROID_HOME}/build-tools/34.0.0/aapt" dump badging "$APK")"
else
  echo 'ERROR: aapt not available; cannot verify APK metadata.' >&2
  exit 1
fi

grep -F "package: name='com.skywa.app'" <<<"$BADGING" >/dev/null
grep -F "versionCode='$VERSION_CODE' versionName='$VERSION_NAME'" <<<"$BADGING" >/dev/null || {
  echo "ERROR: APK version metadata does not match Gradle ($VERSION_NAME / $VERSION_CODE)." >&2
  exit 1
}

entries="$(unzip -Z1 "$APK")"
for required in \
  "lib/arm64-v8a/libnode.so" \
  "lib/arm64-v8a/libskywa-node-bridge.so" \
  "assets/nodejs-project/apps/server/src/runner/server.js" \
  "assets/nodejs-project/packages/whatsapp-engine/src/engine.js" \
  "assets/nodejs-project/.skywa-app-version" \
  "assets/nodejs-project/.skywa-app-version-code" \
  "assets/nodejs-project/node_modules/@whiskeysockets/baileys/lib/index.js"; do
  if ! grep -Fxq "$required" <<<"$entries"; then
    echo "ERROR: standalone APK is missing required entry: $required" >&2
    exit 1
  fi
done

native_abis="$(grep -E '^lib/[^/]+/[^/]+\.so$' <<<"$entries" | cut -d/ -f2 | sort -u)"
if [[ "$native_abis" != "arm64-v8a" ]]; then
  echo "ERROR: expected only ARM64 native libraries, found: ${native_abis:-none}" >&2
  exit 1
fi

echo "APK artifact verification: PASS (package ID, version $VERSION_NAME/$VERSION_CODE, ARM64 ABI, native runtime, bridge, backend, and Baileys engine)"
