import {rename} from 'node:fs/promises';
import path from 'node:path';

export const PAIRING_STAGES = Object.freeze({
  IDLE:'idle', WAITING_SOCKET:'menunggu-socket', WAITING_CODE:'menunggu-kode',
  CODE_READY:'kode-siap', WAITING_CONFIRMATION:'menunggu-konfirmasi',
  CONNECTED:'terhubung', FAILED:'gagal'
});

export function isContaminatedUnregisteredSession(creds) {
  return Boolean(creds && creds.registered !== true);
}

export function staleSessionPath(sessionPath, timestamp = Date.now()) {
  return path.resolve(path.dirname(sessionPath), path.basename(sessionPath) + '.stale-' + timestamp);
}

export async function quarantineUnregisteredSession({sessionPath, readCreds, exists, renamePath = rename, now = Date.now}) {
  if (!(await exists(sessionPath))) return {moved:false, reason:'missing'};
  let creds;
  try { creds = await readCreds(path.join(sessionPath, 'creds.json')); }
  catch (error) {
    if (error && error.code === 'ENOENT') return {moved:false, reason:'no-creds'};
    throw error;
  }
  if (!isContaminatedUnregisteredSession(creds)) return {moved:false, reason:creds?.registered === true ? 'registered' : 'no-creds'};
  const target = staleSessionPath(sessionPath, now());
  await renamePath(sessionPath, target);
  return {moved:true, from:sessionPath, to:target};
}

export function safeDisconnectSummary(error, at = Date.now()) {
  const statusCode = Number.isFinite(error?.output?.statusCode) ? error.output.statusCode : null;
  const raw = String(error?.message || error?.data?.message || 'Koneksi terputus');
  const reason = raw.replace(/\b\+?\d{8,15}\b/g, '[nomor disamarkan]').replace(/(?:Bearer\s+)[^\s]+/ig, 'Bearer [disamarkan]').slice(0, 180);
  return {statusCode, reason, at};
}

export function createPairingController({socket, phoneNumber, onCode, onStage, timeoutMs = 15000, waitForSocketOpen}) {
  let requested = false;
  let timer = null;
  const setStage = (stage, error) => onStage?.(stage, error);
  const requestOnce = async () => {
    if (requested) return;
    requested = true;
    setStage(PAIRING_STAGES.WAITING_CODE);
    try {
      if (waitForSocketOpen) await Promise.race([
        waitForSocketOpen(socket),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Waktu tunggu koneksi habis sebelum socket terbuka.')), timeoutMs); })
      ]);
      const code = await Promise.race([
        socket.requestPairingCode(phoneNumber),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Permintaan kode pairing melewati batas waktu. Coba ulangi pairing.')), timeoutMs); })
      ]);
      if (!code) throw new Error('WhatsApp tidak mengembalikan kode pairing.');
      clearTimeout(timer);
      onCode?.(String(code).match(/.{1,4}/g)?.join('-') || String(code));
      setStage(PAIRING_STAGES.CODE_READY);
    } catch (error) {
      clearTimeout(timer);
      setStage(PAIRING_STAGES.FAILED, error?.message || 'Gagal meminta kode pairing.');
    }
  };
  const onUpdate = update => {
    if (update?.qr) void requestOnce();
    if (update?.connection === 'open') { clearTimeout(timer); setStage(PAIRING_STAGES.CONNECTED); }
    if (update?.connection === 'close') { clearTimeout(timer); setStage(PAIRING_STAGES.FAILED, 'Socket WhatsApp terputus sebelum pairing selesai.'); }
  };
  socket.ev.on('connection.update', onUpdate);
  return {dispose() { clearTimeout(timer); socket.ev.off?.('connection.update', onUpdate); }, hasRequested:()=>requested};
}
