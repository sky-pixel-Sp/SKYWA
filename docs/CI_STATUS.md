# SKYWA CI and source status

The Android app now contains a native control panel for the local Termux backend. The backend exposes health/status, WhatsApp pairing, send-message and basic auto-reply configuration endpoints.

CI checks JavaScript syntax and unit tests, assembles a debug APK, and verifies the APK's package ID before uploading the artifact. Always check the current Actions run; the existence of this workflow is not proof that a build succeeded.

Known limitations: a live WhatsApp pairing and message delivery have not been run by CI. APK installation, Android-to-Termux loopback communication, and background behavior must still be tested on the target phone. The project source is a reconstruction of the key files, not a byte-for-byte import of the original ZIP.

Never commit .env files, WhatsApp session credentials, API keys, or session/auth-state directories.
