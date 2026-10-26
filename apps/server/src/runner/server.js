import express from 'express';
import {timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'node:http';
import {initDB, getSetting, saveSetting} from '../database.js';
import * as controller from '../lib/runtimeController.js';
import {logoutWhatsApp, sendText, getAutoReplyConfig, setAutoReplyConfig, getAIConfig, setAIConfig, getAutomationConfig, setAutomationConfig, getAutomationStats, resetAutomationStats} from '../../../../packages/whatsapp-engine/src/engine.js';
import {normalizeAIConfig, generateAIReply} from '../../../../packages/whatsapp-engine/src/ai-provider.js';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const BIND = process.env.SKYWA_BIND || '127.0.0.1';
const API_TOKEN = typeof process.env.SKYWA_API_TOKEN === 'string' ? process.env.SKYWA_API_TOKEN : '';
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  if (!API_TOKEN) {
    return res.status(503).json({status:'unavailable', error:'Token keamanan API lokal belum dikonfigurasi. Restart runtime SKYWA dari aplikasi.'});
  }
  const suppliedBytes = Buffer.from(req.get('X-Skywa-Token') || '', 'utf8');
  const expectedBytes = Buffer.from(API_TOKEN, 'utf8');
  if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) {
    return res.status(401).json({status:'unauthorized', error:'Token API lokal tidak valid. Restart runtime dan buka ulang aplikasi SKYWA.'});
  }
  return next();
});
app.use(express.json({limit:'1mb'}));

app.get('/api/health', (_req, res) => {
  const h = controller.getHealth();
  return res.json({
    status: h.controller === 'running' ? 'healthy' : h.controller === 'failed' ? 'degraded' : 'starting',
    service: 'SKYWA',
    mode: 'standalone-android'
  });
});

app.get('/api/build', async (_req, res) => {
  let bundleVersion = 'unknown';
  let appVersion = 'unknown';
  let appVersionCode = null;
  try {
    bundleVersion = (await readFile(path.resolve(process.cwd(), 'skywa-bundle-version.txt'), 'utf8')).trim() || 'unknown';
  } catch (_) {
    // A source checkout may not have a staged runtime fingerprint.
  }
  try {
    appVersion = (await readFile(path.resolve(process.cwd(), 'skywa-app-version.txt'), 'utf8')).trim() || 'unknown';
    const codeText = (await readFile(path.resolve(process.cwd(), 'skywa-app-version-code.txt'), 'utf8')).trim();
    appVersionCode = /^\d+$/.test(codeText) ? Number(codeText) : null;
  } catch (_) {
    // A source checkout may not have Android build metadata staged.
  }
  return res.json({
    status: 'ok',
    appVersion,
    appVersionCode,
    bundleVersion,
    nodeVersion: process.version,
    uptime: Math.round(process.uptime()),
    mode: 'standalone-android'
  });
});

app.get('/api/system/status', (_req, res) => {
  const h = controller.getHealth();
  res.json({
    server:'SKYWA', uptime:Math.round(process.uptime()), controller:h.controller,
    whatsapp_state:h.whatsapp, connected:h.connected, database:initDB() ? 'connected' : 'disconnected',
    mode:'standalone-android', backend:'Node.js', runtime:'embedded-android',
    startTime:h.startTime ? new Date(h.startTime).toISOString() : null
  });
});

app.post('/api/system/start', async (req, res) => res.json({...await controller.startRuntime(req.body || {}), mode:'standalone-android'}));
app.post('/api/system/stop', async (_req, res) => res.json({...await controller.stopRuntime(), note:'Session preserved'}));
app.post('/api/system/restart', async (req, res) => res.json({...await controller.restartRuntime(req.body || {}), mode:'standalone-android'}));
app.get('/api/whatsapp/status', (_req, res) => res.json(controller.getWhatsAppStatus()));
app.post('/api/whatsapp/start', async (req, res) => res.json({...await controller.startRuntime(req.body || {}), endpoint:'whatsapp/start'}));
app.post('/api/whatsapp/pairing/reset', async (_req, res) => res.json({...await controller.resetUnregisteredPairingSession(), endpoint:'whatsapp/pairing/reset'}));
app.post('/api/whatsapp/stop', async (_req, res) => res.json({...await controller.stopRuntime(), endpoint:'whatsapp/stop', note:'Disconnect only; session preserved'}));

app.post('/api/whatsapp/logout', async (_req, res) => {
  try {
    await logoutWhatsApp();
    await controller.stopRuntime();
    res.json({status:'logged_out', endpoint:'whatsapp/logout'});
  } catch (error) {
    res.status(502).json({status:'failed', error:error.message || 'Logout failed', endpoint:'whatsapp/logout'});
  }
});

