function parameters(m){
 if(!Array.isArray(m)||m.length!==2||m.some(r=>!Array.isArray(r)||r.length!==3||!r.every(Number.isFinite)))throw Error('Invalid bridge similarity');
 const [[a,b,x],[c,d,y]]=m;
 if(Math.abs(a-d)>1e-8||Math.abs(b+c)>1e-8||Math.hypot(a,c)<=0)throw Error('Bridge requires uniform similarity, no body warp');
 return {scale:Math.hypot(a,c),rotation:Math.atan2(c,a),translation:[x,y]};
}
export function bridgeTransform(registration,frame){
 if(!Number.isFinite(frame))throw Error('Invalid bridge frame');
 // These are already composed into the joined scene; do not compose again.
 const start=parameters(registration.requiredBridgeStartTransform),end=parameters(registration.requiredBridgeEndTransform);
 const u=Math.max(0,Math.min(1,frame/96)),t=u*u*(3-2*u);
 let angle=end.rotation-start.rotation;angle=Math.atan2(Math.sin(angle),Math.cos(angle));
 return {scale:start.scale+(end.scale-start.scale)*t,rotation:start.rotation+angle*t,translation:start.translation.map((v,i)=>v+(end.translation[i]-v)*t)};
}
