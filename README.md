# SKYWA WhatsApp Bot Studio

SKYWA is a native Android application for controlling the SKYWA WhatsApp automation engine.

## Product requirement

The product target is **one installable Android APK**. End users should not need a website, browser, Termux, shell commands, or a separately running backend. The Android build now has a JNI/C++ bridge and a foreground service intended to start the embedded Node.js runtime, backend, Baileys engine, and production dependencies from within the installed app. The current debug APK targets 64-bit ARM Android devices to avoid packaging two additional CPU runtimes.

## Standalone runtime status

The standalone integration source has been added on the `feat/standalone-android-runtime` branch:

- Node.js 24 mobile runtime preparation and SHA-256 verification.
- Native C++/JNI bridge for launching Node.js in-process.
- Android foreground service with private app storage and a persistent notification.
- Bundling of the existing SKYWA server, WhatsApp engine, and production npm dependencies into Android assets.
- APK checks for the native runtime and JavaScript backend entrypoints.

**This is implementation work, not yet proof of a fully working release.** The GitHub Actions build must pass, and pairing, delivery, auto-reply, app-update preservation, and background reliability still need a real Android device and a real WhatsApp test account. A successful compile alone does not prove WhatsApp works.

The pinned Node.js mobile binary currently comes from a prerelease mobile build based on Node.js 24.22.1. The preparation script checks the exact SHA-256 digest before using it. See [Standalone Android Runtime](docs/STANDALONE_ANDROID_RUNTIME.md).

## Existing app features

- Native Android status and control UI.
- WhatsApp phone-number pairing-code flow.
- Outgoing text messages.
- Keyword-based auto-reply.
- Baileys session persistence and reconnection logic.

All live WhatsApp capabilities require internet connectivity and must be verified on a device before release.

## Build and download

The GitHub Actions workflow prepares the embedded runtime and then builds/verifies the debug APK:

**APK download (GitHub Releases):** https://github.com/sky-pixel-Sp/SKYWA/releases

Build and verification logs: https://github.com/sky-pixel-Sp/SKYWA/actions

For a Linux build machine with JDK 17, Android SDK/NDK, CMake, Node.js 24+, npm, `curl`, and `unzip`:

```bash
bash scripts/prepare-standalone-android.sh
gradle --no-daemon assembleDebug
bash scripts/verify-apk.sh
```

The preparation script is necessary because the large native runtime and `node_modules` are generated/downloaded build inputs and are not committed into source control.

## Security and reliability

- WhatsApp session credentials and settings are stored in Android app-private, no-backup storage; they must never be bundled inside the APK.
- The local API remains bound to `127.0.0.1` and is not intentionally exposed publicly.
- A foreground service and partial wake lock are used to improve continuity while the bot is running. This can increase battery use; Android OEM battery-management and force-stop behavior can still stop background activity.
- Do not claim standalone operation or successful live WhatsApp tests until the APK and physical-device tests have actually passed.
