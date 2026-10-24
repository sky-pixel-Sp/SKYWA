# SKYWA CI and source status

This branch reconstructs key source files from the available SKYWA-CI-Ready archive through GitHub's file API. This is not a byte-for-byte import of the full ZIP archive.

The Actions workflow installs Node dependencies, runs syntax checks and unit tests, builds a debug APK, and verifies its package metadata. Check the Actions tab for a real run before claiming success.

Known gap: the Android WebView expects app/src/main/assets/www/index.html, which was absent from the source archive. Frontend build output and Android-to-Termux integration need further work. No live WhatsApp pairing or delivery test is claimed.

Never commit .env files, session credentials, API keys, or WhatsApp auth state.
