# SKYWA CI and source status

The Android app contains a native control panel for its embedded Android Node.js runtime, with explicit runtime start/stop controls. The backend exposes health/status, WhatsApp pairing, send-message and basic auto-reply configuration endpoints.

CI checks JavaScript syntax and unit tests, assembles a debug APK, and verifies the APK's package ID before uploading the artifact. Always check the current Actions run; the existence of this workflow is not proof that a build succeeded.

Known limitations: a live WhatsApp pairing and message delivery have not been run by CI. APK installation, Android-to-Termux loopback communication, and background behavior must still be tested on the target phone. The project source is a reconstruction of the key files, not a byte-for-byte import of the original ZIP.

Never commit .env files, WhatsApp session credentials, API keys, or session/auth-state directories.


## v1.5.0 scope
- Bottom navigation separates Home, WhatsApp, Automation and AI settings.
- Runtime ON/OFF is a dedicated Android service action, distinct from WhatsApp connect/disconnect.
- CI covers syntax, automation/AI unit tests, APK packaging and runtime bundle fingerprint inclusion; only physical-device testing can confirm service process teardown/startup, WhatsApp pairing, delivery and screen-off behavior.
