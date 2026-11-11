const encoder=new TextEncoder();
const email=v=>typeof v==='string'&&/^[A-Za-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/.test(v);
const b64=v=>btoa(Array.from(encoder.encode(v),x=>String.fromCharCode(x)).join(''));
export function notificationConfigured(env){return env.NOTIFICATIONS_ENABLED==='true'&&email(env.ADMIN_EMAIL)&&env.NOTIFICATION_VERIFIED_EMAIL===env.ADMIN_EMAIL&&email(env.SMTP_FROM)&&typeof env.SMTP_HOST==='string'&&/^[A-Za-z0-9.-]+$/.test(env.SMTP_HOST)&&!!env.SMTP_USER&&!!env.SMTP_PASSWORD;}
export async function sendSMTP(env,event,connector){
 if(!notificationConfigured(env))throw Error('notification_not_configured');
 const connect=connector??(await import('cloudflare:sockets')).connect;
 const socket=connect({hostname:env.SMTP_HOST,port:465},{secureTransport:'on'});
 const writer=socket.writable.getWriter(),reader=socket.readable.getReader();let buffered='',timer;
 const line=async()=>{while(!buffered.includes('\n')){const r=await reader.read();if(r.done)throw Error('smtp_closed');buffered+=new TextDecoder().decode(r.value);if(buffered.length>16384)throw Error('smtp_response_limit');}const i=buffered.indexOf('\n'),s=buffered.slice(0,i).replace(/\r$/,'');buffered=buffered.slice(i+1);return s;};
 const expect=async allowed=>{for(let i=0;i<100;i++){const s=await line(),m=s.match(/^(\d{3})([ -])/);if(!m)throw Error('smtp_invalid_response');const code=Number(m[1]);if(!allowed.includes(code))throw Error('smtp_rejected_'+code);if(m[2]===' ')return;}throw Error('smtp_response_limit');};
 const command=async(text,codes)=>{await writer.write(encoder.encode(text+'\r\n'));await expect(codes);};
 const subjects={'translation-created':'PARASPOTS: új fordítási feladat','translation-reminder':'PARASPOTS: közeleg a fordítás határideje','translation-overdue':'PARASPOTS: lejárt fordítási határidő','urgent-safety-change':'PARASPOTS: sürgős biztonsági változás'};
 const run=async()=>{
  await expect([220]);await command('EHLO paraspots.at',[250]);await command('AUTH PLAIN '+b64('\0'+env.SMTP_USER+'\0'+env.SMTP_PASSWORD),[235]);
  await command('MAIL FROM:<'+env.SMTP_FROM+'>',[250]);await command('RCPT TO:<'+env.ADMIN_EMAIL+'>',[250,251]);await command('DATA',[354]);
  const payload=JSON.parse(event.payload),text=`PARASPOTS központi értesítés\nEsemény: ${subjects[event.kind]??'Változás'}\nIdőpont: ${event.created_at}\nKlub / terület: ${payload.entityID??''}\nHatáridő: ${payload.dueAt??''}\n\nA részleteket a Cockpitban vagy a https://paraspots.at/superadmin oldalon ellenőrizheted.\n`;
  const id=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(event.id))),x=>x.toString(16).padStart(2,'0')).join('');
  const body=b64(text).match(/.{1,76}/g)?.join('\r\n')??'';
  await command(`From: <${env.SMTP_FROM}>\r\nTo: <${env.ADMIN_EMAIL}>\r\nSubject: =?UTF-8?B?${b64(subjects[event.kind]??'PARASPOTS értesítés')}?=\r\nDate: ${new Date().toUTCString()}\r\nMessage-ID: <${id}@paraspots.at>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${body}\r\n.`,[250]);
  // A 250 after DATA is provider acceptance. A failed QUIT must not resend accepted mail.
 };
 try{await Promise.race([run(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('smtp_timeout')),8000);})]);}
 finally{clearTimeout(timer);try{await socket.close();}catch{}try{reader.releaseLock();writer.releaseLock();}catch{}}
}
export async function queueReminders(db,now=Date.now()){
 const stamp=new Date(now).toISOString(),soon=new Date(now+2*3600000).toISOString();
 for(const [kind,comparison,limit] of [['translation-reminder','> ?',soon],['translation-overdue','<= ?',stamp]]){
  const sql=`INSERT OR IGNORE INTO notification_outbox(id,kind,payload,created_at) SELECT entity_type||':'||entity_id||':'||due_at||':'||?, ?, json_object('entityType',entity_type,'entityID',entity_id,'dueAt',due_at), ? FROM translation_tasks WHERE status='pending' AND due_at ${comparison} AND due_at<=? GROUP BY entity_type,entity_id,due_at`;
  await db.prepare(sql).bind(kind,kind,stamp,stamp,limit).run();
 }
}
export async function dispatchNotifications(env,{sender=sendSMTP,reminders=false}={}){
 if(!notificationConfigured(env))return {configured:false,sent:0};
 const db=env.SITE_DB;if(reminders)await queueReminders(db);
 let sent=0;
 for(let i=0;i<3;i++){
  const now=new Date().toISOString(),lease=crypto.randomUUID(),until=new Date(Date.now()+120000).toISOString();
  const {results}=await db.prepare("UPDATE notification_outbox SET lease_token=?,lease_until=?,attempts=attempts+1 WHERE id=(SELECT id FROM notification_outbox WHERE delivered_at IS NULL AND cancelled_at IS NULL AND attempts<5 AND (lease_until IS NULL OR lease_until<=?) ORDER BY CASE WHEN kind='urgent-safety-change' THEN 0 ELSE 1 END,created_at LIMIT 1) RETURNING *").bind(lease,until,now).all();
  const event=results[0];if(!event)break;
  try{
   const p=JSON.parse(event.payload);
   if(event.kind!=='urgent-safety-change'&&!await db.prepare("SELECT id FROM translation_tasks WHERE entity_type=? AND entity_id=? AND status='pending' AND due_at=? LIMIT 1").bind(p.entityType,p.entityID,p.dueAt).first()){
    await db.prepare('UPDATE notification_outbox SET cancelled_at=?,lease_token=NULL WHERE id=? AND lease_token=?').bind(now,event.id,lease).run();continue;
   }
   await sender(env,event);
   await db.prepare('UPDATE notification_outbox SET delivered_at=?,last_error=NULL,lease_token=NULL WHERE id=? AND lease_token=?').bind(new Date().toISOString(),event.id,lease).run();sent++;
  }catch(e){
   const reason=/^(smtp_[a-z0-9_]+|notification_not_configured)$/.test(e?.message??'')?e.message:'notification_delivery_failed';
   await db.prepare('UPDATE notification_outbox SET last_error=?,lease_until=?,lease_token=NULL WHERE id=? AND lease_token=?').bind(reason,new Date(Date.now()+Math.min(240,5*2**(event.attempts-1))*60000).toISOString(),event.id,lease).run();
  }
 }
 return {configured:true,sent};
}
export async function notificationStatus(db,env){
 const found=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind('notification_outbox').first();
 if(!found)return {configured:false,pending:0,failed:0,lastAccepted:null};
 const summary=await db.prepare('SELECT SUM(CASE WHEN delivered_at IS NULL AND cancelled_at IS NULL THEN 1 ELSE 0 END) AS pending,SUM(CASE WHEN last_error IS NOT NULL AND delivered_at IS NULL AND cancelled_at IS NULL THEN 1 ELSE 0 END) AS failed,MAX(delivered_at) AS lastAccepted FROM notification_outbox').first();
 return {configured:notificationConfigured(env),pending:summary.pending??0,failed:summary.failed??0,lastAccepted:summary.lastAccepted};
}
