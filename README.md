# SKYWA WhatsApp Bot Studio

SKYWA is a small Android control panel plus a Node.js / Baileys companion backend. The Android app controls the backend over the device's loopback interface. The backend must run in Termux on the same Android phone.

## Included in this build

- Android app with backend health/status, WhatsApp pairing-code flow, stop control, sending text messages, and a basic keyword auto-reply rule.
- Node.js companion server that defaults to 127.0.0.1:3000.
- WhatsApp session persistence and basic reconnection behavior.
- Unit tests for engine exports, disconnected-send validation, and auto-reply configuration.
- GitHub Actions workflow for syntax checks, tests, Android APK build and APK package verification.

## Download

Open the repository Actions page and download the SKYWA debug APK artifact from a successful run:
https://github.com/sky-pixel-Sp/SKYWA/actions

The artifact is temporary (workflow retention is 14 days). Check that the workflow run says successful before installing the APK.

## First-time setup on Android

1. Download the source ZIP from the repository's Code menu, or clone the repository inside Termux so files are stored in Termux's private home rather than shared storage.
2. In Termux, install dependencies and run the setup script. From the project folder, execute:

    pkg update -y
    pkg install -y git nodejs-lts
    bash scripts/setup-termux.sh
    bash scripts/start-termux.sh

3. Keep the Termux backend running. Open SKYWA Bot Studio and tap Refresh Status.
4. Enter the WhatsApp phone number in international format, without a plus sign (for Indonesia, for example 6281234567890), then tap Minta Kode Pairing.
5. On WhatsApp, open Perangkat tertaut, choose Tautkan perangkat, select Tautkan dengan nomor telepon, and enter the code shown by SKYWA.
6. After connection, send a test message to a number you control. Auto-reply is disabled by default; configure its keyword and reply text in the app, then enable and save it.

## Running from a Termux clone

Clone the project within Termux home to avoid shared-storage permission limitations:

    pkg install -y git nodejs-lts
    git clone https://github.com/sky-pixel-Sp/SKYWA.git
    cd SKYWA
    bash scripts/setup-termux.sh
    bash scripts/start-termux.sh

If the repository's default branch has not yet been updated to this build, download the source ZIP for branch ci/skywa-import-and-ci instead.

## Troubleshooting

- Backend OFFLINE: run the Termux start script and keep it open. The app expects http://127.0.0.1:3000.
- Pairing code not appearing: verify the phone number with country code, internet connectivity, and the current WhatsApp device-linking flow. Stop and restart once, then refresh status.
- WhatsApp will disconnect if Android kills Termux in the background. Set Termux battery use to Unrestricted and consider running termux-wake-lock in Termux.
- Do not put project files in shared storage and do not commit WhatsApp credentials, session files, API tokens, or .env files.

## Safety and limits

- The server binds to loopback by default; do not expose it publicly. The Android app uses cleartext HTTP only to reach 127.0.0.1 on the same device.
- This is an installable preview, not a fully tested production release. A live WhatsApp pairing, end-to-end delivery, and long-duration background stability still need to be checked on a real phone.
- Use auto-reply responsibly. An empty keyword means every incoming text message can receive the configured reply.
- The Android app requires Android 7.0 (API 24) or newer. The companion backend requires Node.js 20 or newer.

## Repository status

The initial GitHub repository was empty. This build reconstructs the main control/backend pieces from the available SKYWA-CI-Ready archive through the GitHub connector; it is not a byte-for-byte import of every file in that archive.
