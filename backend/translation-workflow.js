import {textFields} from './localization.js';
const eq=(a,b)=>{if(a===b)return true;if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((v,i)=>eq(v,b[i]));if(obj(a)&&obj(b)){const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&eq(a[k],b[k]));}return false;};
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
export function at(value,path){return path.reduce((v,k)=>v?.[k],value);}
function set(value,path,newValue){let p=value;for(const k of path.slice(0,-1)){if(!p[k]||typeof p[k]!=='object')p[k]={};p=p[k];}if(newValue===undefined)delete p[path.at(-1)];else p[path.at(-1)]=structuredClone(newValue);}
export function anchor(value,path){
 const result=[];let p=value;
 for(const k of path){if(Array.isArray(p)){const child=p[k];result.push({index:k,id:child?.id??null,name:child?.name??null,lat:child?.coordinates?.lat??null,lon:child?.coordinates?.lon??null});}p=p?.[k];}
 return JSON.stringify(result);
}
// Publish only the club's explicit delta, never unrelated Superadmin draft content.
export function mergeClubPublication(originalDraft,nextDraft,published){
 if(published==null)return null;
 function merge(before,after,live){
  if(eq(before,after))return structuredClone(live);
  if(obj(before)&&obj(after)&&obj(live)){
   const result=structuredClone(live);
   for(const key of new Set([...Object.keys(before),...Object.keys(after)]))if(!eq(before[key],after[key])){
    const value=merge(before[key],after[key],live[key]);if(value===undefined)delete result[key];else result[key]=value;
   }
   return result;
  }
  if(!eq(before,live)&&!eq(after,live))throw new Error('publication_conflict');
  return structuredClone(after);
 }
 return merge(originalDraft,nextDraft,published);
}
export function prepareTranslations(type,before,next){
 const value=structuredClone(next),jobs=[];
 function add(path,source,prior,container,key){
  if(typeof source!=='string'||source===prior)return;
  for(const language of ['en','hu']){
   const oldText=type==='club' ? at(before,path)?.[language] : at(before,path.slice(0,-1))?.translations?.[language]?.[key];
   if(type==='club')container[language]=source.trim()?'[DE] '+source:'';
   else{container.translations??={};container.translations[language]??={};container.translations[language][key]=source.trim()?'[DE] '+source:'';container.translations.de??={};container.translations.de[key]=source;}
   jobs.push({path,language,source,previous:typeof oldText==='string'?oldText:'',anchor:anchor(value,path),deleted:!source.trim()});
  }
 }
 if(type==='club')for(const key of ['description','warnings','events','webcams','tandem']){const target=value[key];if(obj(target))add([key],target.de,before?.[key]?.de,target,key);}
 else{
  function walk(node,previous,path=[]){
   if(Array.isArray(node)){node.forEach((x,i)=>walk(x,previous?.[i],[...path,String(i)]));return;}
   if(!obj(node))return;
   for(const [key,v]of Object.entries(node)){if(key==='translations')continue;if(textFields.has(key)&&typeof v==='string')add([...path,key],v,previous?.[key],node,key);else walk(v,previous?.[key],[...path,key]);}
  }
  walk(value,before);
 }
 return {value,jobs};
}
export async function trackedContentWrite({db,statement,entityType,entityID,before,after,jobs,actor,role,action,clubID}){
 const op=crypto.randomUUID(),instant=Date.now(),now=new Date(instant).toISOString(),due=new Date(instant+86400000).toISOString();
 const guard='EXISTS(SELECT 1 FROM cockpit_audit WHERE id=?)';
 const statements=[statement,db.prepare('INSERT INTO cockpit_audit(id,site_id,actor,role,action,created_at,before_json,after_json) SELECT ?,?,?,?,?,?,?,? WHERE changes()=1').bind(op,entityType+':'+entityID,actor,role,action,now,JSON.stringify(before),JSON.stringify(after))];
 for(const job of jobs){
  const path=JSON.stringify(job.path);
  statements.push(db.prepare(`UPDATE translation_tasks SET status='superseded',revision=revision+1 WHERE entity_type=? AND entity_id=? AND path=? AND language=? AND status='pending' AND ${guard}`).bind(entityType,entityID,path,job.language,op));
  if(!job.deleted)statements.push(db.prepare(`INSERT INTO translation_tasks(id,entity_type,entity_id,path,language,source_text,source_anchor,context_json,previous_text,created_at,due_at) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE ${guard}`).bind(crypto.randomUUID(),entityType,entityID,path,job.language,job.source,job.anchor,JSON.stringify(after),job.previous,now,due,op));
 }
 if(jobs.some(j=>!j.deleted))statements.push(db.prepare(`INSERT INTO notification_outbox(id,kind,payload,created_at) SELECT ?,'translation-created',?,? WHERE ${guard}`).bind(op+':translation',JSON.stringify({entityType,entityID,clubID,dueAt:due}),now,op));
 if(jobs.some(j=>j.path.includes('warnings')||j.path.includes('windSensitivity')))statements.push(db.prepare(`INSERT INTO notification_outbox(id,kind,payload,created_at) SELECT ?,'urgent-safety-change',?,? WHERE ${guard}`).bind(op+':urgent',JSON.stringify({entityType,entityID,clubID}),now,op));
 const result=await db.batch(statements);return result[0].meta.changes>0;
}
export async function workflowReady(db){for(const name of ['cockpit_audit','translation_tasks','notification_outbox'])if(!await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(name).first())return false;return true;}
export async function translationRoute({request,path,db,body,env,reply,audit}){
 if(path==='/api/admin/cockpit/translations'&&request.method==='GET'){
  if(!await workflowReady(db))return reply({error:'A fordítási munkafolyamat még nincs telepítve.'},503);
  const {results}=await db.prepare("SELECT * FROM translation_tasks WHERE status='pending' ORDER BY due_at,id LIMIT 200").all();
  const tasks=[];for(const r of results){const row=r.entity_type==='club'?await db.prepare('SELECT revision,profile FROM clubs WHERE id=?').bind(r.entity_id).first():await db.prepare('SELECT revision,draft,published FROM sites WHERE id=?').bind(r.entity_id).first();tasks.push({...r,sourceRevision:row?.revision??null,currentContext:row?JSON.parse(r.entity_type==='club'?row.profile:(row.published??row.draft)):null,path:JSON.parse(r.path),context:JSON.parse(r.context_json),context_json:undefined});}
  return reply({tasks,automaticTranslation:false,notifications:'outbox-only'});
 }
 if(!await workflowReady(db))return reply({error:'A fordítási munkafolyamat még nincs telepítve.'},503);
 const match=path.match(/^\/api\/admin\/cockpit\/translations\/([a-f0-9-]{36})(?:\/(approve))?$/);if(!match)return reply({error:'Nem található.'},404);
 let b;try{b=await body();}catch{return reply({error:'Érvénytelen kérés.'},400);}
 const task=await db.prepare('SELECT * FROM translation_tasks WHERE id=?').bind(match[1]).first();
 if(!task||task.status!=='pending')return reply({error:'A feladat már nem aktuális.'},409);
 if(b.revision!==task.revision)return reply({error:'A fordítás közben módosult.'},409);
 if(request.method==='PUT'&&!match[2]){
  if(typeof b.text!=='string'||b.text.length>20000)return reply({error:'Legfeljebb 20000 karakteres fordítás szükséges.'},400);
  const result=await db.batch([db.prepare("UPDATE translation_tasks SET translated_text=?,revision=revision+1 WHERE id=? AND revision=? AND status='pending'").bind(b.text,task.id,b.revision),audit(task.entity_type+':'+task.entity_id,'translation-draft',{taskID:task.id,text:task.translated_text},{taskID:task.id,text:b.text})]);
  return result[0].meta.changes?reply({ok:true,revision:b.revision+1}):reply({error:'Fordítási ütközés.'},409);
 }
 if(request.method!=='POST'||!match[2])return reply({error:'Nem támogatott művelet.'},405);
 if(!task.translated_text.trim()||task.translated_text.trim().startsWith('[DE]'))return reply({error:'Jóváhagyható fordítást adj meg.'},400);
 const club=task.entity_type==='club',row=await db.prepare(club?'SELECT * FROM clubs WHERE id=?':'SELECT * FROM sites WHERE id=?').bind(task.entity_id).first();
 if(!row||row.revision!==b.sourceRevision)return reply({error:'A forrás közben módosult. Frissíts és ellenőrizd újra.'},409);
 const current=JSON.parse(club?row.profile:(row.published??row.draft)),keys=JSON.parse(task.path);
 const source=club?at(current,keys)?.de:at(current,keys);
 if(source!==task.source_text||anchor(current,keys)!==task.source_anchor)return reply({error:'A német szöveg vagy a hely azonossága megváltozott. Új ellenőrzés szükséges.'},409);
 const updated=structuredClone(current);
 if(club)set(updated,[...keys,task.language],task.translated_text);else set(updated,[...keys.slice(0,-1),'translations',task.language,keys.at(-1)],task.translated_text);
 let write;
 const taskGuard="EXISTS(SELECT 1 FROM translation_tasks WHERE id=? AND revision=? AND status='pending')";
 if(club)write=db.prepare(`UPDATE clubs SET profile=?,revision=revision+1 WHERE id=? AND revision=? AND ${taskGuard}`).bind(JSON.stringify(updated),row.id,row.revision,task.id,task.revision);
 else{
  const draft=JSON.parse(row.draft);
  if(at(draft,keys)===task.source_text&&anchor(draft,keys)===task.source_anchor)set(draft,[...keys.slice(0,-1),'translations',task.language,keys.at(-1)],task.translated_text);
  write=db.prepare(`UPDATE sites SET draft=?,published=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND ${taskGuard}`).bind(JSON.stringify(draft),row.published==null?null:JSON.stringify(updated),new Date().toISOString(),row.id,row.revision,task.id,task.revision);
 }
 const now=new Date().toISOString();
 const result=await db.batch([write,audit(task.entity_type+':'+task.entity_id,'approve-translation',{taskID:task.id,content:current},{taskID:task.id,content:updated}),db.prepare("UPDATE translation_tasks SET status='approved',approved_at=?,approved_by=?,revision=revision+1 WHERE id=? AND revision=? AND changes()=1").bind(now,env.ADMIN_EMAIL,task.id,task.revision)]);
 return result[0].meta.changes?reply({ok:true}):reply({error:'Jóváhagyási ütközés.'},409);
}

export function foreignTextChanged(type,before,next){
 if(type==='club')return ['description','warnings','events','webcams','tandem'].some(k=>['en','hu'].some(l=>(before?.[k]?.[l]??'')!==(next?.[k]?.[l]??'')));
 function walk(a,b){
  if(Array.isArray(b))return b.some((v,i)=>walk(a?.[i],v));
  if(!obj(b))return false;
  for(const l of ['en','hu'])if(!eq(a?.translations?.[l]??{},b.translations?.[l]??{}))return true;
  return Object.keys(b).some(k=>k!=='translations'&&walk(a?.[k],b[k]));
 }
 return walk(before,next);
}
