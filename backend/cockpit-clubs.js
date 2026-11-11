// Central club records use the existing clubs table and revision contract.
const textFields=['description','warnings','events','webcams','tandem'];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function validateClubProfile(name,input) {
 const errors=[];
 if(typeof name!=='string'||!name.trim()||name.length>6000)errors.push('A klub neve kötelező, legfeljebb 6000 karakter.');
 if(!object(input))return [...errors,'A klubprofil objektum legyen.'];
 function walk(v){if(object(v))for(const [k,x]of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))errors.push('Tiltott profilkulcs.');walk(x);}else if(Array.isArray(v))v.forEach(walk);}
 walk(input);
 for(const k of ['id','name','revision','password','password_hash','token'])if(k in input)errors.push('A profil nem tartalmazhat azonosítót vagy hozzáférési adatot.');
 for(const k of textFields)if(input[k]!=null){
  if(!object(input[k]))errors.push(`${k}: DE/EN/HU nyelvi mezők szükségesek.`);
  else for(const lang of ['de','en','hu'])if(input[k][lang]!=null&&(typeof input[k][lang]!=='string'||input[k][lang].length>6000))errors.push(`${k}.${lang}: legfeljebb 6000 karakter.`);
 }
 for(const k of ['url','link','webcamLink'])if(input[k]!=null&&input[k]!==''){
  try{const u=new URL(input[k]);if(typeof input[k]!=='string'||input[k].length>6000||u.protocol!=='https:'||!u.hostname||u.username||u.password)throw Error();}catch{errors.push(`${k}: érvényes HTTPS-cím szükséges.`);}
 }
 if(input.email!=null&&input.email!==''&&(typeof input.email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)))errors.push('Érvénytelen e-mail-cím.');
 if(input.logo!=null&&input.logo!==''&&(typeof input.logo!=='string'||!/^\/api\/media\/[a-f0-9]{64}\.(jpg|png|webp)$/.test(input.logo)))errors.push('A logó a meglévő képtárból származzon.');
 if(input.hidden!=null&&(!Array.isArray(input.hidden)||input.hidden.some(k=>!textFields.includes(k))))errors.push('Érvénytelen rejtett modul.');
 return errors;
}
export function clubRecord(row){return {id:row.id,name:row.name,profile:JSON.parse(row.profile),revision:row.revision};}
export async function saveCockpitClub({db,b,env,reply,audit}) {
 const errors=validateClubProfile(b.name,b.profile);if(errors.length)return reply({error:errors.join('\n')},400);
 const creating=b.id==null;
 if(!creating&&!/^\d{3}$/.test(b.id))return reply({error:'Érvénytelen klubazonosító.'},400);
 if(creating&&b.revision!==0)return reply({error:'Új klub revíziója 0 legyen.'},400);
 let id=b.id;
 if(creating){const row=await db.prepare('SELECT COALESCE(MAX(CAST(id AS INTEGER)),0)+1 AS next FROM clubs').first();if(row.next>999)return reply({error:'Elfogytak a háromjegyű klubazonosítók.'},409);id=String(row.next).padStart(3,'0');}
 const existing=await db.prepare('SELECT * FROM clubs WHERE id=?').bind(id).first();
 if((!creating&&!existing)||(existing?.revision??0)!==b.revision)return reply({error:'A klub közben módosult. A helyi munkapéldány megmarad.',club:existing?clubRecord(existing):null},409);
 const prior=existing?JSON.parse(existing.profile):{},profile={...prior,...b.profile};
 for(const field of textFields)if(object(b.profile[field]))profile[field]={...(object(prior[field])?prior[field]:{}),...b.profile[field]};
 if(profile.logo&&profile.logo!==prior.logo&&!await env.SITE_PHOTOS?.head(profile.logo.split('/').pop()))return reply({error:'A kiválasztott logó nem található a központi képtárban.'},400);
 const next={id,name:b.name.trim(),profile,revision:b.revision+1};
 const statement=creating?db.prepare('INSERT OR IGNORE INTO clubs(id,name,profile,revision) VALUES(?,?,?,1)').bind(id,next.name,JSON.stringify(profile)):
 db.prepare('UPDATE clubs SET name=?,profile=?,revision=revision+1 WHERE id=? AND revision=?').bind(next.name,JSON.stringify(profile),id,b.revision);
 const result=await db.batch([statement,audit('club:'+id,creating?'create-club':'edit-club',existing?clubRecord(existing):null,next)]);
 if(!result[0].meta.changes)return reply({error:'Klubmentési ütközés. Frissítés és összehasonlítás szükséges.'},409);
 return reply({ok:true,club:next});
}
