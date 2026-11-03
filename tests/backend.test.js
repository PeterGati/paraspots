import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {pbkdf2Sync} from 'node:crypto';
import {database} from './d1.js';import {handle} from '../backend/api.js';
const seed=JSON.parse(readFileSync(new URL('../data/niederoesterreich/hohe-wand.json',import.meta.url)));
const password='test-only-password';
const stored='pbkdf2$100000$test$'+pbkdf2Sync(password,'test',100000,32,'sha256').toString('hex');
function setup(){
 const env={SITE_DB:database(),ADMIN_EMAIL:'admin@example.test',ADMIN_PASSWORD_HASH:stored};let cookie='';
 return {env,async req(path,method='GET',data,origin='https://test.local'){
 const r=await handle(new Request('https://test.local'+path,{method,headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})}),env);
 if(r.headers.has('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,body:r.status===304?null:await r.json(),headers:r.headers};
 },login(){return this.req('/api/login','POST',{email:'admin@example.test',password});}};
}
test('draft isolation, directions, optimistic locking, publish and withdrawal',async()=>{
 const app=setup();assert.equal((await app.req('/api/admin/sites')).status,401);assert.equal((await app.login()).status,200);
 let r=await app.req('/api/admin/sites','PUT',{data:seed,revision:0});assert.equal(r.status,200);
 assert.equal((await app.req('/api/sites')).body.sites.length,0);
 r=await app.req('/api/admin/sites');let row=r.body.sites[0];assert.deepEqual(row.draft.startpunkte[0].launchDirections,['O','SO']);
 assert.equal((await app.req('/api/admin/sites','PUT',{data:{...seed,name:'Lost write'},revision:0})).status,409);
 assert.equal((await app.req(`/api/admin/sites/${encodeURIComponent(row.id)}/publish`,'POST',{revision:row.revision})).status,200);
 assert.equal((await app.req('/api/sites')).body.sites[0].data.name,'Hohe Wand');
 row=(await app.req('/api/admin/sites')).body.sites[0];
 assert.equal((await app.req('/api/admin/sites','PUT',{data:{...seed,name:'Edited'},revision:row.revision})).status,200);
 assert.equal((await app.req('/api/sites')).body.sites[0].data.name,'Hohe Wand');
 row=(await app.req('/api/admin/sites')).body.sites[0];
 assert.equal((await app.req(`/api/admin/sites/${encodeURIComponent(row.id)}/unpublish`,'POST',{revision:row.revision})).status,200);
 assert.equal((await app.req('/api/sites')).body.sites.length,0);
});
test('rejects cross-origin writes, invalid data and logs out',async()=>{
 const app=setup();await app.login();assert.equal((await app.req('/api/admin/sites','PUT',{data:seed},'https://evil.test')).status,403);
 assert.equal((await app.req('/api/admin/sites','PUT',{data:{...seed,windDirections:['invalid']}})).status,400);
 assert.equal((await app.req('/api/admin/sites','PUT',{data:{...seed,coordinates:{lat:99,lon:0}}})).status,400);
 await app.req('/api/logout','POST',{});assert.equal((await app.req('/api/admin/sites')).status,401);
});
test('incorrect passwords are throttled',async()=>{
 const app=setup();for(let i=0;i<5;i++)assert.equal((await app.req('/api/login','POST',{email:'admin@example.test',password:'wrong'})).status,401);
 assert.equal((await app.login()).status,429);
});
test('clean Schöckl import preserves all three launches, directions and landings',async()=>{
 const app=setup();await app.login();
 const site=JSON.parse(readFileSync(new URL('./fixtures/schoeckel-schoeckl.json',import.meta.url)));
 assert.equal((await app.req('/api/admin/sites','PUT',{data:site,revision:0})).status,200);
 assert.equal((await app.req('/api/sites')).body.sites.length,0);
 const row=(await app.req('/api/admin/sites')).body.sites[0];
 await app.req(`/api/admin/sites/${encodeURIComponent(row.id)}/publish`,'POST',{revision:row.revision});
 const result=(await app.req('/api/sites')).body.sites[0].data;
 assert.deepEqual(result,site);
 assert.deepEqual(result.startpunkte.map(p=>p.launchDirections),[['S'],['O','SO','S'],['N','NW']]);
 assert.equal(result.landeplaetze.length,3);
});
