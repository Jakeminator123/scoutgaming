import * as THREE from './vendor/three/three.module.js';
import {compositeProfileErrors,trackedContacts} from './actor-grade.mjs';

export async function loadActorComposite(){
  const profile=await fetch('review/amira-composite/profile.json').then(r=>{if(!r.ok)throw new Error('Composite profile missing');return r.json();});
  const errors=compositeProfileErrors(profile);if(errors.length)throw new Error(errors.join('; '));
  const tracks=await fetch(profile.contacts).then(r=>{if(!r.ok)throw new Error('Contact tracks missing');return r.json();});
  return {profile,tracks};
}

// The shadow layer is above the table, below cards and the keyed performer.
// It follows the presented native frame, not a timer or a guessed hand pose.
export function createCompositeEnvironment(host,{profile,tracks}){
  const canvas=document.createElement('canvas');canvas.className='actor-contact-shadows';
  Object.assign(canvas.style,{position:'absolute',inset:0,width:'100%',height:'100%',zIndex:19,pointerEvents:'none'});
  canvas.setAttribute('aria-hidden','true');host.append(canvas);
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,2);camera.position.z=1;
  const contact=profile.shadows.contact,cast=profile.shadows.cast;
  const u={mask:{value:null},nextMask:{value:null},maskMix:{value:0},maskRGBA:{value:0},viewport:{value:new THREE.Vector2()},rect:{value:new THREE.Vector4()},sourceSize:{value:new THREE.Vector2()},rail:{value:0},
    points:{value:Array.from({length:4},()=>new THREE.Vector2())},radii:{value:contact.radiiPx.map(p=>new THREE.Vector2(...p))},angles:{value:contact.angles},
    contactOpacity:{value:contact.opacity},contactBlur:{value:contact.blurPx},contactOffset:{value:new THREE.Vector2(...contact.offsetPx)},
    castOpacity:{value:cast.opacity},castBlur:{value:cast.blurPx},castOffset:{value:new THREE.Vector2(...cast.offsetPx)},compression:{value:cast.verticalCompression},castBand:{value:cast.sourceBandAboveRailPx},fadeDistance:{value:cast.fadeDistancePx},referenceScale:{value:1}};
  const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,uniforms:u,
    vertexShader:'varying vec2 v; void main(){v=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader:`varying vec2 v;uniform sampler2D mask,nextMask;uniform float maskMix,maskRGBA;uniform vec2 viewport,sourceSize,points[4],radii[4],contactOffset,castOffset;uniform vec4 rect;
      uniform float rail,angles[4],contactOpacity,contactBlur,castOpacity,castBlur,compression,castBand,fadeDistance,referenceScale;
      float sampleMask(vec2 p){vec2 uv=p/sourceSize;if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0))))return 0.0;uv.y=1.0-uv.y;vec4 a=texture2D(mask,uv);if(maskRGBA<.5)return a.r;return mix(a.a,texture2D(nextMask,uv).a,maskMix);}
      void main(){
        vec2 pixel=vec2(v.x,1.0-v.y)*viewport;
        if(pixel.y<rail){gl_FragColor=vec4(0.0);return;}
        vec2 p=(pixel-rect.xy)/rect.zw*sourceSize;
        float a=0.0;
        for(int i=0;i<4;i++){
          vec2 d=p-points[i]-contactOffset*referenceScale;
          float c=cos(angles[i]),s=sin(angles[i]);d=mat2(c,-s,s,c)*d;
          vec2 r=(radii[i]*.5+vec2(contactBlur))*referenceScale;
          float shadow=contactOpacity*exp(-.5*dot(d/r,d/r));
          a=1.0-(1.0-a)*(1.0-shadow);
        }
        float localRail=(rail-rect.y)/rect.w*sourceSize.y;
        vec2 q=p-castOffset*referenceScale;q.y=localRail+(q.y-localRail)/compression;
        float blur=castBlur*referenceScale;
        // Gaussian 3x3 weights [1,2,1] x [1,2,1], on alpha only.
        float sil=sampleMask(q)*.25;
        for(int i=0;i<8;i++){float angle=float(i)*.7853982;bool diagonal=mod(float(i),2.0)>0.5;
          sil+=sampleMask(q+vec2(cos(angle),sin(angle))*blur*(diagonal?1.414214:1.0))*(diagonal?.0625:.125);}
        float band=smoothstep(localRail-castBand*referenceScale,localRail,q.y);
        float fade=exp(-abs(q.y-localRail)/max(1.0,fadeDistance*referenceScale));
        float c=castOpacity*sil*band*fade;a=1.0-(1.0-a)*(1.0-c);
        gl_FragColor=vec4(0.0,0.0,0.0,clamp(a,0.0,.94));
      }`});
  const geometry=new THREE.PlaneGeometry(2,2);scene.add(new THREE.Mesh(geometry,material));
  const finish=document.createElement('div');finish.className='actor-scene-finish';finish.setAttribute('aria-hidden','true');
  Object.assign(finish.style,{position:'absolute',inset:0,zIndex:35,pointerEvents:'none',backdropFilter:`brightness(${profile.finish.brightness}) contrast(${profile.finish.contrast})`,background:`radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(0,0,0,${profile.finish.vignette}) 100%)`});
  const grain=document.createElement('div');
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" stitchTiles="stitch" seed="9"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>';
  Object.assign(grain.style,{position:'absolute',inset:0,backgroundImage:`url("data:image/svg+xml,${encodeURIComponent(svg)}")`,opacity:profile.finish.grain,mixBlendMode:'soft-light'});finish.append(grain);host.append(finish);
  let lastMask=null,texture=null,stopped=false,joinSource=null,joinTextures=[];
  const makeTexture=image=>{const t=new THREE.CanvasTexture(image);t.colorSpace=THREE.NoColorSpace;t.generateMipmaps=false;t.minFilter=t.magFilter=THREE.LinearFilter;return t;};
  const renderShadow=(actorCanvas,width,height,points,referenceWidth=width)=>{
    const r=actorCanvas.getBoundingClientRect();u.rect.value.set(r.x,r.y,r.width,r.height);u.sourceSize.value.set(width,height);
    u.rail.value=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--performance-rear'))||0;
    u.referenceScale.value=referenceWidth/706;points.forEach((p,i)=>u.points.value[i].set(...p));renderer.render(scene,camera);
  };
  let perfRequest,perfOutput;
  if(new URLSearchParams(location.search).get('compositePerf')==='1'){
    perfOutput=document.createElement('output');perfOutput.id='composite-perf';perfOutput.textContent='Measuring frame pacing…';
    Object.assign(perfOutput.style,{position:'fixed',right:'8px',top:'65px',zIndex:100,background:'#111d',color:'#fff',font:'11px monospace',padding:'6px'});host.append(perfOutput);
    const times=[];let last=0;
    const measure=now=>{if(stopped)return;if(last)times.push(now-last);last=now;
      if(times.length<360)perfRequest=requestAnimationFrame(measure);
      else{const sorted=times.slice(30).sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length*.5)],p95=sorted[Math.floor(sorted.length*.95)];
        perfOutput.textContent=`Frame pacing median ${median.toFixed(1)} ms · p95 ${p95.toFixed(1)} ms`;
        perfOutput.dataset.result=JSON.stringify({samples:sorted.length,medianMs:median,p95Ms:p95,over25ms:sorted.filter(t=>t>25).length});}};
    perfRequest=requestAnimationFrame(measure);
  }
  const resize=()=>{renderer.setSize(innerWidth,innerHeight,false);u.viewport.value.set(innerWidth,innerHeight);};resize();addEventListener('resize',resize);
  return {
    actor(kind,id,sha){
      const track=tracks.clips[id];
      if(!trackedContacts(track,0,sha))throw new Error(`Composite contact/source mismatch: ${id}`);
      return {profile,grade:profile[kind],contacts:frame=>trackedContacts(track,frame,sha),
        paintShadows(mask,actorCanvas,frame){
          if(stopped||!actorCanvas.isConnected)return;
          const points=trackedContacts(track,frame,sha);if(!points)return;
          if(mask!==lastMask){texture?.dispose();texture=makeTexture(mask);lastMask=mask;}
          u.mask.value=u.nextMask.value=texture;u.maskRGBA.value=u.maskMix.value=0;
          texture.needsUpdate=true;renderShadow(actorCanvas,mask.width,mask.height,points);
          canvas.dataset.contactClip=id;canvas.dataset.contactFrame=String(frame);canvas.dataset.contactSource=sha;
        }};
    },
    paintJoin(from,to,actorCanvas,t,fromState,toState){
      if(stopped)return;
      if(joinSource!==from){for(const tex of joinTextures)tex.dispose();joinTextures=[makeTexture(from),makeTexture(to)];joinSource=from;}
      const points=state=>{const track=tracks.clips[state.id],r=state.registration??{};return trackedContacts(track,state.frame,track.sha256).map(p=>p.map((v,k)=>v*(r.scale??1)+(k?r.y??0:r.x??0)));};
      const a=points(fromState),b=points(toState);u.mask.value=joinTextures[0];u.nextMask.value=joinTextures[1];u.maskRGBA.value=1;u.maskMix.value=t;
      renderShadow(actorCanvas,from.width,from.height,a.map((p,i)=>p.map((v,k)=>v+(b[i][k]-v)*t)),470);
      canvas.dataset.contactClip=`${fromState.id}->${toState.id}`;canvas.dataset.contactFrame=t.toFixed(3);
    },
    dispose(){stopped=true;if(perfRequest)cancelAnimationFrame(perfRequest);perfOutput?.remove();removeEventListener('resize',resize);texture?.dispose();for(const t of joinTextures)t.dispose();geometry.dispose();material.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();finish.remove();}
  };
}
