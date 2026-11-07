import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {database} from './d1.js';
import {handle} from '../backend/api.js';

test('real SQLite allowlist: add, duplicate, per-club access, revoke, admin isolation and private content',async()=>{
 const db=database(), env={SITE_DB:db};
 const hash=v=>createHash('sha256').update(v).digest('hex');
 for(const club of ['001','002']) {
  db.sql.prepare('INSERT INTO club_accounts(email,club_id) VALUES(?,?)').run(club+'@example.test',club);
  db.sql.prepare('INSERT INTO club_sessions VALUES(?,?,?)').run(hash(club),club+'@example.test',Date.now()+60000);
 }
 db.sql.prepare('INSERT INTO sessions VALUES(?,?)').run(hash('super'),Date.now()+60000);
 const call=async(path,{method='GET',body,admin,superuser=false,email,origin='https://test.local'}={})=>{
  const r=await handle(new Request('https://test.local'+path,{method,headers:{Origin:origin,...(superuser?{Cookie:'ps_admin=super'}:admin?{Cookie:'ps_club='+admin}:{}),...(email?{'X-Paraspots-Member-Email':email}:{})},body:body?JSON.stringify(body):undefined}),env);
  assert.equal(r.headers.get('Cache-Control'),'no-store');
  return {status:r.status,data:await r.json()};
 };
 assert.equal((await call('/api/club/account',{admin:'001',method:'PUT',body:{email:'new-admin@example.test',password:'long-test-password'}})).status,403);
 for(const club of ['001','002']) {
  const target='/api/club/members?mode=super&club='+club;
  assert.equal((await call(target,{superuser:true,method:'PUT',body:{email:'super-added@example.test'}})).status,200);
  assert.equal((await call(target,{superuser:true})).data.members[0].email,'super-added@example.test');
  assert.equal((await call(target,{superuser:true,method:'DELETE',body:{email:'super-added@example.test'}})).status,200);
 }
 const add=(club,email)=>call('/api/club/members',{admin:club,method:'PUT',body:{email}});
 assert.equal((await add('001',' Pilot@Example.test ')).status,200);
 assert.equal((await add('001','pilot@example.test')).status,200);
 assert.equal((await call('/api/club/members',{admin:'001'})).data.members.length,1);
 assert.equal(db.sql.prepare('SELECT count(*) AS n FROM club_accounts WHERE email=?').get('pilot@example.test').n,0);
 for(const kind of ['news','documents','events']) {
  const published=await call('/api/club/member-content',{admin:'001',method:'PUT',body:{kind,title:kind,body:'Private '+kind}});
  assert.equal(published.status,200);
  assert.equal((await call('/api/club/member-content?club=001',{admin:'002',method:'DELETE',body:{id:published.data.id,revision:1}})).status,403);
  assert.equal((await call('/api/club/member-content',{admin:'002',method:'DELETE',body:{id:published.data.id,revision:1}})).status,404);
  assert.equal((await call('/api/member/'+kind+'?club=001',{email:'pilot@example.test'})).data.items[0].body,'Private '+kind);
  assert.equal((await call('/api/member/'+kind+'?club=001',{email:'outsider@example.test'})).status,403);
  assert.equal((await call('/api/member/'+kind+'?club=002',{email:'pilot@example.test'})).status,403);
  assert.equal((await call('/api/member/'+kind+'?club=001')).status,401);
 }
 const member=await call('/api/member/access?club=001',{email:'PILOT@EXAMPLE.TEST'});
 assert.equal(member.status,200);assert.equal(member.data.identityVerified,false);
 assert.equal((await call('/api/club/profile',{email:'pilot@example.test',method:'PUT',body:{name:'attack'}})).status,401);
 assert.equal((await call('/api/club/members',{email:'pilot@example.test'})).status,401);
 assert.equal((await call('/api/club/members?club=002',{admin:'001'})).status,403);
 assert.equal((await call('/api/club/members',{admin:'001',method:'PUT',body:{email:'x@example.test',clubId:'002'}})).status,403);
 assert.equal((await call('/api/club/members',{admin:'001',method:'PUT',body:{email:'x@example.test',role:'admin'}})).status,400);
 assert.equal((await add('001','not-an-email')).status,400);
 assert.equal((await call('/api/club/members',{admin:'001',method:'DELETE',body:{email:'pilot@example.test'},origin:'https://evil.test'})).status,403);
 assert.equal((await add('002','pilot@example.test')).status,200);
 assert.equal((await call('/api/member/access?club=002',{email:'pilot@example.test'})).status,200);
 assert.equal((await call('/api/club/members',{admin:'001',method:'DELETE',body:{email:'pilot@example.test'}})).status,200);
 for(const kind of ['access','news','documents','events']) assert.equal((await call('/api/member/'+kind+'?club=001',{email:'pilot@example.test'})).status,403);
 assert.equal((await call('/api/member/access?club=002',{email:'pilot@example.test'})).status,200);
 const publicResponse=await handle(new Request('https://test.local/api/sites'),env);
 assert.equal((await publicResponse.text()).includes('Private '),false);
 // No registration is needed: a newly added address works immediately as requested.
 assert.equal((await add('001','new@example.test')).status,200);
 assert.equal((await call('/api/member/access?club=001',{email:'new@example.test'})).status,200);
 db.sql.close();
});
