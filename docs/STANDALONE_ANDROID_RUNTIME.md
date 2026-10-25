# SKYWA Standalone Android Runtime

## Goal

SKYWA must install as one native Android APK. End users must not need a website, browser, Termux, shell commands, or a manually started backend.

## Integration added in this branch

- Native Android UI remains Java-based.
- `NodeService` manages a foreground service, persistent notification, and a partial wake lock while the local engine is active.
- `NodeRuntime` and `node-bridge.cpp` use JNI/C++ to call the embedded Node.js `node::Start` API.
- `scripts/prepare-standalone-android.sh` downloads the pinned Android mobile runtime, verifies its SHA-256 digest, copies native libraries/headers into the Android project, stages the existing SKYWA server and engine, and installs production npm dependencies into a shared asset bundle.
- The runtime's working directory is inside `noBackupFilesDir/skywa-runtime`. The existing server's `./data/sessions` and `./data/users.json` therefore reside in app-private storage. Bundle refresh attempts to preserve that data on APK updates.
- Native UI requests continue to use `127.0.0.1:3000`; the backend binds to loopback and is not intended to be exposed to the LAN or public internet.
- `scripts/verify-apk.sh` checks the package ID and verifies that the native Node runtime, JNI bridge, server entrypoint, engine source, and Baileys entrypoint are packaged inside the APK.

## Pinned embedded runtime

The preparation script pins the Node.js 24.22.1 mobile Android lite archive published at:

https://github.com/fogtape/nodejs-mobile/releases/tag/v24.22.1-0

Archive SHA-256:

`87ac319660b9dbff1c3a878d5dec2e15560a42f04d7660c8ddaf87c24627ac82`

This is a prerelease mobile build rather than the official Node.js desktop distribution. It is based on the Node.js 24.22.1 upstream tag, which meets the current Baileys Node.js 20+ requirement. The lite profile omits Node Inspector, `node:sqlite`/Web Storage, built-in TypeScript stripping, and single-executable-app packaging; the current server uses JavaScript and JSON files and does not depend on those features.

The downloaded native runtime is not committed to source control. It is fetched and checksum-verified during the build, keeping the repository smaller and making the runtime source/version explicit.

## Build

On a Linux build host with JDK 17, Android SDK, NDK `27.3.13750724`, CMake `3.22.1`, Node.js 24+, npm, `curl`, and `unzip`:

```bash
bash scripts/prepare-standalone-android.sh
gradle --no-daemon assembleDebug
bash scripts/verify-apk.sh
```

GitHub Actions runs the preparation step before Gradle, then uploads a debug APK only after the workflow and package verification pass.

## Android runtime behavior

1. The user opens SKYWA; the Activity starts the foreground runtime service.
2. The service displays a persistent notification and prepares the bundled JavaScript project in app-private storage.
3. It sets `HOME`, `TMPDIR`, `NODE_COMPILE_CACHE`, and `NODE_COMPILE_CACHE_PORTABLE` before starting Node.
4. The existing Express backend is launched inside the app process.
5. The UI controls the engine through the loopback API. WhatsApp pairing and messages still need an internet connection and a real WhatsApp account.

Node's in-process startup API supports only one runtime instance per Android process. The current service starts Node once for that process; it does not attempt to terminate and reinitialize the same native runtime in-place. A process restart by Android resets the static state. User-facing WhatsApp stop/disconnect controls stop the WhatsApp socket, not the embedded HTTP runtime.

## Important Android notes

- The app keeps a partial wake lock while the service is alive to improve connectivity when the screen is off. This consumes additional battery.
- Android OEM battery management, permission settings, and force-stop behavior can still stop background activity; no application can promise uninterrupted runtime under force-stop.
- Foreground-service special-use behavior and notification visibility must be checked on supported Android versions. A Google Play release would also need the appropriate foreground-service declarations/review.
- The current optimized debug APK targets `arm64-v8a` only. This is intended for modern 64-bit ARM Android phones; 32-bit-only devices and x86 emulators need a separate build.
- The current SKYWA UI/engine paths focus on text sending and text auto-reply. Linux x64 `sharp` and libvips binaries are removed from the Android bundle; Baileys dynamically imports image adapters only when media operations are invoked.

## Validation status — not a release certification

Source integration has been added, but it is **not yet evidence that the final product works on a physical phone**. CI still needs to prove the build and the contents verification. Before declaring SKYWA ready, test on an actual Android device:

- Fresh install and first-launch asset extraction.
- Cold start and local server readiness.
- Pairing-code generation and actual WhatsApp pairing.
- Outgoing message delivery and incoming auto-reply.
- Session preservation after app restart and APK upgrade.
- Screen-off behavior, process kill/recreation, and battery use.
- Behavior when notification permission is denied and when the phone's OEM battery restrictions are enabled.

A green JavaScript unit test or successful Gradle build does not prove live WhatsApp pairing, message delivery, or long-running background reliability.
