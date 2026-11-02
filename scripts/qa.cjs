const { chromium }=require('playwright');
const fs=require('fs');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || (fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':undefined),headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.url()+': '+r.status());});
const base='http://127.0.0.1:4173';
let checks=[];
for(const width of [1440,390,320]){
await page.setViewportSize({width,height:1000});
for(const lang of ['de','en','hu'])for(const route of ['index','pilots','clubs','how-it-works','contact']){
await page.goto(`${base}/${lang}/${route}.html`);await page.locator('h1').waitFor();
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
if(overflow)throw new Error(`Overflow ${width} ${lang} ${route}`);
await page.locator('img').evaluateAll(async imgs=>{await Promise.all(imgs.map(async i=>{i.loading='eager';await i.decode();}));});
const broken=await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src));if(broken.length)throw new Error('Broken images '+broken);
checks.push(`${width}/${lang}/${route}: pass`);
if(lang==='de'&&['index','clubs'].includes(route)&&width!==320)await page.screenshot({path:`.qa/${route}-${width}.png`,fullPage:true});
}
}
await page.setViewportSize({width:1440,height:1000});
await page.goto(base+'/hu/clubs.html');await page.locator('.languages a[lang=en]').click();if(!page.url().endsWith('/en/clubs.html'))throw new Error('Language page mismatch');
await page.setViewportSize({width:390,height:844});await page.locator('.menu-toggle').click();if(await page.locator('.menu-toggle').getAttribute('aria-expanded')!=='true')throw new Error('Menu closed');await page.keyboard.press('Escape');
await page.goto(base+'/demo/?lang=en');await page.locator('.mobile-menu').click();
await page.locator('[data-view=tickets]').first().click();await page.locator('[data-action=tickets-approve]').first().click();await page.locator('#cancel').click();await page.locator('#confirm').waitFor({state:'hidden'});if(await page.locator('[data-action=tickets-approve]').count()!==2)throw new Error('Cancel changed tickets');
await page.locator('[data-action=tickets-approve]').first().click();await page.locator('#accept').click();await page.waitForFunction(()=>document.querySelectorAll('[data-action=tickets-approve]').length===1);if(await page.locator('[data-action=tickets-approve]').count()!==1)throw new Error('Approve failed');
await page.locator('#filter').selectOption('approved');if(await page.locator('tbody tr').count()!==2)throw new Error('Filter failed');
await page.locator('#club').selectOption('talwind');await page.locator('#filter').selectOption('approved');if(await page.locator('tbody tr').count()!==0)throw new Error('Club isolation failed');
await page.locator('#club').selectOption('bergblick');
// Collapsed mobile navigation is opened when needed.
async function go(v){if(!(await page.locator(`[data-view=${v}]`).first().isVisible()))await page.locator('.mobile-menu').click();await page.locator(`[data-view=${v}]`).first().click();}
await go('alerts');await page.locator('[data-action=close]').click();await page.locator('#accept').click();await page.locator('[data-action=expire]').click();if(!(await page.locator('[data-action=reopen]').count()))throw new Error('Expiry reopened area');
await page.locator('[data-action=reopen]').click();await page.locator('#accept').click();
await go('members');await page.locator('[data-action=members-approve]').first().click();await page.locator('#accept').click();await page.waitForFunction(()=>document.querySelectorAll('[data-action=members-approve]').length===1);if(await page.locator('[data-action=members-approve]').count()!==1)throw new Error('Member approve failed');
await page.locator('#role').selectOption('superadmin');await go('modules');await page.locator('[data-module=daypass]').uncheck();await page.locator('#role').selectOption('clubadmin');await go('modules');if(!(await page.locator('[data-module=daypass]').isDisabled()))throw new Error('Superadmin module restriction failed');
await page.reload();await go('modules');if(!(await page.locator('[data-module=daypass]').isDisabled()))throw new Error('Persistence failed');
await page.locator('[data-action=reset]').click();await page.locator('#accept').click();await page.waitForFunction(()=>!document.querySelector('[data-module=daypass]').disabled);if(await page.locator('[data-module=daypass]').isDisabled())throw new Error('Reset failed');
for(const width of [1440,390,320])for(const lang of ['de','en','hu']){
await page.setViewportSize({width,height:1000});await page.goto(base+'/demo/?lang='+lang);
for(const v of ['overview','tickets','members','alerts','modules','audit']){await go(v);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw new Error('Admin overflow '+width+'/'+lang+'/'+v);checks.push(`admin/${width}/${lang}/${v}: pass`);if(lang==='hu'&&v==='overview'&&width!==320)await page.screenshot({path:`.qa/admin-${width}.png`,fullPage:true});}
await page.locator('#role').selectOption('superadmin');await go('clubs');checks.push(`superadmin/${width}/${lang}: pass`);
}
if(errors.length)throw new Error(errors.join('\n'));
fs.writeFileSync('.qa/results.json',JSON.stringify({checks,flows:['language preserves page','mobile menu','ticket cancel/approve/filter','club data isolation','closure survives member-report expiry','explicit reopening','membership approval','superadmin module restriction','session persistence','reset'],errors},null,2));
console.log(`PASS: ${checks.length} page/viewport checks; 10 interaction checks; no browser errors.`);await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
