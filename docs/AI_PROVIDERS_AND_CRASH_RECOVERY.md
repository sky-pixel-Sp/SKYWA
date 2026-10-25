# SKYWA AI providers and fallback

## Supported providers

- **OpenRouter** — OpenAI-compatible chat completions endpoint. Configure a model ID and OpenRouter API key.
- **Google Gemini** — Gemini `generateContent` API. Configure a Gemini API key and a model ID such as `gemini-2.5-flash`.
- **Local endpoint** — an OpenAI-compatible server such as Ollama at `http://127.0.0.1:11434/v1`. The model must already be downloaded and running; SKYWA does not bundle local model weights.

## Automatic fallback

Enable fallback and select a provider different from the primary provider. If the primary request fails or returns no usable text, SKYWA attempts the fallback provider once. The fallback has its own model and API key. If both fail, the returned error includes bounded primary and fallback diagnostics. Fallback is disabled by default.

For a local fallback, SKYWA uses the configured local endpoint and the fallback model name. Cloud credentials are not added to local endpoint request headers. Gemini credentials are sent in the `x-goog-api-key` header, not the URL.

## Privacy and credentials

- AI is opt-in. When AI replies are enabled, incoming WhatsApp text and a limited conversation history may be sent to the configured provider.
- The AI settings endpoint never returns either stored API key; it returns boolean `hasApiKey` and `hasFallbackApiKey` indicators.
- API keys are currently stored in the app's local settings database. They are not encrypted at rest by the AI module itself; Android Keystore-backed encryption remains a production hardening requirement.
- Do not expose the local API server to public networks. The standalone runtime authenticates local API requests with an installation-specific token.

## Testing

The provider tests mock network responses and verify request formatting, response parsing, credential isolation, fallback activation, and combined failure behavior. These tests do not prove that a live API key is valid or that a live provider is reachable. Real WhatsApp pairing, delivery, and background stability require physical-device tests.
