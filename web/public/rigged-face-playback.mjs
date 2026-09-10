import {controlDealerFace,prepareFacialPerformance,verifyFacialSource,sampleDealerIdle} from './dealer-face.mjs';

// The caller supplies the same media element used by shared playSpeech.
// Preparation does not animate anything; only its successfully started token
// can own the face, and an old completion cannot clear a newer utterance.
export function createRiggedFacePlayback({root,modelSha256,loadPerformance,loadBytes,baseURL,onState=()=>{},onSample=()=>{}}){
 const face=controlDealerFace(root),verified=new Map();let active=null;
 let eye=null;root.traverse(obj=>{if(obj.isBone&&obj.name==='EyeLeft')eye=obj;});
 const eyeRest=eye?.quaternion.clone();let lastTime=null,yaw=0,pitch=0;
 const url=value=>new URL(value,baseURL).href;
 const cancelled=signal=>{if(signal?.aborted)throw new DOMException('Facial preparation cancelled','AbortError');};
 async function verify(data,source,signal){
  const key=url(source)+'#'+data.sha256;
  if(verified.has(key))return;
  const bytes=await loadBytes(url(source),signal);cancelled(signal);
  await verifyFacialSource(data,bytes);cancelled(signal);verified.set(key,true);
 }
 return {
  async prepare({id,media,kind,audioDelayMs=0,text},signal){
   cancelled(signal);const data=await loadPerformance(id,signal);cancelled(signal);
   const b=data?.binding;
   if(!b||b.lineId!==id||b.kind!==kind||!b.videoUrl||!b.audioUrl||!Number.isFinite(b.audioDelayMs)||b.audioDelayMs!==audioDelayMs||b.text!==text)
    throw new Error(`Facial binding differs from the playing line: ${id}`);
   if(!['embedded-video','indexed-audio'].includes(kind)||url(media.currentSrc||media.src)!==url(b.audioUrl))
    throw new Error(`Facial audio source differs from the playing media: ${id}`);
   const performance=prepareFacialPerformance(data,{modelSha256});
   await verify(data,b.videoUrl,signal);
   await verify({sha256:b.audioSha256},b.audioUrl,signal);cancelled(signal);
   return {id,media,performance,offset:kind==='indexed-audio'?Math.max(0,b.audioDelayMs)/1000:0,signal};
  },
  start(token){if(!token||token.signal?.aborted)return false;face.reset();active=token;onState(token.id);return true;},
  stop(token){if(token&&token!==active)return;active=null;face.reset();onState(null);},
  sample(idleSeconds,lookAt=null){
   const dt=lastTime===null?1/30:Math.max(0,Math.min(.05,idleSeconds-lastTime));lastTime=idleSeconds;
   if(active?.signal?.aborted||active?.media.ended)this.stop(active);
   if(active){yaw=pitch=0;const time=active.media.currentTime+active.offset;face.sample(active.performance,time);onSample({id:active.id,mediaTime:active.media.currentTime,time});return;}
   const idle=sampleDealerIdle(idleSeconds);let targetYaw=idle.yaw,targetPitch=idle.pitch;
   if(eye&&lookAt){
    // The authored eye points along local +Y. Evaluate the resting eye basis
    // in the currently posed head; the previous gaze must not feed back.
    eye.updateWorldMatrix(true,false);
    const origin=eye.getWorldPosition(eye.position.clone());
    const inverse=eye.parent.getWorldQuaternion(eyeRest.clone()).multiply(eyeRest).invert();
    const direction=origin.clone().set(...lookAt).sub(origin).applyQuaternion(inverse);
    targetYaw=Math.max(-.35,Math.min(.35,Math.atan2(direction.x,direction.y)));
    targetPitch=Math.max(-.25,Math.min(.25,Math.atan2(direction.z,Math.hypot(direction.x,direction.y))));
   }
   const blend=1-Math.exp(-dt*12);yaw+=(targetYaw-yaw)*blend;pitch+=(targetPitch-pitch)*blend;
   face.apply(idle.weights);face.gaze(yaw,pitch);
  },
  get currentLine(){return active?.id??null;},
 };
}
