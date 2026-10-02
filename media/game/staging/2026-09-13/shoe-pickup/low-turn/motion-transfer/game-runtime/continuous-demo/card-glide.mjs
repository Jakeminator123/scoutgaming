// Authored motion only after the photographed release. Distances are in the
// fixed1920x1080 source plane, so resizing the browser cannot change timing.
export function createCardGlide(start,target,releaseFrame,{fps=60,latestFrame=333}={}){
 const valid=q=>Array.isArray(q)&&q.length===4&&q.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite));
 if(!valid(start)||!valid(target)||!Number.isInteger(releaseFrame)||!Number.isFinite(fps)||fps<=0)throw Error('Invalid card glide');
 const centre=q=>[0,1].map(axis=>q.reduce((sum,p)=>sum+p[axis],0)/4);
 const a=centre(start),b=centre(target),distance=Math.hypot(b[0]-a[0],b[1]-a[1]);
 // Constant deceleration, bounded to keep the card within its filmed return.
 const cornerDistance=Math.max(...start.map((p,i)=>Math.hypot(p[0]-target[i][0],p[1]-target[i][1])));
 const durationFrames=cornerDistance<1?0:Math.max(12,Math.min(28,Math.ceil(Math.sqrt(2*distance/6000)*fps)));
 const endFrame=releaseFrame+durationFrames;
 if(endFrame>latestFrame)throw Error('Card glide exceeds available return');
 return {distance,durationFrames,endFrame,quadAt(frame){
  const t=durationFrames===0?(frame>=releaseFrame?1:0):Math.max(0,Math.min(1,(frame-releaseFrame)/durationFrames)),travel=1-(1-t)**2;
  return start.map((p,k)=>p.map((n,j)=>n+(target[k][j]-n)*travel));
 }};
}