app.get('/api/bot/config', (_req, res) => res.json(getAutoReplyConfig()));
app.get('/api/automation/config', (_req, res) => res.json(getAutomationConfig()));
app.post('/api/automation/config', (req, res) => {
  const previous = getAutomationConfig();
  try {
    const config = setAutomationConfig(req.body || {});
    if (!saveSetting('automationConfig', config)) {
      setAutomationConfig(previous);
      return res.status(500).json({status:'failed', error:'Gagal menyimpan konfigurasi ke penyimpanan lokal. Periksa ruang penyimpanan dan izin aplikasi, lalu coba lagi.'});
    }
    return res.json({status:'saved', config});
  } catch (error) {
    return res.status(400).json({status:'failed', error:error.message || 'Automation config invalid'});
  }
});
app.get('/api/automation/stats', (_req, res) => res.json(getAutomationStats()));
app.post('/api/automation/stats/reset', (_req, res) => res.json({status:'reset', stats:resetAutomationStats()}));
app.post('/api/automation/pause', (_req, res) => {
  const previous = getAutomationConfig();
  const config = setAutomationConfig({...previous, paused:true});
  if (!saveSetting('automationConfig', config)) {
    setAutomationConfig(previous);
    return res.status(500).json({status:'failed', error:'Gagal menyimpan konfigurasi ke penyimpanan lokal. Periksa ruang penyimpanan dan izin aplikasi, lalu coba lagi.'});
  }
  return res.json({status:'paused', config});
});
app.post('/api/automation/resume', (_req, res) => {
  const previous = getAutomationConfig();
  const config = setAutomationConfig({...previous, paused:false});
  if (!saveSetting('automationConfig', config)) {
    setAutomationConfig(previous);
    return res.status(500).json({status:'failed', error:'Gagal menyimpan konfigurasi ke penyimpanan lokal. Periksa ruang penyimpanan dan izin aplikasi, lalu coba lagi.'});
  }
  return res.json({status:'resumed', config});
});
app.post('/api/bot/config', (req, res) => {
  const body = req.body || {};
  if (body.enabled !== undefined && typeof body.enabled !== 'boolean') return res.status(400).json({error:'enabled must be a boolean'});
  if (body.trigger !== undefined && typeof body.trigger !== 'string') return res.status(400).json({error:'trigger must be a string'});
  if (body.reply !== undefined && typeof body.reply !== 'string') return res.status(400).json({error:'reply must be a string'});
  const trigger = (body.trigger || '').trim();
  const reply = (body.reply || '').trim();
  if (trigger.length > 200 || reply.length > 2000) return res.status(400).json({error:'trigger max is 200 characters and reply max is 2000 characters'});
  if (body.enabled === true && !reply) return res.status(400).json({error:'reply is required when auto-reply is enabled'});
  const previous = getAutoReplyConfig();
  const config = setAutoReplyConfig({enabled:body.enabled === true, trigger, reply});
  if (!saveSetting('botConfig', config)) {
    setAutoReplyConfig(previous);
    return res.status(500).json({status:'failed', error:'Gagal menyimpan konfigurasi ke penyimpanan lokal. Periksa ruang penyimpanan dan izin aplikasi, lalu coba lagi.'});
  }
  return res.json({status:'saved', config});
});

app.get('/api/ai/config', (_req, res) => {
  const config = getAIConfig();
  const {apiKey, fallbackApiKey, ...safe} = config;
  res.json({...safe, hasApiKey:Boolean(apiKey), hasFallbackApiKey:Boolean(fallbackApiKey)});
});
app.post('/api/ai/config', (req, res) => {
  try {
    const body = req.body || {};
    const current = getAIConfig();
    const apiKey = typeof body.apiKey === 'string' && body.apiKey.trim() ? body.apiKey.trim() : current.apiKey;
    const fallbackApiKey = typeof body.fallbackApiKey === 'string' && body.fallbackApiKey.trim() ? body.fallbackApiKey.trim() : current.fallbackApiKey;
    const config = normalizeAIConfig({...current, ...body, apiKey, fallbackApiKey, hasApiKey:Boolean(apiKey)});
    if (!saveSetting('aiConfig', config)) {
      return res.status(500).json({status:'failed', error:'Gagal menyimpan konfigurasi ke penyimpanan lokal. Periksa ruang penyimpanan dan izin aplikasi, lalu coba lagi.'});
    }
    setAIConfig(config);
    const {apiKey:secret, fallbackApiKey:fallbackSecret, ...safe} = config;
    return res.json({status:'saved', ...safe, hasApiKey:Boolean(secret), hasFallbackApiKey:Boolean(fallbackSecret)});
  } catch (error) { res.status(400).json({status:'failed', error:error.message || 'AI config invalid'}); }
});
app.post('/api/ai/test', async (req, res) => {
  try {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim().slice(0, 6000) : '';
    if (!prompt) return res.status(400).json({error:'Isi pertanyaan untuk tes AI'});
    const config = getAIConfig();
    const reply = await generateAIReply({...config, enabled:true}, prompt);
    res.json({status:'ok', reply, provider:config.provider, model:config.model});
  } catch (error) { res.status(502).json({status:'failed', error:error.message || 'AI test failed'}); }
});

