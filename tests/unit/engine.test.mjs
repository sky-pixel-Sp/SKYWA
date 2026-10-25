import {describe, test} from 'node:test';
import assert from 'node:assert/strict';
const engine = await import('../../packages/whatsapp-engine/src/engine.js');

describe('SKYWA WhatsApp engine', () => {
  test('exposes required lifecycle states', () => {
    for (const key of ['DISCONNECTED','STARTING','CONNECTING','QR_PENDING','PAIRING','CONNECTED','RECONNECTING','STOPPING','ERROR']) {
      assert.equal(typeof engine.ConnectionState[key], 'string');
    }
  });

  test('starts disconnected with empty pairing data', () => {
    assert.equal(engine.getCurrentState(), engine.ConnectionState.DISCONNECTED);
    assert.equal(engine.isConnected(), false);
    assert.equal(engine.getQRCode(), null);
    assert.equal(engine.getPairingCode(), null);
  });

  test('exports lifecycle functions', () => {
    for (const key of ['startWhatsApp','stopWhatsApp','logoutWhatsApp','getSock','sendMessage','sendText','setState','getAutoReplyConfig','setAutoReplyConfig','getAutomationConfig','setAutomationConfig','getAutomationStats','resetAutomationStats']) {
      assert.equal(typeof engine[key], 'function');
    }
  });

  test('rejects sends while disconnected', async () => {
    await assert.rejects(() => engine.sendMessage('123@s.whatsapp.net', {text:'hello'}), /Not connected/);
  });

  test('validates recipient and text', async () => {
    await assert.rejects(() => engine.sendText('', 'hello'), /jid/);
    await assert.rejects(() => engine.sendText('123@s.whatsapp.net', ' '), /text/);
  });

  test('automation guardrails default to safe settings and validate rule sets', () => {
    const defaults = engine.getAutomationConfig();
    assert.equal(defaults.rulesEnabled, false);
    assert.equal(defaults.ignoreGroups, true);
    assert.equal(defaults.cooldownSeconds, 10);
    const saved = engine.setAutomationConfig({
      rulesEnabled: true,
      rules: [{id:'price', matchType:'contains', keywords:['harga', 'price'], reply:'Silakan sebut produk.'}],
      cooldownSeconds: 12,
      maxRepliesPerMinute: 5
    });
    assert.equal(saved.rulesEnabled, true);
    assert.equal(saved.rules.length, 1);
    assert.deepEqual(saved.rules[0].keywords, ['harga', 'price']);
    engine.setAutomationConfig({
      rulesEnabled:false, paused:false, ignoreGroups:true, allowlist:[], blocklist:[],
      cooldownSeconds:10, maxRepliesPerMinute:8, activeHoursEnabled:false,
      activeStart:'08:00', activeEnd:'21:00', rules:[]
    });
  });

  test('auto-reply is off by default and validates enabled config', () => {
    assert.deepEqual(engine.getAutoReplyConfig(), {enabled:false, trigger:'', reply:''});
    assert.throws(() => engine.setAutoReplyConfig({enabled:true, trigger:'hi', reply:''}), /reply is required/);
    assert.deepEqual(engine.setAutoReplyConfig({enabled:true, trigger:'hi', reply:'Hello there'}), {enabled:true, trigger:'hi', reply:'Hello there'});
    assert.deepEqual(engine.setAutoReplyConfig({enabled:false, trigger:'', reply:''}), {enabled:false, trigger:'', reply:''});
  });
});
