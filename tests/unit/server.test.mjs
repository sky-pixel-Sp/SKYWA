import {describe, test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer as createProbe} from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SERVER_PATH = path.join(REPO_ROOT, 'apps/server/src/runner/server.js');
const TOKEN = 'skywa-test-token-that-is-not-a-real-secret';

async function freePort() {
  const probe = createProbe();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}

async function startServer({dbPath}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'skywa-server-test-'));
  const port = await freePort();
  const child = spawn(process.execPath, [SERVER_PATH], {
    cwd,
    env: {...process.env, PORT:String(port), SKYWA_BIND:'127.0.0.1', SKYWA_API_TOKEN:TOKEN, SKYWA_DB_PATH:dbPath},
    stdio:['ignore','pipe','pipe']
  });
  let logs = '';
  child.stdout.on('data', chunk => { logs = (logs + chunk.toString()).slice(-6000); });
  child.stderr.on('data', chunk => { logs = (logs + chunk.toString()).slice(-6000); });
  const base = 'http://127.0.0.1:' + port;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error('SKYWA test server exited early: ' + logs);
    try {
      const response = await fetch(base + '/api/health');
      if (response.ok) return {child, base, cwd, logs:() => logs};
    } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  child.kill('SIGTERM');
  throw new Error('SKYWA test server did not become ready: ' + logs);
}

async function stopServer(server) {
  if (!server) return;
  if (server.child.exitCode === null) server.child.kill('SIGTERM');
  await new Promise(resolve => {
    if (server.child.exitCode !== null) return resolve();
    const timer = setTimeout(resolve, 1500);
    server.child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
  fs.rmSync(server.cwd, {recursive:true, force:true});
}

async function json(response) {
  return response.json();
}

describe('SKYWA local API security and endpoint behavior', () => {
  test('requires the install token, exempts health, validates input and confirms saved settings', async t => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'skywa-test-db-'));
    const dbPath = path.join(cwd, 'data', 'users.json');
    const server = await startServer({dbPath});
    t.after(async () => {
      await stopServer(server);
      fs.rmSync(cwd, {recursive:true, force:true});
    });

    assert.equal((await fetch(server.base + '/api/health')).status, 200, 'health is intentionally public');
    assert.equal((await fetch(server.base + '/api/whatsapp/status')).status, 401, 'status and QR data must be protected');
    assert.equal((await fetch(server.base + '/api/whatsapp/status', {headers:{'X-Skywa-Token':'wrong-token'}})).status, 401);
    assert.equal((await fetch(server.base + '/api/ai/config')).status, 401, 'AI configuration must be protected too');
    const headers = {'X-Skywa-Token':TOKEN, 'Content-Type':'application/json'};

    fs.writeFileSync(path.join(server.cwd, 'skywa-app-version.txt'), '1.7.0');
    fs.writeFileSync(path.join(server.cwd, 'skywa-app-version-code.txt'), '8');
    fs.writeFileSync(path.join(server.cwd, 'skywa-bundle-version.txt'), 'test-commit-sha');
    const buildResponse = await fetch(server.base + '/api/build', {headers});
    assert.equal(buildResponse.status, 200);
    const buildInfo = await json(buildResponse);
    assert.equal(buildInfo.appVersion, '1.7.0');
    assert.equal(buildInfo.appVersionCode, 8);
    assert.equal(buildInfo.bundleVersion, 'test-commit-sha');

    const invalidJson = await fetch(server.base + '/api/ai/config', {method:'POST',headers,body:'{"enabled":'});
    assert.equal(invalidJson.status, 400, 'malformed JSON should not become HTTP 500');
    const invalidConfig = await fetch(server.base + '/api/ai/config', {
      method:'POST', headers, body:JSON.stringify({provider:'local',model:'local-model',baseUrl:'file:///unsafe',enabled:false})
    });
    assert.equal(invalidConfig.status, 400, 'invalid endpoint URLs should be rejected');

    const disconnectedSend = await fetch(server.base + '/api/message/send', {
      method:'POST', headers, body:JSON.stringify({jid:'628123456789@s.whatsapp.net',text:'test'})
    });
    assert.equal(disconnectedSend.status, 409, 'send while disconnected is a conflict');

    const saved = await fetch(server.base + '/api/bot/config', {
      method:'POST', headers, body:JSON.stringify({enabled:true,trigger:'halo',reply:'Halo!'})
    });
    assert.equal(saved.status, 200);
    assert.equal((await json(saved)).status, 'saved');
    const database = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    assert.deepEqual(database.settings.botConfig, {enabled:true,trigger:'halo',reply:'Halo!'});
  });

  test('returns 500 and never says saved when persistent storage fails', async t => {
    const blockedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skywa-test-db-fail-'));
    const blocker = path.join(blockedRoot, 'blocked');
    fs.writeFileSync(blocker, 'not a directory');
    const dbPath = path.join(blocker, 'users.json');
    const server = await startServer({dbPath});
    t.after(async () => {
      await stopServer(server);
      fs.rmSync(blockedRoot, {recursive:true, force:true});
    });
    const response = await fetch(server.base + '/api/automation/config', {
      method:'POST',
      headers:{'X-Skywa-Token':TOKEN,'Content-Type':'application/json'},
      body:JSON.stringify({rulesEnabled:false,paused:false,ignoreGroups:true,cooldownSeconds:10,maxRepliesPerMinute:8,rules:[]})
    });
    assert.equal(response.status, 500);
    const body = await json(response);
    assert.equal(body.status, 'failed');
    assert.match(body.error, /gagal menyimpan konfigurasi/i);
    assert.doesNotMatch(body.error, /saved/i);
  });
});
