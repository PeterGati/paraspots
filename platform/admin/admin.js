import {dayPanel,saveDay} from './day.js';
const titles=['Übersicht','Vereinsprofil','Fluggebiete','Tagesmitgliedschaft','QR-Aufkleber','Warnungen & Sperren','Luftraum & Naturschutz','Veranstaltungen','Webcams & Medien','Tandemflüge','Mitglieder & Zugänge','Module & Einstellungen'];
const sections={1:'description',5:'warnings',7:'events',8:'webcams',9:'tandem'};
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search);
const elevated=params.get('mode')==='super';
let selected=params.get('club') || '001', view=0, model;
const field=(name,title,value='',type='text',extra='')=>`<label>${esc(title)}<input type="${type}" name="${name}" value="${esc(value)}" ${extra}></label>`;
const langs=['de','en','hu'];
async function api(path='',method='GET',data) {
  const query=elevated?'?mode=super&club='+encodeURIComponent(selected):'';
  const binary=data instanceof File;
  const response=await fetch('/api/club'+path+query,{method,headers:data&&!binary?{'Content-Type':'application/json'}:{},body:binary?data:data?JSON.stringify(data):undefined});
  const result=await response.json();
  if(!response.ok) throw Object.assign(new Error(result.error || 'Anfrage fehlgeschlagen.'),{status:response.status});
  return result;
}
function showError(error){$('message').textContent=error.message;}
async function load() {
  try {model=await api();$('login').hidden=true;$('workspace').hidden=false;$('logout').hidden=elevated;render();}
  catch(e){if(e.status===401){$('workspace').hidden=true;$('login').hidden=elevated;if(elevated)$('message').innerHTML='<a href="/superadmin/">Im Superadmin anmelden</a>';}else showError(e);}
}
function render(){
  const {club,sites,accounts}=model;
  const own=sites.filter(s=>s.club_id===club.id);
  $('title').textContent=club.name;$('number').textContent='Verein '+club.id;
  $('switch').hidden=!model.superuser;$('switch').innerHTML=model.clubs.map(c=>`<option value="${c.id}" ${c.id===club.id?'selected':''}>${esc(c.name)} · ${c.id}</option>`).join('');
  $('menu').innerHTML=titles.map((s,i)=>`<button data-view="${i}" ${view===i?'aria-current="page"':''}>${esc(s)}</button>`).join('');
  let html='';
  if(view===0) html=`<p>${own.length} zugeordnete Fluggebiete · ${accounts.length} Verwaltungszugänge</p><a href="/verein/?id=${club.id}">Öffentliche Vereinsseite öffnen</a>`;
  else if(sections[view]) {
    const key=sections[view],p=club.profile;
    html=`<form data-save="profile">${view===1?field('name','Vereinsname',club.name,'text','required'):''}${langs.map(l=>`<label>Text · ${l.toUpperCase()}<textarea name="${l}" maxlength="6000">${esc(p[key]?.[l])}</textarea></label>`).join('')}${view===9?field('link','Externer Tandem-Link',p.link,'url'):view===8?field('webcamLink','Webcam-Link',p.webcamLink,'url'):''}<button>Speichern und veröffentlichen</button></form>`;
  } else if(view===2) {
    html=own.map(s=>`<form data-save="site" data-site="${esc(s.id)}"><h3>${esc(s.draft.name)}</h3>${field('name','Gebietsname',s.draft.name,'text','required')}<label>Beschreibung · DE<textarea name="description">${esc(s.draft.description)}</textarea></label><button>Entwurf speichern</button><p>Die Freigabe erfolgt im Superadmin.</p></form><details><summary>Alle Gebietsdaten bearbeiten</summary><form data-save="full-site" data-site="${esc(s.id)}"><label>Vollständiger Gebietsentwurf (JSON)<textarea name="draft" required>${esc(JSON.stringify(s.draft,null,2))}</textarea></label><button>Entwurf speichern</button></form></details>`).join('')||'<p>Noch kein Fluggebiet zugeordnet.</p>';
    html+=`<form data-save="new-site"><h3>Fluggebiet anlegen</h3>${field('name','Gebietsname','','text','required')}${field('region','Regionskürzel','','text','required')}${field('slug','Gebietskürzel','','text','required')}<button>Entwurf anlegen</button></form>`;
    if(model.superuser)html+=`<form data-save="owner"><label>Fluggebiet zu diesem Verein zuordnen<select name="site" required>${sites.filter(s=>s.club_id!==club.id).map(s=>`<option value="${esc(s.id)}">${esc(s.draft.name)} · ${esc(s.club_id||'nicht zugeordnet')}</option>`).join('')}</select></label><button>Zuordnen</button></form>`;
  } else if(view===3||view===4){html=dayPanel(model,view,{esc,field});
  } else if(view===6) {
    html='<p>Vorbereitete Satellitenkarte in sRGB mit eingezeichneten AMSL-Höhen, Grenzen und Schutzzonen hochladen. Empfohlen: 6000 × 4000 Pixel, bei großen Karten bis 8192 Pixel an der langen Seite.</p>';
    html+=`<form data-save="map">${field('title','Kartentitel','','text','required')}${field('source','Quelle','','text','required')}${field('updated','Aktualisiert am','','date','required')}${field('image','WebP / JPEG · bis 32 MB','','file','accept="image/webp,image/jpeg" required')}<button>Karte zur Bibliothek hinzufügen</button></form>`;
    if(model.maps.length && own.length) html+=`<form data-save="view"><label>Fluggebiet<select name="site">${own.map(s=>`<option value="${esc(s.id)}">${esc(s.draft.name)}</option>`).join('')}</select></label><label>Karte<select name="map">${model.maps.map(m=>`<option value="${esc(m.id)}">${esc(m.title)} · ${esc(m.updated)}</option>`).join('')}</select></label>${field('x','Mittelpunkt horizontal (0–1)',.5,'number','step="any" min="0" max="1" required')}${field('y','Mittelpunkt vertikal (0–1)',.5,'number','step="any" min="0" max="1" required')}${field('zoom','Anfangszoom (1–16)',1,'number','step="any" min="1" max="16" required')}<button>Grundansicht speichern</button> <button name="remove" value="1">Zuordnung entfernen</button></form>`;
  } else if(view===10) {
    html=accounts.map(a=>`<p>${esc(a.email)} · ${a.active?'Aktiv':'Passwort ausstehend'}</p>`).join('')||'<p>Noch kein Verwaltungszugang.</p>';
    if(model.superuser)html+=`<form data-save="account">${field('email','Zugang für diesen Verein',accounts[0]?.email,'email','required')}${field('password','Passwort festlegen oder ersetzen','','password','minlength="12" maxlength="256" autocomplete="new-password" required')}<button>Zugang speichern</button></form>`;
  } else if(view===11) {
    html=`<form data-save="modules">${Object.entries(sections).map(([i,k])=>`<label><input type="checkbox" name="${k}" ${club.profile.hidden?.includes(k)?'':'checked'}> ${titles[i]}</label>`).join('')}<button>Sichtbarkeit speichern</button></form>`;
  } else html='<p>Vorbereitet. Die Konfiguration wird in der nächsten Entwicklungsphase freigeschaltet.</p>';
  $('panel').innerHTML='<h2>'+titles[view]+'</h2>'+html;
  restoreView();
}
function restoreView(){
  const f=document.querySelector('[data-save="view"]');if(!f)return;
  const v=model.views.find(v=>v.site_id===f.elements.site.value && v.map_id===f.elements.map.value);
  for(const [k,d] of [['x',.5],['y',.5],['zoom',1]])f.elements[k].value=v?.[k]??d;
}
$('menu').onclick=e=>{if(e.target.dataset.view!==undefined){view=Number(e.target.dataset.view);$('message').textContent='';render();}};
$('switch').onchange=async e=>{selected=e.target.value;await load();};
$('panel').onchange=e=>{if(e.target.tagName==='SELECT')restoreView();};
$('login').onsubmit=async e=>{e.preventDefault();try{await api('/login','POST',Object.fromEntries(new FormData(e.target)));e.target.reset();$('message').textContent='';await load();}catch(err){showError(err);}};
$('logout').onclick=async()=>{try{await api('/logout','POST');model=null;await load();}catch(err){showError(err);}};
$('panel').onsubmit=async e=>{
  e.preventDefault();const form=e.target,action=form.dataset.save,b=Object.fromEntries(new FormData(form)),p=structuredClone(model.club.profile);
  const button=e.submitter;button.disabled=true;
  try {
    if(action==='profile'||action==='modules'){
      if(action==='profile'){p[sections[view]]=Object.fromEntries(langs.map(l=>[l,b[l]]));if(view===9)p.link=b.link;if(view===8)p.webcamLink=b.webcamLink;}
      else p.hidden=Object.values(sections).filter(k=>!b[k]);
      await api('/profile','PUT',{name:b.name||model.club.name,profile:p,revision:model.club.revision});
    }else if(action==='site'){const s=model.sites.find(s=>s.id===form.dataset.site);await api('/site','PUT',{...b,site:s.id,revision:s.revision});}
    else if(action==='full-site'){
      const s=model.sites.find(s=>s.id===form.dataset.site);
      let draft;try{draft=JSON.parse(b.draft);}catch{throw Error('Der Entwurf enthält ungültiges JSON.');}
      await api('/site','PUT',{draft,site:s.id,revision:s.revision});
    } else if(action==='new-site'){await api('/new-site','PUT',b);}
    else if(action==='owner'){if(!b.site)throw Error('Fluggebiet auswählen.');await api('/ownership','PUT',{site:b.site,previous:model.sites.find(s=>s.id===b.site).club_id});}
    else if(action==='map'){const uploaded=await api('/map-image','POST',b.image);await api('/map','PUT',{...b,image:uploaded.photo});}
    else if(action==='view'){await api('/view','PUT',{...b,x:Number(b.x),y:Number(b.y),zoom:Number(b.zoom),remove:button.name==='remove'});}
    else if(action.startsWith('day-')||action==='stickers'){await saveDay(api,form,b,model);}
    else if(action==='account'){await api('/account','PUT',b);form.reset();}
    $('message').textContent='Gespeichert.';await load();
  }catch(err){showError(err);}finally{button.disabled=false;}
};
load();
