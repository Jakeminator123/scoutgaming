import * as THREE from './vendor/three/three.module.js';

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
    if(bestAlpha>0.95)rgb=mix(rgb,inward,1.0-smoothstep(0.65,0.98,original));
    return vec4(rgb,alpha);
  }`;

export function createActorCompositor(width,height){
  const canvas=document.createElement('canvas');
  const source=document.createElement('canvas'),mask=document.createElement('canvas');
  source.width=mask.width=width;source.height=mask.height=height;
  const s=source.getContext('2d'),m=mask.getContext('2d');
  const rgb=new THREE.CanvasTexture(source),alpha=new THREE.CanvasTexture(mask);
  for(const texture of [rgb,alpha]){texture.colorSpace=THREE.NoColorSpace;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;}
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:false});renderer.setSize(width,height,false);renderer.setClearColor(0,0);
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,2);camera.position.z=1;
  const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,
    uniforms:{rgb:{value:rgb},mask:{value:alpha},actorPixel:{value:new THREE.Vector2(1/width,1/height)}},
    vertexShader:'varying vec2 v; void main(){v=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader:`uniform sampler2D rgb; uniform sampler2D mask; varying vec2 v;
      float actorAt(vec2 uv){return texture2D(mask,uv).r;}
      vec3 rgbAt(vec2 uv){return texture2D(rgb,uv).rgb;}
      ${actorEdgeGLSL}
      void main(){gl_FragColor=cleanActor(v);}`});
  const geometry=new THREE.PlaneGeometry(2,2);scene.add(new THREE.Mesh(geometry,material));
  return {canvas,paint(frame,matte,{packed=false}={}){
    s.clearRect(0,0,width,height);m.clearRect(0,0,width,height);
    if(packed){s.drawImage(frame,0,0,width,height,0,0,width,height);m.drawImage(frame,0,height,width,height,0,0,width,height);}
    else{s.drawImage(frame,0,0,width,height);m.drawImage(matte,0,0,width,height);}
    rgb.needsUpdate=alpha.needsUpdate=true;renderer.render(scene,camera);
  },dispose(){rgb.dispose();alpha.dispose();geometry.dispose();material.dispose();renderer.dispose();renderer.forceContextLoss();}};
}
