import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {database} from './d1.js';
import {membershipWrite,addMemberships,membershipAdmin} from '../backend/membership.js';

test('mixed sites, partial sticker fields, ordering, clearing, ownership and immutable handoff',async()=>{
 const db=database();
 const owners=new Map([['a','002'],['b','002'],['c','002'],['other','001']]);
 for(const [site,owner] of owners){
   db.sql.prepare("INSERT INTO sites(id,draft,updated_at) VALUES(?,'{}','')").run(site);
   db.sql.prepare('INSERT INTO site_clubs VALUES(?,?)').run(site,owner);
 }
 let revision=0;
 const write=async(path,b,superuser=false)=>membershipWrite({db,clubId:'002',superuser,path:'/api/club/'+path,b:{revision,...b},reply:(data,status=200)=>({data,status})});
 const save=async(path,b)=>{assert.equal((await write(path,b)).status,200);revision++;};
 const get=async()=>{const sites=[...owners.keys()].map(id=>({id,data:{}}));await addMemberships(db,sites,owners);return sites.map(s=>s.data.dayMembership);};
 assert.deepEqual((await get()).filter(Boolean),[]);
 await save('day-rule',{mode:'paid',cents:650,terms:{hu:'Egy nap'}});
 await save('day-rule',{site:'b',mode:'lift'});
 await save('day-rule',{site:'c',mode:'none'});
 await save('day-options',{cash:{de:'Vereinshaus'},paypal:'https://paypal.me/example',other:'https://example.com',lift:{de:'Talstation'}});
 assert.equal((await get())[0].showPaymentHelp,false);
 const exampleIban='AT611904300234573201';
 for(const field of [{count:25},{iban:exampleIban},{name:'Musterverein'},{download:'https://testflight.apple.com/join/Example1'}]){
   await save('day-bank',{...field});
   const [paid,lift,none,other]=await get();
   assert.equal(paid.showPaymentHelp,true);
   assert.deepEqual(paid.methods.map(m=>m.kind),['qr','cash','paypal','other','lift']);
   assert.equal(paid.cents,650);assert.equal(lift.mode,'lift');assert.equal(lift.showPaymentHelp,false);assert.deepEqual(lift.methods,[]);
   assert.equal(none,undefined);assert.equal(other,undefined);
   assert.equal(JSON.stringify(paid).includes(exampleIban),false);
   await save('day-bank',{});
   assert.equal((await get())[0].showPaymentHelp,false);
 }
 assert.equal((await write('day-bank',{count:24})).status,400);
 assert.equal((await write('day-rule',{site:'other',mode:'paid',cents:10})).status,403);
 assert.equal((await write('day-rule',{mode:'none',revision:0})).status,409);
 await save('day-bank',{count:50,iban:exampleIban,name:'Musterverein'});
 const order={id:randomUUID(),site:'a'};
 assert.equal((await write('stickers',order)).status,403);
 const exported=await write('stickers',order,true);
 assert.equal(exported.status,200);assert.equal(exported.data.download,'');
 assert.equal(new Set(exported.data.labels).size,50);
 assert.deepEqual((await write('stickers',order,true)).data.labels,exported.data.labels);
 await save('day-rule',{site:'a',mode:'paid',cents:850});
 assert.equal((await write('stickers',order,true)).status,400);
 assert.equal((await membershipAdmin(db,'002')).batches[0].current,false);
 await save('day-rule',{site:'a',mode:'inherit'});
 assert.equal((await get())[0].cents,650);
});

test('a saved sticker field activates instructions on an unconfigured site, without publishing a fee',async()=>{
  const db=database(),owners=new Map([['hw','001']]);
  const s={base:{mode:'none',cents:0,terms:{}},sites:{},bank:{iban:'present'},alternatives:{},download:''};
  async function feed(){
    db.sql.prepare('INSERT OR REPLACE INTO day_settings VALUES(?,?,1)').run('001',JSON.stringify(s));
    const sites=[{id:'hw',data:{}}];await addMemberships(db,sites,owners);return sites[0].data;
  }
  assert.deepEqual(await feed(),{paymentHelp:{mode:'info',showPaymentHelp:true,methods:[{kind:'qr'}]}});
  s.bank.iban='';assert.deepEqual(await feed(),{});
  s.bank.count=25;s.base.terms={de:'',en:'',hu:''};assert.deepEqual(await feed(),{});
  s.base.mode='lift';assert.equal((await feed()).dayMembership.showPaymentHelp,false);
});
