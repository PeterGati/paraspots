export function dayPanel(model,view,{esc,field}) {
  const {settings,batches}=model.day;
  const own=model.sites.filter(site=>site.club_id===model.club.id);
  const texts=(key,label,value)=>['de','en','hu'].map(lang=>field(key+'_'+lang,label+' · '+lang.toUpperCase(),value?.[lang])).join('');
  function ruleForm(site,title,rule) {
    const modes=[...(site?[['inherit','Vereinsvorgabe verwenden']]:[]),['none','Keine Tagesmitgliedschaft'],['paid','Separat zu bezahlen'],['lift','Im Bergliftticket enthalten']];
    return `<form data-save="day-rule" data-site="${esc(site)}"><h3>${esc(title)}</h3><label>Regelung<select name="mode">${modes.map(([id,name])=>`<option value="${id}" ${(rule?.mode||'inherit')===id?'selected':''}>${name}</option>`).join('')}</select></label>${field('amount','Preis in EUR (nur bei separater Gebühr)',rule?.cents?(rule.cents/100).toFixed(2):'','number','min="0.01" step="0.01"')}${texts('terms','Bedingungen',rule?.terms)}<button>Regelung speichern</button></form>`;
  }
  if(view===3){
    const a=settings.alternatives;
    return ruleForm('','Vereinsvorgabe',settings.base)+own.map(s=>ruleForm(s.id,s.draft.name,settings.sites[s.id])).join('')+
      `<form data-save="day-options"><h3>Weitere Zahlungswege</h3><p>Bei separater Gebühr und Angaben unter QR-Aufkleber steht der QR-Aufkleber immer an erster Stelle.</p>${texts('cash','Barzahlung – wo?',a.cash)}${field('paypal','PayPal-Link',a.paypal,'url')}${field('other','Weiterer Zahlungslink',a.other,'url')}${texts('lift','Berglift – wo oder wie bezahlen?',a.lift)}<button>Zahlungswege speichern</button></form>`;
  }
  const bank=settings.bank;
  let html=`<form data-save="day-bank"><p>PARASPOTS erstellt die Aufkleber zentral und versendet sie an den Verein. 25 bis 50 Stück ermöglichen Ersatz bei Witterung, UV-Strahlung, Schnee, Kratzern oder Vandalismus.</p>${field('iban','IBAN des Vereins',bank.iban)}${field('name','Begünstigter / Kontoinhaber',bank.name,'text','maxlength="70"')}${field('count','Gewünschte Stückzahl',bank.count,'number','min="25" max="50"')}${field('download','App-Store- oder TestFlight-Link (falls vorhanden)',settings.download,'url')}<p>Alle Felder leer: Die Zahlungshilfe bleibt in der App ausgeblendet. Bereits eine Angabe aktiviert sie für separat zahlbare Fluggebiete.</p><p>Bei Änderung der IBAN oder Gebühr neue Aufkleber anfordern, per Post zusenden und die alten vor Ort ersetzen.</p><button>Anforderung speichern</button></form>`;
  if(!model.superuser)return html;
  const separate=own.filter(s=>(settings.sites[s.id]??settings.base).mode==='paid');
  if(separate.length)html+=`<form data-save="stickers"><h3>Übergabe an die Druckvorbereitung</h3><label>Fluggebiet<select name="site">${separate.map(s=>`<option value="${esc(s.id)}">${esc(s.draft.name)}</option>`).join('')}</select></label><button>Aufkleber-IDs vergeben und Daten exportieren</button></form>`;
  for(const b of batches)html+=`<form data-save="stickers" data-id="${esc(b.id)}"><input type="hidden" name="site" value="${esc(b.site)}"><p>${esc(b.site)} · ${esc(b.created.slice(0,10))}</p>${b.current?'<button>Gleiche IDs erneut exportieren</button>':'Veraltet · neue Aufkleber versenden und ersetzen.'}</form>`;
  return html;
}
export async function saveDay(api,form,b,model){
  const action=form.dataset.save;
  const localized=key=>Object.fromEntries(['de','en','hu'].map(l=>[l,b[key+'_'+l]]));
  const base={revision:model.day.revision};
  if(action==='day-rule'){
    const cents=/^\d+(?:\.\d{1,2})?$/.test(b.amount)?Math.round(Number(b.amount)*100):0;
    return api('/day-rule','PUT',{...base,mode:b.mode,cents,site:form.dataset.site,terms:localized('terms')});
  }
  if(action==='day-options')return api('/day-options','PUT',{...base,paypal:b.paypal,other:b.other,cash:localized('cash'),lift:localized('lift')});
  if(action==='day-bank')return api('/day-bank','PUT',{...b,...base,count:b.count===''?null:Number(b.count)});
  if(!form.dataset.request)form.dataset.request=crypto.randomUUID();
  const data=await api('/stickers','PUT',{...base,id:form.dataset.id||form.dataset.request,reprint:!!form.dataset.id,site:b.site});
  const file={clubId:data.clubId,site:data.site,download:data.download,beneficiary:data.name,iban:data.iban,currency:'EUR',amount:(data.cents/100).toFixed(2),labels:data.labels.map(id=>({id,remittance:'PARASPOTS '+id}))};
  const url=URL.createObjectURL(new Blob([JSON.stringify(file,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.download='PARASPOTS-'+data.labels[0]+'.json';a.href=url;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
