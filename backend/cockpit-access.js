import {memberEmail} from './club-members.js';
const fingerprint=async row=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([row.email,row.club_id,row.password_hash])))),b=>b.toString(16).padStart(2,'0')).join('');
export async function cockpitAccounts(db,clubID){
 const {results}=await db.prepare('SELECT * FROM club_accounts WHERE club_id=? ORDER BY email').bind(clubID).all();
 return Promise.all(results.map(async row=>({email:row.email,active:row.password_hash!=null,version:await fingerprint(row)})));
}
export async function saveCockpitAccess({db,b,env,reply,audit,clubID}){
 const email=memberEmail(b.email);
 if(!email||!['grant','revoke'].includes(b.action))return reply({error:'Érvényes e-mail és művelet szükséges.'},400);
 if(!await db.prepare('SELECT id FROM clubs WHERE id=?').bind(clubID).first())return reply({error:'A klub nem található.'},404);
 const existing=await db.prepare('SELECT * FROM club_accounts WHERE email=?').bind(email).first();
 if(existing&&existing.club_id!==clubID)return reply({error:'Ez az adminfiók másik klubhoz tartozik.'},409);
 if((existing?await fingerprint(existing):null)!==(b.version??null))return reply({error:'A jogosultság közben módosult. Frissítsd a listát.'},409);
 if(b.action==='revoke'&&!existing)return reply({error:'A fiók nem található.'},404);
 let passwordHash=null;
 if(b.action==='grant'){
  if(typeof b.password!=='string'||b.password.length<12||b.password.length>256)return reply({error:'12–256 karakteres jelszó szükséges.'},400);
  const salt=crypto.randomUUID(),encoder=new TextEncoder();
  const key=await crypto.subtle.importKey('raw',encoder.encode(b.password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256);
  passwordHash='pbkdf2$100000$'+salt+'$'+Array.from(new Uint8Array(bits),x=>x.toString(16).padStart(2,'0')).join('');
 }
 if(existing?.password_hash===null&&b.action==='revoke')return reply({ok:true,unchanged:true});
 const statement=existing?db.prepare('UPDATE club_accounts SET password_hash=? WHERE email=? AND club_id=? AND password_hash IS ?').bind(passwordHash,email,clubID,existing.password_hash):db.prepare('INSERT OR IGNORE INTO club_accounts(email,club_id,password_hash) VALUES(?,?,?)').bind(email,clubID,passwordHash);
 const before=existing?{email,clubID,active:existing.password_hash!=null}:null,after={email,clubID,active:b.action==='grant'};
 const result=await db.batch([statement,audit('club:'+clubID,b.action==='grant'?'grant-admin':'revoke-admin',before,after),db.prepare('DELETE FROM club_sessions WHERE email=? AND changes()=1').bind(email)]);
 if(!result[0].meta.changes)return reply({error:'Jogosultsági ütközés; frissítsd a listát.'},409);
 return reply({ok:true,accounts:await cockpitAccounts(db,clubID)});
}
