#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if command -v pkg >/dev/null 2>&1; then
  pkg update -y
  pkg install -y nodejs-lts git
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js and npm are required. In Termux run: pkg install nodejs-lts" >&2
  exit 1
fi

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "SKYWA requires Node.js 20 or newer. Current: $(node --version)" >&2
  exit 1
fi

mkdir -p "$ROOT/apps/server/data"
echo "[SKYWA] Installing WhatsApp engine dependencies…"
(cd "$ROOT/packages/whatsapp-engine" && npm install --no-audit --no-fund)
echo "[SKYWA] Installing backend dependencies…"
(cd "$ROOT/apps/server" && npm install --no-audit --no-fund)

echo
echo "Setup selesai."
echo "Jalankan backend dengan: bash \"$ROOT/scripts/start-termux.sh\""
echo "Biarkan Termux tetap berjalan saat memakai aplikasi SKYWA."