app.get('/api/system/diagnostics', (_req, res) => {
  const h = controller.getHealth();
  res.json({
    node_version:process.version, platform:process.platform, bind:BIND, port:PORT,
    memory_usage_mb:Math.round(process.memoryUsage().heapUsed / 1048576 * 100) / 100,
    controller_state:h.controller, whatsapp_state:h.whatsapp, mode:'standalone-android'
  });
});

app.post('/api/message/send', async (req, res) => {
  try {
    const {jid, text} = req.body || {};
    if (typeof jid !== 'string' || !jid.trim() || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({error:'jid and text must be non-empty strings'});
    }
    const result = await sendText(jid.trim(), text);
    res.json({status:'sent', jid:jid.trim(), messageId:result?.key?.id || null});
  } catch (error) {
    if (/Not connected to WhatsApp/i.test(error?.message || '')) {
      return res.status(409).json({error:'WhatsApp belum terhubung. Hubungkan perangkat WhatsApp terlebih dahulu, lalu kirim ulang.'});
    }
    return res.status(500).json({error:'Pesan gagal dikirim. Periksa koneksi WhatsApp dan coba lagi.'});
  }
});

app.use((error, req, res, _next) => {
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({status:'failed', error:'JSON body tidak valid. Periksa format JSON lalu coba lagi.'});
  }
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({status:'failed', error:'Ukuran request terlalu besar.'});
  }
  console.error('[SKYWA ERROR]', error?.name || 'Error');
  return res.status(500).json({error:'Terjadi kesalahan internal. Periksa pengaturan lalu coba lagi.', endpoint:req.path || 'unknown'});
});

initDB();
const storedAIConfig = getSetting('aiConfig');
if (storedAIConfig) {
  try { setAIConfig(storedAIConfig); }
  catch (error) { console.error('[SKYWA] Stored AI config was ignored:', error.message); }
}
const storedAutomationConfig = getSetting('automationConfig');
if (storedAutomationConfig) {
  try { setAutomationConfig(storedAutomationConfig); }
  catch (error) { console.error('[SKYWA] Stored automation config was ignored:', error.message); }
}
const storedBotConfig = getSetting('botConfig');
if (storedBotConfig) {
  try { setAutoReplyConfig(storedBotConfig); }
  catch (error) { console.error('[SKYWA] Stored bot config was ignored:', error.message); }
}

const server = createServer(app);
async function resumeSavedWhatsAppSession() {
  const credentialsPath = path.resolve(process.cwd(), 'data/sessions/main/creds.json');
  try {
    const credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
    if (credentials.registered !== true) return;

    console.log('[SKYWA] Saved WhatsApp session found; attempting reconnect.');
    const result = await controller.startRuntime({});
    if (result.status !== 'started') {
      console.error('[SKYWA] Saved WhatsApp session could not restart:', result.error || result.status);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('[SKYWA] Could not inspect saved WhatsApp session:', error.message || error);
    }
  }
}

server.on('error', (error) => {
  if (error && error.code === 'EADDRINUSE') {
    console.error('[SKYWA] EADDRINUSE: loopback port ' + PORT + ' is already in use. Stop the other local server before starting SKYWA.');
  } else {
    console.error('[SKYWA] HTTP server failed:', error && error.code ? error.code : 'UNKNOWN');
  }
  // Avoid an unhandled EventEmitter error that would terminate Node without a useful diagnostic.
});
server.listen(PORT, BIND, () => {
  console.log('[SKYWA] Server started on ' + BIND + ':' + PORT);
  // Run only after the local API is accepting requests. A fresh install has
  // no creds.json and remains idle until the user pairs WhatsApp in the UI.
  setTimeout(() => { void resumeSavedWhatsAppSession(); }, 750);
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));

export default app;
