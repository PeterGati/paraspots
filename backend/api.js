import {localizedContent} from './localization.js';
import {photoPath,uploadPhoto,servePhoto} from './media.js';
import { validateSite } from './validation.js';
const encoder=new TextEncoder();
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{...headers,...extra}});
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join('');
export async function passwordMatches(password,stored){
 try{
  const [scheme,iterations,salt,want]=stored.split('$');
  if(scheme!=='pbkdf2'||Number(iterations)!==100000)return false;
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const got=Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256))).map(x=>x.toString(16).padStart(2,'0')).join('');
  let diff=got.length^want.length; for(let i=0;i<got.length;i++)diff|=got.charCodeAt(i)^want.charCodeAt(i);return diff===0;
 }catch{return false;}
}
export async function handle(request,env){
 try{return await route(request,env);}catch(e){console.error('Site API failure',e?.message);return reply({error:'A szerver most nem érhető el. A mentést próbáld újra.'},500);}
}
async function route(request,env){
 const url=new URL(request.url),path=url.pathname.replace(/\/$/,'');
 if(!env.SITE_DB)return reply({error:'A központi adattároló még nincs beállítva.'},503);
 if(photoPath.test(path)&&['GET','HEAD'].includes(request.method))return servePhoto(request,env.SITE_PHOTOS,path);
 const db=env.SITE_DB,now=Date.now();
 const origin=request.headers.get('Origin');
 if(!['GET','HEAD'].includes(request.method)&&origin!==url.origin)return reply({error:'Tiltott kérés.'},403);
 const body=async()=>{
  if(Number(request.headers.get('Content-Length'))>262144)throw Error('payload');
  const raw=await request.text();if(encoder.encode(raw).length>262144)throw Error('payload');return JSON.parse(raw);
 };
 if(path==='/api/login'&&request.method==='POST'){
  if(!env.ADMIN_EMAIL||!env.ADMIN_PASSWORD_HASH)return reply({error:'A bejelentkezés még nincs beállítva.'},503);
  const ip=await hash(request.headers.get('CF-Connecting-IP')||'local');
  const row=await db.prepare('SELECT * FROM login_attempts WHERE key=?').bind(ip).first();
  if(row&&row.expires>now&&row.count>=5)return reply({error:'Túl sok próbálkozás. Próbáld újra 15 perc múlva.'},429);
  let b;try{b=await body();}catch{return reply({error:'Hibás kérés.'},400);}
  const valid=await passwordMatches(typeof b.password==='string'?b.password:'',env.ADMIN_PASSWORD_HASH);
  if(!valid||typeof b.email!=='string'||b.email.toLowerCase()!==env.ADMIN_EMAIL.toLowerCase()){
   await db.prepare('INSERT INTO login_attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<? THEN 1 ELSE count+1 END, expires=CASE WHEN expires<? THEN ? ELSE expires END').bind(ip,now+900000,now,now,now+900000).run();
   return reply({error:'Hibás e-mail-cím vagy jelszó.'},401);
  }
  await db.prepare('DELETE FROM login_attempts WHERE key=? OR expires<?').bind(ip,now).run();
  const token=crypto.randomUUID()+crypto.randomUUID();
  await db.prepare('DELETE FROM sessions WHERE expires<?').bind(now).run();
  await db.prepare('INSERT INTO sessions(token_hash,expires) VALUES(?,?)').bind(await hash(token),now+8*3600000).run();
  return reply({ok:true},200,{'Set-Cookie':`ps_admin=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=28800${url.protocol==='https:'?'; Secure':''}`});
 }
 if(path==='/api/sites'&&request.method==='GET'){
  const {results}=await db.prepare('SELECT id,published,published_at FROM sites WHERE published IS NOT NULL ORDER BY id').all();
  const sites=results.map(r=>({id:r.id,data:url.searchParams.has('lang')?localizedContent(JSON.parse(r.published),['de','en','hu'].includes(url.searchParams.get('lang'))?url.searchParams.get('lang'):'de'):JSON.parse(r.published),publishedAt:r.published_at}));
  const etag='"'+await hash(JSON.stringify(sites))+'"';
  if(request.headers.get('If-None-Match')===etag)return new Response(null,{status:304,headers:{ETag:etag,'Cache-Control':'no-cache'}});
  return reply({schemaVersion:1,sites},200,{ETag:etag,'Cache-Control':'no-cache'});
 }
 const token=request.headers.get('Cookie')?.match(/(?:^|;\s*)ps_admin=([^;]+)/)?.[1];
 const session=token?await db.prepare('SELECT expires FROM sessions WHERE token_hash=?').bind(await hash(token)).first():null;
 if(!session||session.expires<=now)return reply({error:'Bejelentkezés szükséges.'},401);
 if(path==='/api/admin/media'&&request.method==='POST')return uploadPhoto(request,env.SITE_PHOTOS);
 if(path==='/api/logout'&&request.method==='POST'){
  await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hash(token)).run();
  return reply({ok:true},200,{'Set-Cookie':'ps_admin=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0'});
 }
 if(path==='/api/admin/session'&&request.method==='GET')return reply({email:env.ADMIN_EMAIL});
 if(path==='/api/admin/sites'&&request.method==='GET'){
  const {results}=await db.prepare('SELECT * FROM sites ORDER BY id').all();
  return reply({sites:results.map(r=>({...r,draft:JSON.parse(r.draft),published:r.published?JSON.parse(r.published):null}))});
 }
 if(path==='/api/admin/sites'&&request.method==='PUT'){
  let b;try{b=await body();}catch{return reply({error:'Érvénytelen vagy túl nagy JSON (maximum 256 KB).'},400);}
  const errors=validateSite(b.data);if(errors.length)return reply({error:errors.join('\n')},400);
  const id=b.data.region+'/'+b.data.site;
  const existing=await db.prepare('SELECT revision FROM sites WHERE id=?').bind(id).first();
  const data=JSON.stringify(b.data),stamp=new Date(now).toISOString();
  if(existing){
   const result=await db.prepare('UPDATE sites SET draft=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?').bind(data,stamp,id,b.revision??0).run();
   if(!result.meta.changes)return reply({error:'Közben módosult az adat. Töltsd újra a listát; a helyi szerkesztést előbb exportáld.'},409);
  }else{
   if(b.revision)return reply({error:'A rekord nem található.'},409);
   const result=await db.prepare('INSERT OR IGNORE INTO sites(id,draft,updated_at) VALUES(?,?,?)').bind(id,data,stamp).run();
   if(!result.meta.changes)return reply({error:'Az azonosító már létezik. Töltsd újra a listát.'},409);
  }
  return reply({ok:true,id});
 }
 const match=path.match(/^\/api\/admin\/sites\/([^/]+)\/(publish|unpublish)$/);
 if(match&&request.method==='POST'){
  const id=decodeURIComponent(match[1]); let b;try{b=await body();}catch{return reply({error:'Hibás kérés.'},400);}
  const row=await db.prepare('SELECT * FROM sites WHERE id=?').bind(id).first();
  if(!row)return reply({error:'Nem található.'},404);
  const publishing=match[2]==='publish';
  if(publishing&&validateSite(JSON.parse(row.draft)).length)return reply({error:'A piszkozat hibás.'},400);
  const result=await db.prepare('UPDATE sites SET published=?,published_at=?,revision=revision+1 WHERE id=? AND revision=?').bind(publishing?row.draft:null,publishing?new Date(now).toISOString():null,id,b.revision??0).run();
  if(!result.meta.changes)return reply({error:'Az adat közben módosult. Frissítsd a listát.'},409);
  return reply({ok:true});
 }
 return reply({error:'Nem található.'},404);
}
