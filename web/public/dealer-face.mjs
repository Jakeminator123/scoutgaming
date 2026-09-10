// Facial performance is sampled from the original media clock, never a second timer.
const clamp=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
export const FACE_SHAPES=['eyeBlinkLeft','eyeBlinkRight','jawOpen','mouthPucker','mouthSmile','mouthClose','browInnerUpLeft','browInnerUpRight','mouthWide','mouthFunnel'];
// Authored idle behavior, distinct from measured speech. Fast blinks and short
// saccades with held gaze avoid a constantly drifting or motionless stare.
export function sampleDealerIdle(seconds=0) {
 const time=Number.isFinite(seconds)?((seconds%29)+29)%29:0;
 let blink=0;
 for(const start of [3.8,7.9,13.4,19.8,24.6]){const t=time-start;if(t>=0&&t<.09)blink=t/.09;else if(t>=.09&&t<.24)blink=1-(t-.09)/.15;}
 const looks=[[0,0,0],[4.1,.06,-.025],[7.5,0,0],[11.2,-.055,.01],[15.8,0,0],[21.2,.025,-.018],[26.4,0,0]];
 let i=looks.findLastIndex(p=>p[0]<=time),previous=looks[Math.max(0,i-1)],current=looks[i];
 const t=clamp((time-current[0])/.075),ease=t*t*(3-2*t);
 return {weights:{eyeBlinkLeft:blink,eyeBlinkRight:blink},yaw:previous[1]+(current[1]-previous[1])*ease,pitch:previous[2]+(current[2]-previous[2])*ease};
}
export function mapFacialWeights(source={}) {
 const average=(a,b)=>((source[a]??0)+(source[b]??0))/2;
 return Object.fromEntries(FACE_SHAPES.map(name=>[name,clamp(name==='mouthSmile'?average('mouthSmileLeft','mouthSmileRight'):name==='mouthWide'?average('mouthStretchLeft','mouthStretchRight'):name==='mouthClose'?average('mouthPressLeft','mouthPressRight'):name.startsWith('browInnerUp')?(source.browInnerUp??0):source[name]??0)]));
}
export async function verifyFacialSource(data,bytes) {
 if(!/^[a-f0-9]{64}$/.test(data.sha256??''))throw new Error('Facial source hash missing');
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==data.sha256)throw new Error('Facial performance does not match this source video');
 return hash;
}
export function prepareFacialPerformance(data) {
 if(data.schemaVersion!==1||!Array.isArray(data.frames)||!data.frames.length||!(data.duration>0))throw new Error('Invalid facial performance');
 let previous=-1;
 for(const frame of data.frames){if(!Number.isFinite(frame.time)||frame.time<0||frame.time<=previous||frame.time>=data.duration)throw new Error('Facial timestamps must be strictly increasing within source duration');previous=frame.time;}
 const frames=data.frames.map(f=>({time:f.time,weights:mapFacialWeights(f.weights)}));
 return {duration:data.duration,sourceHash:data.sha256,sample(time){
  if(!Number.isFinite(time)||time<frames[0].time||time>=data.duration)return mapFacialWeights();
  let lo=0,hi=frames.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(frames[mid].time<=time)lo=mid;else hi=mid-1;}
  const a=frames[lo],b=frames[Math.min(lo+1,frames.length-1)];
  if(lo===frames.length-1&&time-a.time>.12)return mapFacialWeights();
  if(b.time-a.time>.12)return mapFacialWeights(); // Do not invent missing source performance.
  const t=b.time===a.time?0:(time-a.time)/(b.time-a.time);
  return Object.fromEntries(FACE_SHAPES.map(name=>[name,a.weights[name]+(b.weights[name]-a.weights[name])*t]));
 }};
}
export function controlDealerFace(root) {
 const targets=[],eyes=[];
 root.traverse(obj=>{if(obj.isBone&&['EyeLeft','EyeRight'].includes(obj.name))eyes.push({bone:obj,rest:obj.quaternion.clone(),x:obj.position.clone().set(1,0,0),z:obj.position.clone().set(0,0,1)});if(!obj.morphTargetDictionary||!obj.morphTargetInfluences)return;for(const name of FACE_SHAPES){const index=obj.morphTargetDictionary[name];if(index!==undefined)targets.push({obj,index,name});}});
 if(!targets.length)throw new Error('Dealer model does not contain facial shape keys');
 return {apply(weights={}){for(const {obj,index,name} of targets)obj.morphTargetInfluences[index]=clamp(weights[name]);},gaze(yaw=0,pitch=0){yaw=Math.max(-.35,Math.min(.35,Number.isFinite(yaw)?yaw:0));pitch=Math.max(-.25,Math.min(.25,Number.isFinite(pitch)?pitch:0));for(const {bone,rest,x,z} of eyes)bone.quaternion.copy(rest).multiply(rest.clone().setFromAxisAngle(z,-yaw)).multiply(rest.clone().setFromAxisAngle(x,pitch));},reset(){this.apply();this.gaze();},sample(performance,mediaTime){this.apply(performance.sample(mediaTime));},targetCount:targets.length};
}
