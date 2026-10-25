import {startWhatsApp,stopWhatsApp,getSock,getCurrentState,isConnected,getQRCode,getPairingCode} from '../../../../packages/whatsapp-engine/src/engine.js';
let controllerState='stopped',lastError=null,startTime=null;
export const getControllerState=()=>controllerState;
export const getLastError=()=>lastError;
export async function startRuntime(options={}){try{controllerState='starting';lastError=null;startTime=Date.now();await startWhatsApp('main',options);controllerState='running';return{status:'started',state:controllerState,time:Date.now()};}catch(error){controllerState='failed';lastError=error.message||String(error);return{status:'failed',error:lastError,state:controllerState};}}
export async function stopRuntime(){try{controllerState='stopping';await stopWhatsApp();controllerState='stopped';return{status:'stopped',state:controllerState,time:Date.now()};}catch(error){controllerState='failed';lastError=error.message||String(error);return{status:'failed',error:lastError,state:controllerState};}}
export async function restartRuntime(options={}){const stop=await stopRuntime();const start=await startRuntime(options);return{status:'restarted',stop,start,state:controllerState};}
export function getHealth(){return{controller:controllerState,whatsapp:getCurrentState(),connected:isConnected(),sockExists:getSock()!==null,startTime,uptimeSec:startTime?Math.round((Date.now()-startTime)/1000):0,lastError};}
export function getWhatsAppStatus(){return{state:getCurrentState(),connected:isConnected(),qr:getQRCode(),pairing:getPairingCode(),sessionId:'main'};}
