import {createBlenderTableScene} from '/blender-table-scene.mjs';
import {createActorCompositor} from '/actor-compositor.mjs';
import {loadActorComposite,createCompositeEnvironment} from '/actor-composite-scene.mjs';
import {uniformRegistration} from '/performance-contact.mjs';
const params=new URLSearchParams(location.search),clip=params.get('clip')??'greeting',after=params.get('view')==='after';
const base=document.createElement('base');base.href='/';document.head.append(base);
const status=document.querySelector('#status');
try{
  document.querySelector('[name=clip]').value=clip;document.querySelector('[name=view]').value=after?'after':'before';
  // Submit remains on this review page despite the base URL used by game assets.
  document.querySelector('form').action='/review/amira-composite/';
  document.documentElement.dataset.greenDealer='amira';document.documentElement.dataset.dealer='amira';document.documentElement.classList.add('table-3d');
  document.documentElement.style.setProperty('--room-plate','url("/dealers/amira/scene-clear-v2.png")');
  const data=after?await loadActorComposite():null;
  const host=document.querySelector('#scene');
  const table=await createBlenderTableScene(document.querySelector('#table-canvas'),{dealer:'amira',frame:{framingScale:.85},composite:data});
  const env=data?createCompositeEnvironment(host,data):null;
  const waiting=clip==='waiting';
  const take=await fetch(waiting?'/review/amira-green-waiting/idle.json':'/review/amira-green-speak/speak.json').then(r=>r.json());
  const line=waiting?{media:take.base,camera:take.camera}:take.lines[clip];
  if(!line)throw new Error('Unknown clip');
  const actor=createActorCompositor(line.media.width,line.media.height,{composite:env?.actor(waiting?'waiting':'speech',clip,line.media.sha256)});
  const frame=new Image();frame.src=`/review/amira-composite/${clip}-frame0.png`;await frame.decode();
  actor.canvas.className='astrid-green-idle';host.append(actor.canvas);
  const paint=()=>{const fit=uniformRegistration(line.camera,{width:innerWidth,height:innerHeight});Object.assign(actor.canvas.style,{left:`${fit.x}px`,top:`${fit.y}px`,width:`${fit.width}px`,height:`${fit.height}px`});actor.paint(frame,null,{packed:true,frameIndex:0});};
  paint();addEventListener('resize',()=>{table.resize();paint();});
  status.textContent=`${after?'Efter':'Före'} · ${clip} · exakt källbildruta 0 · oförändrad kamera/mask`;
  document.documentElement.dataset.reviewReady='true';
}catch(error){status.textContent=error.message;console.error(error);}
