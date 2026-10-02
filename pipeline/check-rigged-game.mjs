// Run against an isolated localhost demo server. Requires Playwright and Chromium.
const {chromium}=await import(process.env.PLAYWRIGHT_IMPORT??'playwright');
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('..',import.meta.url)),dir=process.env.CROUPIER_PROOF_DIR??root+'/content/staging/rigged-game-check';
await fs.mkdir(dir,{recursive:true});
const base=new URL(process.env.CROUPIER_REVIEW_URL??'http://rigqa.localhost:4197');
assert.ok(base.hostname==='localhost'||base.hostname==='127.0.0.1'||base.hostname.endsWith('.localhost'),'Use an isolated local demo server');
const manifest=JSON.parse(await fs.readFile(root+'/media/dealers/astrid/runtime/indexed/rig/face-study/speech-manifest.json'));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:[`--host-resolver-rules=MAP ${base.hostname} 127.0.0.1`,...(process.platform==='darwin'?['--enable-gpu','--use-angle=metal']:[])]});
const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir,size:{width:1280,height:800}}});
const page=await context.newPage(),errors=[],logs=[],lines=[],rounds=[];let currentDealer='astrid-rig';
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.text().includes('[speech]'))logs.push({at:Date.now(),dealer:currentDealer,text:m.text()});});
page.on('response',async r=>{if(r.url().endsWith('/api/table')&&r.status()===200)rounds.push(await r.json());});
const wait=async fn=>{const start=Date.now();while(!fn()){if(Date.now()-start>40000)throw new Error('Playback did not complete');await page.waitForTimeout(200);}};
try{
 await page.goto(new URL('/?dealer=astrid&scene=rigged-review&face=anatomical&rehearsal=1',base).href);
 await page.locator('#rehearsal-repeat').waitFor({timeout:60000});await page.screenshot({path:dir+'/rest.png'});
 for(const id of Object.keys(manifest.lines)){
  await page.locator('#rehearsal-line').selectOption(id);const begin=logs.length;
  await page.locator('#rehearsal-repeat').click();await wait(()=>logs.slice(begin).filter(l=>l.text==='[speech] end '+id).length===2);
  const state=await page.locator('#rig-review-status').evaluate(el=>({...el.dataset}));
  assert.ok(!state.faceError,state.faceError);
  const history=JSON.parse(state.faceHistory??'[]').slice(-2);assert.equal(history.length,2);assert.ok(history.every(h=>h.id===id&&h.samples>10));
  lines.push({id,history});console.log('LINE',id,JSON.stringify(history));
 }
 const session=await (await context.request.get(new URL('/api/auth/session',base).href)).json();assert.ok(session.guest&&!session.authenticated,'Only a fresh guest demo profile may place these test bets');
 await page.locator('#rehearsal > summary').click();
 for(let i=0;i<7;i++)await page.locator(`.seat[data-box="${i}"] .spot`).click();
 await page.locator('#deal-now').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('#actions-top:not([hidden]) button:not(:disabled),#actions:not([hidden]) button:not(:disabled),#insurance:not([hidden]) button')].length||document.querySelector('#rig-review-status')?.dataset.action==='collect-sweep',null,{timeout:90000});
 await page.screenshot({path:dir+'/seven-seat-dealt.png'});
 for(let i=0;i<12;i++){
  if(await page.locator('#ins-no').isVisible()){await page.locator('#ins-no').click();await page.waitForTimeout(1500);continue;}
  const stand=page.locator('#actions-top:not([hidden]) [data-act="stand"]:not(:disabled),#actions:not([hidden]) [data-act="stand"]:not(:disabled)').filter({visible:true}).first();
  if(await stand.count()){await stand.click();await page.waitForTimeout(700);continue;}
  const status=await page.locator('#rig-review-status').evaluate(el=>({...el.dataset}));
  if(status.action==='collect-sweep')break;
  await page.waitForTimeout(1000);
 }
 await page.waitForFunction(()=>document.querySelector('#rig-review-status')?.dataset.action==='collect-sweep',null,{timeout:90000});
 await page.waitForTimeout(3500);await page.screenshot({path:dir+'/seven-seat-sweep.png'});
 await page.waitForFunction(()=>document.querySelectorAll('.cards .card').length===0,null,{timeout:45000});
 await page.screenshot({path:dir+'/seven-seat-complete.png'});
 const final=await page.locator('#rig-review-status').evaluate(el=>({...el.dataset}));
 assert.ok(Number(final.collectionSize)>=16);assert.equal(final.gathered,final.collectionSize);
 console.log('ROUND',JSON.stringify(final));
 for(const dealer of ['vera','amira','mei','astrid']){
  currentDealer=dealer;await page.goto(new URL(`/?dealer=${dealer}&rehearsal=1`,base).href);await page.locator('#rehearsal-repeat').waitFor({timeout:60000});await page.locator('#rehearsal-line').selectOption('greeting');const begin=logs.length;await page.locator('#rehearsal-repeat').click();await wait(()=>logs.slice(begin).filter(l=>l.text==='[speech] end greeting').length===2);console.log('DEFAULT',dealer,'two completed');
 }
 await fs.writeFile(dir+'/results.json',JSON.stringify({modelSha256:manifest.modelSha256,lines,rounds,final,errors,logs},null,2));assert.deepEqual(errors,[]);
 console.log('PASS',lines.length,'Astrid lines repeated; 7-seat collection; four default dealers repeated');
}catch(error){console.log('FAIL',error.stack);await fs.writeFile(dir+'/failure.json',JSON.stringify({message:error.message,lines,rounds,errors,logs},null,2));await page.screenshot({path:dir+'/failure.png'});process.exitCode=1;}
finally {await context.close();await browser.close();}
