import {startWhatsApp,stopWhatsApp,getSock,getCurrentState,isConnected,getQRCode,getPairingCode} from '../../../../packages/whatsapp-engine/src/engine.js';
import {createSerialExecutor} from './serial-operations.js';

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
  return {state:getCurrentState(),connected:isConnected(),qr:getQRCode(),pairing:getPairingCode(),sessionId:'main'};
}
