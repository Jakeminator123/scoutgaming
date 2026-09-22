import * as THREE from './vendor/three/three.module.js';
import {edgeBlendGLSL,edgeUniforms,createSceneSampler} from './actor-edge-blend.mjs';
import {actorGradeGLSL} from './actor-grade.mjs';

// Source-pixel cleanup, shared by stream speech, embedded speech and dealing.
// Opaque skin/hair pixels remain unchanged. At the segmentation boundary only,
// use the nearest more-opaque colour to remove captured background spill.
export const actorEdgeGLSL=`
  uniform vec2 actorPixel;
  vec4 cleanActor(vec2 uv){
    float original=actorAt(uv),alpha=original,bestAlpha=original;
    vec3 rgb=rgbAt(uv),inward=rgb;
    for(int i=0;i<4;i++){
      vec2 direction=i==0?vec2(1.0,0.0):i==1?vec2(-1.0,0.0):i==2?vec2(0.0,1.0):vec2(0.0,-1.0);
      alpha=min(alpha,actorAt(uv+direction*actorPixel));
      vec2 inside=uv+direction*actorPixel*2.0;
      float candidate=actorAt(inside);
      if(candidate>bestAlpha){bestAlpha=candidate;inward=rgbAt(inside);}
    }
    alpha=clamp((alpha-0.06)/0.94,0.0,1.0);
    // A fingertip over the opaque black sleeve is not background spill.
    // Borrowing the sleeve's colour turns skin black as the matte fluctuates.
    float skin=smoothstep(0.07,0.16,rgb.r-rgb.b)*smoothstep(0.015,0.055,rgb.r-rgb.g);
    alpha=max(alpha,skin*smoothstep(0.04,0.65,original));
    float colourMatch=1.0-smoothstep(0.08,0.22,length(rgb-inward));
    if(bestAlpha>0.95)rgb=mix(rgb,inward,colourMatch*(1.0-smoothstep(0.65,0.98,original)));
    return vec4(rgb,alpha);
  }`;

export function createActorCompositor(width,height,{composite=null}={}){
  const canvas=document.createElement('canvas');
  const source=document.createElement('canvas'),mask=document.createElement('canvas');
  source.width=mask.width=width;source.height=mask.height=height;
  const s=source.getContext('2d'),m=mask.getContext('2d');
  const rgb=new THREE.CanvasTexture(source),alpha=new THREE.CanvasTexture(mask);
  for(const texture of [rgb,alpha]){texture.colorSpace=THREE.NoColorSpace;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;}
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:false});renderer.setSize(width,height,false);renderer.setClearColor(0,0);
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,2);camera.position.z=1;
  const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,
    uniforms:{rgb:{value:rgb},mask:{value:alpha},actorPixel:{value:new THREE.Vector2(1/width,1/height)},...edgeUniforms(),
      gradeEnabled:{value:composite?1:0},gradeCurve:{value:new THREE.Vector4(...(composite?.grade.curve.slice(0,4)??[0,.25,.5,.75]))},gradeHigh:{value:composite?.grade.curve[4]??1},
      gradeSaturation:{value:composite?.grade.saturation??1},gradeGain:{value:new THREE.Vector3(...(composite?.grade.temperatureRGB??[1,1,1]))},
      shapeDodge:{value:composite?.profile.shape.dodge??0},shapeBurn:{value:composite?.profile.shape.burn??0},lowerSpill:{value:composite?.profile.edge.lowerSpillAmount??0},
      gradeWrapWidth:{value:composite?.profile.edge.wrapWidthPx??2.5},
      contactPoints:{value:Array.from({length:4},()=>new THREE.Vector2())}},
    vertexShader:'varying vec2 v; void main(){v=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader:`uniform sampler2D rgb; uniform sampler2D mask; varying vec2 v;
      float actorAt(vec2 uv){return texture2D(mask,uv).r;}
      vec3 rgbAt(vec2 uv){return texture2D(rgb,uv).rgb;}
      ${actorEdgeGLSL}
      ${edgeBlendGLSL}
      ${actorGradeGLSL}
      void main(){gl_FragColor=blendEdge(v,gradeActor(v,cleanActor(v)));}`});
  const geometry=new THREE.PlaneGeometry(2,2);scene.add(new THREE.Mesh(geometry,material));
  const sceneSampler=createSceneSampler();
  let paintCount=0,submitTotal=0;
  if(composite)canvas.dataset.compositeProfile=composite.profile.id;
  return {canvas,paint(frame,matte,{packed=false,frameIndex=0}={}){
    const started=performance.now();
    s.clearRect(0,0,width,height);m.clearRect(0,0,width,height);
    if(packed){s.drawImage(frame,0,0,width,height,0,0,width,height);m.drawImage(frame,0,height,width,height,0,0,width,height);}
    else{s.drawImage(frame,0,0,width,height);m.drawImage(matte,0,0,width,height);}
    if(canvas.isConnected)sceneSampler.update(material.uniforms,canvas);
    if(composite){
      const u=material.uniforms,e=composite.profile.edge;
      u.edgeErode.value=e.erodePx;u.edgeFeather.value=e.featherPx;u.edgeWrap.value=e.wrapAmount;
      if(e.hair){u.hairFeather.value=e.hair.featherPx*width/470;u.hairAmount.value=e.hair.amount;u.hairWrap.value=e.hair.wrapAmount;u.hairRegion.value.set(...e.hair.region);}
      // Stable, measured room/felt colours avoid a green fallback or a random
      // cleared WebGL drawing buffer changing the wrap between video frames.
      u.sceneReady.value=0;u.wrapColour.value.set(...e.roomRGB);u.feltColour.value.set(...e.feltRGB);
      composite.contacts(frameIndex)?.forEach((p,i)=>u.contactPoints.value[i].set(...p));
      composite.paintShadows(mask,canvas,frameIndex);
    }
    rgb.needsUpdate=alpha.needsUpdate=true;renderer.render(scene,camera);
    if(composite){const elapsed=performance.now()-started;canvas.dataset.compositeSubmitMs=elapsed.toFixed(2);
      if(++paintCount>3){submitTotal+=elapsed;canvas.dataset.compositeMeanSubmitMs=(submitTotal/(paintCount-3)).toFixed(2);}}
  },snapshot({width:outWidth=width,height:outHeight=height,x=0,y=0,scale=1}={}){
    // Copy immediately after rendering, before the browser clears the WebGL
    // drawing buffer. Silent joins consume the exact graded/cleaned endpoint.
    renderer.render(scene,camera);
    const image=document.createElement('canvas');image.width=outWidth;image.height=outHeight;
    image.getContext('2d').drawImage(canvas,x,y,width*scale,height*scale);return image;
  },dispose(){sceneSampler.dispose();rgb.dispose();alpha.dispose();geometry.dispose();material.dispose();renderer.dispose();renderer.forceContextLoss();}};
}
