import {notificationStatus} from './notifications.js';
import {membershipAdmin,membershipWrite} from './membership.js';
import {translationRoute} from './translation-workflow.js';
import {cockpitAccounts,saveCockpitAccess} from './cockpit-access.js';
import {saveCockpitClub,clubRecord} from './cockpit-clubs.js';
import {validateSite} from './validation.js';
import {backupRoute} from './backups.js';

// Existing sessions, tables, ownership and revisions; no schema migration.
async function writeGate(env, reply, backupStatus) {
 if(env.COCKPIT_WRITES_ENABLED!=='true')return {enabled:false,reason:'Az éles Cockpit-írás még nincs engedélyezve.'};
 const restored=Date.parse(env.COCKPIT_RUNTIME_RESTORE_VERIFIED_AT||'');
 if(!Number.isFinite(restored)||restored>Date.now())return {enabled:false,reason:'Az elkülönített Cloudflare-visszaállítás nincs igazolva.'};
 try {
  const response=await backupStatus({request:new Request('https://paraspots.at/api/admin/backups'),path:'/api/admin/backups',env,reply});
  if(!response.ok)return {enabled:false,reason:'A központi mentés nem ellenőrizhető.'};
  const status=await response.json();
  const recent=status.backups?.some(b=>{const age=Date.now()-Date.parse(b.verifiedAt);return age>=0&&age<36*3600000;});
  if(!recent)return {enabled:false,reason:'Nincs 36 órán belüli, visszaellenőrzött központi mentés.'};
  return {enabled:true,reason:'Központi mentés és elkülönített visszaállítás igazolva.'};
 } catch {return {enabled:false,reason:'A mentési ellenőrzés nem érhető el; írás zárolva.'};}
}
function record(row) {return {id:row.id,draft:JSON.parse(row.draft),published:row.published?JSON.parse(row.published):null,revision:row.revision,clubID:row.club_id??null};}
export async function cockpitRoute({request,path,db,body,env,reply,backupStatus=backupRoute}) {
 if(path==='/api/admin/cockpit/notifications'&&request.method==='GET')return reply(await notificationStatus(db,env));
 if(path==='/api/admin/cockpit/translations'&&request.method==='GET')return translationRoute({request,path,db,body,env,reply});
 if(path==='/api/admin/cockpit/changes'&&request.method==='GET') {
  if(!await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind('cockpit_audit').first())return reply({error:'A központi változásnapló még nincs telepítve.'},503);
  const {results}=await db.prepare('SELECT * FROM cockpit_audit ORDER BY created_at DESC,id DESC LIMIT 100').all();
  return reply({scope:env.TRANSLATION_WORKFLOW_ENABLED==='true'?'Cockpit-műveletek és webes klubadmin profil-/területszerkesztések; a többi webes művelet még nincs bekötve.':'Cockpit Superadmin-műveletek; a webes klubadmin eseményei még nincsenek bekötve.',changes:results.map(r=>({...r,before:r.before_json?JSON.parse(r.before_json):null,after:JSON.parse(r.after_json),before_json:undefined,after_json:undefined}))});
 }
 const membershipMatch=path.match(/^\/api\/admin\/cockpit\/clubs\/(\d{3})\/(membership|day-bank|day-rule|day-options|stickers)$/);
 if(request.method==='GET'&&membershipMatch?.[2]==='membership')return reply(await membershipAdmin(db,membershipMatch[1]));
 const accessMatch=path.match(/^\/api\/admin\/cockpit\/clubs\/(\d{3})\/accounts$/);
 if(request.method==='GET'&&accessMatch)return reply({accounts:await cockpitAccounts(db,accessMatch[1])});
 const clubMatch=path.match(/^\/api\/admin\/cockpit\/clubs\/(\d{3})$/);
 if(request.method==='GET'&&clubMatch){const row=await db.prepare('SELECT * FROM clubs WHERE id=?').bind(clubMatch[1]).first();return row?reply({club:clubRecord(row)}):reply({error:'A klub nem található.'},404);}
 const select=id=>db.prepare('SELECT sites.*,site_clubs.club_id FROM sites LEFT JOIN site_clubs ON site_clubs.site_id=sites.id WHERE sites.id=?').bind(id).first();
 const match=path.match(/^\/api\/admin\/cockpit\/sites\/([^/]+)(?:\/(publish))?$/);
 if(request.method==='GET'&&match&&!match[2]) {
  const row=await select(decodeURIComponent(match[1]));return row?reply({record:record(row)}):reply({error:'A központi rekord nem található.'},404);
 }
 if(path==='/api/admin/cockpit'&&request.method==='GET') {
  const gate=await writeGate(env,reply,backupStatus);
  if(gate.enabled&&!await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind('cockpit_audit').first())return reply({enabled:false,reason:'A központi változásnapló még nincs telepítve.'});
  return reply(gate);
 }
 const savingMembership=!!membershipMatch&&membershipMatch[2]!=='membership'&&request.method==='PUT';
 const savingTranslation=/^\/api\/admin\/cockpit\/translations\/[a-f0-9-]{36}(?:\/approve)?$/.test(path)&&['PUT','POST'].includes(request.method);
 const savingAccess=!!accessMatch&&request.method==='PUT';
 const savingClub=path==='/api/admin/cockpit/clubs'&&request.method==='PUT';
 const saving=path==='/api/admin/cockpit/sites'&&request.method==='PUT';
 const publishing=!!match?.[2]&&request.method==='POST';
 if(!saving&&!publishing&&!savingClub&&!savingAccess&&!savingTranslation&&!savingMembership)return reply({error:'Nem támogatott Cockpit-művelet.'},405);
 const gate=await writeGate(env,reply,backupStatus);if(!gate.enabled)return reply({error:gate.reason},423);
 if(!env.ADMIN_EMAIL)return reply({error:'A módosító személye nem azonosítható.'},503);
 if(!await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind('cockpit_audit').first())return reply({error:'A központi változásnapló még nincs telepítve.'},503);
 const audit=(id,action,before,after)=>db.prepare('INSERT INTO cockpit_audit(id,site_id,actor,role,action,created_at,before_json,after_json) SELECT ?,?,?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),id,env.ADMIN_EMAIL,'superadmin',action,new Date().toISOString(),before?JSON.stringify(before):null,JSON.stringify(after));
 if(savingTranslation){if(env.TRANSLATION_WORKFLOW_ENABLED!=='true')return reply({error:'A fordítási munkafolyamat még nincs engedélyezve.'},423);return translationRoute({request,path,db,body,env,reply,audit});}
 let b;try{b=await body();}catch{return reply({error:'Érvénytelen kérés.'},400);}
 if(savingMembership){if(!await db.prepare('SELECT id FROM clubs WHERE id=?').bind(membershipMatch[1]).first())return reply({error:'A klub nem található.'},404);return membershipWrite({db,clubId:membershipMatch[1],superuser:true,path:'/api/club/'+membershipMatch[2],b,reply,audit});}
 if(savingAccess)return saveCockpitAccess({db,b,env,reply,audit,clubID:accessMatch[1]});
 if(!Number.isSafeInteger(b.revision)||b.revision<0)return reply({error:'Érvényes revízió szükséges.'},400);
 if(savingClub)return saveCockpitClub({db,b,env,reply,audit});
 if(saving) {
  // A draft may omit required publication content, but malformed values are rejected.
  const errors=validateSite({...b.data,name:typeof b.data?.name==='string'?(b.data.name.trim()||'(piszkozat)'):b.data?.name});
  if(errors.length)return reply({error:errors.join('\n')},400);
  if(b.clubID!==null&&b.clubID!==''&&!/^\d{3}$/.test(b.clubID??''))return reply({error:'Érvénytelen klub.'},400);
  const clubID=b.clubID||null;
  if(clubID&&!await db.prepare('SELECT id FROM clubs WHERE id=?').bind(clubID).first())return reply({error:'A klub nem található.'},400);
  const id=b.data.region+'/'+b.data.site, existing=await select(id);
  if((existing?.revision??0)!==b.revision)return reply({error:'Más már módosította az adatot. A helyi változat megmaradt.',record:existing?record(existing):null},409);
  // Preserve the site's identity; local renames must not create a second server record.
  if(b.sourceID!=null&&b.sourceID!==id)return reply({error:'Meglévő terület azonosítója nem változtatható.'},400);
  const stamp=new Date().toISOString(),data=JSON.stringify(b.data);
  const write=existing
   ? db.prepare('UPDATE sites SET draft=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=? RETURNING id,revision').bind(data,stamp,id,b.revision)
   : db.prepare('INSERT OR IGNORE INTO sites(id,draft,updated_at) VALUES(?,?,?) RETURNING id,revision').bind(id,data,stamp);
  // D1 batch is transactional. changes() binds the ownership mutation to the CAS result.
  const ownership=clubID
   ? db.prepare('INSERT INTO site_clubs(site_id,club_id) SELECT ?,? WHERE changes()=1 ON CONFLICT(site_id) DO UPDATE SET club_id=excluded.club_id').bind(id,clubID)
   : db.prepare('DELETE FROM site_clubs WHERE site_id=? AND changes()=1').bind(id);
  const next={id,draft:b.data,published:existing?.published?JSON.parse(existing.published):null,revision:b.revision+1,clubID};
  const result=await db.batch([write,audit(id,'save-draft',existing?record(existing):null,next),ownership]);
  if(!result[0].meta.changes){const current=await select(id);return reply({error:'Mentési ütközés. A helyi változat megmaradt.',record:current?record(current):null},409);}
  // Report exactly the revision written by this request, not a subsequent editor's revision.
  return reply({ok:true,record:{id,draft:b.data,published:existing?.published?JSON.parse(existing.published):null,revision:b.revision+1,clubID}});
 }
 const id=decodeURIComponent(match[1]),row=await select(id);
 if(!row)return reply({error:'A terület nem található.'},404);
 if(row.revision!==b.revision)return reply({error:'Közben módosult a szerverpiszkozat.',record:record(row)},409);
 const data=JSON.parse(row.draft),errors=validateSite(data);
 if(errors.length)return reply({error:errors.join('\n')},422);
 // Publication requires valid supplied data, not completeness. Missing club,
 // descriptions, points and coordinates are allowed for collaborative collection.
 // validateSite above still rejects invalid identities, types, URLs and GPS ranges.
 const next={...record(row),published:data,revision:b.revision+1};
 const result=await db.batch([db.prepare('UPDATE sites SET published=draft,published_at=?,revision=revision+1 WHERE id=? AND revision=?').bind(new Date().toISOString(),id,b.revision),audit(id,'publish',record(row),next)]);
 if(!result[0].meta.changes)return reply({error:'Publikálási ütközés. Frissítsd a szerverállapotot.'},409);
 return reply({ok:true,record:{...record(row),published:data,revision:b.revision+1}});
}
