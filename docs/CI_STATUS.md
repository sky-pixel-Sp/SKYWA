# SKYWA CI and source status

The Android app contains a native control panel for its embedded Android Node.js runtime, with explicit runtime start/stop controls. The backend exposes health/status, WhatsApp pairing, send-message and basic auto-reply configuration endpoints.

CI checks JavaScript syntax and unit tests, assembles a debug APK, and verifies the APK's package ID before uploading the artifact. Always check the current Actions run; the existence of this workflow is not proof that a build succeeded.

Known limitations: a live WhatsApp pairing and message delivery have not been run by CI. APK installation, Android-to-Termux loopback communication, and background behavior must still be tested on the target phone. The project source is a reconstruction of the key files, not a byte-for-byte import of the original ZIP.

Never commit .env files, WhatsApp session credentials, API keys, or session/auth-state directories.


## v1.5.0 scope
- Bottom navigation separates Home, WhatsApp, Automation and AI settings.
- Runtime ON/OFF is a dedicated Android service action, distinct from WhatsApp connect/disconnect.
- CI covers syntax, automation/AI unit tests, APK packaging and runtime bundle fingerprint inclusion; only physical-device testing can confirm service process teardown/startup, WhatsApp pairing, delivery and screen-off behavior.

## v1.7 hardening branch status

The branch `fix/audit-v1.7-hardening` adds an installation-scoped local API token, a shared authenticated Android HTTP client, strict loopback cleartext policy, local-provider API-key isolation, reconnect timer cancellation, serialized lifecycle operations, gated command replies, cooldown reservations, atomic settings persistence, and endpoint integration tests.

The Android Gradle configuration is the source of truth for `versionName` and `versionCode`; the preparation script stamps those values into the embedded runtime and the APK verification script compares the packaged metadata. CI artifact names include version and commit SHA. The repository download branch is published only from `release/v1.7`, after successful verification.

Status classifications must stay separate: a green CI run means automated tests/build/metadata checks passed; it does not mean the APK was installed or tested on a physical Android device, WhatsApp pairing succeeded, messages were delivered, or background reliability was proven.
