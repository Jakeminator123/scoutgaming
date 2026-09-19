import {uniformRegistration} from './performance-contact.mjs';
import {createActorCompositor} from './actor-compositor.mjs';
import {createIdleVideoLoop} from './idle-video-loop.mjs';

// A green take depicts exactly one event, never a player-seat delivery.
export function shouldUseGreenDealerCard({dealer,enabled,containerId,faceDown,existingCards}) {
  return dealer==='astrid'&&enabled===true&&containerId==='dealer-cards'&&faceDown===false&&existingCards===0;
}

// Takes default to one card. A reviewed opening pair explicitly opts in to
// two; hits, split hands and dealer cards retain their existing routes.
export function shouldUseGreenBoxCard(take,{dealer,enabled,box,split,faceDown,existingCards}) {
  const count=take?.tracking?.openingCards===2?2:1;
  return dealer==='astrid'&&enabled===true&&Number.isInteger(take?.box)&&box!=null&&Number(box)===take.box&&split!==true&&faceDown===false&&Number.isInteger(existingCards)&&existingCards>=0&&existingCards<count;
}
export function selectGreenTake(takes,context) {
  if(!Array.isArray(takes))return null;
  return takes.find(take=>take?.action==='deal-dealer'?shouldUseGreenDealerCard({...context,containerId:context.containerId}):shouldUseGreenBoxCard(take,context))??null;
}
// takes.json lists the review takes beside the original single take.json; a
// directory without it still serves only take.json. Disabled or non-review
// takes are dropped here so gameplay never sees them.
export async function loadGreenTakes(dir){
  const list=await fetch(`${dir}/takes.json`).then(r=>r.ok?r.json():null).then(m=>Array.isArray(m?.takes)?m.takes:['take.json']).catch(()=>['take.json']);
  const takes=await Promise.all(list.map(file=>fetch(`${dir}/${file}`).then(r=>r.ok?r.json():null).catch(()=>null)));
  return takes.filter(t=>t?.status==='review'&&t?.enabled!==false);
}

export const GREEN_PLACEMENT={width:1920,height:1080,scale:.58,x:403,y:18};
export function greenSourcePoint([x,y],viewport={width:innerWidth,height:innerHeight}) {
  const p=GREEN_PLACEMENT,fit=uniformRegistration(p,viewport);
  return {x:fit.x+(p.x+p.scale*x)*fit.scale,y:fit.y+(p.y+p.scale*y)*fit.scale};
}
export function greenShoeOutlet(take,viewport={width:innerWidth,height:innerHeight}){
  const fit=uniformRegistration(take.camera,viewport);
  const [x,y]=take.camera.shoeOutlet;
  return {x:fit.x+x*fit.width,y:fit.y+y*fit.height};
}

// Frame 96 from this same masked take is a temporary still, not a new idle.
// Share the action's registration so returning to rest cannot resize Astrid.
export function installGreenRestFrame(host,take){
  const image=document.createElement('img');
  image.className='astrid-rest-frame';
  image.src=new URL('rest.png',new URL(take.media.src,document.baseURI)).href;
  image.alt='Astrid';
  image.draggable=false;
  const resize=()=>{
    const fit=uniformRegistration(take.camera,{width:innerWidth,height:innerHeight});
    Object.assign(image.style,{left:`${fit.x}px`,top:`${fit.y}px`,width:`${fit.width}px`,height:`${fit.height}px`});
  };
  resize();host.append(image);
  addEventListener('resize',resize);
  return ()=>{removeEventListener('resize',resize);image.remove();};
}

