# SKYWA WhatsApp Bot Studio

SKYWA is an Android control shell and Node.js companion backend for a WhatsApp automation engine based on Baileys.

## Project layout
- `apps/server/`: Express backend and runtime controller.
- `packages/whatsapp-engine/`: Baileys lifecycle, pairing, session, and message-send integration.
- `app/`: Android Gradle application.
- `tests/unit/`: Node.js unit tests.
- `.github/workflows/build-apk.yml`: CI syntax checks, unit tests, Android debug build, and APK metadata verification.

## Local development
1. Install Node.js 20 or newer and Java 17 / Android SDK for APK builds.
2. In `packages/whatsapp-engine`, run `npm install`.
3. In `apps/server`, run `npm install`.
4. Run the tests from repository root: `node --test tests/unit/engine.test.mjs`.
5. Start the backend from `apps/server` with `npm start`. It binds to loopback by default.

## Important
Do not commit WhatsApp session files, API keys, tokens, or `.env` files. A successful build or live WhatsApp connection must only be claimed after CI or a real integration test confirms it. The Android shell is currently a minimal UI; full frontend bundling and device integration remain follow-up work.

## Import note
The initial repository was empty. This branch reconstructs the key application and CI files from the available SKYWA-CI-Ready archive using the GitHub connector; it is not a byte-for-byte import of every file in that ZIP. See `docs/CI_STATUS.md` for known gaps.
