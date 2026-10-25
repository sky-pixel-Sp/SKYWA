import {describe, test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAIConfig, buildAIRequest, generateAIReply} from '../../packages/whatsapp-engine/src/ai-provider.js';

describe('SKYWA AI provider', () => {
  test('defaults to disabled OpenRouter', () => {
    const c = normalizeAIConfig({});
    assert.equal(c.provider, 'openrouter');
    assert.equal(c.enabled, false);
    assert.equal(c.model, 'openai/gpt-4o-mini');
  });

  test('requires provider API key before enabling cloud provider', () => {
    assert.throws(() => normalizeAIConfig({enabled:true, provider:'openrouter'}), /API key OpenRouter/);
    assert.throws(() => normalizeAIConfig({enabled:true, provider:'gemini'}), /API key Gemini/);
  });

  test('builds OpenRouter chat completion request', () => {
    const r = buildAIRequest({provider:'openrouter', apiKey:'test-key', model:'openai/gpt-4o-mini', systemPrompt:'Be clear'}, 'hello');
    assert.equal(r.url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(r.headers.Authorization, 'Bearer test-key');
    assert.equal(r.body.messages[1].content, 'hello');
  });

  test('builds Gemini generateContent request without OpenRouter headers', () => {
    const r = buildAIRequest({provider:'gemini', apiKey:'gem-key', model:'gemini-2.5-flash', systemPrompt:'Be concise'}, 'halo');
    assert.match(r.url, /generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-2\.5-flash:generateContent\?key=gem-key/);
    assert.equal(r.url.includes('gem-key'), false);\n    assert.equal(r.headers['x-goog-api-key'], 'gem-key');\n    assert.equal(r.body.contents[0].parts[0].text, 'halo');
    assert.equal(r.body.systemInstruction.parts[0].text, 'Be concise');
    assert.equal('Authorization' in r.headers, false);
  });

  test('local requests never receive a cloud API key', () => {
    const r = buildAIRequest({provider:'local', apiKey:'openrouter-secret-must-not-leak', model:'qwen2.5:3b', baseUrl:'http://127.0.0.1:11434/v1'}, 'halo');
    assert.equal(r.url, 'http://127.0.0.1:11434/v1/chat/completions');
    assert.equal('Authorization' in r.headers, false);
    assert.equal(JSON.stringify(r.headers).includes('openrouter-secret-must-not-leak'), false);
  });

  test('parses Gemini response payload', async () => {
    const config = {enabled:true, provider:'gemini', apiKey:'gem-key', model:'gemini-2.5-flash'};
    const answer = await generateAIReply(config, 'halo', {fetch:async () => new Response(JSON.stringify({candidates:[{content:{parts:[{text:' Hai! '}]}}]}), {status:200})});
    assert.equal(answer, 'Hai!');
  });

  test('falls back to Gemini when OpenRouter fails', async () => {
    const config = {enabled:true, provider:'openrouter', apiKey:'primary-key', model:'openai/gpt-4o-mini', fallbackEnabled:true, fallbackProvider:'gemini', fallbackApiKey:'fallback-key', fallbackModel:'gemini-2.5-flash'};
    let calls = 0;
    const answer = await generateAIReply(config, 'hello', {fetch:async (url) => {
      calls += 1;
      if (calls === 1) return new Response(JSON.stringify({error:{message:'rate limited'}}), {status:429});
      assert.match(url, /generativelanguage\.googleapis\.com/);
      return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'fallback answer'}]}}]}), {status:200});
    }});
    assert.equal(answer, 'fallback answer');
    assert.equal(calls, 2);
  });

  test('does not allow same primary and fallback provider', () => {
    assert.throws(() => normalizeAIConfig({enabled:true, provider:'gemini', apiKey:'key', fallbackEnabled:true, fallbackProvider:'gemini', fallbackApiKey:'key'}), /harus berbeda/);
  });

  test('returns useful error if primary and fallback both fail', async () => {
    const config = {enabled:true, provider:'openrouter', apiKey:'primary-key', fallbackEnabled:true, fallbackProvider:'gemini', fallbackApiKey:'fallback-key'};
    await assert.rejects(() => generateAIReply(config, 'hello', {fetch:async () => new Response(JSON.stringify({error:{message:'offline'}}), {status:503})}), /utama dan fallback gagal/);
  });
});
