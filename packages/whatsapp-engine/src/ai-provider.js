const DEFAULTS = Object.freeze({
  enabled: false,
  provider: 'openrouter',
  apiKey: '',
  model: 'openai/gpt-4o-mini',
  baseUrl: 'http://127.0.0.1:11434/v1',
  fallbackEnabled: false,
  fallbackProvider: 'gemini',
  fallbackApiKey: '',
  fallbackModel: 'gemini-2.5-flash',
  systemPrompt: 'Kamu adalah asisten WhatsApp yang ramah, jelas, ringkas, dan menjawab dalam bahasa pengguna. Jangan mengarang informasi. Jika tidak tahu, katakan terus terang.',
  maxTokens: 350,
  temperature: 0.6
});
const PROVIDERS = new Set(['openrouter', 'gemini', 'local']);

function boundedString(value, fallback, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback;
}

function validateEndpoint(value) {
  let parsed;
  try { parsed = new URL(value); } catch { parsed = null; }
  if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) {
    throw new TypeError('Endpoint lokal harus berupa URL HTTP atau HTTPS yang valid');
  }
  return value.replace(/\/+$/, '');
}

function normalizeProvider(value, fallback = 'openrouter') {
  return PROVIDERS.has(value) ? value : fallback;
}

function validateProviderCredentials(provider, apiKey, enabled, label) {
  if (enabled && provider !== 'local' && !apiKey) {
    throw new TypeError('API key ' + (label || provider) + ' wajib diisi sebelum provider diaktifkan');
  }
}

export function normalizeAIConfig(input = {}) {
  const provider = normalizeProvider(input.provider);
  const apiKey = boundedString(input.apiKey, '', 500);
  const model = boundedString(input.model, DEFAULTS.model, 160);
  const baseUrl = boundedString(input.baseUrl, DEFAULTS.baseUrl, 500);
  const systemPrompt = boundedString(input.systemPrompt, DEFAULTS.systemPrompt, 4000);
  const fallbackEnabled = input.fallbackEnabled === true;
  const fallbackProvider = normalizeProvider(input.fallbackProvider, 'gemini');
  const fallbackApiKey = boundedString(input.fallbackApiKey, '', 500);
  const fallbackModel = boundedString(input.fallbackModel, 'gemini-2.5-flash', 160);
  const enabled = input.enabled === true;
  const maxTokens = Number.isFinite(Number(input.maxTokens)) ? Math.min(1200, Math.max(64, Math.round(Number(input.maxTokens)))) : DEFAULTS.maxTokens;
  const temperature = Number.isFinite(Number(input.temperature)) ? Math.min(1.5, Math.max(0, Number(input.temperature))) : DEFAULTS.temperature;

  if (!model) throw new TypeError('Model AI tidak boleh kosong');
  if (provider === 'local') validateEndpoint(baseUrl);
  validateProviderCredentials(provider, apiKey, enabled, provider === 'gemini' ? 'Gemini' : 'OpenRouter');
  if (fallbackEnabled) {
    if (fallbackProvider === provider) throw new TypeError('Provider fallback harus berbeda dari provider utama');
    if (!fallbackModel) throw new TypeError('Model fallback tidak boleh kosong');
    if (fallbackProvider === 'local') validateEndpoint(baseUrl);
    validateProviderCredentials(fallbackProvider, fallbackApiKey, enabled, fallbackProvider === 'gemini' ? 'Gemini fallback' : 'OpenRouter fallback');
  }
  return {enabled, provider, apiKey, model, baseUrl, fallbackEnabled, fallbackProvider, fallbackApiKey, fallbackModel, systemPrompt, maxTokens, temperature};
}

function openAICompatibleRequest(provider, config, userText, history) {
  const baseUrl = provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : config.baseUrl;
  return {
    url: baseUrl.endsWith('/chat/completions') ? baseUrl : baseUrl + '/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      ...(provider === 'openrouter' ? {
        Authorization: 'Bearer ' + config.apiKey,
        'HTTP-Referer': 'https://github.com/sky-pixel-Sp/SKYWA',
        'X-Title': 'SKYWA WhatsApp Bot Studio'
      } : {})
    },
    body: {
      model: config.model,
      messages: [
        {role: 'system', content: config.systemPrompt},
        ...history,
        {role: 'user', content: userText}
      ],
      max_tokens: config.maxTokens,
      temperature: config.temperature
    }
  };
}

