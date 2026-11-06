import {isValidIBAN} from 'ibantools';

const languages=['de','en','hu'];
const blankRule={mode:'none',cents:0,terms:{}};
const initial=()=>({base:blankRule,sites:{},bank:{iban:'',name:'',count:null},alternatives:{},download:''});
const invalid=message=>{throw new RangeError(message);};
function text(value,max) {
  if(value==null)return '';
  if(typeof value!=='string'||value.length>max||/[\x00-\x1f]/.test(value))invalid('Text oder Länge prüfen.');
  return value.trim();
}
function localized(value) {
  return Object.fromEntries(languages.map(l=>[l,text(value?.[l],500)]));
}
function link(value) {
  const raw=text(value,1000);
  if(!raw)return '';
  try{const u=new URL(raw);if(u.protocol==='https:'&&u.hostname&&!u.username&&!u.password)return u.href;}catch{}
  invalid('Ein gültiger HTTPS-Link ist erforderlich.');
}
function rule(value) {
  if(!['none','paid','lift'].includes(value?.mode))invalid('Modus auswählen.');
  const cents=value.mode==='paid'?value.cents:0;
  if(!Number.isSafeInteger(cents)||(value.mode==='paid'&&(cents<=0||cents>99999999999)))invalid('Einen positiven Eurobetrag mit höchstens zwei Nachkommastellen eingeben.');
  return {mode:value.mode,cents,terms:localized(value.terms)};
}
function bankDetails(value) {
  const iban=text(value.iban,64).replace(/ /g,'').toUpperCase(),name=text(value.name,70);
  if(iban && !isValidIBAN(iban))invalid('Gültige IBAN eingeben.');
  if(value.count!=null && (!Number.isInteger(value.count)||value.count<25||value.count>50))invalid('Bitte 25 bis 50 Aufkleber anfordern.');
  return {iban,name,count:value.count??null};
}
function downloadLink(value) {
  const url=link(value);if(!url)return '';
  const u=new URL(url);
  if(!(u.hostname==='apps.apple.com'&&/\/id\d+\/?$/.test(u.pathname))&&!(u.hostname==='testflight.apple.com'&&/^\/join\/[A-Za-z0-9]+\/?$/.test(u.pathname)))invalid('Offiziellen App-Store- oder öffentlichen TestFlight-Link angeben.');
  return url;
}
export function effective(settings,site){return settings.sites[site] ?? settings.base;}
function matchesPrint(batch,settings,site) {
  const r=effective(settings,site);
  return r.mode==='paid' && batch.cents===r.cents && batch.iban===settings.bank.iban && batch.name===settings.bank.name && batch.download===settings.download;
}
export async function addMemberships(db,sites,owners) {
  const settings=new Map((await db.prepare('SELECT * FROM day_settings').all()).results.map(r=>[r.club_id,JSON.parse(r.settings)]));
  for(const site of sites){
    delete site.data.dayMembership;
    const owner=owners.get(site.id),s=settings.get(owner);
    if(!s)continue;
    const r=effective(s,site.id);
    if(r.mode==='none')continue;
    const showPaymentHelp=r.mode==='paid' && Boolean(s.bank.iban || s.bank.name || s.bank.count || s.download);
    const methods=[];
    if(r.mode==='paid'){
      if(showPaymentHelp)methods.push({kind:'qr'});
      for(const kind of ['cash','paypal','other','lift']){
        const value=s.alternatives[kind];
        if(typeof value==='string'?value:Object.values(value??{}).some(Boolean))methods.push({kind,value});
      }
    }
    site.data.dayMembership={...r,showPaymentHelp,methods};
  }
}
export async function membershipAdmin(db,id) {
  const row=await db.prepare('SELECT * FROM day_settings WHERE club_id=?').bind(id).first();
  const settings=row?JSON.parse(row.settings):initial();
  const batches=(await db.prepare('SELECT * FROM sticker_batches WHERE club_id=? ORDER BY created DESC').bind(id).all()).results.map(b=>({
    id:b.id,site:b.site_id,created:b.created,current:matchesPrint(JSON.parse(b.snapshot),settings,b.site_id)
  }));
  return {settings,revision:row?.revision??0,batches};
}
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function membershipWrite({db,clubId,superuser,path,b,reply}) {
  const {settings,revision}=await membershipAdmin(db,clubId);
  const owns=async site=>typeof site==='string' && await db.prepare('SELECT 1 FROM site_clubs WHERE club_id=? AND site_id=?').bind(clubId,site).first();
  try{
    if(path==='/api/club/stickers'){
      if(!superuser)return reply({error:'Nur für die PARASPOTS-Zentrale.'},403);
      if(!uuidPattern.test(b.id)||!await owns(b.site))return reply({error:'Gebiet oder Druckauftrag ungültig.'},400);
      let batch=await db.prepare('SELECT * FROM sticker_batches WHERE id=? AND club_id=? AND site_id=?').bind(b.id,clubId,b.site).first();
      if(!batch){
        if(b.reprint)return reply({error:'Auftrag nicht gefunden.'},404);
        const r=effective(settings,b.site);
        if(r.mode!=='paid'||!settings.bank.iban||!settings.bank.name||!settings.bank.count)invalid('Für den Datenexport bitte separate Gebühr, IBAN, Begünstigten und Stückzahl angeben.');
        if(revision!==b.revision)return reply({error:'Einstellungen geändert. Bitte neu laden.'},409);
        const snapshot={...settings.bank,cents:r.cents,download:settings.download};
        await db.prepare('INSERT OR IGNORE INTO sticker_batches SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM day_settings WHERE club_id=? AND revision=?) AND EXISTS(SELECT 1 FROM site_clubs WHERE club_id=? AND site_id=?)')
          .bind(b.id,clubId,b.site,JSON.stringify(snapshot),new Date().toISOString(),clubId,revision,clubId,b.site).run();
        batch=await db.prepare('SELECT * FROM sticker_batches WHERE id=? AND club_id=? AND site_id=?').bind(b.id,clubId,b.site).first();
        if(!batch)return reply({error:'Daten geändert. Bitte neu laden.'},409);
      }
      const snapshot=JSON.parse(batch.snapshot);
      if(!matchesPrint(snapshot,settings,b.site))invalid('Veraltet. Neue Aufkleber drucken, versenden und vor Ort ersetzen.');
      const labels=Array.from({length:snapshot.count},(_,i)=>clubId+'-'+batch.id+'-'+String(i+1).padStart(2,'0'));
      return reply({labels,...snapshot,site:b.site,clubId});
    }
    if(revision!==b.revision)return reply({error:'Einstellungen geändert. Bitte neu laden.'},409);
    let guardedSite='';
    switch(path){
      case '/api/club/day-rule':
        if(b.site){
          if(!await owns(b.site))return reply({error:'Kein Zugriff.'},403);
          guardedSite=b.site;
          if(b.mode==='inherit')delete settings.sites[b.site];else settings.sites[b.site]=rule(b);
        }else settings.base=rule(b);
        break;
      case '/api/club/day-options':
        settings.alternatives={cash:localized(b.cash),lift:localized(b.lift),paypal:link(b.paypal),other:link(b.other)};
        break;
      case '/api/club/day-bank':settings.bank=bankDetails(b);settings.download=downloadLink(b.download);break;
      default:return reply({error:'Nicht gefunden.'},404);
    }
    const result=await db.prepare("INSERT INTO day_settings SELECT ?,?,1 WHERE (?=0 OR EXISTS(SELECT 1 FROM day_settings WHERE club_id=? AND revision=?)) AND (?=\'\' OR EXISTS(SELECT 1 FROM site_clubs WHERE club_id=? AND site_id=?)) ON CONFLICT(club_id) DO UPDATE SET settings=excluded.settings,revision=day_settings.revision+1 WHERE day_settings.revision=?")
      .bind(clubId,JSON.stringify(settings),revision,clubId,revision,guardedSite,clubId,guardedSite,revision).run();
    return result.meta.changes?reply({ok:true}):reply({error:'Daten geändert. Bitte neu laden.'},409);
  }catch(error){if(error instanceof RangeError)return reply({error:error.message},400);throw error;}
}
