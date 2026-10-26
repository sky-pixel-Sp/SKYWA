import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import {generateAIReply, normalizeAIConfig} from './ai-provider.js';
import {createReconnectScheduler} from './reconnect-scheduler.js';
import {normalizeAutomationConfig, findAutomationRule, isHelpOrResetCommand, reserveAutomationReply, releaseAutomationReservation, recordAutomationReply, recordAutomationEvent, getAutomationStats, resetAutomationStats} from './automation.js';

const logger = pino({level:'info'});
export const ConnectionState = {
  DISCONNECTED:'DISCONNECTED', STARTING:'STARTING', CONNECTING:'CONNECTING',
  QR_PENDING:'QR_PENDING', PAIRING:'PAIRING', CONNECTED:'CONNECTED',
  RECONNECTING:'RECONNECTING', STOPPING:'STOPPING', ERROR:'ERROR'
};
let sock = null, state = ConnectionState.DISCONNECTED, qr = null, pairing = null, retries = 0;
let autoReplyConfig = {enabled:false, trigger:'', reply:''};
let lifecycleGeneration = 0;
const reconnectScheduler = createReconnectScheduler();
let aiConfig = {enabled:false, provider:'openrouter', apiKey:'', model:'openai/gpt-4o-mini', baseUrl:'http://127.0.0.1:11434/v1', systemPrompt:'Kamu adalah asisten WhatsApp yang ramah dan ringkas.', maxTokens:350, temperature:0.6};
const aiHistories = new Map();
const MAX_HISTORY_MESSAGES = 12;
let automationConfig = normalizeAutomationConfig({});
const maxRetries = 10, baseDelay = 2000;

export const getCurrentState = () => state;
export const getQRCode = () => qr;
export const getPairingCode = () => pairing;
export const getSock = () => sock;
export const getAutoReplyConfig = () => ({...autoReplyConfig});
export const getAIConfig = () => ({...aiConfig});
export const getAutomationConfig = () => ({
  ...automationConfig,
  allowlist: [...automationConfig.allowlist],
  blocklist: [...automationConfig.blocklist],
  rules: automationConfig.rules.map(rule => ({...rule, keywords: [...rule.keywords]}))
});
export function setAutomationConfig(config = {}) {
  automationConfig = normalizeAutomationConfig({...automationConfig, ...config});
  return getAutomationConfig();
}
export {getAutomationStats, resetAutomationStats};
export function setAIConfig(config = {}) { aiConfig = normalizeAIConfig({...aiConfig, ...config, hasApiKey: Boolean(config.hasApiKey || config.apiKey || aiConfig.apiKey)}); return getAIConfig(); }

export function setAutoReplyConfig(config = {}) {
  const enabled = config.enabled === true;
  const trigger = typeof config.trigger === 'string' ? config.trigger.trim().slice(0, 200) : '';
  const reply = typeof config.reply === 'string' ? config.reply.trim().slice(0, 2000) : '';
  if (enabled && !reply) throw new TypeError('reply is required when auto-reply is enabled');
  autoReplyConfig = {enabled, trigger, reply};
  logger.info({enabled, keywordMode: trigger ? 'keyword' : 'all-text-messages'}, 'Auto-reply config updated');
  return getAutoReplyConfig();
}

export function setState(next) {
  state = next;
  logger.info({state}, 'Connection state changed');
}

export function isConnected() {
  return state === ConnectionState.CONNECTED && sock !== null && sock.ev !== undefined;
}

async function createSocket(sessionId) {
  const auth = await useMultiFileAuthState('./data/sessions/' + sessionId);
  const latest = await fetchLatestBaileysVersion();
  const socket = makeWASocket({
    version: latest.version,
    logger: pino({level:'silent'}),
    printQRInTerminal: false,
    auth: auth.state,
    browser: ['SKYWA', 'Chrome', '120.0.0']
  });
  socket.authState = auth.state;
  socket.ev.on('creds.update', auth.saveCreds);
  return socket;
}

