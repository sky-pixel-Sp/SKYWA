# SKYWA Standalone Android Runtime — Implementation Gate

## Product requirement

SKYWA must be installed as one Android APK and must not require the user to install, open, or keep Termux running. The WhatsApp engine, its Node.js runtime, server/API, dependencies, and session storage must be packaged or provisioned by the APK itself. The UI must start and stop the embedded runtime through Android lifecycle-aware components.

## Audit findings from the current source

- `app/src/main/java/com/skywa/ui/MainActivity.java` sends requests to `http://127.0.0.1:3000` and explicitly tells the user to start `scripts/start-termux.sh`.
- `apps/server/package.json` requires Node.js >=20 and uses Baileys, Express, and Pino.
- `packages/whatsapp-engine/src/engine.js` persists WhatsApp credentials relative to `./data/sessions`, so the embedded runtime must set a writable app-private working directory before loading the engine.
- `app/build.gradle` refers to `../native/android-runtime/src/main/java`, but that directory is absent from the inspected branch tree.
- The existing APK workflow verifies a debug APK, but this only proves packaging/buildability; it does not prove that the WhatsApp backend is bundled or can run without Termux.

## Runtime integration gate

Do not mark this project standalone until all of the following are true:

1. A supported Android Node.js runtime is bundled for supported ABIs (at minimum arm64-v8a) and its version is compatible with the engine's Node.js requirement.
2. The complete server and production dependencies are included in the APK assets and copied to app-private storage at first launch/update.
3. An Android foreground service owns the runtime lifecycle, exposes a persistent notification while the bot is active, and handles stop/restart without requiring a shell.
4. Session credentials and settings live only in app-private storage and survive app updates/restarts. Never bundle credentials in the APK.
5. The UI starts the embedded runtime itself and reports a clear runtime startup error if initialization fails; no Termux instructions remain.
6. CI checks APK contents for the runtime, bundled server entry point, dependencies, and required native ABI libraries.
7. Device validation on a physical Android phone covers cold start, pairing-code request, connection persistence, outgoing message, auto-reply, force-stop/reopen, and Android background restrictions.

## Important compatibility risk

The current engine package declares Node.js >=20. Do not select a mobile Node runtime solely because it can be called from Java: verify its actual Node version, supported Android ABIs, package compatibility, and startup API before integrating it. If the runtime only supplies Node 18, either select a supported Node 20+ mobile runtime or explicitly test and revise the engine's compatibility assumptions; do not silently lower the requirement.

## Release status

This document is an implementation gate, not evidence that standalone runtime integration is complete. Until all gates above pass, the APK must be described as a preview that still requires an external backend.
