const DEFAULTS = Object.freeze({
  rulesEnabled: false,
  paused: false,
  ignoreGroups: true,
  allowlist: [],
  blocklist: [],
  cooldownSeconds: 10,
  maxRepliesPerMinute: 8,
  activeHoursEnabled: false,
  activeStart: '08:00',
  activeEnd: '21:00',
  rules: []
});

const metrics = {
  received: 0,
  filtered: 0,
  rulesReplied: 0,
  staticReplied: 0,
  aiReplied: 0,
  failures: 0,
  lastEventAt: null,
  lastEvent: null
};
const lastReplyAtByChat = new Map();
const recentReplyTimes = [];
const MAX_TRACKED_CHATS = 2000;
const MAX_RECENT_REPLIES = 2000;

function listValues(value) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[;,\n\r]+/) : [];
  return [...new Set(values.map(item => String(item ?? '').trim()).filter(Boolean))].slice(0, 500);
}

function normalizeIdentifier(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return '';
  if (text.includes('@')) return text;
  const digits = text.replace(/\D/g, '');
  return digits.length >= 3 ? digits : '';
}

function validTime(value, fallback) {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : fallback;
}

export function normalizeAutomationConfig(input = {}) {
  const source = {...DEFAULTS, ...(input && typeof input === 'object' ? input : {})};
  const rules = (Array.isArray(source.rules) ? source.rules : []).slice(0, 30).map((rule, index) => {
    const rawKeywords = Array.isArray(rule?.keywords)
      ? rule.keywords
      : typeof rule?.keyword === 'string' ? [rule.keyword] : [];
    const keywords = [...new Set(rawKeywords
      .map(value => String(value ?? '').trim().slice(0, 100))
      .filter(Boolean))].slice(0, 20);
    const matchType = ['contains', 'exact', 'startsWith'].includes(rule?.matchType) ? rule.matchType : 'contains';
    return {
      id: String(rule?.id || 'rule-' + (index + 1)).slice(0, 80),
      enabled: rule?.enabled !== false,
      matchType,
      keywords,
      reply: typeof rule?.reply === 'string' ? rule.reply.trim().slice(0, 2000) : ''
    };
  }).filter(rule => rule.keywords.length > 0 && rule.reply.length > 0);

  const parseBoundedInt = (value, fallback, min, max) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
  };
  return {
    rulesEnabled: source.rulesEnabled === true,
    paused: source.paused === true,
    ignoreGroups: source.ignoreGroups !== false,
    allowlist: [...new Set(listValues(source.allowlist).map(normalizeIdentifier).filter(Boolean))].slice(0, 500),
    blocklist: [...new Set(listValues(source.blocklist).map(normalizeIdentifier).filter(Boolean))].slice(0, 500),
    cooldownSeconds: parseBoundedInt(source.cooldownSeconds, DEFAULTS.cooldownSeconds, 0, 3600),
    maxRepliesPerMinute: parseBoundedInt(source.maxRepliesPerMinute, DEFAULTS.maxRepliesPerMinute, 1, 60),
    activeHoursEnabled: source.activeHoursEnabled === true,
    activeStart: validTime(source.activeStart, DEFAULTS.activeStart),
    activeEnd: validTime(source.activeEnd, DEFAULTS.activeEnd),
    rules
  };
}

