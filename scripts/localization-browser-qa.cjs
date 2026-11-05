const {chromium}=require('playwright');const fs=require('fs');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:4175/superadmin/');await page.locator('input[name=email]').fill('qa@example.test');await page.locator('input[name=password]').fill('local-qa-only');await page.getByRole('button',{name:'Belépés',exact:true}).click();await page.locator('#workspace').waitFor({state:'visible'});
 const seed={region:'test',site:'localization',name:'Lokalisierungstest',description:'Deutscher Testtext',coordinates:{lat:47.2,lon:15.4},windDirections:['O','SO'],operator:{name:'Testverein',url:'https://example.test',phone:'123'},access:{parking:'Parktext',car:true},startpunkte:[{name:'Startpunkt',description:'Original Starttext',coordinates:{lat:47.2,lon:15.4},launchDirections:['S']}],landeplaetze:[]};
 await page.locator('#import').setInputFiles({name:'localization.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(seed))});await page.locator('#editor').waitFor({state:'visible'});
 assert.match(await page.locator('#warnings').textContent(),/EN hiányzik/);
 const field=(path,lang)=>page.locator('[data-translation]').filter({visible:true}).evaluateAll((els,{path,lang})=>els.findIndex(el=>JSON.stringify(JSON.parse(el.dataset.translation).path)===JSON.stringify(path)&&JSON.parse(el.dataset.translation).lang===lang),{path,lang});
 async function fill(path,lang,text){const index=await field(path,lang);assert(index>=0);await page.locator('[data-translation]').nth(index).fill(text);}
 await fill(['description'],'en','Approved English test content');await fill(['description'],'hu','Jóváhagyott magyar teszttartalom');await fill(['startpunkte',0,'description'],'hu','Magyar startpont tesztszöveg');
 await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#message').textContent.startsWith('✓ Piszkozat'));
 const before=await (await page.request.get('http://127.0.0.1:4175/api/sites')).json();assert.equal(before.sites.length,0);
 await page.locator('#publish').click();await page.waitForFunction(()=>document.querySelector('#message').textContent.startsWith('Közzétéve'));
 const response=await (await page.request.get('http://127.0.0.1:4175/api/sites')).json();assert.equal(response.sites[0].data.description,seed.description);assert.deepEqual(response.sites[0].data.windDirections,seed.windDirections);assert.deepEqual(response.sites[0].data.coordinates,seed.coordinates);
 for(const [lang,want]of [['de',seed.description],['en','Approved English test content'],['hu','Jóváhagyott magyar teszttartalom']]){const payload=await(await page.request.get('http://127.0.0.1:4175/api/sites?lang='+lang)).json();assert.equal(payload.sites[0].data.description,want);}
 fs.writeFileSync('.qa/localization-published.json',JSON.stringify(response));
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`.qa/localization-${width}.png`,fullPage:true});}
 await page.reload();await page.locator('.record').click();const saved=await page.locator('[data-translation]').nth(await field(['description'],'hu')).inputValue();assert.equal(saved,'Jóváhagyott magyar teszttartalom');
 await fill(['description'],'hu','Frissített magyar teszttartalom');await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#message').textContent.startsWith('✓ Piszkozat'));
 const draft=await(await page.request.get('http://127.0.0.1:4175/api/sites?lang=hu')).json();assert.equal(draft.sites[0].data.description,'Jóváhagyott magyar teszttartalom');
 await page.locator('#publish').click();await page.waitForFunction(()=>document.querySelector('#message').textContent.startsWith('Közzétéve'));
 const updated=await(await page.request.get('http://127.0.0.1:4175/api/sites')).json();fs.writeFileSync('.qa/localization-updated.json',JSON.stringify(updated));assert.equal(updated.sites[0].data.translations.hu.description,'Frissített magyar teszttartalom');
 assert.deepEqual(errors,[]);console.log('PASS: real admin browser edit/save/reload/publish, DE/EN/HU API, draft isolation, coordinates/directions preserved, desktop/mobile layout');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
