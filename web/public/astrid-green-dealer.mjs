import {uniformRegistration} from './performance-contact.mjs';

// A green take depicts exactly one event, never a player-seat delivery.
export function shouldUseGreenDealerCard({dealer,enabled,containerId,faceDown,existingCards}) {
  return dealer==='astrid'&&enabled===true&&containerId==='dealer-cards'&&faceDown===false&&existingCards===0;
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
export function layoutGreenDealerCards(container,take) {
  if(!container||!take)return;
  const parent=container.parentElement.getBoundingClientRect();
  Object.assign(container.style,{left:`${-parent.x}px`,top:`${-parent.y}px`,transform:'none'});
  const fit=uniformRegistration(take.camera,{width:innerWidth,height:innerHeight});
  const quad=take.frames[take.events.land].card.corners.map(([x,y])=>[fit.x+x*fit.width,fit.y+y*fit.height]);
  const scale=fit.scale;
  [...container.querySelectorAll('.card')].forEach((el,i)=>{
    const shifted=quad.map(([x,y])=>[x+i*42*scale,y+i*4*scale]);
    Object.assign(el.style,{left:'0',top:'0',width:'100px',height:'140px',border:'0',transformOrigin:'0 0',animation:'none',transform:`matrix3d(${quadMatrix(shifted,100,140).join(',')})`});
    el.dataset.greenSlot=String(i);
  });
}
