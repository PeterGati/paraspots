export const directions = ['N','NO','O','SO','S','SW','W','NW'];
export function validateSite(d) {
 const errors=[];
 if (!d || typeof d!=='object' || Array.isArray(d)) return ['A JSON egy starthely objektuma legyen.'];
 for (const k of ['region','site']) if(typeof d[k]!=='string'||!(/^[a-z0-9][a-z0-9-]{0,79}$/).test(d[k])) errors.push(`${k}: kisbetűs, kötőjeles azonosító szükséges.`);
 if(typeof d.name!=='string'||!d.name.trim()) errors.push('A név kötelező.');
 for(const key of ['operator','access','flightCharacteristics','siteRatings']) if(d[key]!=null&&(typeof d[key]!=='object'||Array.isArray(d[key]))) errors.push(`${key}: objektum szükséges.`);
 function keys(value){if(value&&typeof value==='object')for(const [key,v]of Object.entries(value)){if(['__proto__','prototype','constructor'].includes(key))errors.push('Nem megengedett JSON-kulcs.');keys(v);}}
 keys(d);

 function point(p,path){
  if(!p||typeof p!=='object'||Array.isArray(p)){errors.push(`${path}: hibás adat.`);return;}
  if(p.coordinates!=null){
   if(typeof p.coordinates!=='object'||Array.isArray(p.coordinates)) errors.push(`${path}: hibás koordináta.`);
   else for(const [k,max] of [['lat',90],['lon',180]]){let v=p.coordinates[k];if(v!=null&&(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>max)) errors.push(`${path}.coordinates.${k}: WGS84 tizedes fokot adj meg számként (például ${k==='lat'?'47.20083':'15.47583'}), −${max} és ${max} között.`);}
  }
  for(const k of ['startHeight','heightDifference','talHeight']) if(p[k]!=null&&(typeof p[k]!=='number'||!Number.isFinite(p[k]))) errors.push(`${path}.${k}: szám szükséges.`);
  for(const k of ['windDirections','launchDirections']) if(p[k]!=null){
   if(!Array.isArray(p[k]))errors.push(`${path}.${k}: irányok listája szükséges, például ["O","SO","S"].`);
   else {
    const bad=p[k].filter(x=>!directions.includes(x));
    if(bad.length)errors.push(`${path}.${k}: ismeretlen jelölés: ${bad.map(x=>JSON.stringify(x)).join(', ')}. Használható: N, NO, O, SO, S, SW, W, NW. O = Ost (kelet), NO = Nordost (északkelet). Példa: ["O","SO","S"].`);
    if(new Set(p[k]).size!==p[k].length)errors.push(`${path}.${k}: minden irány csak egyszer szerepelhet.`);
   }
  }
  for(const k of ['name','description','difficulty','windSensitivity','approachDescription','webcam']) if(p[k]!=null&&typeof p[k]!=='string') errors.push(`${path}.${k}: szöveg szükséges.`);
 }
 point(d,'starthely');
 for(const key of ['startpunkte','landeplaetze']) {
  if(d[key]!=null&&!Array.isArray(d[key])) errors.push(`${key}: lista szükséges.`);
  else (d[key]||[]).forEach((p,i)=>point(p,`${key}[${i+1}]`));
 }
 return errors;
}
export function importWarnings(d){
 const w=[];
 for(const key of ['startpunkte','landeplaetze']) for(const p of d[key]||[]) if(p.coordinates?.lat==null||p.coordinates?.lon==null)w.push(`${p.name||key}: hiányos koordináták.`);
 if(d.description?.length>1000)w.push('Hosszú leírás: ellenőrizd az importált szöveg tördelését.');
 return w;
}
