import {manageMembers,memberList,memberContent} from './club-members.js';
import {membershipAdmin,membershipWrite} from './membership.js';
import {photoPath, uploadPhoto} from './media.js';
import {validateSite} from './validation.js';

const rows = async statement => (await statement.all()).results;
const conflict = 'Die Daten wurden inzwischen geändert. Bitte neu laden.';
const fields = ['description', 'warnings', 'events', 'webcams', 'tandem'];
const isText = value => typeof value === 'string' && value.length <= 6000;
const https = value => {
  try { return value == null || value === '' || (isText(value) && new URL(value).protocol === 'https:'); } catch { return false; }
};
export async function publicClubs(db) {
  const clubs = await rows(db.prepare('SELECT id,name,profile FROM clubs ORDER BY id'));
  return clubs.map(c => ({id:c.id, name:c.name, ...JSON.parse(c.profile)}));
}
export async function siteRelations(db) {
  const owners = await rows(db.prepare('SELECT site_id,club_id FROM site_clubs'));
  const maps = await rows(db.prepare('SELECT s.site_id,s.x,s.y,s.zoom,m.* FROM site_maps s JOIN regional_maps m ON m.id=s.map_id ORDER BY m.title,m.id'));
  return {owners:new Map(owners.map(o=>[o.site_id,o.club_id])),maps};
}
export async function clubRoute({request,url,path,db,body,hash,reply,superuser,env,passwordMatches}) {
  const method = request.method;
  const now = Date.now();
  const cookie = request.headers.get('Cookie')?.match(/(?:^|;\s*)ps_club=([^;]+)/)?.[1];
  const tokenHash = cookie && await hash(cookie);
  if(path === '/api/club/login' && method === 'POST') {
    const key = 'club:'+await hash(request.headers.get('CF-Connecting-IP') || 'local');
    const attempts = await db.prepare('SELECT * FROM login_attempts WHERE key=?').bind(key).first();
    if(attempts?.expires > now && attempts.count >= 5) return reply({error:'Bitte in 15 Minuten erneut versuchen.'},429);
    const {email,password} = await body();
    const account = await db.prepare('SELECT * FROM club_accounts WHERE email=?').bind(String(email).trim()).first();
    const valid = await passwordMatches(String(password),account?.password_hash || 'pbkdf2$100000$placeholder$invalid');
    if(!account || !valid) {
      await db.prepare('INSERT INTO login_attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END, expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END').bind(key,now+900000,now,now).run();
      return reply({error:'E-Mail oder Passwort ungültig.'},401);
    }
    const token = crypto.randomUUID()+crypto.randomUUID();
    await db.prepare('DELETE FROM club_sessions WHERE expires<=?').bind(now).run();
    const inserted = await db.prepare('INSERT INTO club_sessions SELECT ?,email,? FROM club_accounts WHERE email=? AND password_hash=?').bind(await hash(token),now+28800000,account.email,account.password_hash).run();
    if(!inserted.meta.changes) return reply({error:'Bitte erneut anmelden.'},401);
    await db.prepare('DELETE FROM login_attempts WHERE key=?').bind(key).run();
    return reply({ok:true},200,{'Set-Cookie':'ps_club='+token+'; Path=/api; HttpOnly; SameSite=Strict; Max-Age=28800'+(url.protocol==='https:'?'; Secure':'')});
  }
  if(path === '/api/club/logout' && method === 'POST') {
    if(tokenHash) await db.prepare('DELETE FROM club_sessions WHERE token_hash=?').bind(tokenHash).run();
    return reply({ok:true},200,{'Set-Cookie':'ps_club=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0'});
  }
  const account = tokenHash && await db.prepare('SELECT a.email,a.club_id FROM club_sessions s JOIN club_accounts a ON a.email=s.email WHERE s.token_hash=? AND s.expires>?').bind(tokenHash,now).first();
  if(!superuser && !account) return reply({error:'Anmeldung erforderlich.'},401);
  const clubId = superuser ? url.searchParams.get('club') || '001' : account.club_id;
  if(!superuser && url.searchParams.has('club') && url.searchParams.get('club')!==clubId) return reply({error:'Kein Zugriff.'},403);
  const club = await db.prepare('SELECT * FROM clubs WHERE id=?').bind(clubId).first();
  if(!club) return reply({error:'Verein nicht gefunden.'},404);
  if(path === '/api/club' && method==='GET') {
    const allSites = await rows(db.prepare('SELECT s.id,s.draft,s.revision,c.club_id FROM sites s LEFT JOIN site_clubs c ON c.site_id=s.id WHERE ? OR c.club_id=? ORDER BY s.id').bind(Number(superuser),clubId));
    const sites = allSites.map(s=>({...s,draft:JSON.parse(s.draft)}));
    const {maps} = await siteRelations(db);
    return reply({members:await memberList(db,clubId),memberContent:await memberContent(db,clubId),superuser,day:await membershipAdmin(db,clubId),club:{...club,profile:JSON.parse(club.profile)},clubs:superuser?await publicClubs(db):[],sites,
      maps:await rows(db.prepare('SELECT * FROM regional_maps ORDER BY title,id')),views:maps.filter(m=>sites.some(s=>s.id===m.site_id)),
      accounts:await rows(db.prepare('SELECT email,password_hash IS NOT NULL AS active FROM club_accounts WHERE club_id=?').bind(clubId))});
  }
  if(['/api/club/members','/api/club/member-content'].includes(path)) return manageMembers({request,path,db,clubId,body,reply});
  if(path === '/api/club/map-image' && method==='POST') return uploadPhoto(request,env.SITE_PHOTOS,{map:true});
  if(method!=='PUT') return reply({error:'Nicht gefunden.'},404);
  const b=await body();
  if(path.startsWith('/api/club/day-')||path==='/api/club/stickers')return membershipWrite({db,clubId,superuser,path,b,reply});
  if(path==='/api/club/account' && superuser) {
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email) || typeof b.password!=='string' || b.password.length<12 || b.password.length>256) return reply({error:'E-Mail und Passwort mit mindestens 12 Zeichen erforderlich.'},400);
    const salt=crypto.randomUUID(), encoder=new TextEncoder();
    const key=await crypto.subtle.importKey('raw',encoder.encode(b.password),'PBKDF2',false,['deriveBits']);
    const bytes=await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256);
    const digest='pbkdf2$100000$'+salt+'$'+Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
    const email=b.email.trim().toLowerCase();
    const owner=await db.prepare('SELECT club_id FROM club_accounts WHERE email=?').bind(email).first();
    if(owner && owner.club_id!==clubId) return reply({error:'Adresse bereits einem anderen Verein zugeordnet.'},409);
    const [result]=await db.batch([
      db.prepare('INSERT INTO club_accounts VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash WHERE club_id=excluded.club_id').bind(email,clubId,digest),
      db.prepare('DELETE FROM club_sessions WHERE email IN (SELECT email FROM club_accounts WHERE email=? AND club_id=?)').bind(email,clubId)
    ]);
    return reply({ok:!!result.meta.changes},result.meta.changes?200:409);
  }
  if(path==='/api/club/profile') {
    if(!isText(b.name) || !b.name.trim() || !fields.every(f=>['de','en','hu'].every(l=>isText(b.profile?.[f]?.[l] ?? ''))) || !https(b.profile?.link) || !https(b.profile?.webcamLink)) return reply({error:'Profil oder HTTPS-Link ungültig.'},400);
    const profile={};
    for(const f of fields) profile[f]=Object.fromEntries(['de','en','hu'].map(l=>[l,b.profile?.[f]?.[l] || '']));
    for(const k of ['link','webcamLink']) profile[k]=b.profile?.[k] || '';
    profile.hidden=fields.filter(k=>b.profile?.hidden?.includes(k));
    const result=await db.prepare('UPDATE clubs SET name=?,profile=?,revision=revision+1 WHERE id=? AND revision=?').bind(b.name.trim(),JSON.stringify(profile),clubId,b.revision).run();
    return result.meta.changes?reply({ok:true}):reply({error:conflict},409);
  }
  if(path==='/api/club/ownership' && superuser) {
    const owner=await db.prepare('SELECT club_id FROM site_clubs WHERE site_id=?').bind(b.site).first();
    if((owner?.club_id??null)!==(b.previous??null)) return reply({error:conflict},409);
    const result=owner ? await db.prepare('UPDATE site_clubs SET club_id=? WHERE site_id=? AND club_id=?').bind(clubId,b.site,b.previous).run()
      : await db.prepare('INSERT OR IGNORE INTO site_clubs SELECT id,? FROM sites WHERE id=?').bind(clubId,b.site).run();
    return result.meta.changes?reply({ok:true}):reply({error:conflict},409);
  }
  if(path==='/api/club/map') {
    if(![b.title,b.source,b.updated,b.image].every(v=>isText(v)&&v.trim()) || !/^\d{4}-\d{2}-\d{2}$/.test(b.updated) || !photoPath.test(b.image) || b.image.endsWith('.png') || !await env.SITE_PHOTOS?.head(b.image.split('/').pop())) return reply({error:'Bild, Titel, Quelle und Aktualisierungsdatum erforderlich.'},400);
    const id=crypto.randomUUID();
    await db.prepare('INSERT INTO regional_maps VALUES(?,?,?,?,?)').bind(id,b.title,b.image,b.source,b.updated).run();
    return reply({id});
  }
  if(path==='/api/club/new-site') {
    const data={region:b.region,site:b.slug,name:b.name};
    if(validateSite(data).length) return reply({error:'Name sowie Region und Gebietskürzel (Kleinbuchstaben, Ziffern, Bindestriche) prüfen.'},400);
    const id=data.region+'/'+data.site;
    try {
      await db.batch([db.prepare('INSERT INTO sites(id,draft,updated_at) VALUES(?,?,?)').bind(id,JSON.stringify(data),new Date().toISOString()),
        db.prepare('INSERT INTO site_clubs VALUES(?,?)').bind(id,clubId)]);
    } catch(e) {if(String(e).includes('UNIQUE'))return reply({error:'Gebiet existiert bereits.'},409);throw e;}
    return reply({id});
  }
  const ownership='EXISTS(SELECT 1 FROM site_clubs WHERE site_id=? AND club_id=?)';
  if(!b.site || !await db.prepare('SELECT 1 FROM site_clubs WHERE site_id=? AND club_id=?').bind(b.site,clubId).first()) return reply({error:'Kein Zugriff.'},403);
  if(path==='/api/club/site') {
    const row=await db.prepare('SELECT draft FROM sites WHERE id=?').bind(b.site).first();
    const data=b.draft ?? JSON.parse(row.draft);
    if(!b.draft && (!isText(b.name)||!b.name.trim()||!isText(b.description))) return reply({error:'Name und Beschreibung prüfen.'},400);
    if(!b.draft) for(const k of ['name','description']) {
      data[k]=b[k];
      if(data.translations?.de) data.translations.de[k]=b[k];
    }
    if(validateSite(data).length || data.region+'/'+data.site!==b.site) return reply({error:'Gebietsdaten prüfen.'},400);
    const result=await db.prepare('UPDATE sites SET draft=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=? AND '+ownership).bind(JSON.stringify(data),new Date().toISOString(),b.site,b.revision,b.site,clubId).run();
    return result.meta.changes?reply({ok:true}):reply({error:conflict},409);
  }
  if(path==='/api/club/view') {
    if(![b.x,b.y,b.zoom].every(Number.isFinite)||b.x<0||b.x>1||b.y<0||b.y>1||b.zoom<1||b.zoom>16) return reply({error:'Grundansicht ungültig.'},400);
    if(!await db.prepare('SELECT 1 FROM regional_maps WHERE id=?').bind(b.map).first()) return reply({error:'Karte nicht gefunden.'},404);
    const result=b.remove ? await db.prepare('DELETE FROM site_maps WHERE site_id=? AND map_id=? AND '+ownership).bind(b.site,b.map,b.site,clubId).run()
      : await db.prepare('INSERT INTO site_maps SELECT ?,?,?,?,? WHERE '+ownership+' ON CONFLICT(site_id,map_id) DO UPDATE SET x=excluded.x,y=excluded.y,zoom=excluded.zoom').bind(b.site,b.map,b.x,b.y,b.zoom,b.site,clubId).run();
    return result.meta.changes?reply({ok:true}):reply({error:conflict},409);
  }
  return reply({error:'Nicht gefunden.'},404);
}
