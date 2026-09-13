// Retarget photographed motion, without representing it as a new measured take.
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const center=c=>c.reduce((p,v)=>[p[0]+v[0]/4,p[1]+v[1]/4],[0,0]);
export function deliveryReach(take,frame,end){
  const e=take.events,release=take.frames[e.release];
  const from=center(release.card.corners),to=center(end);
  const phase=frame<=e.release?smooth((frame-e.pickup)/(e.release-e.pickup)):
    1-smooth((frame-e.land)/Math.max(1,e.rest-e.land));
  const sample=take.frames[Math.min(frame,e.release)];
  const anchor=sample.contact?.finger??release.contact.finger;
  const shoulder=take.action==='deal-left'?[.445,.405]:take.action==='deal-right'?[.5,.405]:[.46,.405];
  return {delta:[(to[0]-from[0])*phase,(to[1]-from[1])*phase],anchor,shoulder};
}
export function shiftCard(card,delta){
  return card&&{...card,corners:card.corners.map(([x,y,z])=>[x+delta[0],y+delta[1],z])};
}
