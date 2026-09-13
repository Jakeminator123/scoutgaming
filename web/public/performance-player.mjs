import * as THREE from './vendor/three/three.module.js';
import {validateContactTake,contactFrame,contactCueClock,uniformRegistration,calibrationPayload,continuationStartFrame} from './performance-contact.mjs';
import {cardFaceArt} from './card-art.mjs';
import {actorEdgeGLSL} from './actor-compositor.mjs';

// A packed source carries RGB in its upper half; R=actor alpha and G=front
// fingers in its lower half. Two independent videos cannot guarantee contact.
export class PerformancePlayer {
  constructor({host,onState=()=>{},staged=false}) {
    this.host=host;this.onState=onState;this.staged=staged;this.active=null;this.assets=new Map();this.held=null;
    this.resize=()=>{if(!this.held)return;const fit=uniformRegistration(this.held.camera,{width:innerWidth,height:innerHeight});Object.assign(this.held.layer.style,{left:`${fit.x}px`,top:`${fit.y}px`,width:`${fit.width}px`,height:`${fit.height}px`});};
    window.addEventListener('resize',this.resize);
  }
  cancel() { this.active?.abort(); }
  release() { this.held?.dispose();this.held=null;this.host.classList.remove('performance-playing'); }
  async preload(takes) { await Promise.all(takes.map(take=>this.source(take))); }
  async source(take,signal) {
    const key=take.media.sha256;
    if(this.assets.has(key))return this.assets.get(key);
    const response=await fetch(take.media.src,{signal});
    if(!response.ok)throw new Error('Performance media is unavailable');
    const bytes=await response.arrayBuffer();
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
    if(digest!==key)throw new Error('Performance media changed since review');
    const url=URL.createObjectURL(new Blob([bytes],{type:'video/mp4'}));
    this.assets.set(key,url);return url;
  }
  async play(take,{card,faceDown=false,target,corners,origin,onCue=()=>{},onLand=()=>{}}) {
    const errors=validateContactTake(take,{approved:!(this.staged&&take.status==='review')});
    if(errors.length)throw new Error(errors[0]);
    if(this.active)throw new Error('A dealer performance is already playing');
    if(!HTMLVideoElement.prototype.requestVideoFrameCallback)throw new Error('Presented video frames are unavailable');
    const fit=uniformRegistration(take.camera,{width:innerWidth,height:innerHeight});
    const controller=new AbortController();this.active=controller;
    const {signal}=controller;
    const video=document.createElement('video');video.playsInline=true;video.muted=true;video.preload='auto';
    // Only silent dealing footage is retimed. Contact and foley still use the
    // presented source frame, never a separate accelerated animation timer.
    video.defaultPlaybackRate=take.playbackRate??1;
    const layer=document.createElement('div');layer.className='performance-layer';layer.setAttribute('aria-hidden','true');
    layer.dataset.action=take.action;layer.dataset.faceDown=String(faceDown);
    Object.assign(layer.style,{left:`${fit.x}px`,top:`${fit.y}px`,width:`${fit.width}px`,height:`${fit.height}px`});
    const moving=document.createElement('canvas');
    const {width,height}=take.media;moving.width=width;moving.height=height;layer.append(moving);
    let visual,frameRequest,timer,landed=false,painted=false,completed=false;
    const dispose=()=>{layer.remove();visual?.dispose();video.removeAttribute('src');video.load();};
    const hidden=()=>{if(document.hidden)controller.abort();};
    const resized=()=>controller.abort();
    document.addEventListener('visibilitychange',hidden);window.addEventListener('resize',resized);
    try {
      if(document.hidden)throw new Error('Performance skipped while table is hidden');
      const calibrationDigest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(calibrationPayload(take)))),x=>x.toString(16).padStart(2,'0')).join('');
      if(calibrationDigest!==take.calibrationSha256)throw new Error('Performance tracking changed since review');
      timer=setTimeout(()=>controller.abort(),20000);
      video.src=await this.source(take,signal);
      await new Promise((resolve,reject)=>{
        const clean=()=>{video.removeEventListener('loadeddata',loaded);video.removeEventListener('error',failed);signal.removeEventListener('abort',aborted);};
        const loaded=()=>{clean();resolve();},failed=()=>{clean();reject(new Error('Cannot decode performance media'));},aborted=()=>{clean();reject(new Error('Performance loading interrupted'));};
        video.addEventListener('loadeddata',loaded,{once:true});video.addEventListener('error',failed,{once:true});signal.addEventListener('abort',aborted,{once:true});
        if(signal.aborted)aborted();else if(video.readyState>=2)loaded();
      });
      if(video.videoWidth!==width||video.videoHeight!==height*2)throw new Error('Packed performance dimensions are invalid');
      if(Math.abs(video.duration-take.media.frames/take.media.fps)>2/take.media.fps)throw new Error('Performance duration no longer matches tracking');
      // Resource selection resets playbackRate to defaultPlaybackRate. Apply
      // the calibrated rate after loading as well, before the first frame.
      video.playbackRate=take.playbackRate??1;
      layer.dataset.playbackRate=String(video.playbackRate);
      const startFrame=continuationStartFrame(this.held?.take,take);
      layer.dataset.startFrame=String(startFrame);
      layer.dataset.take=take.id;
      if(startFrame>0)await new Promise((resolve,reject)=>{
        const clean=()=>{video.removeEventListener('seeked',ready);video.removeEventListener('error',failed);signal.removeEventListener('abort',aborted);};
        const ready=()=>{clean();resolve();},failed=()=>{clean();reject(new Error('Cannot seek to registered pickup'));},aborted=()=>{clean();reject(new Error('Pickup preparation interrupted'));};
        video.addEventListener('seeked',ready,{once:true});video.addEventListener('error',failed,{once:true});signal.addEventListener('abort',aborted,{once:true});
        if(signal.aborted)aborted();else video.currentTime=startFrame/take.media.fps;
      });
      signal.throwIfAborted();
      clearTimeout(timer);timer=setTimeout(()=>controller.abort(),(video.duration/video.playbackRate+3)*1000);
      visual=createContactVisual(moving,width,height,card,faceDown,video,take.colourGain);
      const cue=contactCueClock(take.events,onCue,{fps:take.media.fps,playbackRate:video.playbackRate});
      const end=(corners??[[target.x,target.y],[target.right,target.y],[target.right,target.bottom],[target.x,target.bottom]])
        .map(([x,y])=>[(x-fit.x)/fit.width,(y-fit.y)/fit.height,0]);
      const release=take.frames[take.events.release].card;
      // Keep the previous presented frame while the next media is loading.
      // Swap only after the new frame has actually rendered; never show idle
      // or a transparent canvas between two deliveries.
      layer.style.visibility='hidden';this.host.append(layer);
      this.host.classList.add('performance-active');
      await new Promise((resolve,reject)=>{
        const clean=()=>{signal.removeEventListener('abort',aborted);video.removeEventListener('error',failed);video.removeEventListener('ended',ended);};
        const aborted=()=>{clean();reject(new Error('Performance interrupted; server card preserved'));};
        const failed=()=>{clean();reject(new Error('Performance decoding failed'));};
        const ended=()=>{clean();landed?resolve():reject(new Error('Landing frame was not presented'));};
        signal.addEventListener('abort',aborted,{once:true});video.addEventListener('error',failed,{once:true});video.addEventListener('ended',ended,{once:true});
        const paint=(_,metadata)=>{
          if(signal.aborted)return;
          try {
            const sample=contactFrame(take,metadata.mediaTime);
            // The calibrated resting frame is the end of the action. Do not
            // replay the baked hold after every card in a live sequence.
            const atRest=!take.continuation&&sample.frame>=take.events.rest;
            if(sample.frame<startFrame){frameRequest=video.requestVideoFrameCallback(paint);return;}
            layer.dataset.frame=String(sample.frame);
            layer.dataset.phase=sample.frame<take.events.pickup?'reach':sample.frame<take.events.release?'contact':sample.frame<take.events.land?'release':'return';
            let sampleCard=sample.card;
            if(sample.frame>=take.events.release&&sample.frame<=take.events.land) {
              const t=(sample.frame-take.events.release)/Math.max(1,take.events.land-take.events.release),u=1-(1-t)**2;
              sampleCard={...release,corners:release.corners.map((p,i)=>p.map((v,k)=>v+(end[i][k]-v)*u)),faceUp:!faceDown};
            }
            // Hand the landed card back once, so the resting transition cannot
            // fade, duplicate or pop its face/rotation at the end of the video.
            if(sample.frame>=take.events.land){if(!landed)onLand();sampleCard=null;}
            visual.paint(sampleCard);
            if(!painted){painted=true;this.held?.dispose();this.held=null;layer.style.visibility='';this.host.classList.add('performance-playing');this.onState(`Dealing ${take.action==='deal-dealer'?'to Astrid':'to player'}${faceDown?' · face down':''}`);}
            landed ||= sample.frame>=take.events.land;
            cue(sample.frame,{visible:!document.hidden});
            if(atRest){video.pause();clean();resolve();return;}
            frameRequest=video.requestVideoFrameCallback(paint);
          }catch(error){clean();reject(error);}
        };
        frameRequest=video.requestVideoFrameCallback(paint);
        video.play().catch(error=>{clean();reject(error);});
      });
      completed=true;
      this.held={layer,camera:take.camera,take,dispose};
      this.onState(take.continuation?'Ready · hand at shoe for next card':'Ready · resting pose');
      return {landed};
    } finally {
      clearTimeout(timer);video.pause();if(frameRequest!==undefined)video.cancelVideoFrameCallback(frameRequest);
      document.removeEventListener('visibilitychange',hidden);window.removeEventListener('resize',resized);
      if(!completed){dispose();if(!this.held)this.host.classList.remove('performance-playing');}
      this.host.classList.remove('performance-active');this.active=null;
    }
  }
  dispose(){this.cancel();this.release();window.removeEventListener('resize',this.resize);for(const url of this.assets.values())URL.revokeObjectURL(url);this.assets.clear();}
}

