import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {database} from './d1.js';import {cockpitRoute} from '../backend/cockpit.js';import {handle} from '../backend/api.js';
const root='/api/admin/cockpit';const reply=(body,status=200)=>Response.json(body,{status});
const seed=JSON.parse(readFileSync(new URL('../data/niederoesterreich/hohe-wand.json',import.meta.url)));
for(const k of ['startpunkte','landeplaetze'])for(const p of seed[k]){p.name ||= 'Test point';p.coordinates={lat:47.8,lon:16.0};}
function setup(){const db=database();db.sql.exec(readFileSync(new URL('../backend/cockpit-audit.sql',import.meta.url),'utf8'));
 const env={COCKPIT_WRITES_ENABLED:'true',COCKPIT_RUNTIME_RESTORE_VERIFIED_AT:'2026-01-01T00:00:00Z',ADMIN_EMAIL:'admin@example.test'};
 return {db,env,call(path,method='GET',data,backupStatus=async()=>reply({backups:[{verifiedAt:new Date().toISOString()}]})) {return cockpitRoute({request:new Request('https://test.local'+root+path,{method}),path:root+path,db,body:async()=>data,env,reply,backupStatus});}};}
test('existing Superadmin session required and write gate defaults closed',async()=>{
 const response=await handle(new Request('https://test.local'+root+'/sites',{method:'PUT',headers:{Origin:'https://test.local'}}),{SITE_DB:database()});assert.equal(response.status,401);
 const a=setup();delete a.env.COCKPIT_WRITES_ENABLED;assert.equal((await a.call('/sites','PUT',{})).status,423);assert.equal(a.db.sql.prepare('SELECT count(*) AS n FROM sites').get().n,0);
});
test('missing runtime restore, old backups and missing audit table block writes',async()=>{
 const a=setup();delete a.env.COCKPIT_RUNTIME_RESTORE_VERIFIED_AT;assert.equal((await a.call('/sites','PUT',{})).status,423);
 a.env.COCKPIT_RUNTIME_RESTORE_VERIFIED_AT='2026-01-01T00:00:00Z';assert.equal((await a.call('/sites','PUT',{},async()=>reply({backups:[{verifiedAt:'2020-01-01T00:00:00Z'}]}))).status,423);
 a.db.sql.exec('DROP TABLE cockpit_audit');assert.equal((await a.call('/sites','PUT',{})).status,503);
});
test('incomplete server draft stays private; ownership and audit save atomically',async()=>{
 const a=setup(),data={region:'steiermark',site:'new-site',name:'',startpunkte:[],landeplaetze:[]};
 let r=await a.call('/sites','PUT',{data,revision:0,clubID:'001'});assert.equal(r.status,200);let saved=(await r.json()).record;assert.equal(saved.revision,1);assert.equal(saved.published,null);
 assert.equal(a.db.sql.prepare('SELECT club_id FROM site_clubs WHERE site_id=?').get(saved.id).club_id,'001');
 const audit=a.db.sql.prepare('SELECT * FROM cockpit_audit').get();assert.equal(audit.actor,'admin@example.test');assert.equal(audit.action,'save-draft');assert.equal(JSON.parse(audit.after_json).draft.name,'');
 assert.equal((await a.call('/sites/'+encodeURIComponent(saved.id)+'/publish','POST',{revision:1})).status,422);
 assert.equal(a.db.sql.prepare('SELECT published FROM sites WHERE id=?').get(saved.id).published,null);
});
test('stale revision cannot overwrite draft, ownership or audit',async()=>{
 const a=setup();const body={data:seed,revision:0,clubID:'001'};await a.call('/sites','PUT',body);
 const r=await a.call('/sites','PUT',{...body,data:{...seed,name:'Lost update'},clubID:'002'});assert.equal(r.status,409);
 assert.equal((await r.json()).record.draft.name,seed.name);assert.equal(a.db.sql.prepare('SELECT club_id FROM site_clubs WHERE site_id=?').get(seed.region+'/'+seed.site).club_id,'001');assert.equal(a.db.sql.prepare('SELECT count(*) AS n FROM cockpit_audit').get().n,1);
});
test('publication is separate, CAS checked and audited',async()=>{
 const a=setup();await a.call('/sites','PUT',{data:seed,revision:0,clubID:'001'});const route='/sites/'+encodeURIComponent(seed.region+'/'+seed.site);
 let r=await a.call(route+'/publish','POST',{revision:1});assert.equal(r.status,200);let record=(await r.json()).record;assert.equal(record.revision,2);assert.deepEqual(record.published,seed);
 r=await a.call('/sites','PUT',{data:{...seed,name:'Unpublished edit'},sourceID:record.id,revision:2,clubID:'002'});assert.equal(r.status,200);record=(await r.json()).record;assert.equal(record.published.name,seed.name);assert.equal(record.draft.name,'Unpublished edit');
 assert.equal((await a.call(route+'/publish','POST',{revision:2})).status,409);
 assert.equal(a.db.sql.prepare('SELECT count(*) AS n FROM cockpit_audit').get().n,3);
});
test('audit failure rolls back the content change',async()=>{
 const a=setup();a.db.sql.exec("CREATE TRIGGER deny_audit BEFORE INSERT ON cockpit_audit BEGIN SELECT RAISE(ABORT,'test audit failure'); END;");
 await assert.rejects(()=>a.call('/sites','PUT',{data:seed,revision:0,clubID:'001'}));assert.equal(a.db.sql.prepare('SELECT count(*) AS n FROM sites').get().n,0);
});