function attach(socket, sessionId, phoneNumber, generation) {
  let pairingRequested = false;
  socket.ev.on('connection.update', async update => {
    if (generation !== lifecycleGeneration || socket !== sock) return;
    if (update.qr) {
      qr = update.qr;
      setState(ConnectionState.QR_PENDING);
    }

    const registered = Boolean(socket.authState?.creds?.registered);
    if (phoneNumber && !registered && !pairing && !pairingRequested) {
      pairingRequested = true;
      try {
        setState(ConnectionState.PAIRING);
        const code = await socket.requestPairingCode(phoneNumber);
        pairing = code.match(/.{1,4}/g)?.join('-') || code;
      } catch (error) {
        pairingRequested = false;
        logger.error({err:error}, 'Pairing code request failed');
        setState(ConnectionState.ERROR);
      }
    }

    if (update.connection === 'open') {
      reconnectScheduler.cancel();
      setState(ConnectionState.CONNECTED);
      retries = 0;
      qr = null;
      pairing = null;
    }

    if (update.connection === 'close') {
      const reason = update.lastDisconnect?.error?.output?.statusCode;
      if (reason === DisconnectReason.loggedOut) {
        reconnectScheduler.cancel();
        if (sock === socket) sock = null;
        lifecycleGeneration++;
        setState(ConnectionState.DISCONNECTED);
        qr = null;
        pairing = null;
        return;
      }
      if (retries >= maxRetries) {
        setState(ConnectionState.ERROR);
        return;
      }
      setState(ConnectionState.RECONNECTING);
      const delay = Math.min(baseDelay * (2 ** retries++), 60000);
      reconnectScheduler.schedule(async () => {
        if (generation !== lifecycleGeneration || sock !== socket) return;
        try {
          const next = await createSocket(sessionId);
          if (generation !== lifecycleGeneration || sock !== socket) {
            try { next.end(undefined); } catch (_) {}
            return;
          }
          sock = next;
          attach(next, sessionId, phoneNumber, generation);
          listenMessages(next);
        } catch (error) {
          if (generation === lifecycleGeneration) {
            logger.error({err:error}, 'Reconnect failed');
            setState(ConnectionState.ERROR);
          }
        }
      }, delay);
    } else if (update.connection === 'connecting' && state !== ConnectionState.QR_PENDING && state !== ConnectionState.PAIRING) {
      setState(ConnectionState.CONNECTING);
    }
  });
}

function extractText(message) {
  const value = message?.message || {};
  return value.conversation
    || value.extendedTextMessage?.text
    || value.imageMessage?.caption
    || value.videoMessage?.caption
    || value.documentMessage?.caption
    || value.buttonsResponseMessage?.selectedDisplayText
    || value.listResponseMessage?.title
    || '';
}

