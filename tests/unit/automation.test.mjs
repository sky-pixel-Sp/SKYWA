import {describe, test, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAutomationConfig, findAutomationRule, checkAutomationAllowed,
  reserveAutomationReply, releaseAutomationReservation, isHelpOrResetCommand,
  recordAutomationReply, resetAutomationGuardState, isWithinActiveHours,
  recordAutomationEvent, getAutomationStats, resetAutomationStats
} from '../../packages/whatsapp-engine/src/automation.js';

describe('SKYWA Automation Pro', () => {
  beforeEach(() => {
    resetAutomationGuardState();
    resetAutomationStats();
  });

  test('normalizes and bounds automation settings', () => {
    const c = normalizeAutomationConfig({
      rulesEnabled: true, cooldownSeconds: 999999, maxRepliesPerMinute: 0,
      ignoreGroups: false, allowlist: ['+62 812-3456-7890', 'bad'],
      rules: [{matchType:'invalid', keywords:[' price ', ''], reply:' done '}]
    });
    assert.equal(c.rulesEnabled, true);
    assert.equal(c.cooldownSeconds, 3600);
    assert.equal(c.maxRepliesPerMinute, 1);
    assert.deepEqual(c.allowlist, ['6281234567890']);
    assert.equal(c.rules[0].matchType, 'contains');
    assert.deepEqual(c.rules[0].keywords, ['price']);
    assert.equal(c.rules[0].reply, 'done');
  });

  test('supports contains, exact and startsWith match modes', () => {
    const rules = [
      {id:'exact-hi', enabled:true, matchType:'exact', keywords:['halo'], reply:'Hai!'},
      {id:'order', enabled:true, matchType:'startsWith', keywords:['order'], reply:'Nomor pesanan?'},
      {id:'price', enabled:true, matchType:'contains', keywords:['harga','price'], reply:'Pilih produk.'}
    ];
    assert.equal(findAutomationRule('HALO', rules)?.id, 'exact-hi');
    assert.equal(findAutomationRule('order #123', rules)?.id, 'order');
    assert.equal(findAutomationRule('berapa harganya?', rules)?.id, 'price');
    assert.equal(findAutomationRule('unknown', rules), null);
  });

  test('ignores groups by default and respects allow/block lists', () => {
    const defaults = normalizeAutomationConfig({});
    assert.equal(checkAutomationAllowed(defaults, '120363@g.us').reason, 'group-ignored');
    assert.equal(checkAutomationAllowed({...defaults, ignoreGroups:false, allowlist:['6281234567890']}, '628999999999@s.whatsapp.net').reason, 'not-allowlisted');
    assert.equal(checkAutomationAllowed({...defaults, blocklist:['6281234567890']}, '6281234567890@s.whatsapp.net').reason, 'blocked-chat');
    assert.equal(checkAutomationAllowed({...defaults, ignoreGroups:false, allowlist:['6281234567890']}, '6281234567890@s.whatsapp.net').allowed, true);
  });

  test('pause and active hours gate automatic replies', () => {
    assert.equal(checkAutomationAllowed({...normalizeAutomationConfig({}), paused:true}, '628123456789@s.whatsapp.net').reason, 'paused');
    assert.equal(isWithinActiveHours('22:00', '06:00', new Date(2026, 9, 25, 23, 0)), true);
    assert.equal(isWithinActiveHours('22:00', '06:00', new Date(2026, 9, 25, 12, 0)), false);
  });

  test('enforces per-chat cooldown and global reply rate', () => {
    const config = normalizeAutomationConfig({ignoreGroups:false, cooldownSeconds:10, maxRepliesPerMinute:2});
    const jid1 = '628111111111@s.whatsapp.net';
    const jid2 = '628222222222@s.whatsapp.net';
    recordAutomationReply(jid1, 100000);
    assert.equal(checkAutomationAllowed(config, jid1, 105000).reason, 'chat-cooldown');
    assert.equal(checkAutomationAllowed(config, jid1, 111000).allowed, true);
    recordAutomationReply(jid1, 111000);
    recordAutomationReply(jid2, 112000);
    assert.equal(checkAutomationAllowed(config, '628333333333@s.whatsapp.net', 113000).reason, 'global-rate-limit');
    assert.equal(checkAutomationAllowed(config, '628333333333@s.whatsapp.net', 172000).allowed, true);
  });

  test('help and reset commands are identified for the same safety gate', () => {
    for (const command of ['/help', '/start', '/reset']) assert.equal(isHelpOrResetCommand(command), true);
    assert.equal(isHelpOrResetCommand('/anything-else'), false);
    const config = normalizeAutomationConfig({paused:true});
    assert.equal(reserveAutomationReply(config, '628111111111@s.whatsapp.net').reason, 'paused');
    assert.equal(reserveAutomationReply({...config, paused:false, blocklist:['628111111111']}, '628111111111@s.whatsapp.net').reason, 'blocked-chat');
    assert.equal(reserveAutomationReply({...config, paused:false}, '120363@g.us').reason, 'group-ignored');
  });

  test('reserves cooldown and rate-limit capacity before async reply completes', () => {
    const config = normalizeAutomationConfig({ignoreGroups:false, cooldownSeconds:10, maxRepliesPerMinute:1});
    const jid = '628111111111@s.whatsapp.net';
    const first = reserveAutomationReply(config, jid, 100000);
    assert.equal(first.allowed, true);
    assert.equal(checkAutomationAllowed(config, jid, 100001).reason, 'chat-cooldown');
    assert.equal(checkAutomationAllowed(config, '628222222222@s.whatsapp.net', 100001).reason, 'global-rate-limit');
    assert.equal(releaseAutomationReservation(first.token), true);
    assert.equal(checkAutomationAllowed(config, jid, 100002).allowed, true);
  });

  test('failed reply reservation can be released without burning cooldown', () => {
    const config = normalizeAutomationConfig({ignoreGroups:false, cooldownSeconds:10});
    const jid = '628111111111@s.whatsapp.net';
    const reservation = reserveAutomationReply(config, jid, 200000);
    assert.equal(reservation.allowed, true);
    assert.equal(releaseAutomationReservation(reservation.token), true);
    assert.equal(reserveAutomationReply(config, jid, 200001).allowed, true);
  });

  test('records runtime automation metrics', () => {
    recordAutomationEvent('received');
    recordAutomationEvent('aiReplied');
    const stats = getAutomationStats();
    assert.equal(stats.received, 1);
    assert.equal(stats.aiReplied, 1);
    assert.equal(typeof stats.lastEventAt, 'string');
  });
});
