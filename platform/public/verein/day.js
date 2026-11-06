const copy={
 de:['Tagesmitgliedschaft','Im Bergliftticket enthalten','QR-Aufkleber vor Ort','Öffne deine eigene Banking-App. Scanne den Zahlungscode, prüfe Begünstigten, IBAN, Betrag und Verwendungszweck und gib die Überweisung frei. Bewahre die SMS oder Buchungsbestätigung für die Kontrolle durch den Verein auf.','Barzahlung','Weiterer Zahlungslink','Berglift'],
 en:['Day membership','Included in the lift ticket','QR sticker on site','Open your own banking app. Scan the payment code, check the beneficiary, IBAN, amount and reference, then authorise the transfer. Keep the SMS or booking confirmation for a local check by the club.','Cash','Other payment link','Mountain lift'],
 hu:['Napi tagság','A felvonójegy tartalmazza','Helyszíni QR-matrica','Nyisd meg a saját banki appodat. Olvasd be a fizetési kódot, ellenőrizd a kedvezményezettet, az IBAN-t, az összeget és a közleményt, majd hagyd jóvá az átutalást. Őrizd meg az SMS-t vagy a könyvelési visszaigazolást a klub helyszíni ellenőrzéséhez.','Készpénz','Egyéb fizetési link','Felvonó']
};
export function showMembership(add,m,lang){
 if(!m)return;
 const c=copy[lang],local=v=>v?.[lang]||v?.de||'';
 add('h4',c[0]);
 if(m.mode!=='info')add('p',m.mode==='lift'?c[1]:new Intl.NumberFormat(lang,{style:'currency',currency:'EUR'}).format(m.cents/100));
 if(local(m.terms))add('p',local(m.terms));
 for(const method of m.methods){
   if(method.kind==='qr'){add('strong',c[2]);add('p',c[3]);}
   else if(method.kind==='cash'||method.kind==='lift'){add('p',(method.kind==='cash'?c[4]:c[6])+' · '+local(method.value));}
   else{const a=add('a',method.kind==='paypal'?'PayPal':c[5]);a.href=method.value;add('p','');}
 }
}
