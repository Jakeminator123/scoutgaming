import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const p=await browser.newPage({viewport:{width:390,height:844}}),room='buffer'+Date.now();let delayed=false;
 await p.route('**/media/deal/pos4.mp4',async route=>{if(!delayed){delayed=true;await new Promise(r=>setTimeout(r,1700));}await route.continue();});
 await p.goto('http://127.0.0.1:8632/?session='+room);
 await p.locator('[aria-label="Select box 4"]').click();await p.locator('#enter').click();await p.locator('#playerName').fill('Buffer Test');await p.locator('#enter').click();
 await p.locator('[aria-label="Bet on box 4"]').click();await p.locator('#dealNow').click();
 await p.waitForFunction(()=>document.querySelector('#stage').dataset.clip==='deal_pos4'&&document.querySelector('video.on')?.currentTime>1.8,null,{timeout:45000});
 const receipt=await p.evaluate(async room=>{
  const v=document.querySelector('video.on');const state=await (await fetch('/api/table',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:room,op:'state'})})).json();
  const step=state.plan.steps.find(s=>s.clip?.id==='deal_pos4');return {mediaTime:v.currentTime,expectedTime:(state.serverNow-step.startAt)/1000};
 },room);
 receipt.drift=Math.abs(receipt.mediaTime-receipt.expectedTime);receipt.injectedLoadDelayMs=1700;
 writeFileSync('review/2026-09-26-game-integration/buffering-result.json',JSON.stringify(receipt,null,2));console.log(receipt);
 if(!delayed||receipt.drift>.5)throw new Error('Buffered video did not catch up to shared clock');
}finally{await browser.close();}
