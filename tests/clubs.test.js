import test from 'node:test';
import assert from 'node:assert/strict';
import {pbkdf2Sync,randomUUID} from 'node:crypto';
import {database} from './d1.js';
import {handle} from '../backend/api.js';

test('club roles, shared drafts, public profiles and regional map assignments',async()=>{
  const pass=randomUUID();
  const env={SITE_DB:database(),ADMIN_EMAIL:'admin@example.test',ADMIN_PASSWORD_HASH:'pbkdf2$100000$test$'+pbkdf2Sync(pass,'test',100000,32,'sha256').toString('hex')};
  function session(){
    let cookie='';
    return async(path,method='GET',body,origin='https://test.local')=>{
      const response=await handle(new Request('https://test.local'+path,{method,headers:{Origin:origin,Cookie:cookie},body:body?JSON.stringify(body):undefined}),env);
      if(response.headers.has('Set-Cookie'))cookie=response.headers.get('Set-Cookie').split(';')[0];
      return {status:response.status,data:await response.json()};
    };
  }
  const admin=session(),one=session(),two=session();
  const superpath=(path,club)=>'/api/club'+path+'?mode=super&club='+club;
  assert.equal((await admin('/api/login','POST',{email:env.ADMIN_EMAIL,password:pass})).status,200);
  for(const [club,email,call] of [['001','one@example.test',one],['002','two@example.test',two]]){
    assert.equal((await admin(superpath('/account',club),'PUT',{email,password:pass})).status,200);
    assert.equal((await call('/api/club/login','POST',{email,password:pass})).status,200);
    assert.equal((await call('/api/club')).data.club.id,club);
    assert.equal((await call('/api/club/new-site','PUT',{region:'region',slug:'site-'+club,name:club})).status,200);
  }
  assert.deepEqual((await one('/api/club')).data.sites.map(s=>s.id),['region/site-001']);
  assert.equal((await one('/api/admin/sites')).status,401);
  assert.equal((await one(superpath('','002'))).status,403);
  assert.equal((await one('/api/club/site','PUT',{site:'region/site-002'})).status,403);
  assert.equal((await one('/api/club/profile','PUT',{name:'X',profile:{},revision:1},'https://other.test')).status,403);
  assert.equal((await one('/api/club/profile','PUT',{name:'Test',profile:{tandem:{hu:'Tandem'},link:'https://example.test'},revision:1})).status,200);
  assert.equal((await one('/api/club/profile','PUT',{name:'Lost edit',profile:{},revision:1})).status,409);
  assert.equal((await one('/api/club/site','PUT',{site:'region/site-001',revision:1,name:'New draft',description:'Text'})).status,200);
  assert.equal((await admin('/api/admin/sites')).data.sites[0].draft.name,'New draft');
  env.SITE_DB.sql.prepare('INSERT INTO regional_maps VALUES(?,?,?,?,?)').run('map','Region','/api/media/test.jpg','Test source','2026-11-06');
  for(const [club,call,x] of [['001',one,0.1],['002',two,0.9]]){
    const site='region/site-'+club;
    assert.equal((await call('/api/club/view','PUT',{site,map:'map',zoom:2,x,y:0.5})).status,200);
    const row=(await call('/api/club')).data.sites[0];
    assert.equal((await admin('/api/admin/sites/'+encodeURIComponent(site)+'/publish','POST',{revision:row.revision})).status,200);
  }
  const feed=(await two('/api/sites')).data;
  assert.deepEqual(feed.sites.map(s=>[s.data.clubId,s.data.regionalMaps[0].x]),[['001',0.1],['002',0.9]]);
  assert.equal(feed.clubs[0].tandem.hu,'Tandem');
  assert.equal(JSON.stringify(feed).includes('example.test","password'),false);
  assert.equal((await admin(superpath('/account','001'),'PUT',{email:'one@example.test',password:randomUUID()})).status,200);
  assert.equal((await one('/api/club')).status,401);
  assert.equal((await two('/api/club')).status,200);
});
