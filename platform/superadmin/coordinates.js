export function googleMapsUrl(lat,lon){
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
 const url=new URL('https://www.google.com/maps/search/');url.searchParams.set('api','1');url.searchParams.set('query',`${lat},${lon}`);return url.href;
}
function el(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
export function coordinateEditor(value,path){
 const fs=el('fieldset',null,'coordinate-editor');fs.append(el('legend','Koordináták · GPS (WGS84)'));
 fs.append(el('p','Tizedes fok / Dezimalgrad. Külön mezőbe írd a szélességet és a hosszúságot. Példa: lat 47.20083, lon 15.47583.','coordinate-help'));
 const fields=el('div',null,'grid'),inputs={};
 for(const [key,title,max,example]of [['lat','Szélesség / Latitude (lat)',90,'47.20083'],['lon','Hosszúság / Longitude (lon)',180,'15.47583']]){
  const label=el('label',title),input=el('input');input.type='number';input.step='any';input.min=-max;input.max=max;input.placeholder=example;input.value=value?.[key]??'';input.dataset.type='number';input.dataset.path=JSON.stringify([...path,key]);input.setAttribute('aria-label',title);label.append(input);fields.append(label);inputs[key]=input;
 }
 fs.append(fields);
 fs.append(el('p','Formátum: számok fokjel, N/E/O betű és fok–perc–másodperc jelölés nélkül. JSON-ban tizedespontot használj. A két szám sorrendje a térképlinkben: lat, lon.','coordinate-help'));
 fs.append(el('p','Észak és kelet pozitív, dél és nyugat negatív. Breite: −90…90; Länge: −180…180.','coordinate-help'));
 const link=el('a','Google Maps – pont ellenőrzése ↗','button coordinate-map-link'),status=el('p',null,'coordinate-help');link.target='_blank';link.rel='noopener noreferrer';
 const update=()=>{const url=googleMapsUrl(inputs.lat.valueAsNumber,inputs.lon.valueAsNumber);link.setAttribute('aria-disabled',String(!url));if(url){link.href=url;status.textContent='A link a fenti pontot mutatja meg; az adatokat továbbra is a piszkozat mentésével rögzíted.';}else{link.removeAttribute('href');status.textContent='A térképes ellenőrzéshez mindkét koordinátát érvényesen add meg.';}};
 fields.addEventListener('input',update);update();fs.append(link,status);
 const details=el('details');details.append(el('summary','JSON-példa / JSON-Beispiel'));details.append(el('pre','"coordinates": { "lat": 47.20083, "lon": 15.47583 }'));fs.append(details);return fs;
}
