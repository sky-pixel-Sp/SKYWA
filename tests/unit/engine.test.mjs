import {describe,test} from 'node:test';
import assert from 'node:assert/strict';
const engine=await import('../../packages/whatsapp-engine/src/engine.js');
describe('SKYWA WhatsApp engine',()=>{
 test('exposes required lifecycle states',()=>{for(const k of ['DISCONNECTED','STARTING','CONNECTING','QR_PENDING','PAIRING','CONNECTED','RECONNECTING','STOPPING','ERROR'])assert.equal(typeof engine.ConnectionState[k],'string');});
 test('starts disconnected with empty pairing data',()=>{assert.equal(engine.getCurrentState(),engine.ConnectionState.DISCONNECTED);assert.equal(engine.isConnected(),false);assert.equal(engine.getQRCode(),null);assert.equal(engine.getPairingCode(),null);});
 test('exports lifecycle functions',()=>{for(const k of ['startWhatsApp','stopWhatsApp','logoutWhatsApp','getSock','sendMessage','sendText','setState'])assert.equal(typeof engine[k],'function');});
 test('rejects sends while disconnected',async()=>{await assert.rejects(()=>engine.sendMessage('123@s.whatsapp.net',{text:'hello'}),/Not connected/);});
 test('validates recipient and text',async()=>{await assert.rejects(()=>engine.sendText('','hello'),/jid/);await assert.rejects(()=>engine.sendText('123@s.whatsapp.net',' '),/text/);});
});