test('concurrent CAS failure cannot change club or insert audit',async()=>{
 const a=setup();await a.call('/sites','PUT',{data:seed,revision:0,clubID:'001'});
 const batch=a.db.batch.bind(a.db);a.db.batch=async statements=>{
  a.db.sql.prepare('UPDATE sites SET revision=revision+1 WHERE id=?').run(seed.region+'/'+seed.site);
  return batch(statements);
 };
 const r=await a.call('/sites','PUT',{data:{...seed,name:'Race loser'},revision:1,clubID:'002'});
 assert.equal(r.status,409);assert.equal(a.db.sql.prepare('SELECT club_id FROM site_clubs WHERE site_id=?').get(seed.region+'/'+seed.site).club_id,'001');
 assert.equal(a.db.sql.prepare('SELECT count(*) AS n FROM cockpit_audit').get().n,1);
});

test('central change list contains real before/after and declares its limited scope',async()=>{
 const a=setup();await a.call('/sites','PUT',{data:seed,revision:0,clubID:'001'});
 const response=await a.call('/changes');assert.equal(response.status,200);const result=await response.json();
 assert.equal(result.changes.length,1);assert.equal(result.changes[0].before,null);assert.deepEqual(result.changes[0].after.draft,seed);assert.match(result.scope,/klubadmin/);
});

test('named incomplete sites publish without invented club, points or GPS',async()=>{
 for(const missing of [
  {region:'steiermark',site:'partial',name:'Partial'},
  {region:'steiermark',site:'partial',name:'Partial',description:'',startpunkte:[{name:'Start',coordinates:{lat:null,lon:null},startHeight:null}],landeplaetze:[]},
  {region:'steiermark',site:'partial',name:'Partial',startpunkte:[{coordinates:{lat:47,lon:null}}]}
 ]) {
  const a=setup();let r=await a.call('/sites','PUT',{data:missing,revision:0,clubID:null});assert.equal(r.status,200);
  const route='/sites/'+encodeURIComponent('steiermark/partial');
  assert.equal(a.db.sql.prepare('SELECT published FROM sites').get().published,null);
  r=await a.call(route+'/publish','POST',{revision:1});assert.equal(r.status,200);
  const record=(await r.json()).record;assert.deepEqual(record.published,missing);assert.equal(record.clubID,null);
  assert.equal(a.db.sql.prepare('SELECT count(*) AS n FROM cockpit_audit').get().n,2);
 }
});
test('incomplete publication never bypasses invalid coordinates or identity',async()=>{
 for(const data of [
  {region:'steiermark',site:'bad',name:'Bad',startpunkte:[{coordinates:{lat:91,lon:16}}]},
  {region:'steiermark',site:'bad',name:'Bad',startpunkte:[{coordinates:{lat:'unknown',lon:null}}]},
  {region:'steiermark',site:'bad',name:''},
  {region:'steiermark',site:'bad',name:'Bad',photo:'javascript:alert(1)'}
 ]) {
  const a=setup();a.db.sql.prepare('INSERT INTO sites(id,draft,updated_at) VALUES(?,?,?)').run('steiermark/bad',JSON.stringify(data),new Date().toISOString());
  const row=a.db.sql.prepare('SELECT revision FROM sites').get();
  assert.equal((await a.call('/sites/steiermark%2Fbad/publish','POST',{revision:row.revision})).status,422);
  assert.equal(a.db.sql.prepare('SELECT published FROM sites').get().published,null);
 }
});
