// Metres, Y up. Seat numbering follows the game's left-to-right box order.
// A split uses a compact two-row arrangement instead of widening through
// neighbouring players. Server hand/card identities remain unchanged.
export function riggedCardPose({profile,seat=null,handIndex=0,handCount=1,cardIndex=0,cardCount=1}) {
  if(seat!==null&&(!Number.isInteger(seat)||seat<0||seat>6))throw new Error('Invalid seat');
  if(!Number.isInteger(handCount)||handCount<1||handCount>4||!Number.isInteger(handIndex)||handIndex<0||handIndex>=handCount||(seat===null&&handCount!==1))throw new Error('Invalid split hand');
  if(!Number.isInteger(cardCount)||cardCount<1||!Number.isInteger(cardIndex)||cardIndex<0||cardIndex>=cardCount)throw new Error('Invalid card index');
  const position=[...(seat===null?profile.dealerCards:profile.seatCards[6-seat])];
  position[1]=profile.feltHeight+.00055+cardIndex*.00045;
  if(handCount===1){
    const step=Math.min(.023,.11/Math.max(1,cardCount-1));
    position[0]+=(cardIndex-(cardCount-1)/2)*step;
    position[2]-=cardIndex*Math.min(.006,(seat===null?.016:.06)/Math.max(1,cardCount-1));
  }else{
    const angle=Math.PI*.15+(6-seat)*(Math.PI*.70/6);
    const tangent=[Math.sin(angle),-Math.cos(angle)*.66/.91];
    const length=Math.hypot(...tangent);tangent[0]/=length;tangent[1]/=length;
    const outward=[-tangent[1],tangent[0]],columns=Math.min(2,handCount);
    const column=handIndex%columns,row=Math.floor(handIndex/columns);
    const spread=Math.min(.014,.056/Math.max(1,cardCount-1));
    const across=(column-(columns-1)/2)*.145+(cardIndex-(cardCount-1)/2)*spread;
    const depth=(handCount>2?(row-.5)*.115:0)-.012-cardIndex*Math.min(.002,.010/Math.max(1,cardCount-1));
    position[0]+=tangent[0]*across+outward[0]*depth;
    position[2]+=tangent[1]*across+outward[1]*depth;
    if(seat===0||seat===6)position[0]+=Math.sign(position[0])*.042;
  }
  return {position,yaw:Math.atan2(position[0]*.72,Math.max(.25,position[2]))};
}

export function cardCorners({position,yaw},width=.063,length=.088) {
  const c=Math.cos(yaw),s=Math.sin(yaw);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>[
    position[0]+x*width/2*c+z*length/2*s,position[1],
    position[2]-x*width/2*s+z*length/2*c,
  ]);
}
