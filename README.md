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
- Keyword-based auto-reply.\n- Automation Pro: up to 30 match rules (`contains`, `exact`, `startsWith`), allowlist/blocklist, group filtering, chat cooldown, global rate limit, optional active hours, pause/resume and runtime metrics.
- Baileys session persistence and reconnection logic.

All live WhatsApp capabilities require internet connectivity and must be verified on a device before release.

## Build and download

The GitHub Actions workflow prepares the embedded runtime and then builds/verifies the debug APK:

**Download latest standalone APK (ARM64):** https://raw.githubusercontent.com/sky-pixel-Sp/SKYWA/apk-downloads/SKYWA-standalone-arm64.apk

Open the [APK download branch](https://github.com/sky-pixel-Sp/SKYWA/tree/apk-downloads) if you prefer to download it from the repository UI. The workflow updates this APK after a successful build from the standalone or `fix/**` branch.

This is a GitHub prerelease build. The APK is distributed as a release asset rather than committed to the source branch.

Build and verification logs: https://github.com/sky-pixel-Sp/SKYWA/actions

## Install on Android

1. Open the **Download latest standalone APK** link above on the Android phone and download `SKYWA-standalone-arm64.apk`.
2. Open the downloaded file from Downloads. If Android asks, allow your browser or file manager to **Install unknown apps**, then return and tap **Install**.
3. If an older SKYWA debug build is installed and Android reports a signature conflict, uninstall the older build first and install the new one. **Uninstalling erases that installation's local settings and WhatsApp session**, so only do this if you can pair again.
4. Open SKYWA and wait for the foreground service notification/runtime startup to settle. Keep internet access enabled for WhatsApp and OpenRouter.
5. To configure AI, open **Pengaturan AI**. For OpenRouter, choose the provider, enter the API key and model ID, save, and run the test prompt. For a local provider, the endpoint and model server must already be reachable from the phone; the APK does not include model weights.
6. Link WhatsApp using the pairing-code flow in the app, then test with a separate chat before enabling automatic replies for normal use.

**Device requirement:** this build targets ARM64 Android devices. CI verifies source tests, APK compilation, and package contents; it does not replace a real-device test of launch, WhatsApp pairing, message sending, and background behavior.

### Automation Pro

Automation Pro is configured from the native app screen. Each rule uses one line in this format:

- `contains: harga, produk => Silakan sebut produk yang kamu cari.`
- `exact: halo => Halo! Ada yang bisa dibantu?`
- `startsWith: order => Kirim nomor pesanan agar bisa dicek.`

A blank whitelist means chats are allowed unless blocked; a populated whitelist allows replies only to listed phone numbers/JIDs. Group chats are ignored by default. Cooldown and a global per-minute rate limit apply before automated replies. AI is used only when no custom/legacy rule matches; pause stops all automatic replies. Runtime metrics are local and reset when the process restarts. Test automation in a separate chat before enabling it for real customers.

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
