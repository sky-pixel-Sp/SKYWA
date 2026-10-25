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
    for (const key of ['startWhatsApp','stopWhatsApp','logoutWhatsApp','getSock','sendMessage','sendText','setState','getAutoReplyConfig','setAutoReplyConfig']) {
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

  test('auto-reply is off by default and validates enabled config', () => {
    assert.deepEqual(engine.getAutoReplyConfig(), {enabled:false, trigger:'', reply:''});
    assert.throws(() => engine.setAutoReplyConfig({enabled:true, trigger:'hi', reply:''}), /reply is required/);
    assert.deepEqual(engine.setAutoReplyConfig({enabled:true, trigger:'hi', reply:'Hello there'}), {enabled:true, trigger:'hi', reply:'Hello there'});
    assert.deepEqual(engine.setAutoReplyConfig({enabled:false, trigger:'', reply:''}), {enabled:false, trigger:'', reply:''});
  });
});
