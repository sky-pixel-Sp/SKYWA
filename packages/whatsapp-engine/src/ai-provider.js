const DEFAULTS = Object.freeze({
  enabled: false, provider: 'openrouter', apiKey: '', model: 'openai/gpt-4o-mini',
  baseUrl: 'http://127.0.0.1:11434/v1',
  systemPrompt: 'Kamu adalah asisten WhatsApp yang ramah, jelas, ringkas, dan menjawab dalam bahasa pengguna. Jangan mengarang informasi. Jika tidak tahu, katakan terus terang.',
  maxTokens: 350, temperature: 0.6
});
export function normalizeAIConfig(input = {}) {
  const provider = input.provider === 'local' ? 'local' : 'openrouter';
  const model = typeof input.model === 'string' ? input.model.trim().slice(0,160) : DEFAULTS.model;
  const baseUrl = typeof input.baseUrl === 'string' ? input.baseUrl.trim().replace(/\/+$/, '').slice(0,500) : DEFAULTS.baseUrl;
  const systemPrompt = typeof input.systemPrompt === 'string' ? input.systemPrompt.trim().slice(0,4000) : DEFAULTS.systemPrompt;
  const apiKey = typeof input.apiKey === 'string' ? input.apiKey.trim().slice(0,500) : '';
  const maxTokens = Number.isFinite(Number(input.maxTokens)) ? Math.min(1200,Math.max(64,Math.round(Number(input.maxTokens)))) : DEFAULTS.maxTokens;
  const temperature = Number.isFinite(Number(input.temperature)) ? Math.min(1.5,Math.max(0,Number(input.temperature))) : DEFAULTS.temperature;
  if (!model) throw new TypeError('Model AI tidak boleh kosong');
  if (provider === 'openrouter' && input.enabled === true && !apiKey && input.hasApiKey !== true) throw new TypeError('API key OpenRouter wajib diisi sebelum AI diaktifkan');
  if (provider === 'local' && !baseUrl) throw new TypeError('URL endpoint lokal wajib diisi');
  let parsed; try { parsed = new URL(baseUrl); } catch { parsed = null; }
  if (provider === 'local' && (!parsed || !['http:','https:'].includes(parsed.protocol))) throw new TypeError('Endpoint lokal harus berupa URL HTTP atau HTTPS yang valid');
  return {enabled:input.enabled===true,provider,apiKey,model,baseUrl,systemPrompt,maxTokens,temperature};
}
export function buildAIRequest(config,userText,history=[]) {
  const normalized=normalizeAIConfig({...config,enabled:false,apiKey:config.apiKey||'local'});
  const baseUrl=normalized.provider==='openrouter'?'https://openrouter.ai/api/v1':normalized.baseUrl;
  return {url:baseUrl.endsWith('/chat/completions')?baseUrl:baseUrl+'/chat/completions',
    headers:{'Content-Type':'application/json',...(normalized.provider==='openrouter'?{Authorization:'Bearer '+config.apiKey,'HTTP-Referer':'https://github.com/sky-pixel-Sp/SKYWA','X-Title':'SKYWA WhatsApp Bot Studio'}:{})},
    body:{model:normalized.model,messages:[{role:'system',content:normalized.systemPrompt},...(Array.isArray(history)?history.slice(-12).filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').map(m=>({role:m.role,content:m.content.slice(0,3000)})):[]),{role:'user',content:String(userText).slice(0,6000)}],max_tokens:normalized.maxTokens,temperature:normalized.temperature}};
}
export async function generateAIReply(config,userText,options={}) {
  if(!config||config.enabled!==true)throw new Error('AI auto-reply belum diaktifkan');
  if(typeof userText!=='string'||!userText.trim())throw new TypeError('Pesan pengguna kosong');
  const request=buildAIRequest(config,userText.trim(),options.history||[]); const fetcher=options.fetch||globalThis.fetch;
  if(typeof fetcher!=='function')throw new Error('HTTP fetch tidak tersedia pada runtime ini');
  const response=await fetcher(request.url,{method:'POST',headers:request.headers,body:JSON.stringify(request.body),signal:AbortSignal.timeout(25000)});
  const raw=await response.text(); let data; try{data=raw?JSON.parse(raw):{};}catch{data={};}
  if(!response.ok)throw new Error('AI provider gagal: '+String(data?.error?.message||data?.message||('HTTP '+response.status)).slice(0,240));
  const answer=data?.choices?.[0]?.message?.content;
  if(typeof answer!=='string'||!answer.trim())throw new Error('Provider AI tidak mengembalikan teks jawaban');
  return answer.trim().slice(0,4000);
}
export const DEFAULT_AI_CONFIG=DEFAULTS;
