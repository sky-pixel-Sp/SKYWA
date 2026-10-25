#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RUNTIME_VERSION="24.22.1-0"
RUNTIME_URL="https://github.com/fogtape/nodejs-mobile/releases/download/v${RUNTIME_VERSION}/nodejs-mobile-android-lite-${RUNTIME_VERSION}.zip"
RUNTIME_SHA256="87ac319660b9dbff1c3a878d5dec2e15560a42f04d7660c8ddaf87c24627ac82"
CACHE_DIR="${XDG_CACHE_HOME:-${HOME:-/tmp}/.cache}/skywa"
ARCHIVE="${CACHE_DIR}/nodejs-mobile-android-lite-${RUNTIME_VERSION}.zip"
APP_LIBNODE="app/src/main/cpp/libnode"
APP_ASSETS="app/src/main/assets/nodejs-project"
FORCE="${1:-}"

command -v curl >/dev/null || { echo "ERROR: curl is required." >&2; exit 1; }
command -v unzip >/dev/null || { echo "ERROR: unzip is required." >&2; exit 1; }
command -v npm >/dev/null || { echo "ERROR: npm is required." >&2; exit 1; }

mkdir -p "$CACHE_DIR"
if [[ ! -f "$ARCHIVE" ]] || [[ "$FORCE" == "--force" ]]; then
  echo "Downloading embedded Node.js ${RUNTIME_VERSION} runtime…"
  curl --fail --location --retry 3 --retry-delay 2 "$RUNTIME_URL" --output "$ARCHIVE"
fi

echo "${RUNTIME_SHA256}  ${ARCHIVE}" | sha256sum --check --status || {
  echo "ERROR: Node.js runtime SHA-256 did not match the pinned release asset." >&2
  rm -f "$ARCHIVE"
  exit 1
}

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/unpacked"
unzip -q "$ARCHIVE" -d "$WORK/unpacked"

HEADER_FILE="$(find "$WORK/unpacked" -type f -path '*/include/node/node.h' -print -quit)"
if [[ -z "$HEADER_FILE" ]]; then
  echo "ERROR: Node.js runtime archive did not contain include/node/node.h." >&2
  exit 1
fi

rm -rf "$APP_LIBNODE"
mkdir -p "$APP_LIBNODE/include/node"
cp -R "$(dirname "$HEADER_FILE")/." "$APP_LIBNODE/include/node/"

# This APK targets modern 64-bit Android phones. Keeping only arm64-v8a
# cuts more than 120 MiB compared with a universal APK.
ABI="arm64-v8a"
LIBRARY="$(find "$WORK/unpacked" -type f -name libnode.so -path "*/${ABI}/libnode.so" -print -quit)"
if [[ -z "$LIBRARY" ]]; then
  echo "ERROR: required arm64-v8a/libnode.so is missing from the runtime." >&2
  exit 1
fi
mkdir -p "$APP_LIBNODE/bin/${ABI}"
cp "$LIBRARY" "$APP_LIBNODE/bin/${ABI}/libnode.so"

# Bundle the existing server and WhatsApp engine without user session data.
# Install production modules in one shared node_modules directory so both
# source trees resolve the same dependency versions.
rm -rf "$APP_ASSETS"
mkdir -p "$APP_ASSETS/apps" "$APP_ASSETS/packages"
cp -R apps/server "$APP_ASSETS/apps/server"
cp -R packages/whatsapp-engine "$APP_ASSETS/packages/whatsapp-engine"
# CI installs workspace dependencies before this script runs. Do not copy
# those host-side node_modules folders into the APK; the root install below
# creates one clean production-only dependency tree for the Android runtime.
rm -rf "$APP_ASSETS/apps/server/node_modules" "$APP_ASSETS/packages/whatsapp-engine/node_modules"
rm -f "$APP_ASSETS/apps/server/package-lock.json" "$APP_ASSETS/packages/whatsapp-engine/package-lock.json"

node --input-type=commonjs - "$APP_ASSETS" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const stage = process.argv[2];
const server = JSON.parse(fs.readFileSync(path.join(stage, 'apps/server/package.json'), 'utf8'));
const engine = JSON.parse(fs.readFileSync(path.join(stage, 'packages/whatsapp-engine/package.json'), 'utf8'));
const dependencies = { ...(server.dependencies || {}), ...(engine.dependencies || {}) };
const bundlePackage = {
  name: 'skywa-embedded-runtime',
  version: '1.0.0',
  private: true,
  type: 'module',
  description: 'Production runtime bundled into the SKYWA Android APK',
  dependencies
};
fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify(bundlePackage, null, 2) + '\n');
NODE

(
  cd "$APP_ASSETS"
  npm install --omit=dev --no-audit --no-fund
)

# Baileys only dynamically imports image adapters for media operations and
# catches missing adapters. SKYWA currently implements text send and text
# auto-replies; Linux x64 sharp binaries cannot run on Android and are unused.
rm -rf \
  "$APP_ASSETS/node_modules/sharp" \
  "$APP_ASSETS/node_modules/@img/sharp-linux-x64" \
  "$APP_ASSETS/node_modules/@img/sharp-libvips-linux-x64" \
  "$APP_ASSETS/node_modules/@img/sharp-linux-arm64" \
  "$APP_ASSETS/node_modules/@img/sharp-libvips-linux-arm64" \
  "$APP_ASSETS/node_modules/@img/sharp-linuxmusl-x64" \
  "$APP_ASSETS/node_modules/@img/sharp-libvips-linuxmusl-x64" \
  "$APP_ASSETS/node_modules/@img/sharp-linuxmusl-arm64" \
  "$APP_ASSETS/node_modules/@img/sharp-libvips-linuxmusl-arm64"

# Stamp the source revision into the installed bundle. Runtime assets are cached
# in app-private storage, so versionCode alone is not enough after hotfix builds.
BUNDLE_VERSION="$(git rev-parse HEAD)"
printf '%s\n' "$BUNDLE_VERSION" > "$APP_ASSETS/.skywa-bundle-version"

echo "Embedded Node.js runtime: ${RUNTIME_VERSION} (SHA-256 verified)"
echo "Runtime library: ${APP_LIBNODE}/bin/arm64-v8a/libnode.so"
echo "Production engine bundle: ${APP_ASSETS}"
echo "Standalone Android preparation complete."
