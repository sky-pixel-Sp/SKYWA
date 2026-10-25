#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js/npm belum terpasang. Jalankan bash scripts/setup-termux.sh terlebih dahulu." >&2
  exit 1
fi
if [ ! -d "$ROOT/packages/whatsapp-engine/node_modules" ] || [ ! -d "$ROOT/apps/server/node_modules" ]; then
  echo "Dependencies belum terpasang. Jalankan bash scripts/setup-termux.sh terlebih dahulu." >&2
  exit 1
fi

cd "$ROOT/apps/server"
export PORT="$(printenv PORT 2>/dev/null || echo 3000)"
export SKYWA_BIND="127.0.0.1"
echo "[SKYWA] Backend lokal dimulai pada 127.0.0.1:$PORT"
echo "[SKYWA] Jangan expose backend ke internet atau ubah SKYWA_BIND ke 0.0.0.0."
exec npm start
