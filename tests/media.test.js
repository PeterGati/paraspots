import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {pbkdf2Sync} from 'node:crypto';
import {database} from './d1.js';import {photoBucket} from './photo-bucket.js';import {handle} from '../backend/api.js';import {validateSite} from '../backend/validation.js';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5ngAAAAASUVORK5CYII=','base64');
test('only authenticated same-origin admin can upload; published image is immutable and survives removing draft photo',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'paraspots-media-'));
 try{
 const env={SITE_DB:database(),SITE_PHOTOS:photoBucket(dir),ADMIN_EMAIL:'admin@test',ADMIN_PASSWORD_HASH:'pbkdf2$100000$t$'+pbkdf2Sync('test','t',100000,32,'sha256').toString('hex')};
 let cookie='';async function req(path,method='GET',body,origin='https://test.local'){return handle(new Request('https://test.local'+path,{method,headers:{Origin:origin,Cookie:cookie},...(body?{body}:{})}),env);}
 assert.equal((await req('/api/admin/media','POST',png)).status,401);
 const login=await req('/api/login','POST',JSON.stringify({email:'admin@test',password:'test'}));cookie=login.headers.get('set-cookie').split(';')[0];
 assert.equal((await req('/api/admin/media','POST',png,'https://evil.test')).status,403);
 assert.equal((await req('/api/admin/media','POST','<svg>fake</svg>')).status,415);
 assert.equal((await req('/api/admin/media','POST',new Uint8Array(8*1024*1024+1))).status,413);
 const result=await req('/api/admin/media','POST',png);assert.equal(result.status,200);const {photo}=await result.json();assert.match(photo,/^\/api\/media\/[a-f0-9]{64}\.png$/);
 const data=JSON.parse(await readFile(new URL('./fixtures/schoeckel-schoeckl.json',import.meta.url)));data.photo=photo;data.startpunkte[0].photo=photo;data.landeplaetze[0].photo=photo;
 assert.deepEqual(validateSite(data),[]);assert.ok(validateSite({...data,photo:'https://outside.test/image.jpg'}).length);
 assert.equal((await req('/api/admin/sites','PUT',JSON.stringify({data}))).status,200);
 assert.equal((await (await req('/api/sites')).json()).sites.length,0);
 let row=(await (await req('/api/admin/sites')).json()).sites[0];
 await req(`/api/admin/sites/${encodeURIComponent(row.id)}/publish`,'POST',JSON.stringify({revision:row.revision}));
 assert.equal((await (await req('/api/sites')).json()).sites[0].data.photo,photo);
 row=(await (await req('/api/admin/sites')).json()).sites[0];data.photo=null;
 await req('/api/admin/sites','PUT',JSON.stringify({data,revision:row.revision}));
 // Editing the next draft does not remove a published image or the actual object.
 assert.equal((await (await req('/api/sites')).json()).sites[0].data.photo,photo);
 cookie='';const image=await req(photo);assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');assert.match(image.headers.get('cache-control'),/immutable/);assert.deepEqual(Buffer.from(await image.arrayBuffer()),png);
 const notModified=await handle(new Request('https://test.local'+photo,{headers:{'If-None-Match':image.headers.get('etag')}}),env);assert.equal(notModified.status,304);
 assert.equal((await req(photo,'HEAD')).status,200);assert.equal((await req('/api/media/'+'a'.repeat(64)+'.png')).status,404);
 }finally{await rm(dir,{recursive:true,force:true});}
});
