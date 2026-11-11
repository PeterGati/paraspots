import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {database} from './d1.js';import {cockpitRoute} from '../backend/cockpit.js';import {publicClubs} from '../backend/clubs.js';
const reply=(b,s=200)=>Response.json(b,{status:s});
function setup(){const db=database();db.sql.exec(readFileSync(new URL('../backend/cockpit-audit.sql',import.meta.url),'utf8'));
 const env={ADMIN_EMAIL:'admin@example.test',COCKPIT_WRITES_ENABLED:'true',COCKPIT_RUNTIME_RESTORE_VERIFIED_AT:'2026-01-01T00:00:00Z'};
 return {db,env,call: (b,path='/api/admin/cockpit/clubs',method='PUT')=>cockpitRoute({request:new Request('https://test.local'+path,{method}),path,db,body:async()=>b,env,reply,backupStatus:async()=>reply({backups:[{verifiedAt:new Date().toISOString()}]})})};}
test('new club allocated centrally, visible in existing API and audited',async()=>{
 const a=setup();const r=await a.call({id:null,name:' New Club ',profile:{description:{de:'Original',en:'English',hu:'Magyar'}},revision:0});assert.equal(r.status,200);const c=(await r.json()).club;
 assert.equal(c.id,'003');assert.equal(c.name,'New Club');assert.equal(c.revision,1);assert.equal((await publicClubs(a.db)).find(x=>x.id==='003').description.hu,'Magyar');
 assert.equal(a.db.sql.prepare('SELECT action FROM cockpit_audit').get().action,'create-club');
});
test('profile revisions preserve unknown data and reject stale saves',async()=>{
 const a=setup();a.db.sql.prepare('UPDATE clubs SET profile=? WHERE id=?').run(JSON.stringify({custom:{preserve:true},description:{de:'old',en:'keep English'}}),'001');
 let r=await a.call({id:'001',name:'Updated',profile:{description:{de:'new'}},revision:1});assert.equal(r.status,200);const saved=(await r.json()).club;assert.equal(saved.profile.custom.preserve,true);assert.equal(saved.profile.description.en,'keep English');
 r=await a.call({id:'001',name:'Lost edit',profile:{},revision:1});assert.equal(r.status,409);assert.equal((await r.json()).club.name,'Updated');
});
test('invalid links, profile identity overrides and unknown media are rejected',async()=>{
 const a=setup();for(const profile of [{url:'javascript:alert(1)'},{id:'999'},{email:'bad'},{description:'wrong'},{logo:'/api/media/'+'0'.repeat(64)+'.png'}])assert.equal((await a.call({id:null,name:'Club',revision:0,profile})).status,400);
 assert.equal(a.db.sql.prepare('SELECT count(*) AS n FROM clubs').get().n,2);
});
test('failed audit rolls back club creation; locked writes never create a club',async()=>{
 const a=setup();a.env.COCKPIT_WRITES_ENABLED='false';assert.equal((await a.call({id:null,name:'Club',profile:{},revision:0})).status,423);
 a.env.COCKPIT_WRITES_ENABLED='true';a.db.sql.exec("CREATE TRIGGER deny_club_audit BEFORE INSERT ON cockpit_audit BEGIN SELECT RAISE(ABORT,'test'); END;");
 await assert.rejects(()=>a.call({id:null,name:'Club',profile:{},revision:0}));assert.equal(a.db.sql.prepare('SELECT count(*) AS n FROM clubs').get().n,2);
});

test('concurrent club ID allocation cannot overwrite the winner',async()=>{
 const a=setup();const batch=a.db.batch.bind(a.db);a.db.batch=async statements=>{a.db.sql.prepare('INSERT INTO clubs(id,name) VALUES(?,?)').run('003','Other admin');return batch(statements);};
 const r=await a.call({id:null,name:'My club',profile:{},revision:0});assert.equal(r.status,409);assert.equal(a.db.sql.prepare('SELECT name FROM clubs WHERE id=?').get('003').name,'Other admin');assert.equal(a.db.sql.prepare('SELECT count(*) AS n FROM cockpit_audit').get().n,0);
});
