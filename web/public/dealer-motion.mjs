// Metres, Y up. Cards remain rigid; contact and empty-hand return are distinct.
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);
const length=a=>Math.hypot(...a);
const unit=a=>mul(a,1/(length(a)||1));
const mix=(a,b,t)=>add(mul(a,1-t),mul(b,t));
export const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};

export function solveArm(shoulder,target,upper,lower,pole) {
  if(!(upper>0&&lower>0)||![...shoulder,...target,...pole].every(Number.isFinite))throw new Error('Invalid arm geometry');
  const delta=sub(target,shoulder),distance=length(delta);
  const direction=distance>1e-8?unit(delta):[0,-1,0];
  const reach=Math.max(Math.abs(upper-lower)+1e-6,Math.min(upper+lower-1e-6,distance));
  let bend=sub(sub(pole,shoulder),mul(direction,dot(sub(pole,shoulder),direction)));
  if(length(bend)<1e-7){const axis=Math.abs(direction[1])<.8?[0,1,0]:[1,0,0];bend=sub(axis,mul(direction,dot(axis,direction)));}
  bend=unit(bend);
  const along=(upper*upper-lower*lower+reach*reach)/(2*reach);
  const height=Math.sqrt(Math.max(0,upper*upper-along*along));
  const wrist=add(shoulder,mul(direction,reach));
  return {elbow:add(add(shoulder,mul(direction,along)),mul(bend,height)),wrist,error:length(sub(wrist,target))};
}

export const DEAL_SECONDS=1.65;
export function sampleDelivery(time,{outlet,target,rest}) {
  const t=Math.max(0,Math.min(1,time));
  // One pickup, guided transfer, release at the destination, empty-hand return.
  const pickup=.20,release=.69,returnStart=.75;
  let hand,card,grip=0,phase;
  if(t<pickup){hand=mix(rest,outlet,ease(t/pickup));card=[...outlet];phase='pickup';}
  else if(t<release){const u=(t-pickup)/(release-pickup);card=mix(outlet,target,ease(u));card[1]+=Math.sin(Math.PI*u)*.045;hand=[...card];grip=1;phase='carry';}
  else {card=[...target];const u=ease((t-returnStart)/(1-returnStart));hand=mix(target,rest,u);hand[1]+=Math.sin(Math.PI*u)*.12;grip=Math.max(0,1-(t-release)/.045);phase=t<returnStart?'release':'return';}
  return {hand,card,grip,phase,released:t>=release,picked:t>=pickup};
}

export function seatTarget(seat,cardIndex=0,splitIndex=0) {
  if(!Number.isInteger(seat)||seat<0||seat>6)throw new Error('Seat must be 0–6');
  const angle=Math.PI*.15+seat*(Math.PI*.70/6);
  return [Math.cos(angle)*.91+(splitIndex-.5)*.09+cardIndex*.024,.91055,Math.sin(angle)*.66-.05-cardIndex*.009];
}

export function sampleTwoHandDelivery(time,{outlet,target,leftRest=[.22,.91055,.23],rightRest=[-.22,.91055,.23]}) {
  const t=Math.max(0,Math.min(1,time));
  if(target[0]>=0){const s=sampleDelivery(t,{outlet,target,rest:leftRest});return {...s,left:s.hand,right:[...rightRest],leftGrip:s.grip,rightGrip:0,active:'left'};}
  const transfer=[0,.985,.18];let card,left,right,leftGrip=0,rightGrip=0,phase,active='left';
  if(t<.2){left=mix(leftRest,outlet,ease(t/.2));right=[...rightRest];card=[...outlet];phase='pickup';}
  else if(t<.39){const u=ease((t-.2)/.19);card=mix(outlet,transfer,u);card[1]+=Math.sin(Math.PI*u)*.025;left=[...card];right=mix(rightRest,transfer,ease((t-.24)/.15));leftGrip=1;phase='handoff';}
  else if(t<.69){const u=ease((t-.39)/.3);card=mix(transfer,target,u);card[1]+=Math.sin(Math.PI*u)*.03;right=[...card];left=mix(transfer,leftRest,ease((t-.39)/.18));rightGrip=1;phase='carry';active='right';}
  else{card=[...target];const u=ease((t-.75)/.25);right=mix(target,rightRest,u);right[1]+=Math.sin(Math.PI*u)*.12;left=[...leftRest];rightGrip=Math.max(0,1-(t-.69)/.045);phase=t<.75?'release':'return';active='right';}
  return {hand:active==='left'?left:right,left,right,card,leftGrip,rightGrip,grip:active==='left'?leftGrip:rightGrip,phase,active,picked:t>=.2,released:t>=.69};
}


export const CARD_ACTION_SECONDS={reveal:1.8,collect:2.0};
export function sampleCardAction(time,{kind,source,target=source,initialYaw=0}) {
  const t=Math.max(0,Math.min(1,time));
  if(!['reveal','collect'].includes(kind))throw new Error('Unknown card action');
  if(kind==='collect'){
    const one=source[0]<=0?sampleDelivery(t,{outlet:source,target,rest:[-.22,.91055,.23]}):null;
    const s=one?{...one,right:one.hand,left:[.22,.91055,.23],rightGrip:one.grip,leftGrip:0,active:'right'}:sampleTwoHandDelivery(t,{outlet:source,target});
    return {...s,visible:true,cardPitch:0,cardYaw:initialYaw,kind};
  }
  const rest=[-.22,.91055,.23],card=[...source],start=add(source,[0,0,.035]),end=add(source,[0,0,-.035]);let right,phase,pitch=Math.PI,grip=0;
  if(t<.2){right=mix(rest,start,ease(t/.2));phase='approach';}
  else if(t<.72){
    const u=(t-.2)/.52;
    card[1]+=.11*Math.sin(Math.PI*u);
    pitch=Math.PI*(1-ease((u-.12)/.76));
    right=add(card,[0,.035*Math.sin(pitch),-.035*Math.cos(pitch)]);grip=1;phase='reveal';
  }else{
    pitch=0;const u=ease((t-.77)/.23);
    right=mix(end,rest,u);right[1]+=.06*Math.sin(Math.PI*u);
    phase=t<.77?'release':'return';grip=Math.max(0,1-(t-.72)/.04);
  }
  return {kind,hand:right,right,left:[.22,.91055,.23],card,cardPitch:pitch,cardYaw:initialYaw,rightGrip:grip,leftGrip:0,grip,phase,active:'right',visible:true,picked:t>=.2,released:t>=.72};
}
