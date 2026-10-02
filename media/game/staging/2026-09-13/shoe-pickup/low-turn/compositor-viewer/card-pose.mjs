// Authored rigid orthographic pose; hidden corners are not measured observations.
export function cardPose(trajectory,time){
 const a=trajectory.frames[Math.floor(time)],b=trajectory.frames[Math.ceil(time)];
 if(!a?.rotationVector||!b?.rotationVector)return null;
 const fraction=time-Math.floor(time),mix=(x,y)=>x+(y-x)*fraction;
 const rotation=a.rotationVector.map((v,i)=>mix(v,b.rotationVector[i]));
 const center=a.centerNative.map((v,i)=>mix(v,b.centerNative[i]));
 const angle=Math.hypot(...rotation),axis=angle?rotation.map(v=>v/angle):[0,0,1];
 const c=Math.cos(angle),s=Math.sin(angle),[kx,ky,kz]=axis;
 const {width,height}=trajectory.physicalDimensions;
 const quad=[[-width/2,-height/2],[width/2,-height/2],[width/2,height/2],[-width/2,height/2]].map(([x,y])=>{
  const dot=kx*x+ky*y;
  return [x*c-kz*y*s+kx*dot*(1-c)+center[0],y*c+kz*x*s+ky*dot*(1-c)+center[1]];
 });
 const u=[quad[1][0]-quad[0][0],quad[1][1]-quad[0][1]],v=[quad[3][0]-quad[0][0],quad[3][1]-quad[0][1]];
 const face=u[0]*v[1]-u[1]*v[0]>0?'back':'front';
 return {quad,face};
}
