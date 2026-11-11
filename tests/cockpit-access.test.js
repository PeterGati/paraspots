import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {database} from './d1.js';import {cockpitRoute} from '../backend/cockpit.js';import {passwordMatches} from '../backend/api.js';
const reply=(b,s=200)=>Response.json(b,{status:s});
function setup(){const db=database();db.sql.exec(readFileSync(new URL('../backend/cockpit-audit.sql',import.meta.url),'utf8'));const env={ADMIN_EMAIL:'super@example.test',COCKPIT_WRITES_ENABLED:'true',COCKPIT_RUNTIME_RESTORE_VERIFIED_AT:'2026-01-01T00:00:00Z'};
 return {db,call:(b,id='001',method='PUT')=>{const path='/api/admin/cockpit/clubs/'+id+'/accounts';return cockpitRoute({request:new Request('https://test.local'+path,{method}),path,body:async()=>b,db,env,reply,backupStatus:async()=>reply({backups:[{verifiedAt:new Date().toISOString()}]})});}};}
test('grant uses existing password scheme; audit and list contain no password material',async()=>{
 const a=setup();const r=await a.call({email:'new@example.test',action:'grant',password:'example-test-password',version:null});assert.equal(r.status,200);
 const list=await r.json(),row=a.db.sql.prepare('SELECT * FROM club_accounts WHERE email=?').get('new@example.test');assert.ok(await passwordMatches('example-test-password',row.password_hash));
 const audit=a.db.sql.prepare('SELECT * FROM cockpit_audit').get();assert.equal(audit.action,'grant-admin');for(const value of [JSON.stringify(list),JSON.stringify(audit)]){assert.ok(!value.includes('example-test-password'));assert.ok(!value.includes('pbkdf2$'));}
});
test('revocation disables login and invalidates current sessions atomically',async()=>{
 const a=setup();let r=await a.call({email:'new@example.test',action:'grant',password:'example-test-password'});const account=(await r.json()).accounts.find(x=>x.email==='new@example.test');
 a.db.sql.prepare('INSERT INTO club_sessions VALUES(?,?,?)').run('test-session','new@example.test',Date.now()+100000);
 r=await a.call({email:account.email,action:'revoke',version:account.version});assert.equal(r.status,200);assert.equal(a.db.sql.prepare('SELECT password_hash FROM club_accounts WHERE email=?').get(account.email).password_hash,null);assert.equal(a.db.sql.prepare('SELECT count(*) AS n FROM club_sessions').get().n,0);
 assert.equal((await a.call({email:account.email,action:'grant',password:'other-test-password',version:account.version})).status,409);
});
test('another club cannot seize an account; short passwords are rejected',async()=>{
 const a=setup();await a.call({email:'new@example.test',action:'grant',password:'example-test-password'});
 assert.equal((await a.call({email:'new@example.test',action:'grant',password:'example-test-password'},'002')).status,409);
 assert.equal((await a.call({email:'short@example.test',action:'grant',password:'short'})).status,400);
});
test('audit failure rolls back access changes',async()=>{
 const a=setup();a.db.sql.exec("CREATE TRIGGER reject_access BEFORE INSERT ON cockpit_audit BEGIN SELECT RAISE(ABORT,'test'); END;");await assert.rejects(()=>a.call({email:'new@example.test',action:'grant',password:'example-test-password'}));assert.equal(a.db.sql.prepare('SELECT * FROM club_accounts WHERE email=?').get('new@example.test'),undefined);
});
