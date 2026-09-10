import {ease} from './dealer-motion.mjs';
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const leftRest=[.22,.91055,.23],rightRest=[-.22,.91055,.23],thickness=.00045;

// A presentation-only sweep over the actual server card transforms. Every
// card stays in place until the fingers reach it; gathered cards form one
// packet, with the first card on top and subsequent cards sliding underneath.
export function planCollection(cards,{landing,felt=.91055}={}){
 if(!cards.length)return null;
 if(!landing?.every(Number.isFinite)||cards.some(c=>!c.position?.every(Number.isFinite)))throw new Error('Collection requires finite physical card positions');
 const groups=new Map();
 for(const card of cards){const key=card.group??'dealer';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(card);}
 const ordered=[...groups.entries()].sort(([a,aa],[b,bb])=>a==='dealer'?1:b==='dealer'?-1:Math.max(...bb.map(c=>c.position[0]))-Math.max(...aa.map(c=>c.position[0])))
  .flatMap(([,group])=>group.slice().sort((a,b)=>b.position[0]-a.position[0]||b.position[1]-a.position[1]));
 const points=ordered.map(c=>[c.position[0],felt,c.position[2]]),tangents=points.map((p,i)=>{
  const before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)],length=distance(before,after);
  const bound=Math.min(i?distance(p,before):Infinity,i<points.length-1?distance(p,after):Infinity)*.65;
  return after.map((v,k)=>(v-before[k])*(length?bound/length:0));
 });
 function segment(i,t){
  const a=points[i],b=points[Math.min(i+1,points.length-1)],u=t*t,v=u*t;
  return a.map((x,k)=>(2*v-3*u+1)*x+(v-2*u+t)*tangents[i][k]+(-2*v+3*u)*b[k]+(v-u)*tangents[Math.min(i+1,points.length-1)][k]);
 }
 const path=[{distance:0,point:points[0]}],pickups=[0];let total=0;
 for(let i=0;i<points.length-1;i++){
  for(let j=1;j<=20;j++){const point=segment(i,j/20);total+=distance(path.at(-1).point,point);path.push({distance:total,point});}
  pickups.push(total);
 }
 const approach=.65,sweep=Math.max(.45,total/.42),deposit=.95,returnTime=.65,duration=approach+sweep+deposit+returnTime;
 const handoffDistance=ordered[0].position[0]>0?(path.find(p=>p.point[0]<=0)?.distance??total):0;
 const startsLeft=ordered[0].position[0]>0;
 function along(d){
  let lo=0,hi=path.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(path[mid].distance<=d)lo=mid;else hi=mid-1;}
  const a=path[lo],b=path[Math.min(lo+1,path.length-1)];return mix(a.point,b.point,b.distance>a.distance?(d-a.distance)/(b.distance-a.distance):0);
 }
 return {duration,ordered,pickups,total,
  sample(seconds){
   const time=Math.max(0,Math.min(duration,seconds)),u=Math.max(0,Math.min(1,(time-approach)/sweep)),travel=ease(u)*total;
   const count=time<approach?0:pickups.filter(d=>d<=travel+1e-9).length;
   const depositing=time>=approach+sweep,placed=time>=approach+sweep+deposit;
   let point=along(travel),phase=time<approach?'approach':'sweep',left=[...leftRest],right=[...rightRest];
   let transfer=startsLeft?ease((travel-handoffDistance+.60)/1.20):1;
   if(depositing)transfer+=(1-transfer)*ease((time-approach-sweep)/.30);
   const active=transfer<.5?'left':'right';
   if(depositing){const t=ease((time-approach-sweep)/deposit);point=mix(points.at(-1),landing,t);point[1]+=.065*Math.sin(Math.PI*t);phase=placed?'return':'place-stack';}
   const packetTop=[point[0],point[1]+Math.max(0,count-1)*thickness,point[2]];
   if(time<approach){const moving=mix(startsLeft?leftRest:rightRest,points[0],ease(time/approach));moving[1]+=.045*Math.sin(Math.PI*time/approach);if(startsLeft)left=moving;else right=moving;}
   else if(placed){const t=ease((time-approach-sweep-deposit)/returnTime);right=mix(packetTop,rightRest,t);right[1]+=.07*Math.sin(Math.PI*t);}
   else{
    const depart=ease((transfer-.5)*2),arrive=ease(transfer*2);
    if(startsLeft){left=mix(packetTop,leftRest,depart);left[1]+=.04*Math.sin(Math.PI*depart);}
    right=mix(rightRest,packetTop,arrive);
   }
   const transforms=ordered.map((card,index)=>{
    if(index>=count)return{id:card.id,position:[...card.position],yaw:card.yaw,picked:false};
    // Distance-based squaring preserves continuity even when many split cards
    // overlap. No uncollected card jumps to the dealer or changes identity.
    const square=depositing?1:ease(Math.min(1,(travel-pickups[index])/.035));
    const position=[...point];position[1]+=Math.max(0,count-1-index)*thickness;
    position[1]=card.position[1]+(position[1]-card.position[1])*square;
    return{id:card.id,position,yaw:(card.yaw??0)*(1-square),picked:true};
   });
   return {kind:'collect-sweep',phase,progress:time/duration,bodyWeight:time<approach?ease(time/approach):placed?1-ease((time-approach-sweep-deposit)/returnTime):1,
    hand:active==='left'?left:right,left,right,leftGrip:time>=approach&&!placed?1-transfer:0,rightGrip:time>=approach&&!placed?transfer:0,
    active:placed?'right':active,handoff:startsLeft?Math.sin(Math.PI*transfer):0,card:packetTop,cardYaw:0,cardPitch:0,
    picked:count>0,released:placed,visible:true,count,transforms};
  },
 };
}
