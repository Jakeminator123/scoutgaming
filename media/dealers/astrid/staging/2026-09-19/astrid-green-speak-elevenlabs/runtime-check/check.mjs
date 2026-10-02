import pw from '/Users/solvifyab/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.js';const {chromium}=pw;
import fs from 'node:fs';
const extra=process.argv.slice(2);
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--autoplay-policy=no-user-gesture-required','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const logs=[];page.on('console',m=>logs.push(`${m.type()} ${m.text()}`));page.on('pageerror',e=>logs.push(`pageerror ${e.message}`));
await page.goto('http://astridboxright.localhost:4190/?dealer=astrid&table=blender',{waitUntil:'load'});
const sample=async()=>page.evaluate(()=>{const c=document.querySelector('.astrid-green-speak');const i=document.querySelector('.astrid-green-idle');return {speak:c?{...c.dataset,visible:c.style.visibility!=='hidden',rect:c.getBoundingClientRect().toJSON()}:null,idle:i?{state:i.dataset.idleState,frame:i.dataset.idleFrame,segment:i.dataset.idleSegment}:null,performing:document.querySelector('#scene')?.classList.contains('performance-playing'),caption:document.querySelector('#caption')?.textContent};});
const samples=[];
for(let t=0;t<9;t++){await page.waitForTimeout(1000);samples.push({t:t+1,...await sample()});}
await page.screenshot({path:'runtime-check/after-load.png'});
for(const id of extra){
  await page.evaluate(id=>window.astridSay(id),id);
  await page.waitForTimeout(1200);samples.push({line:id,during:await sample()});
  await page.screenshot({path:`runtime-check/${id}-playing.png`});
  await page.waitForTimeout(4000);samples.push({line:id,after:await sample()});
}
await browser.close();
const out={samples,console:logs};
fs.writeFileSync('runtime-check/result.json',JSON.stringify(out,null,1));
console.log(JSON.stringify(logs.filter(l=>!l.includes('GL Driver')),null,1));
console.log(samples.filter(s=>s.line).map(s=>JSON.stringify({line:s.line,during:s.during&&{state:s.during.speak?.speakState,line:s.during.speak?.speakLine,frame:s.during.speak?.speakFrame,delta:s.during.speak?.speakStartDeltaMs,performing:s.during.performing},after:s.after&&{state:s.after.speak?.speakState,idle:s.after.idle,performing:s.after.performing}})).join('\n'));
