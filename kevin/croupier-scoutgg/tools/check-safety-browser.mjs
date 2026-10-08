import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
try {for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
 const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8634/?session=safety-'+name+'-'+Date.now());
 await page.getByRole('button',{name:'Select box 4',exact:true}).click();await page.locator('#enter').click();await page.locator('#playerName').fill('QA');await page.locator('#enter').click();
 await page.waitForFunction(()=>document.querySelector('#gate').classList.contains('off'));
 await page.locator('#pauseDemo').scrollIntoViewIfNeeded();await page.screenshot({path:`review/2026-09-26-safety/${name}-controls.png`,fullPage:true});
 page.once('dialog',d=>d.accept());await page.locator('#pauseDemo').click();await page.waitForFunction(()=>document.querySelector('#pauseDemo').textContent==='Break active');assert.ok(await page.locator('#refillDemo').isDisabled());
 await page.screenshot({path:`review/2026-09-26-safety/${name}-break.png`,fullPage:true});
 await page.reload();await page.waitForFunction(()=>document.querySelector('#entryError').textContent.includes('24-hour demo break'));
 await page.goto('http://127.0.0.1:8634/demo-information.html');assert.equal(await page.locator('h1').textContent(),'Demo information');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`review/2026-09-26-safety/${name}-information.png`,fullPage:true});assert.deepEqual(errors,[]);results.push({name,viewport,passed:true,checks:['join with session cookie','break button','refill disabled','break survives reload','information page fits viewport','no page JS errors']});await context.close();
}}finally{await browser.close();}
writeFileSync('review/2026-09-26-safety/browser.json',JSON.stringify(results,null,2)+'\n');console.log(results);
