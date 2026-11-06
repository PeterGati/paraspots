const params=new URLSearchParams(location.search);
const langs=['de','en','hu'];
const lang=langs.includes(params.get('lang'))?params.get('lang'):'de';
const id=params.get('id'), index=langs.indexOf(lang), main=document.querySelector('main');
document.documentElement.lang=lang;
for(const l of langs){const a=document.createElement('a');a.textContent=l.toUpperCase();a.href='?'+new URLSearchParams({id,lang:l});document.querySelector('nav').append(a);}
function add(tag,text){const el=document.createElement(tag);el.textContent=text;main.append(el);return el;}
const labels={description:['Vereinsprofil','Club profile','Klubprofil'],areas:['Fluggebiete','Flying sites','Repülőterületek'],warnings:['Warnungen & Sperren','Warnings & closures','Figyelmeztetések és lezárások'],events:['Veranstaltungen','Events','Események'],webcams:['Webcams & Medien','Webcams & media','Webkamerák és média'],tandem:['Tandemflüge','Tandem flights','Tandemrepülések']};
try {
  const response=await fetch('/api/sites?lang='+lang);
  if(!response.ok)throw Error();
  const {clubs,sites}=await response.json(),club=clubs.find(c=>c.id===id);
  if(!club)throw Error();
  document.title=club.name+' · PARASPOTS';add('h1',club.name);
  for(const [key,title] of Object.entries(labels)){
    if(club.hidden?.includes(key))continue;
    if(key==='areas'){
      const list=sites.filter(s=>s.data.clubId===id);
      if(list.length){add('h2',title[index]);for(const s of list)add('p',s.data.name);}
      continue;
    }
    const text=club[key]?.[lang] || club[key]?.de;
    const link=key==='tandem'?club.link:key==='webcams'?club.webcamLink:null;
    if(!text&&!link)continue;
    add('h2',title[index]);if(text)add('p',text);
    if(link && new URL(link).protocol==='https:'){const a=add('a',new URL(link).hostname+' ↗');a.href=link;a.rel='noopener noreferrer';}
  }
}catch{add('p',['Verein derzeit nicht verfügbar.','Club currently unavailable.','A klub jelenleg nem érhető el.'][index]);}
