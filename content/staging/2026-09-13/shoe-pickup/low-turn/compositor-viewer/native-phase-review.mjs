import {packedGPU} from '/packed-gpu.mjs';
import {resolveFrameCards} from '/card-state.mjs';
import {shoeMaskEnabled} from '/camera-shoe-contract.mjs';
const {ledger}=await(await fetch('/camera60-joined.json')).json();
const rear=document.querySelector('#rear'),front=document.querySelector('#front'),input=document.querySelector('#frame');
const gpu=packedGPU(document.querySelector('#cards'),rear,{actor:false,outputWidth:1280,shoeMaskURL:'/camera-shoe-mask.png'});
const deliveries=new Map([{r:'A',s:'♠'},{r:'7',s:'♥'},{r:'Q',s:'♣'},{r:'4',s:'♦'}].map((card,i)=>[i+1,{card,faceDown:false}]));
let shift=0,busy=false;
const clamp=n=>Math.max(0,Math.min(349,n));
function paint(n){const row=ledger[n];gpu.paint(null,{cards:resolveFrameCards(row,deliveries).map(c=>({...c,shoeOccluded:row.take!=='return'&&shoeMaskEnabled({...c,nativeFrame:row.sourcePosition})}))});}
async function loaded(v){if(v.readyState>=2)return;await new Promise((resolve,reject)=>{v.addEventListener('loadeddata',resolve,{once:true});v.addEventListener('error',()=>reject(Error(v.id+' unavailable')),{once:true});});}
async function seek(v,t){v.pause();if(Math.abs(v.currentTime-t)<1e-6)return;await new Promise((resolve,reject)=>{v.addEventListener('seeked',resolve,{once:true});v.addEventListener('error',()=>reject(Error(v.id+' seek failed')),{once:true});v.currentTime=t;});}
async function show(){
 if(busy)return;busy=true;const n=clamp(Math.round(Number(input.value)||0)),card=clamp(n+shift);input.value=n;
 for(const e of document.querySelectorAll('button,input'))e.disabled=true;
 try{await Promise.all([loaded(rear),loaded(front)]);await Promise.all([seek(rear,(n+.5)/60),seek(front,(n+.5)/60)]);paint(card);await new Promise(requestAnimationFrame);paint(card);
 document.querySelector('#status').textContent=`Actor ${n}; card ${card} (${shift>=0?'+':''}${shift}). Ready for actual browser screenshot.`;
 document.querySelector('#receipt').textContent=JSON.stringify({actorJoinedFrame:n,cardJoinedFrame:card,cardOffset:shift,seekSeconds:(n+.5)/60,rearCurrentTime:rear.currentTime,frontCurrentTime:front.currentTime,sourceRow:ledger[n],evidenceBoundary:'Seeked midpoint and two paint calls are static sampling preparation, not proof of compositor display or dynamic phase. Capture the visible browser scene.'},null,2);
 }catch(e){document.querySelector('#status').textContent=String(e);}finally{busy=false;for(const e of document.querySelectorAll('button,input'))e.disabled=false;}
}
document.querySelector('#apply').onclick=show;
document.querySelector('#previous').onclick=()=>{input.value=clamp(Number(input.value)-1);show();};
document.querySelector('#next').onclick=()=>{input.value=clamp(Number(input.value)+1);show();};
for(const button of document.querySelectorAll('[data-shift]'))button.onclick=()=>{shift=Number(button.dataset.shift);show();};
await show();