// The new idle and retained upcard share source dimensions, crop and camera.
// RGB and alpha are decoded together and the pose resets while the action
// hides this layer, so its empty-hand return meets the supplied idle endpoint.
export async function installGreenIdle(host,take){
  const manifest=await fetch('review/astrid-elevated-idle/idle.json').then(r=>{if(!r.ok)throw new Error('Elevated idle manifest unavailable');return r.json();});
  const video=document.createElement('video');video.muted=true;video.playsInline=true;video.loop=true;video.preload='auto';
  const actor=createActorCompositor(manifest.width,manifest.height),canvas=actor.canvas;
  canvas.className='astrid-green-idle';canvas.dataset.idleJob=manifest.jobId;canvas.setAttribute('aria-label','Astrid waiting');
  let cycle=0,previous=-1;
  const loop=createIdleVideoLoop(video,{fps:manifest.fps,onFrame:t=>{
    if(t<previous)cycle++;previous=t;
    actor.paint(video,null,{packed:true});
    canvas.dataset.idleFrame=String(Math.floor(t*manifest.fps));canvas.dataset.idleCycle=String(cycle);
    canvas.dataset.idleState='playing';
  },onRecovery:reason=>{
    canvas.dataset.idleRecoveries=String(Number(canvas.dataset.idleRecoveries??0)+1);
    canvas.dataset.idleRecoveryReason=reason;
  },onError:error=>{
    canvas.dataset.idleState='error';console.warn('[elevated idle]',error.message);
  }});
  const resize=()=>{
    const fit=uniformRegistration(take.camera,{width:innerWidth,height:innerHeight});
    Object.assign(canvas.style,{left:`${fit.x}px`,top:`${fit.y}px`,width:`${fit.width}px`,height:`${fit.height}px`});
  };
  const ready=new Promise((resolve,reject)=>{video.addEventListener('loadeddata',resolve,{once:true});video.addEventListener('error',()=>reject(new Error('Elevated idle media unavailable')),{once:true});});
  video.src=manifest.src;
  try{await ready;await loop.resume();}
  catch(error){loop.stop();actor.dispose();throw error;}
  resize();host.append(canvas);addEventListener('resize',resize);
  document.documentElement.dataset.astridIdle='green';
  let performing=false;
  const observer=new MutationObserver(()=>{
    const next=host.classList.contains('performance-playing');
    if(next===performing)return;performing=next;
    if(next){loop.pause({reset:true});canvas.dataset.idleState='dealing';}
    else loop.resume().catch(()=>{document.documentElement.dataset.astridIdle='offline';});
  });
  observer.observe(host,{attributes:true,attributeFilter:['class']});
  return ()=>{observer.disconnect();removeEventListener('resize',resize);loop.stop();video.removeAttribute('src');video.load();canvas.remove();actor.dispose();};
}

// A homography preserves the filmed card plane, including its fixed UV order.
// The authoritative DOM card remains in dealer-cards for reveal/settlement.
export function quadMatrix(quad,width,height) {
  const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=quad;
  const dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3;
  const dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3;
  const den=dx1*dy2-dx2*dy1;
  const g=Math.abs(den)<1e-9?0:(dx3*dy2-dx2*dy3)/den;
  const h=Math.abs(den)<1e-9?0:(dx1*dy3-dx3*dy1)/den;
  return [(x1-x0+g*x1)/width,(y1-y0+g*y1)/width,0,g/width,
    (x3-x0+h*x3)/height,(y3-y0+h*y3)/height,0,h/height,
    0,0,1,0,x0,y0,0,1];
}

// Scale and fan in the photographed table plane, not the screen plane.
// The first slot is independent of card count, so a second delivery cannot
// move the first card. This changes only the requested settled presentation.
export function greenRestCardQuad(quad,index,{scale=1,fanStep=.48}={}) {
  const m=quadMatrix(quad,1,1),offset=index*fanStep;
  return [[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>{
    const x=.5+(u-.5)*scale+offset,y=.5+(v-.5)*scale+index*.04;
    const w=m[3]*x+m[7]*y+1;
    return [(m[0]*x+m[4]*y+m[12])/w,(m[1]*x+m[5]*y+m[13])/w];
  });
}
export function layoutGreenDealerCards(container,take) {
  if(!container||!take)return;
  const parent=container.parentElement.getBoundingClientRect();
  Object.assign(container.style,{left:`${-parent.x}px`,top:`${-parent.y}px`,transform:'none'});
  const fit=uniformRegistration(take.camera,{width:innerWidth,height:innerHeight});
  const quad=take.frames[take.events.land].card.corners.map(([x,y])=>[fit.x+x*fit.width,fit.y+y*fit.height]);
  const scale=fit.scale;
  [...container.querySelectorAll('.card')].forEach((el,i)=>{
    const shifted=take.tracking?.presentation?greenRestCardQuad(quad,i,take.tracking.presentation):quad.map(([x,y])=>[x+i*42*scale,y+i*4*scale]);
    Object.assign(el.style,{left:'0',top:'0',width:'100px',height:'140px',border:'0',transformOrigin:'0 0',animation:'none',transform:`matrix3d(${quadMatrix(shifted,100,140).join(',')})`});
    el.dataset.greenSlot=String(i);
    el.dataset.feltCard='true';
    el.dataset.feltCorners=JSON.stringify(shifted);
  });
}