function listenMessages(socket) {
  socket.ev.on('messages.upsert', async ({messages}) => {
    if (socket !== sock) return;
    for (const message of messages || []) {
      const jid = message?.key?.remoteJid || '';
      if (!message?.message || message.key?.fromMe || jid.endsWith('@broadcast')) continue;
      const text = extractText(message.message).trim();
      if (!text) continue;
      logger.info({from:jid}, 'Incoming message');
      recordAutomationEvent('received');

      const command = text.toLowerCase().trim();
      const isHelp = command === '/help' || command === '/start';
      const isReset = command === '/reset';
      const config = autoReplyConfig;
      const matchesStatic = config.enabled && config.reply && (!config.trigger || text.toLowerCase().includes(config.trigger.toLowerCase()));
      const ai = aiConfig;
      const advancedRule = automationConfig.rulesEnabled ? findAutomationRule(text, automationConfig.rules) : null;
      const automationRequested = isHelpOrResetCommand(command) || Boolean(advancedRule) || matchesStatic || ai.enabled;
      if (!automationRequested) continue;

      const reservation = reserveAutomationReply(automationConfig, jid);
      if (!reservation.allowed) {
        recordAutomationEvent('filtered');
        logger.info({from:jid, reason:reservation.reason}, 'Automation safety rule filtered message');
        continue;
      }

      try {
        let eventName = '';
        if (isHelp) {
          await socket.sendMessage(jid, {text:'SKYWA Bot\n/help — bantuan\n/reset — hapus memori percakapan AI\nAI dan auto-reply dikendalikan pemilik bot di aplikasi.'});
          eventName = 'commandReplies';
        } else if (isReset) {
          aiHistories.delete(jid);
          await socket.sendMessage(jid, {text:'Memori percakapan AI untuk chat ini sudah direset.'});
          eventName = 'commandReplies';
        } else if (advancedRule) {
          await socket.sendMessage(jid, {text:advancedRule.reply});
          eventName = 'rulesReplied';
          logger.info({to:jid, ruleId:advancedRule.id, keyword:advancedRule.matchedKeyword}, 'Advanced automation rule replied');
        } else if (matchesStatic) {
          await socket.sendMessage(jid, {text:config.reply});
          eventName = 'staticReplied';
          logger.info({to:jid}, 'Auto-reply sent');
        } else if (ai.enabled && !automationConfig.paused) {
          const history = aiHistories.get(jid) || [];
          await socket.sendPresenceUpdate('composing', jid).catch(() => {});
          const answer = await generateAIReply(ai, text, {history});
          await socket.sendMessage(jid, {text:answer});
          history.push({role:'user', content:text.slice(0,3000)}, {role:'assistant', content:answer.slice(0,3000)});
          aiHistories.set(jid, history.slice(-MAX_HISTORY_MESSAGES));
          await socket.sendPresenceUpdate('paused', jid).catch(() => {});
          eventName = 'aiReplied';
          logger.info({to:jid, provider:ai.provider, model:ai.model}, 'AI auto-reply sent');
        }
        recordAutomationReply(jid, Date.now(), reservation.token);
        if (eventName) recordAutomationEvent(eventName);
      } catch (error) {
        releaseAutomationReservation(reservation.token);
        recordAutomationEvent('failures');
        await socket.sendPresenceUpdate('paused', jid).catch(() => {});
        logger.error({err:error, provider:ai.provider}, 'Auto-reply failed');
      }
    }
  });
}

export async function startWhatsApp(sessionId = 'main', options = {}) {
  if (sock) await stopWhatsApp();
  reconnectScheduler.cancel();
  const generation = ++lifecycleGeneration;
  setState(ConnectionState.STARTING);
  qr = null;
  pairing = null;
  try {
    const next = await createSocket(sessionId);
    if (generation !== lifecycleGeneration) {
      try { next.end(undefined); } catch (_) {}
      return null;
    }
    sock = next;
    attach(next, sessionId, options.usePairingCode && options.phoneNumber ? options.phoneNumber : null, generation);
    listenMessages(next);
    return next;
  } catch (error) {
    setState(ConnectionState.ERROR);
    throw error;
  }
}

export async function stopWhatsApp() {
  lifecycleGeneration++;
  reconnectScheduler.cancel();
  setState(ConnectionState.STOPPING);
  const previous = sock;
  sock = null;
  if (previous) {
    try {
      previous.ev.removeAllListeners('connection.update');
      previous.ev.removeAllListeners('messages.upsert');
      previous.end(undefined);
    } catch (error) {
      logger.warn({err:error}, 'Socket close warning');
    }
  }
  setState(ConnectionState.DISCONNECTED);
  qr = null;
  pairing = null;
  retries = 0;
}

export async function logoutWhatsApp() {
  lifecycleGeneration++;
  reconnectScheduler.cancel();
  setState(ConnectionState.STOPPING);
  const previous = sock;
  sock = null;
  if (previous) {
    try {
      await previous.logout();
    } catch (error) {
      logger.error({err:error}, 'Logout failed');
      throw error;
    }
  }
  setState(ConnectionState.DISCONNECTED);
  qr = null;
  pairing = null;
  retries = 0;
}

export async function sendMessage(jid, content) {
  if (!sock || !isConnected()) throw new Error('Not connected to WhatsApp');
  return sock.sendMessage(jid, content);
}

export async function sendText(jid, text, options = {}) {
  if (typeof jid !== 'string' || !jid.trim()) throw new TypeError('jid must be a non-empty string');
  if (typeof text !== 'string' || !text.trim()) throw new TypeError('text must be a non-empty string');
  return sendMessage(jid.trim(), {text, ...options});
}
