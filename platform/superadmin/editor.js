import {directions,validateSite,importWarnings} from './validation.js';
import {directionEditor} from './directions.js';
const $=id=>document.getElementById(id),clone=x=>JSON.parse(JSON.stringify(x));
let records=[],current=null,selected=null,dirty=false,busy=false;
const labels={region:'Régió azonosítója',site:'Starthely azonosítója',name:'Név',coordinates:'Koordináták',lat:'Szélesség',lon:'Hosszúság',talHeight:'Völgy magassága (m)',operator:'Üzemeltető / egyesület',url:'Weboldal',phone:'Telefonszám',access:'Megközelítés',car:'Autóval',publicTransport:'Tömegközlekedéssel',hikeAndFly:'Hike & Fly',cableCar:'Felvonóval',parking:'Parkolás',flightCharacteristics:'Repülési lehetőségek',soaring:'Soaring',thermal:'Termik',crossCountry:'Távrepülés',windDirections:'Startirányok – területi összesítés',webcam:'Webkamera URL',approachDescription:'Megközelítés leírása',description:'Leírás',siteRatings:'Értékelések',overallRating:'Összesített értékelés',thermalRating:'Termik értékelése',startpunkte:'Startpontok',landeplaetze:'Leszállóhelyek',startHeight:'Startmagasság (m)',heightDifference:'Szintkülönbség (m)',launchDirections:'Startirányok',difficulty:'Nehézség',windSensitivity:'Szélérzékenység',startRating:'Start értékelése'};
const numeric=new Set(['lat','lon','talHeight','startHeight','heightDifference','overallRating','thermalRating','startRating']);
function message(text,error=false){
 for(const id of ['message','editor-message']){const el=$(id);el.textContent=text;el.classList.toggle('error',error);}
}
function updateControls(){
 $('save').disabled=busy||!current;$('save').textContent=busy?'Folyamatban…':'Piszkozat mentése';
 $('publish').disabled=busy||!selected||dirty;$('unpublish').disabled=busy||!selected?.published;
 $('export').disabled=busy||!current;
 for(const id of ['new','import','reload','logout'])$(id).disabled=busy;
 $('fields').inert=busy;
}
function savedSummary(row){
 const date=new Date(row.updated_at).toLocaleString('hu-HU');
 const same=JSON.stringify(row.draft)===JSON.stringify(row.published);
 return `Szerveren mentve: ${date}. ${row.published?(same?'Ez a változat már közzé van téve.':'Az appban még a korábbi közzétett változat látszik.'):'Még nincs közzétéve, az app ezt a piszkozatot nem látja.'}`;
}
async function api(path,options={}){
 const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...options.headers}});
 const b=await response.json();if(!response.ok){if(response.status===401)showLogin();throw Error(b.error||'Szerverhiba');}return b;
}
function showLogin(){$('login').hidden=false;$('workspace').hidden=true;$('logout').hidden=true;}
function element(tag,text,cls){const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;}
function get(obj,path){return path.reduce((a,k)=>a[k],obj);}
function set(obj,path,v){const a=path.slice(0,-1).reduce((a,k)=>a[k],obj);a[path.at(-1)]=v;}
function collect(){
 const data=clone(current);
 for(const el of $('fields').querySelectorAll('[data-path]')){
  const path=JSON.parse(el.dataset.path),type=el.dataset.type;
  let value=el.value;
  if(type==='directions'){value=[...el.querySelectorAll('input:checked')].map(x=>x.value);}
  else if(type==='boolean')value=el.checked;
  else if(type==='number'){value=value.trim()===''?null:Number(value);if(value!==null&&!Number.isFinite(value))throw Error('Érvénytelen szám.');}
  else if(type==='json')try{value=JSON.parse(value);}catch{throw Error(`${labels[path.at(-1)]||path.at(-1)}: hibás JSON.`);}
  else if(value===''&&get(current,path)===null)value=null;
  set(data,path,value);
 }
 return data;
}
function field(parent,key,value,path){
 const title=labels[key]||key;
 if(['startpunkte','landeplaetze'].includes(key)){
  const section=element('fieldset');section.append(element('legend',title));
  (value||[]).forEach((p,i)=>{const entry=element('div',null,'entry');entry.append(element('h3',`${i+1}. ${p.name||title}`));object(entry,p,[...path,i]);const del=element('button','Eltávolítás');del.type='button';del.onclick=()=>{if(!confirm('Eltávolítod ezt a pontot a piszkozatból?'))return;current=collect();get(current,path).splice(i,1);dirty=true;renderFields();};entry.append(del);section.append(entry);});
  const add=element('button',key==='startpunkte'?'Startpont hozzáadása':'Leszállóhely hozzáadása');add.type='button';add.onclick=()=>{current=collect();get(current,path).push({name:'',coordinates:{lat:null,lon:null},...(key==='startpunkte'?{startHeight:null,heightDifference:null,launchDirections:[]}:{}),difficulty:null,windSensitivity:null,description:''});dirty=true;renderFields();};section.append(add);parent.append(section);return;
 }
 if(value&&typeof value==='object'&&!Array.isArray(value)){
  const fs=element('fieldset');fs.append(element('legend',title));object(fs,value,path);parent.append(fs);return;
 }
 const label=element('label',title);
 let input;
 if(['windDirections','launchDirections'].includes(key)){
  const control=directionEditor(value||[],title,path,key);parent.append(control);return;
 }else if(typeof value==='boolean'){label.className='check-label';input=element('input');input.type='checkbox';input.checked=value;input.dataset.type='boolean';}
 else if(numeric.has(key)){input=element('input');input.type='number';input.step='any';input.value=value??'';input.dataset.type='number';}
 else if(Array.isArray(value)){input=element('textarea');input.value=JSON.stringify(value,null,2);input.dataset.type='json';label.className='wide';}
 else{input=element(/description/i.test(key)?'textarea':'input');input.value=value??'';input.dataset.type='text';if(input.tagName==='TEXTAREA')label.className='wide';}
 input.dataset.path=JSON.stringify(path);
 if(selected&&['site','region'].includes(key))input.disabled=true;
 if(input.tagName==='DIV'){label.append(input);}else{input.setAttribute('aria-label',title);label.append(input);}parent.append(label);
}
function object(parent,data,path=[]){const grid=element('div',null,'grid');for(const [key,value]of Object.entries(data)){if(key==='airspaces')continue;if(value&&typeof value==='object'&&!Array.isArray(value)||['startpunkte','landeplaetze','windDirections','launchDirections'].includes(key)){const wide=element('div',null,'wide');field(wide,key,value,[...path,key]);grid.append(wide);}else field(grid,key,value,[...path,key]);}parent.append(grid);}
function renderFields(){
 $('fields').replaceChildren();object($('fields'),current);$('title').textContent=current.name||'Új starthely';
 $('state').textContent=selected?.published?'Van közzétett változat':'Piszkozat';
 $('warnings').textContent=importWarnings(current).join('\n');$('preview').textContent=JSON.stringify(current,null,2);
 updateControls();
}
function open(data,row=null){current=clone(data);selected=row;dirty=!row;$('empty').hidden=true;$('editor').hidden=false;renderFields();message(row?savedSummary(row):'Még nincs elmentve. Ellenőrizd az adatokat, majd mentsd piszkozatként.');}
async function load(keep=false){
 const data=await api('/api/admin/sites');records=data.sites;$('records').replaceChildren();
 for(const row of records){const btn=element('button',row.draft.name,'record');btn.append(element('small',row.published?'Közzétett + szerkeszthető piszkozat':'Piszkozat'));btn.onclick=()=>{if(dirty&&!confirm('Elveted a nem mentett módosításokat?'))return;open(row.draft,row);};$('records').append(btn);}
 if(keep&&current){const row=records.find(x=>x.id===current.region+'/'+current.site);if(row)open(row.draft,row);}
}
async function action(fn){if(busy)return;busy=true;updateControls();message('Művelet folyamatban…');try{await fn();}catch(e){message(e.message,true);}finally{busy=false;updateControls();}}
$('login-form').onsubmit=e=>{e.preventDefault();action(async()=>{const f=new FormData(e.target);await api('/api/login',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});e.target.password.value='';await start();});};
async function start(){await api('/api/admin/session');$('login').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;await load();message('Kapcsolat rendben. A módosítások csak közzététel után jutnak el az apphoz.');}
$('logout').onclick=()=>action(async()=>{await api('/api/logout',{method:'POST',body:'{}'});location.reload();});
$('reload').onclick=()=>action(async()=>{await load();message('Lista frissítve. A nyitott szerkesztés megmaradt.');});
$('new').onclick=()=>{if(dirty&&!confirm('Elveted a nem mentett módosításokat?'))return;open({region:'niederoesterreich',site:'',name:'',coordinates:{lat:null,lon:null},talHeight:null,operator:{name:'',url:'',phone:null},access:{car:false,publicTransport:false,hikeAndFly:false,cableCar:false,parking:null},flightCharacteristics:{soaring:false,thermal:false,crossCountry:false},windDirections:[],webcam:null,approachDescription:'',description:'',siteRatings:{overallRating:null,thermalRating:null},startpunkte:[],landeplaetze:[]});};
$('import').onchange=e=>action(async()=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;if(file.size>262144)throw Error('Maximum 256 KB méretű JSON tölthető be.');
 let data;try{data=JSON.parse(await file.text());}catch{throw Error('A fájl nem érvényes JSON.');}
 const errors=validateSite(data);if(errors.length)throw Error(errors.join('\n'));
 if(dirty&&!confirm('Elveted a nem mentett módosításokat?'))return;
 const row=records.find(x=>x.id===data.region+'/'+data.site);
 if(row&&!confirm('Ez a starthely már létezik. A fájl adatait betöltöd a szerkesztőbe? Mentésig semmi sem változik.'))return;
 data.startpunkte??=[];data.landeplaetze??=[];data.windDirections??=[];
 open(data,row);dirty=true;$('publish').disabled=true;message('JSON betöltve előnézetbe. Ellenőrizd, majd mentsd piszkozatként.');
});
$('site-form').addEventListener('input',()=>{dirty=true;updateControls();message('Nem mentett módosítások. Az app tartalma még nem változott.');});
$('site-form').onsubmit=e=>{e.preventDefault();action(async()=>{const data=collect(),errors=validateSite(data);if(errors.length)throw Error(errors.join('\n'));await api('/api/admin/sites',{method:'PUT',body:JSON.stringify({data,revision:selected?.revision??0})});current=data;dirty=false;await load(true);message('✓ Piszkozat elmentve. '+savedSummary(selected));});};
for(const mode of ['publish','unpublish'])$(mode).onclick=()=>action(async()=>{
 if(!selected)return;if(mode==='publish'&&dirty)throw Error('Előbb mentsd a piszkozatot.');
 if(!confirm(mode==='publish'?'Közzéteszed ezt a változatot az app számára?':'Visszavonod a közzétételt? Az online frissülő appból eltűnik; offline készüléken a régi adat még megmaradhat.')){message('Művelet megszakítva.');return;}
 await api(`/api/admin/sites/${encodeURIComponent(selected.id)}/${mode}`,{method:'POST',body:JSON.stringify({revision:selected.revision})});await load(true);message(mode==='publish'?'Közzétéve. Az app a következő sikeres frissítéskor veszi át.':'Közzététel visszavonva.');
});
$('export').onclick=()=>action(async()=>{const data=collect();const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=element('a');a.href=url;a.download=(data.site||'starthely')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('JSON export elkészült. A szerveren nem változott az adat.');});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
start().catch(e=>{showLogin();message(e.message,true);});