function buildProviderRequest(provider, config, userText, history) {
  if (provider !== 'gemini') return openAICompatibleRequest(provider, config, userText, history);
  const contents = [
    ...history.map(item => ({role: item.role === 'assistant' ? 'model' : 'user', parts: [{text: item.content}]})),
    {role: 'user', parts: [{text: userText}]}
  ];
  const systemInstruction = config.systemPrompt ? {parts: [{text: config.systemPrompt}]} : undefined;
  const query = new URLSearchParams({key: config.apiKey});
  return {
    url: 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(config.model) + ':generateContent?' + query.toString(),
    headers: {'Content-Type': 'application/json'},
    body: {
      contents,
      ...(systemInstruction ? {systemInstruction} : {}),
      generationConfig: {maxOutputTokens: config.maxTokens, temperature: config.temperature}
    }
  };
}

export function buildAIRequest(config, userText, history = []) {
  const normalized = normalizeAIConfig({...config, enabled: false, apiKey: config.apiKey || 'local', fallbackEnabled: false});
  const provider = normalized.provider;
  const safeHistory = Array.isArray(history)
    ? history.slice(-12).filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
      .map(m => ({role: m.role, content: m.content.slice(0, 3000)}))
    : [];
  const requestConfig = {...normalized, apiKey: config.apiKey || ''};
  if (provider === 'gemini') requestConfig.apiKey = config.apiKey || '';
  return buildProviderRequest(provider, requestConfig, String(userText).slice(0, 6000), safeHistory);
}

async function callProvider(provider, config, userText, history, fetcher) {
  const providerConfig = {...config, provider, model: provider === config.provider ? config.model : config.fallbackModel,
    apiKey: provider === config.provider ? config.apiKey : config.fallbackApiKey};
  const request = buildProviderRequest(provider, providerConfig, userText, history);
  const response = await fetcher(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(request.body),
    signal: AbortSignal.timeout(25000)
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
  if (!response.ok) {
    const message = data?.error?.message || data?.message || data?.error || ('HTTP ' + response.status);
    throw new Error(provider + ' gagal: ' + String(message).slice(0, 220));
  }
  const answer = provider === 'gemini'
    ? data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('')
    : data?.choices?.[0]?.message?.content;
  if (typeof answer !== 'string' || !answer.trim()) throw new Error(provider + ' tidak mengembalikan teks jawaban');
  return answer.trim().slice(0, 4000);
}

export async function generateAIReply(config, userText, options = {}) {
  if (!config || config.enabled !== true) throw new Error('AI auto-reply belum diaktifkan');
  if (typeof userText !== 'string' || !userText.trim()) throw new TypeError('Pesan pengguna kosong');
  const normalized = normalizeAIConfig(config);
  const fetcher = options.fetch || globalThis.fetch;
  if (typeof fetcher !== 'function') throw new Error('HTTP fetch tidak tersedia pada runtime ini');
  const history = Array.isArray(options.history)
    ? options.history.slice(-12).filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
      .map(m => ({role: m.role, content: m.content.slice(0, 3000)}))
    : [];
  try {
    return await callProvider(normalized.provider, normalized, userText.trim().slice(0, 6000), history, fetcher);
  } catch (primaryError) {
    if (!normalized.fallbackEnabled) throw primaryError;
    try {
      const answer = await callProvider(normalized.fallbackProvider, normalized, userText.trim().slice(0, 6000), history, fetcher);
      return answer;
    } catch (fallbackError) {
      throw new Error('Provider utama dan fallback gagal. Utama: ' + String(primaryError.message).slice(0, 180) + '; fallback: ' + String(fallbackError.message).slice(0, 180));
    }
  }
}

export const DEFAULT_AI_CONFIG = DEFAULTS;
