const rows = async statement => (await statement.all()).results;
export function memberEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(email) ? email : null;
}
export async function memberList(db, clubId) {
  return rows(db.prepare('SELECT email,created_at FROM club_members WHERE club_id=? ORDER BY email').bind(clubId));
}
export async function memberContent(db, clubId) {
  return rows(db.prepare('SELECT id,kind,title,body,updated_at,revision FROM club_member_content WHERE club_id=? ORDER BY updated_at DESC,id').bind(clubId));
}
export async function manageMembers({request,path,db,clubId,body,reply}) {
  if (request.method === 'GET') {
    if (path === '/api/club/members') return reply({members:await memberList(db,clubId)});
    if (path === '/api/club/member-content') return reply({items:await memberContent(db,clubId)});
  }
  if (!['PUT','DELETE'].includes(request.method)) return reply({error:'Nicht gefunden.'},404);
  const b = await body();
  if (b.clubId != null && b.clubId !== clubId) return reply({error:'Kein Zugriff.'},403);
  if (path === '/api/club/members') {
    const email = memberEmail(b.email);
    if (!email || (b.role != null && b.role !== 'Vereinsmitglied')) return reply({error:'Gültige E-Mail-Adresse und Rolle Vereinsmitglied erforderlich.'},400);
    if (request.method === 'DELETE') await db.prepare('DELETE FROM club_members WHERE club_id=? AND email=?').bind(clubId,email).run();
    else await db.prepare('INSERT OR IGNORE INTO club_members(club_id,email,created_at) VALUES(?,?,?)').bind(clubId,email,new Date().toISOString()).run();
    return reply({ok:true});
  }
  if (path === '/api/club/member-content') {
    const existing = typeof b.id === 'string' ? await db.prepare('SELECT club_id FROM club_member_content WHERE id=?').bind(b.id).first() : null;
    if (b.id && (!existing || existing.club_id !== clubId)) return reply({error:'Inhalt nicht gefunden.'},404);
    if (request.method === 'DELETE') {
      const result = await db.prepare('DELETE FROM club_member_content WHERE id=? AND club_id=? AND revision=?').bind(b.id || '',clubId,b.revision || 0).run();
      return result.meta.changes ? reply({ok:true}) : reply({error:'Inhalt geändert. Bitte neu laden.'},409);
    }
    if (!['news','documents','events'].includes(b.kind) || typeof b.title !== 'string' || !b.title.trim() || b.title.length > 200 || typeof b.body !== 'string' || !b.body.trim() || b.body.length > 20000) return reply({error:'Kategorie, Titel (max. 200 Zeichen) und Text (max. 20.000 Zeichen) erforderlich.'},400);
    const stamp = new Date().toISOString();
    if (existing) {
      const result = await db.prepare('UPDATE club_member_content SET kind=?,title=?,body=?,updated_at=?,revision=revision+1 WHERE id=? AND club_id=? AND revision=?').bind(b.kind,b.title.trim(),b.body,stamp,b.id,clubId,b.revision || 0).run();
      return result.meta.changes ? reply({ok:true}) : reply({error:'Inhalt geändert. Bitte neu laden.'},409);
    }
    const id = crypto.randomUUID();
    await db.prepare('INSERT INTO club_member_content(id,club_id,kind,title,body,updated_at) VALUES(?,?,?,?,?,?)').bind(id,clubId,b.kind,b.title.trim(),b.body,stamp).run();
    return reply({ok:true,id});
  }
  return reply({error:'Nicht gefunden.'},404);
}
// This is an owner-requested low-assurance email allowlist, NOT verified login.
// These headers are never considered by administrator authentication.
export async function memberRoute({request,url,path,db,reply}) {
  if (request.method !== 'GET') return reply({error:'Methode nicht erlaubt.'},405);
  const email = memberEmail(request.headers.get('X-Paraspots-Member-Email'));
  if (!email) return reply({error:'E-Mail-Adresse erforderlich.',code:'email_required'},401);
  const clubId = url.searchParams.get('club');
  if (!clubId || !await db.prepare('SELECT 1 FROM club_members WHERE club_id=? AND email=?').bind(clubId,email).first()) return reply({error:'Kein Mitgliederzugang für diesen Verein.',code:'not_member'},403);
  if (path === '/api/member/access') return reply({allowed:true,clubId,role:'Vereinsmitglied',identityVerified:false});
  const kind = path.slice('/api/member/'.length);
  if (!['news','documents','events'].includes(kind)) return reply({error:'Nicht gefunden.'},404);
  // Join the allowlist in the content query too: a concurrent revocation cannot
  // expose content between the access check above and this read.
  const items = await rows(db.prepare('SELECT c.id,c.kind,c.title,c.body,c.updated_at FROM club_member_content c JOIN club_members m ON m.club_id=c.club_id WHERE c.club_id=? AND m.email=? AND c.kind=? ORDER BY c.updated_at DESC,c.id').bind(clubId,email,kind));
  return reply({clubId,items});
}
