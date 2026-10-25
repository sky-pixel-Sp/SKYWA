import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.SKYWA_DB_PATH || './data/users.json';

function errorCode(error) {
  return error?.code || error?.name || 'UnknownError';
}

function readDatabase() {
  const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  data.sessions ??= {};
  data.users ??= {};
  data.settings ??= {};
  return data;
}

function writeDatabaseAtomically(data) {
  const target = path.resolve(DB_PATH);
  const directory = path.dirname(target);
  fs.mkdirSync(directory, {recursive:true});
  const temporary = path.join(directory, '.' + path.basename(target) + '.' + process.pid + '.' + Date.now() + '.tmp');
  let fd;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(fd, JSON.stringify(data, null, 2), 'utf8');
    fs.fsyncSync(fd);
  } catch (error) {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch (_) {}
    }
    try { fs.unlinkSync(temporary); } catch (_) {}
    throw error;
  }
  fs.closeSync(fd);
  try {
    fs.renameSync(temporary, target);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch (_) {}
    throw error;
  }
}

export function initDB() {
  try {
    const directory = path.dirname(path.resolve(DB_PATH));
    fs.mkdirSync(directory, {recursive:true});
    if (!fs.existsSync(DB_PATH)) writeDatabaseAtomically({sessions:{},users:{},settings:{}});
    return true;
  } catch (error) {
    console.error('[SKYWA DB] Initialization failed:', errorCode(error));
    return false;
  }
}

export function saveUser(user) {
  try {
    if (!user || typeof user.id !== 'string' || !user.id) return false;
    const data = readDatabase();
    data.users[user.id] = user;
    writeDatabaseAtomically(data);
    return true;
  } catch (error) {
    console.error('[SKYWA DB] User save failed:', errorCode(error));
    return false;
  }
}

export function getSetting(key) {
  try {
    const data = readDatabase();
    return data.settings?.[key] ?? null;
  } catch (error) {
    console.error('[SKYWA DB] Setting read failed:', errorCode(error));
    return null;
  }
}

export function saveSetting(key, value) {
  try {
    if (typeof key !== 'string' || !key) return false;
    const data = readDatabase();
    data.settings[key] = value;
    writeDatabaseAtomically(data);
    return true;
  } catch (error) {
    console.error('[SKYWA DB] Setting save failed:', errorCode(error));
    return false;
  }
}
