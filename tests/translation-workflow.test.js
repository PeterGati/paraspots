import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {database} from './d1.js';import {prepareTranslations,mergeClubPublication,trackedContentWrite,translationRoute,foreignTextChanged} from '../backend/translation-workflow.js';
const reply=(v,s=200)=>Response.json(v,{status:s});
function setup(){const db=database();for(const f of ['cockpit-audit.sql','translation-workflow.sql'])db.sql.exec(readFileSync(new URL('../backend/'+f,import.meta.url),'utf8'));return db;}
const base={name:'Area',description:'Old German',translations:{de:{description:'Old German'},en:{description:'Old English'},hu:{description:'Régi magyar'}},startpunkte:[]};
test('German change replaces stale translations with labelled German and only creates changed-field jobs',()=>{
 const p=prepareTranslations('site',base,{...base,description:'New German'});assert.equal(p.jobs.length,2);assert.equal(p.value.translations.en.description,'[DE] New German');assert.equal(p.jobs[0].previous,'Old English');assert.equal(p.value.translations.de.description,'New German');
 assert.equal(prepareTranslations('site',p.value,structuredClone(p.value)).jobs.length,0);
 assert.equal(base.translations.en.description,'Old English');
});
test('unrelated unpublished Superadmin changes do not leak through a club edit',()=>{
 const draft={...base,name:'Unpublished name'},next={...draft,description:'Club update'};
 const published=mergeClubPublication(draft,next,base);assert.equal(published.name,'Area');assert.equal(published.description,'Club update');
 assert.throws(()=>mergeClubPublication(draft,{...draft,name:'Club competing name'},base),/publication_conflict/);
 assert.equal(mergeClubPublication(draft,next,null),null);
});
test('changed collections with unpublished edits require explicit reconciliation',()=>{
 const published={points:[{name:'One'}]},draft={points:[{name:'Unpublished'}]};
 assert.throws(()=>mergeClubPublication(draft,{points:[{name:'Club'}]},published));
});
test('ordinary club administrator cannot directly change foreign text',()=>{
 assert.equal(foreignTextChanged('site',base,{...base,description:'German edit'}),false);
 assert.equal(foreignTextChanged('site',base,{...base,translations:{en:{description:'Unapproved'}}}),true);
 assert.equal(foreignTextChanged('club',{warnings:{de:'A',hu:'B'}},{warnings:{de:'Changed',hu:'B'}}),false);
});
test('source write, audit, 24h tasks and notification outbox commit together',async()=>{
 const db=setup();db.sql.prepare('INSERT INTO sites(id,draft,published,updated_at) VALUES(?,?,?,?)').run('r/s',JSON.stringify(base),JSON.stringify(base),'before');
 const p=prepareTranslations('site',base,{...base,description:'New German'});
 const ok=await trackedContentWrite({db,statement:db.prepare('UPDATE sites SET draft=?,published=?,revision=revision+1 WHERE id=? AND revision=?').bind(JSON.stringify(p.value),JSON.stringify(p.value),'r/s',1),entityType:'site',entityID:'r/s',before:base,after:p.value,jobs:p.jobs,actor:'club@example.test',role:'clubadmin',action:'club-site-edit',clubID:'001'});
 assert.ok(ok);const tasks=db.sql.prepare('SELECT * FROM translation_tasks').all();assert.equal(tasks.length,2);assert.equal(Date.parse(tasks[0].due_at)-Date.parse(tasks[0].created_at),86400000);assert.equal(db.sql.prepare('SELECT count(*) AS n FROM notification_outbox').get().n,1);
 const unchanged=await trackedContentWrite({db,statement:db.prepare('UPDATE sites SET revision=revision+1 WHERE id=? AND revision=?').bind('r/s',1),entityType:'site',entityID:'r/s',before:base,after:p.value,jobs:p.jobs,actor:'club@example.test',role:'clubadmin',action:'club-site-edit',clubID:'001'});assert.equal(unchanged,false);assert.equal(db.sql.prepare('SELECT count(*) AS n FROM translation_tasks').get().n,2);
});
test('manual translation draft stays private until revision-checked approval',async()=>{
 const db=setup(),p=prepareTranslations('site',base,{...base,description:'New German'});
 await trackedContentWrite({db,statement:db.prepare('INSERT INTO sites(id,draft,published,updated_at) VALUES(?,?,?,?)').bind('r/s',JSON.stringify(p.value),JSON.stringify(p.value),'now'),entityType:'site',entityID:'r/s',before:base,after:p.value,jobs:p.jobs,actor:'club@example.test',role:'clubadmin',action:'club-site-edit',clubID:'001'});
 const task=db.sql.prepare("SELECT * FROM translation_tasks WHERE language='en'").get();
 const audit=(id,action,before,after)=>db.prepare('INSERT INTO cockpit_audit(id,site_id,actor,role,action,created_at,before_json,after_json) SELECT ?,?,?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),id,'super@example.test','superadmin',action,'now',JSON.stringify(before),JSON.stringify(after));
 const call=(suffix,method,b)=>translationRoute({request:new Request('https://test.local',{method}),path:'/api/admin/cockpit/translations/'+task.id+suffix,db,body:async()=>b,env:{ADMIN_EMAIL:'super@example.test'},reply,audit});
 let r=await call('','PUT',{revision:1,text:'Approved English'});assert.equal(r.status,200);assert.equal(JSON.parse(db.sql.prepare('SELECT published FROM sites').get().published).translations.en.description,'[DE] New German');
 assert.equal((await call('/approve','POST',{revision:2,sourceRevision:0})).status,409);
 r=await call('/approve','POST',{revision:2,sourceRevision:1});assert.equal(r.status,200);assert.equal(JSON.parse(db.sql.prepare('SELECT published FROM sites').get().published).translations.en.description,'Approved English');assert.equal(db.sql.prepare('SELECT status FROM translation_tasks WHERE id=?').get(task.id).status,'approved');
 assert.equal((await call('/approve','POST',{revision:2,sourceRevision:1})).status,409);
});
test('key ordering does not cause false foreign-language or publication conflicts',()=>{
 const a={translations:{en:{name:'Name',description:'Text'}}},b={translations:{en:{description:'Text',name:'Name'}}};assert.equal(foreignTextChanged('site',a,b),false);assert.deepEqual(mergeClubPublication(a,b,a),a);
});
test('active club API publishes only German delta, queues translations and preserves Superadmin draft',async()=>{
 const {clubRoute}=await import('../backend/clubs.js');const db=setup();
 const live={region:'r',site:'s',...base},draft={...live,name:'Unpublished central name'};
 db.sql.prepare('INSERT INTO sites(id,draft,published,updated_at) VALUES(?,?,?,?)').run('r/s',JSON.stringify(draft),JSON.stringify(live),'before');db.sql.prepare('INSERT INTO site_clubs VALUES(?,?)').run('r/s','001');
 const path='/api/club/site',url=new URL('https://test.local'+path+'?mode=super&club=001');
 const r=await clubRoute({request:new Request(url,{method:'PUT'}),url,path,db,body:async()=>({site:'r/s',revision:1,name:draft.name,description:'Immediate German'}),hash:async()=>'',reply,superuser:true,env:{TRANSLATION_WORKFLOW_ENABLED:'true',ADMIN_EMAIL:'super@example.test'}});
 assert.equal(r.status,200);const saved=db.sql.prepare('SELECT * FROM sites WHERE id=?').get('r/s');assert.equal(JSON.parse(saved.published).name,'Area');assert.equal(JSON.parse(saved.draft).name,'Unpublished central name');assert.equal(JSON.parse(saved.published).description,'Immediate German');assert.equal(JSON.parse(saved.published).translations.hu.description,'[DE] Immediate German');assert.equal(db.sql.prepare('SELECT count(*) AS n FROM translation_tasks').get().n,2);
});
test('stale-source translation approval is blocked after point reorder',async()=>{
 const db=setup(),old={name:'Area',startpunkte:[{name:'A',coordinates:{lat:47,lon:15},description:'Old'},{name:'B',coordinates:{lat:48,lon:16},description:'Old'}]};const next=structuredClone(old);next.startpunkte[0].description='New';const p=prepareTranslations('site',old,next);
 await trackedContentWrite({db,statement:db.prepare('INSERT INTO sites(id,draft,published,updated_at) VALUES(?,?,?,?)').bind('r/s',JSON.stringify(p.value),JSON.stringify(p.value),'now'),entityType:'site',entityID:'r/s',before:old,after:p.value,jobs:p.jobs,actor:'club@example.test',role:'clubadmin',action:'club-site-edit',clubID:'001'});
 const task=db.sql.prepare("SELECT * FROM translation_tasks WHERE language='en'").get();db.sql.prepare('UPDATE translation_tasks SET translated_text=? WHERE id=?').run('English translation',task.id);
 const reordered=structuredClone(p.value);reordered.startpunkte.reverse();reordered.startpunkte[0].description='New';db.sql.prepare('UPDATE sites SET published=?,revision=revision+1 WHERE id=?').run(JSON.stringify(reordered),'r/s');
 const r=await translationRoute({request:new Request('https://test.local',{method:'POST'}),path:'/api/admin/cockpit/translations/'+task.id+'/approve',db,body:async()=>({revision:1,sourceRevision:2}),env:{ADMIN_EMAIL:'super@example.test'},reply,audit:()=>{throw Error('must not audit or write')}});assert.equal(r.status,409);
});