function phoneFromJid(jid) {
  return String(jid ?? '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

function listHasJid(list, jid) {
  const normalized = String(jid ?? '').trim().toLowerCase();
  const phone = phoneFromJid(normalized);
  return list.some(entry => entry === normalized || (phone && entry === phone));
}

function minutesOfDay(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function isWithinActiveHours(start, end, now = new Date()) {
  const minute = now.getHours() * 60 + now.getMinutes();
  const from = minutesOfDay(validTime(start, DEFAULTS.activeStart));
  const to = minutesOfDay(validTime(end, DEFAULTS.activeEnd));
  if (from === to) return true;
  return from < to ? minute >= from && minute < to : minute >= from || minute < to;
}

export function findAutomationRule(text, rules = []) {
  const message = String(text ?? '').trim().toLocaleLowerCase();
  if (!message) return null;
  for (const rule of Array.isArray(rules) ? rules : []) {
    if (!rule || rule.enabled === false || !Array.isArray(rule.keywords) || !rule.reply) continue;
    const matchType = ['contains', 'exact', 'startsWith'].includes(rule.matchType) ? rule.matchType : 'contains';
    const keyword = rule.keywords.find(raw => {
      const target = String(raw ?? '').trim().toLocaleLowerCase();
      if (!target) return false;
      if (matchType === 'exact') return message === target;
      if (matchType === 'startsWith') return message.startsWith(target);
      return message.includes(target);
    });
    if (keyword) return {...rule, matchedKeyword: keyword};
  }
  return null;
}

export function checkAutomationAllowed(config, jid, now = Date.now()) {
  const current = normalizeAutomationConfig(config);
  const target = String(jid ?? '').trim().toLowerCase();
  if (current.paused) return {allowed: false, reason: 'paused'};
  if (!target) return {allowed: false, reason: 'invalid-chat'};
  if (current.ignoreGroups && target.endsWith('@g.us')) return {allowed: false, reason: 'group-ignored'};
  if (listHasJid(current.blocklist, target)) return {allowed: false, reason: 'blocked-chat'};
  if (current.allowlist.length && !listHasJid(current.allowlist, target)) return {allowed: false, reason: 'not-allowlisted'};
  if (current.activeHoursEnabled && !isWithinActiveHours(current.activeStart, current.activeEnd, new Date(now))) {
    return {allowed: false, reason: 'outside-active-hours'};
  }

  const lastReply = lastReplyAtByChat.get(target);
  if (lastReply !== undefined && current.cooldownSeconds > 0 && now - lastReply < current.cooldownSeconds * 1000) {
    return {allowed: false, reason: 'chat-cooldown'};
  }

  while (recentReplyTimes.length && now - recentReplyTimes[0] >= 60_000) recentReplyTimes.shift();
  if (recentReplyTimes.length >= current.maxRepliesPerMinute) return {allowed: false, reason: 'global-rate-limit'};
  return {allowed: true, reason: 'ok'};
}

export function recordAutomationReply(jid, now = Date.now()) {
  const target = String(jid ?? '').trim().toLowerCase();
  if (!target) return;
  lastReplyAtByChat.delete(target);
  lastReplyAtByChat.set(target, now);
  if (lastReplyAtByChat.size > MAX_TRACKED_CHATS) {
    lastReplyAtByChat.delete(lastReplyAtByChat.keys().next().value);
  }
  recentReplyTimes.push(now);
  if (recentReplyTimes.length > MAX_RECENT_REPLIES) recentReplyTimes.shift();
}

export function recordAutomationEvent(event) {
  const key = String(event ?? '');
  if (Object.prototype.hasOwnProperty.call(metrics, key) && typeof metrics[key] === 'number') {
    metrics[key] += 1;
  }
  metrics.lastEventAt = new Date().toISOString();
  metrics.lastEvent = key.slice(0, 80);
}

export function getAutomationStats() {
  const now = Date.now();
  while (recentReplyTimes.length && now - recentReplyTimes[0] >= 60_000) recentReplyTimes.shift();
  return {...metrics, repliesLastMinute: recentReplyTimes.length};
}

export function resetAutomationStats() {
  metrics.received = 0;
  metrics.filtered = 0;
  metrics.rulesReplied = 0;
  metrics.staticReplied = 0;
  metrics.aiReplied = 0;
  metrics.failures = 0;
  metrics.lastEventAt = null;
  metrics.lastEvent = null;
  return getAutomationStats();
}

export function resetAutomationGuardState() {
  lastReplyAtByChat.clear();
  recentReplyTimes.length = 0;
}
