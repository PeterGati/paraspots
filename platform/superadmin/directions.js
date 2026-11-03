import {directions} from './validation.js';
const ns='http://www.w3.org/2000/svg';
const names={N:'Nord · észak',NO:'Nordost · északkelet',O:'Ost · kelet',SO:'Südost · délkelet',S:'Süd · dél',SW:'Südwest · délnyugat',W:'West · nyugat',NW:'Nordwest · északnyugat'};
function el(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
function svgEl(tag,attrs){const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n;}
function xy(deg,r=108){const a=(deg-90)*Math.PI/180;return [150+r*Math.cos(a),150+r*Math.sin(a)];}
function render(svg,chosen){
 svg.replaceChildren(svgEl('circle',{cx:150,cy:150,r:108,fill:'#cfe8ff'}));
 for(const [i,code] of directions.entries()){
  if(chosen.includes(code)){const s=xy(i*45-22.5),e=xy(i*45+22.5);svg.append(svgEl('path',{'data-direction':code,fill:'#5fd12f',d:`M150 150 L${s[0]} ${s[1]} A108 108 0 0 1 ${e[0]} ${e[1]} Z`}));}
  const [x,y]=xy(i*45,134),t=svgEl('text',{x,y,'text-anchor':'middle','dominant-baseline':'middle','font-size':19,'font-weight':700,fill:'#102740'});t.textContent=code;svg.append(t);
 }
 svg.setAttribute('aria-label',chosen.length?`Rögzített startirányok: ${chosen.join(', ')}`:'Nincs megadott startirány');
}
export function directionEditor(value,title,path,key){
 const fs=el('fieldset',null,'direction-editor');fs.append(el('legend',title));
 fs.append(el('p','Több irány is kijelölhető. Wähle eine oder mehrere Startrichtungen aus.','direction-help'));
 const layout=el('div',null,'direction-layout'),svg=svgEl('svg',{viewBox:'0 0 300 300',role:'img',class:'direction-compass'});
 const input=el('div',null,'direction-set');input.dataset.type='directions';input.dataset.path=JSON.stringify(path);input.setAttribute('role','group');input.setAttribute('aria-label',title);
 for(const code of directions){const label=el('label'),check=el('input');check.type='checkbox';check.value=code;check.checked=value.includes(code);check.setAttribute('aria-label',`${code} – ${names[code]}`);label.append(check,el('span',`${code} — ${names[code]}`));input.append(label);}
 const update=()=>render(svg,[...input.querySelectorAll('input:checked')].map(n=>n.value));input.addEventListener('input',update);update();layout.append(svg,input);fs.append(layout);
 fs.append(el('p','Zöld = megadott startirány / Grün = hinterlegte Startrichtung.','direction-help'));
 fs.append(el('p',key==='windDirections'?'Itt a teljes repülőterület startirányait add meg. Az egyes startpontok irányait a saját adatlapjukon jelöld.':'Csak ennek a startpontnak az irányait jelöld.','direction-help'));
 const details=el('details');details.append(el('summary','JSON-formátum / JSON-Format'));
 details.append(el('p','Kizárólag ezek a német rövidítések használhatók: N, NO, O, SO, S, SW, W, NW. Például kelet = O, nem E; délkelet = SO, nem SE. Az irányokat külön listaelemként add meg, ne egyetlen „O/SO/S” szövegként.'));
 details.append(el('pre',`"${key}": ["O", "SO", "S"]`));fs.append(details);return fs;
}
