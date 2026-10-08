import assert from 'node:assert/strict';
import {chromium,webkit,devices} from 'playwright';
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
const engine=process.env.ENGINE||'webkit',dest=process.env.DEST||`review/2026-09-26-phone-lag/${engine}-before.json`;
const browser=await ({chromium,webkit}[engine]).launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});
try{
 const context=await browser.newContext({...devices['iPhone 13'],defaultBrowserType:undefined});const page=await context.newPage();page.setDefaultTimeout(120000);
 if(engine==='chromium'){const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:6});await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:40,downloadThroughput:6250000,uploadThroughput:1250000});}
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('pageerror',e.message)});
 if(process.env.BASELINE)for(const file of ['shared-table.js','game-cards.js'])await page.route('**/'+file,route=>route.fulfill({contentType:'text/javascript',body:execFileSync('git',['show','0ed16cc:public/'+file])}));
 await page.addInitScript(()=>{
  const p=window.phoneProfile={events:[],gaps:[],mutations:0,longTasks:[],seeks:[],frames:0,api:[]};
  const d=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'currentTime');Object.defineProperty(HTMLMediaElement.prototype,'currentTime',{...d,set(n){if(this.tagName==='VIDEO')p.seeks.push({at:performance.now(),from:d.get.call(this),to:n,clip:document.querySelector('#stage')?.dataset.clip});return d.set.call(this,n)}});
  try{new PerformanceObserver(l=>p.longTasks.push(...l.getEntries().map(x=>({at:x.startTime,dur:x.duration})))).observe({type:'longtask',buffered:true})}catch{}
  document.addEventListener('DOMContentLoaded',()=>{
   new MutationObserver(ms=>{p.mutations+=ms.length}).observe(document.querySelector('#stage'),{subtree:true,childList:true,attributes:true,characterData:true});
   for(const v of document.querySelectorAll('video')){
    for(const type of ['playing','waiting','stalled','error','seeking','seeked','pause'])v.addEventListener(type,()=>p.events.push({type,at:performance.now(),time:v.currentTime,source:v.dataset.source,shown:v.classList.contains('on')}));
    let last=0,source='',media=0;
    const frame=(now,meta)=>{if(v.classList.contains('on')){if(last&&source===v.src&&meta.mediaTime>media&&now-last>100)p.gaps.push({gap:now-last,mediaDelta:meta.mediaTime-media,source:v.dataset.source,at:now});p.frames++;last=now;source=v.src;media=meta.mediaTime;}else last=0;v.requestVideoFrameCallback(frame)};v.requestVideoFrameCallback(frame);
   }
  });
 });
 const room='phone-'+engine+'-'+Date.now(),begin=Date.now();await page.goto('http://127.0.0.1:8634/?session='+room,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Select box 4',exact:true}).click();await page.locator('#enter').click();await page.locator('#playerName').fill('Phone QA');await page.locator('#playerName').press('Enter');await page.waitForFunction(()=>document.querySelector('#gate').classList.contains('off'),{},{timeout:15000}).catch(async e=>{console.log(await page.locator('#gate').innerText());await page.screenshot({path:'review/2026-09-26-phone-lag/join-failed.png'});throw e});
 const db=new DatabaseSync('/tmp/astrid-phone-debug.sqlite');db.exec('PRAGMA busy_timeout=3000');const r=JSON.parse(db.prepare('SELECT state FROM shared_rooms WHERE id=?').get(room).state);r.game.shoe.cards.splice(-4,4,...[{r:'10',s:'♥'},{r:'8',s:'♠'},{r:'7',s:'♣'},{r:'10',s:'♦'}].reverse());db.prepare('UPDATE shared_rooms SET state=? WHERE id=?').run(JSON.stringify(r),room);db.close();
 const prepMs=Date.now()-begin;await page.evaluate(()=>{window.phoneProfile.roundAt=performance.now();window.phoneProfile.mutations=0;});
 for(const name of ['Bet on box 4','Perfect Pairs on box 4','21+3 on box 4'])await page.getByRole('button',{name,exact:true}).click();await page.locator('#dealNow').click();
 const paintFrames=[];let settled=false;const end=Date.now()+170000;while(Date.now()<end){if(process.env.PAINT_FRAMES){const t=await page.evaluate(()=>{const v=document.querySelector('video.on');return v?.dataset.source?.endsWith('/pos4.mp4')?v.currentTime:-1});const slot=t>.4&&t<1?'early':t>1.4&&t<2?'contact':null;if(slot&&!paintFrames.includes(slot)){await page.screenshot({path:process.env.PAINT_FRAMES+'/'+slot+'.png'});paintFrames.push(slot);}}if(await page.locator('#nextRound').isVisible()){settled=true;break}for(const sel of ['[data-insurance="no"]','[data-action="stand"]']){const e=page.locator(sel);if(await e.isVisible()&&await e.isEnabled())await e.click()}await page.waitForTimeout(200)}
 const result=await page.evaluate(()=>({...window.phoneProfile,endAt:performance.now(),videos:[...document.querySelectorAll('video')].map(v=>({width:v.videoWidth,height:v.videoHeight,sourceKind:v.currentSrc.startsWith('blob:')?'blob':'native',dropped:v.getVideoPlaybackQuality?.().droppedVideoFrames,total:v.getVideoPlaybackQuality?.().totalVideoFrames}))}));
 assert.equal(settled,true);assert.deepEqual(errors,[]);assert.ok(result.endAt-result.roundAt<45000,'Decision controls must appear promptly without waiting for auto-stand');
 writeFileSync(dest,JSON.stringify({engine,prepMs,settled,errors,paintFrames,...result},null,2));console.log(JSON.stringify({engine,prepMs,settled,errors,mutations:result.mutations,frames:result.frames,gaps:result.gaps.length,maxGap:Math.max(0,...result.gaps.map(g=>g.gap)),seeks:result.seeks.length,videos:result.videos}));
}finally{await browser.close()}
