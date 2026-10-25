import fs from 'node:fs';
const DB_PATH='./data/users.json';
export function initDB(){try{if(!fs.existsSync('./data'))fs.mkdirSync('./data',{recursive:true});if(!fs.existsSync(DB_PATH))fs.writeFileSync(DB_PATH,JSON.stringify({sessions:{},users:{},settings:{}},null,2));return true;}catch(error){console.error('DB init error:',error.message);return false;}}
export function saveUser(user){try{const data=JSON.parse(fs.readFileSync(DB_PATH,'utf8'));data.users[user.id]=user;fs.writeFileSync(DB_PATH,JSON.stringify(data,null,2));}catch(error){console.error('DB save user error:',error.message);}}
export function getSetting(key){try{const data=JSON.parse(fs.readFileSync(DB_PATH,'utf8'));return data.settings?.[key]??null;}catch(error){console.error('DB get setting error:',error.message);return null;}}
export function saveSetting(key,value){try{const data=JSON.parse(fs.readFileSync(DB_PATH,'utf8'));data.settings??={};data.settings[key]=value;fs.writeFileSync(DB_PATH,JSON.stringify(data,null,2));}catch(error){console.error('DB save setting error:',error.message);}}
