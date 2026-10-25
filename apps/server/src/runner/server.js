import express from 'express';
import {createServer} from 'node:http';
import {initDB, getSetting, saveSetting} from '../database.js';
import * as controller from '../lib/runtimeController.js';
import {logoutWhatsApp, sendText, getAutoReplyConfig, setAutoReplyConfig} from '../../../../packages/whatsapp-engine/src/engine.js';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const BIND = process.env.SKYWA_BIND || '127.0.0.1';
app.use(express.json({limit:'1mb'}));

app.get('/api/health', (_req, res) => {
  const h = controller.getHealth();
  res.json({
    status: h.controller === 'running' ? 'healthy' : h.controller === 'failed' ? 'degraded' : 'starting',
    version: process.version, uptime: Math.round(process.uptime()), server:'SKYWA WhatsApp Bot Studio',
    port:PORT, bind:BIND, database:initDB() ? 'connected' : 'disconnected',
    controller:h.controller, whatsapp:h.whatsapp, mode:'standalone-android'
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
app.post('/api/bot/config', (req, res) => {
  const body = req.body || {};
  if (body.enabled !== undefined && typeof body.enabled !== 'boolean') return res.status(400).json({error:'enabled must be a boolean'});
  if (body.trigger !== undefined && typeof body.trigger !== 'string') return res.status(400).json({error:'trigger must be a string'});
  if (body.reply !== undefined && typeof body.reply !== 'string') return res.status(400).json({error:'reply must be a string'});
  const trigger = (body.trigger || '').trim();
  const reply = (body.reply || '').trim();
  if (trigger.length > 200 || reply.length > 2000) return res.status(400).json({error:'trigger max is 200 characters and reply max is 2000 characters'});
  if (body.enabled === true && !reply) return res.status(400).json({error:'reply is required when auto-reply is enabled'});
  const config = setAutoReplyConfig({enabled:body.enabled === true, trigger, reply});
  saveSetting('botConfig', config);
  res.json({status:'saved', config});
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
    res.status(500).json({error:error.message || 'Message send failed'});
  }
});

app.use((error, req, res, _next) => {
  console.error('[SKYWA ERROR]', error.message);
  res.status(500).json({error:error.message || 'Internal server error', endpoint:req.path || 'unknown'});
});

initDB();
const storedBotConfig = getSetting('botConfig');
if (storedBotConfig) {
  try { setAutoReplyConfig(storedBotConfig); }
  catch (error) { console.error('[SKYWA] Stored bot config was ignored:', error.message); }
}

const server = createServer(app);
server.listen(PORT, BIND, () => console.log('[SKYWA] Server started on ' + BIND + ':' + PORT));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));

export default app;
