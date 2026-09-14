export function reviewQuery(params,box){if(box===3)return (params.get('astridBox3')??'contact')==='contact'&&params.get('astridBox0')==='review'?'review':null;return box===1?(params.get('astridBox1')??params.get('astridBox0')):params.get('astridBox0');}
export function eligible({hostname,port,query,dealer,box,index,split,candidateBox=0}){return port==='4190'&&hostname==='astridsingleseat.localhost'&&query==='review'&&dealer==='astrid'&&[0,1,3].includes(candidateBox)&&box===candidateBox&&index===0&&!split;}
export function sourceFit(fit){const reference={scale:(720-136)/720,x:(1280-1280*((720-136)/720))/2,y:0};const captured={scale:.5421688741883204,x:121.01686751907214,y:.1039891799197603};const ratio=fit.scale/reference.scale;return {scale:ratio*captured.scale,x:fit.x+(captured.x-reference.x)*ratio,y:fit.y+(captured.y-reference.y)*ratio};}
export function canonicalCorners(corners,fit){if(!corners||corners.length!==4)throw Error('Actual2D card corners required');return corners.map(([x,y])=>[(x-fit.x)/fit.scale,(y-fit.y)/fit.scale]);}
// Measured at 1091x837: responsive correction leaves <=.00351 native px
// from CSS layout serialization (~.002 screen px); cap allowance at .02.
export const TARGET_LAYOUT_TOLERANCE=.02;
export function assertTarget(actual,target){if(actual.some((p,i)=>Math.hypot(p[0]-target[i][0],p[1]-target[i][1])>TARGET_LAYOUT_TOLERANCE))throw Error('Current first-card target differs from reviewed endpoint; candidate unavailable');}
export function once(fn){let done=false;return (...args)=>{if(done)return false;done=true;fn(...args);return true;};}
// Scale the complete local hand about its unchanged seat anchor. The table
// scales uniformly; the legacy hand's sizes, offsets and transform origin do not.
export function responsiveHandMatrix({matrix,left,top,origin,anchor=[60,60],ratio}){
 if(!Number.isFinite(ratio)||ratio<=0||matrix.length!==6||![...matrix,left,top,...origin,...anchor].every(Number.isFinite))throw Error('Invalid responsive hand geometry');
 const [a,b,c,d,e,f]=matrix;
 return [a*ratio,b*ratio,c*ratio,d*ratio,e*ratio+(ratio-1)*(left+origin[0]-anchor[0]),f*ratio+(ratio-1)*(top+origin[1]-anchor[1])];
}
// Linear map only: preserve photographed landing center, replace local basis.
export function basisChange(from,to){
 const basis=q=>[q[1][0]-q[0][0],q[1][1]-q[0][1],q[3][0]-q[0][0],q[3][1]-q[0][1]];
 const [a,b,c,d]=basis(from),[e,f,g,h]=basis(to),det=a*d-b*c;if(Math.abs(det)<1e-8)throw Error('Degenerate card basis');
 return [(e*d-g*b)/det,(f*d-h*b)/det,(-e*c+g*a)/det,(-f*c+h*a)/det];
}

// Explicit small source-camera center calibration for box1 only, in native pixels.
export function centerCalibration(actual,target,maxNative=4){
 if(maxNative!==4||![actual,target].every(q=>q?.length===4&&q.every(p=>p?.length===2&&p.every(Number.isFinite))))throw Error('Invalid center calibration');
 const center=q=>q.reduce((a,p)=>[a[0]+p[0]/4,a[1]+p[1]/4],[0,0]);
 const a=center(actual),b=center(target),delta=[b[0]-a[0],b[1]-a[1]],distance=Math.hypot(...delta);
 if(distance>maxNative)throw Error(`Box1 center correction ${distance.toFixed(3)} native px exceeds4; responsive target unavailable`);
 return {delta,distance,maxNative,policy:'Card-only bounded center calibration; actor unchanged'};
}

export function sourceActorTransform(value){
 if(value==null)return undefined;
 if(Object.keys(value).some(k=>!['scale','translation','rotation'].includes(k))||!Number.isFinite(value.scale)||value.scale<=0||!Array.isArray(value.translation)||value.translation.length!==2||!value.translation.every(Number.isFinite)||(value.rotation!==undefined&&!Number.isFinite(value.rotation)))throw Error('Only explicit uniform actor registration is supported');
 return {scale:value.scale,translation:[...value.translation],rotation:value.rotation??0};
}

export function shoeOcclusionContract(ledger,media){
 const value=ledger.shoeOcclusion;
 if(!value||value.src!=='/astrid-box3/shoe-allowed-canonical.png'||!(/^[a-f0-9]{64}$/).test(value.sha256)||value.sha256!==media.shoeMaskSHA256||value.startSource!==38||value.endSource!==48)throw Error('Box3 shoe mask provenance or range mismatch');
 return value;
}
export function sourceShoeOccluded(sourceNative,contract){return Number.isInteger(sourceNative)&&sourceNative>=contract.startSource&&sourceNative<=contract.endSource;}

export function reviewDiagnostics(params){return params.get('astridDiagnostics')==='1'||params.get('astridCapture')==='1';}
