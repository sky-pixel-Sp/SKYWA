import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createPairingController, decideAfterClose, isContaminatedUnregisteredSession, quarantineUnregisteredSession, safeDisconnectSummary} from '../../packages/whatsapp-engine/src/pairing-controller.js';

function fakeSocket() {
 const ev = new EventEmitter(); let calls=0;
 return {ev, get calls(){return calls;}, async requestPairingCode(){calls++; return 'ABCD1234';}};
}
test('does not request pairing code on connecting or close', async()=>{
 const socket=fakeSocket(); const stages=[];
 createPairingController({socket,phoneNumber:'6281234567890',onStage:s=>stages.push(s)});
 socket.ev.emit('connection.update',{connection:'connecting'});
 socket.ev.emit('connection.update',{connection:'close'});
 await new Promise(r=>setImmediate(r));
 assert.equal(socket.calls,0);
});
test('requests pairing exactly once when qr arrives', async()=>{
 const socket=fakeSocket(); const codes=[];
 createPairingController({socket,phoneNumber:'6281234567890',onCode:c=>codes.push(c)});
 socket.ev.emit('connection.update',{qr:'registration-ready'});
 socket.ev.emit('connection.update',{qr:'another-update'});
 await new Promise(r=>setImmediate(r));
 assert.equal(socket.calls,1); assert.deepEqual(codes,['ABCD-1234']);
});
test('unregistered session with creds.me is contaminated',()=>assert.equal(isContaminatedUnregisteredSession({me:{id:'masked'},registered:false}),true));
test('registered session is never quarantined',async()=>{
 let renamed=false;
 const result=await quarantineUnregisteredSession({sessionPath:'/sessions/main',readCreds:async()=>({registered:true,me:{id:'masked'}}),exists:async()=>true,renamePath:async()=>{renamed=true;}});
 assert.equal(result.moved,false); assert.equal(renamed,false); assert.equal(result.reason,'registered');
});
test('quarantines unregistered session including creds.me without deleting it',async()=>{
 let target='';
 const result=await quarantineUnregisteredSession({sessionPath:'/sessions/main',readCreds:async()=>({registered:false,me:{id:'masked'}}),exists:async()=>true,renamePath:async(a,b)=>{target=b;},now:()=>123});
 assert.equal(result.moved,true); assert.equal(target,'/sessions/main.stale-123');
});
test('disconnect summary retains status and safe reason',()=>{
 const summary=safeDisconnectSummary({output:{statusCode:401},message:'logged out from +6281234567890'},123);
 assert.equal(summary.statusCode,401); assert.equal(summary.at,123); assert.match(summary.reason,/nomor disamarkan/);
});

test('515 after credentials register reconnects immediately without failed stage',()=>{
 const result=decideAfterClose({statusCode:515,registeredNow:true,retries:0,maxRetries:10,maxPairingRetries:3});
 assert.deepEqual(result,{action:'reconnect-immediately',stage:'menyelesaikan-penautan'});
});
test('401 stops reconnect attempts',()=>{
 assert.equal(decideAfterClose({statusCode:401,registeredNow:false,retries:0}).action,'stop');
});
test('retry boundary stops unregistered pairing after configured limit',()=>{
 assert.equal(decideAfterClose({statusCode:500,registeredNow:false,retries:3,maxRetries:10,maxPairingRetries:3}).action,'stop');
});
test('515 while unregistered is an immediate restart, not a failure',()=>{
 assert.deepEqual(decideAfterClose({statusCode:515,registeredNow:false,retries:0}),{action:'reconnect-immediately',stage:'menunggu-socket'});
});
