import pw from '/Users/solvifyab/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.js';const {chromium}=pw;
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--autoplay-policy=no-user-gesture-required','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const logs=[];page.on('console',m=>logs.push(`${m.type()} ${m.text()}`));page.on('pageerror',e=>logs.push(`pageerror ${e.message}`));
await page.goto('http://astridboxright.localhost:4190/?dealer=astrid&table=blender',{waitUntil:'load'});
const sample=async()=>page.evaluate(()=>{const c=document.querySelector('.astrid-green-speak');const i=document.querySelector('.astrid-green-idle');return {speak:c?{...c.dataset,visible:c.style.visibility!=='hidden',rect:c.getBoundingClientRect().toJSON()}:null,idle:i?{state:i.dataset.idleState,frame:i.dataset.idleFrame,segment:i.dataset.idleSegment}:null,performing:document.querySelector('#scene')?.classList.contains('performance-playing'),caption:document.querySelector('#caption')?.textContent};});
const samples=[];
for(let t=0;t<12;t++){await page.waitForTimeout(1000);samples.push({t:t+1,...await sample()});}
await page.screenshot({path:'runtime-check/after-load.png'});
await browser.close();
const out={samples,console:logs};
console.log(JSON.stringify(out,null,1));
import('node:fs').then(fs=>fs.writeFileSync('runtime-check/result.json',JSON.stringify(out,null,1)));
