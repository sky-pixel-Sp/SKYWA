# SKYWA WhatsApp Bot Studio

SKYWA is a native Android APK project for controlling the SKYWA WhatsApp automation engine.

## Product requirement

The intended product is **one installable Android APK**. Users must not need a website, browser, Termux, shell commands, or a separately running backend to use the bot. The APK must contain the compatible Node.js runtime, server, production dependencies, and native libraries needed to run the engine locally.

## Current implementation status — not standalone yet

The current source branch builds an Android APK, but its Android controller still calls `http://127.0.0.1:3000` and requires the Node.js backend to be started separately in Termux. Therefore, **an installable APK is not the same thing as a standalone APK**. Do not describe the current artifact as meeting the standalone requirement.

The source audit and acceptance criteria for removing the Termux dependency are tracked in [Standalone Android Runtime](docs/STANDALONE_ANDROID_RUNTIME.md).

## Existing features

- Android controller UI with system and WhatsApp status
- WhatsApp pairing-code flow
- Send text messages
- Keyword-based auto-reply configuration
- Baileys session persistence and reconnection logic
- JavaScript unit tests and a GitHub Actions workflow for APK build verification

These features are source-level capabilities; live WhatsApp pairing, delivery, and long-duration background stability require real-device testing.

## Build artifact

The Actions workflow currently creates a debug APK artifact. It should only be treated as a preview until the standalone runtime acceptance gates pass:

https://github.com/sky-pixel-Sp/SKYWA/actions

## Current preview setup (Termux required)

For the current preview only, the backend must be started in Termux on the same Android device. This is temporary and does not satisfy the intended final product requirement.

## Security and release requirements

- Keep WhatsApp session credentials and app settings in app-private storage; never bundle user credentials in the APK.
- Keep local API endpoints bound to loopback; do not expose the backend publicly.
- Test cold launch, pairing, outgoing messages, auto-reply, session persistence, and Android background restrictions on a physical device.
- Do not claim standalone operation or successful live WhatsApp tests until they have actually been verified.