function createContactVisual(canvas,width,height,card,faceDown,video,colourGain=[1,1,1]) {
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});renderer.setSize(width,height,false);renderer.setClearColor(0,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(0,width,0,-height,.1,1000);camera.position.z=100;
  scene.add(new THREE.HemisphereLight(0xfff4dd,0x30363b,2));
  const light=new THREE.DirectionalLight(0xffe6c6,2);light.position.set(-width*.3,height*.4,700);scene.add(light);
  const videoTexture=new THREE.VideoTexture(video);videoTexture.colorSpace=THREE.NoColorSpace;
  videoTexture.minFilter=THREE.LinearFilter;videoTexture.magFilter=THREE.LinearFilter;
  const planes=[];
  for(const foreground of [false,true]) {
    const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,
      uniforms:{actorColourGain:{value:new THREE.Vector3(...colourGain)},source:{value:videoTexture},foreground:{value:foreground?1:0},actorPixel:{value:new THREE.Vector2(1/width,1/height)}},
      vertexShader:'varying vec2 v; void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:`uniform sampler2D source; uniform vec3 actorColourGain; uniform float foreground; varying vec2 v;
        float actorAt(vec2 uv){return texture2D(source,vec2(uv.x,uv.y*0.5)).r;}
        vec3 rgbAt(vec2 uv){return texture2D(source,vec2(uv.x,0.5+uv.y*0.5)).rgb;}
        ${actorEdgeGLSL}
        void main(){vec4 actor=cleanActor(v);
        vec3 masks=texture2D(source,vec2(v.x,v.y*0.5)).rgb;
        // Split the same actor coverage around the card. Painting fingers
        // over a second complete actor made soft edges more opaque in action
        // than they are in the shared speech compositor.
        float frontAlpha=min(actor.a,masks.g);
        float backAlpha=(actor.a-frontAlpha)/max(1.0-frontAlpha,0.00001);
        float alpha=mix(backAlpha,frontAlpha,foreground);
        if(alpha<0.01)discard;
        // Match warm skin pixels without yellowing the ivory blouse or
        // changing the black suit. Both actor layers use identical grading.
        float warmth=smoothstep(0.08,0.18,actor.r-actor.b)*smoothstep(0.015,0.055,actor.r-actor.g);
        gl_FragColor=vec4(actor.rgb*mix(vec3(1.0),actorColourGain,warmth),alpha);}`});
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
    plane.position.set(width/2,-height/2,foreground?1:-1);plane.renderOrder=foreground?2:0;
    plane.frustumCulled=false;scene.add(plane);planes.push(plane);
  }
  const front=new THREE.CanvasTexture(cardFaceArt(card??{r:'',s:''}).canvas);front.colorSpace=THREE.SRGBColorSpace;
  const back=new THREE.TextureLoader().load('assets/cardback.png');back.colorSpace=THREE.SRGBColorSpace;
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(12),3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,1,1,1,0,0,0],2));geo.setIndex([0,2,1,0,3,2]);
  // The face bitmap already carries the table's paper exposure. Additional
  // lighting made it cream in motion, then white when the DOM took over.
  const mat=new THREE.MeshBasicMaterial({map:front,transparent:true,alphaTest:.01,toneMapped:false,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geo,mat);mesh.frustumCulled=false;mesh.renderOrder=1;scene.add(mesh);
  return {paint(sample){videoTexture.needsUpdate=true;mesh.visible=!!sample;if(sample){
    for(let i=0;i<4;i++){const p=sample.corners[i];geo.attributes.position.setXYZ(i,p[0]*width,-p[1]*height,p[2]);}
    geo.attributes.position.needsUpdate=true;geo.computeVertexNormals();mat.map=faceDown||!sample.faceUp?back:front;mat.needsUpdate=true;
  }renderer.render(scene,camera);},dispose(){geo.dispose();mat.dispose();front.dispose();back.dispose();videoTexture.dispose();for(const plane of planes){plane.geometry.dispose();plane.material.dispose();}renderer.dispose();renderer.forceContextLoss();}};
}

// The table's hands use affine CSS transforms (fan rotation, skew and felt
// flattening). Preserve the four actual corners instead of landing on their
// axis-aligned bounding rectangle and snapping to the fan afterward.
export function cardLandingCorners(element) {
  const bounds=element.getBoundingClientRect();let matrix=new DOMMatrix();
  for(let node=element;node instanceof Element;node=node.parentElement){
    const transform=getComputedStyle(node).transform;
    if(transform!=='none')matrix=new DOMMatrix(transform).multiply(matrix);
  }
  if(!matrix.is2D)return null;
  const style=getComputedStyle(element),w=parseFloat(style.width),h=parseFloat(style.height);
  const points=[[0,0],[w,0],[w,h],[0,h]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix));
  const minX=Math.min(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y));
  return points.map(p=>[bounds.x+p.x-minX,bounds.y+p.y-minY]);
}
