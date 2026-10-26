import {startWhatsApp,stopWhatsApp,getSock,getCurrentState,isConnected,getQRCode,getPairingCode,getPairingDiagnostics,resetPairingDiagnostics} from '../../../../packages/whatsapp-engine/src/engine.js';
import {createSerialExecutor} from './serial-operations.js';
import {access, readFile, rename} from 'node:fs/promises';
import path from 'node:path';
import {quarantineUnregisteredSession, normalizePairingPhoneNumber, assertPairingResetAllowed} from '../../../../packages/whatsapp-engine/src/pairing-controller.js';

let controllerState='stopped',lastError=null,startTime=null;
const serializeOperation=createSerialExecutor();
export const getControllerState=()=>controllerState;
export const getLastError=()=>lastError;

async function startRuntimeNow(options={}) {
  try {
    controllerState='starting'; lastError=null; startTime=Date.now();
    await startWhatsApp('main',options);
    controllerState='running';
    return {status:'started',state:controllerState,time:Date.now()};
  } catch(error) {
    controllerState='failed'; lastError=error.message||String(error);
    return {status:'failed',error:lastError,state:controllerState};
  }
}
async function stopRuntimeNow() {
  try {
    controllerState='stopping';
    await stopWhatsApp();
    controllerState='stopped';
    return {status:'stopped',state:controllerState,time:Date.now()};
  } catch(error) {
    controllerState='failed'; lastError=error.message||String(error);
    return {status:'failed',error:lastError,state:controllerState};
  }
}
export function startRuntime(options={}) { return serializeOperation(()=>startRuntimeNow(options)); }
export function stopRuntime() { return serializeOperation(()=>stopRuntimeNow()); }
export function restartRuntime(options={}) {
  return serializeOperation(async()=>{
    const stop=await stopRuntimeNow();
    const start=await startRuntimeNow(options);
    return {status:'restarted',stop,start,state:controllerState};
  });
}
export function getHealth() {
  return {controller:controllerState,whatsapp:getCurrentState(),connected:isConnected(),sockExists:getSock()!==null,startTime,uptimeSec:startTime?Math.round((Date.now()-startTime)/1000):0,lastError};
}
export function getWhatsAppStatus() {
  return {state:getCurrentState(),connected:isConnected(),qr:getQRCode(),pairing:getPairingCode(),sessionId:'main', ...getPairingDiagnostics()};
}
export function resetUnregisteredPairingSession(phoneNumber) {
  return serializeOperation(async()=>{
    const normalized=normalizePairingPhoneNumber(phoneNumber);
    const liveCreds=getSock()?.authState?.creds;
    assertPairingResetAllowed(liveCreds);
    const sessionPath=path.resolve('./data/sessions/main');
    let creds=null;
    try {
      creds=JSON.parse(await readFile(path.join(sessionPath,'creds.json'),'utf8'));
    } catch(error) {
      if(error?.code!=='ENOENT') throw new Error('Kredensial sesi tidak dapat dibaca; reset dibatalkan agar data sesi tetap aman.');
    }
    assertPairingResetAllowed(creds);
    const stopped=await stopRuntimeNow();
    if(stopped.status==='failed') throw new Error('Runtime tidak berhasil berhenti; sesi pairing tidak diubah.');
    const quarantine=await quarantineUnregisteredSession({
      sessionPath,
      exists:async p=>{try{await access(p);return true;}catch(error){if(error?.code==='ENOENT')return false;throw error;}},
      readCreds:async p=>JSON.parse(await readFile(p,'utf8')),
      renamePath:rename
    });
    resetPairingDiagnostics();
    const started=await startRuntimeNow({usePairingCode:true,phoneNumber:normalized});
    return {...started,pairingReset:{quarantined:quarantine.moved,reason:quarantine.reason||null}};
  });
}
