# SKYWA Android: crash recovery and AI providers

## AI modes
- **OpenRouter**: enter an OpenRouter API key and a model ID such as `openai/gpt-4o-mini`. The key is stored only in the app-private runtime database and is never returned by the settings API.
- **Local endpoint**: enter an OpenAI-compatible local server URL, for example `http://127.0.0.1:11434/v1`, and a model name served by it. This mode sends requests to that endpoint, not to OpenRouter. It is genuinely offline only when the local model server and model weights are already running/available on the device. This APK does not bundle multi-gigabyte model weights.
- AI auto-reply is opt-in. It only handles incoming text when enabled; the test action sends a prompt to the provider but never sends a WhatsApp message.
- Use a dedicated low-cost model, set a clear system prompt, and avoid enabling replies in sensitive group chats without testing.

## Troubleshooting a launch crash
1. Uninstall the older SKYWA preview before installing a new APK if Android reports a package/signature conflict.
2. Reboot once after installation if the embedded native runtime failed to initialize.
3. If it still closes immediately, collect the Android crash report from Settings > Apps > SKYWA > App details or capture `adb logcat` filtered by `AndroidRuntime`, `SKYWA-NodeService`, and `libnode`. A Java exception and a native SIGSEGV have different root causes; don't guess based on the UI alone.
4. CI can verify compilation and APK contents but cannot prove startup stability on a physical phone.


## v1.5.0 runtime toggle
The local server toggle uses an Android service action to request an explicit stop. The service tears down its wake lock and terminates the isolated runtime process because native Node `node::Start` blocks its runtime thread and `stopSelf` alone does not end that native event loop. The app stores the requested server state separately so ordinary status refreshes do not unexpectedly restart a user-stopped server.

## Local AI and privacy note

When AI auto-reply is enabled, incoming WhatsApp text and a limited conversation history may be sent to the selected AI provider for answer generation. Do not enable this for sensitive chats unless you accept the provider's data handling practices. Local-provider requests intentionally omit the OpenRouter Authorization header and do not receive the saved OpenRouter API key.
