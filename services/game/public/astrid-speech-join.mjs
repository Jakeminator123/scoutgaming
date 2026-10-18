import * as THREE from './vendor/three/three.module.js';
import {actorEdgeGLSL} from './actor-compositor.mjs';
import {edgeBlendGLSL,edgeUniforms,createSceneSampler} from './actor-edge-blend.mjs';

// The fitted flow is only used in the short, silent join. Both endpoints are
// the actual decoded frames; recorded speech is never warped or retimed.
export function capturePacked(frame,width,height,outWidth=width,outHeight=height,x=0,y=0){
  const canvas=document.createElement('canvas');canvas.width=outWidth;canvas.height=outHeight*2;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(frame,0,0,width,height,x,y,width,height);
  ctx.drawImage(frame,0,height,width,height,x,outHeight+y,width,height);
  return canvas;
}

export function loadJoinImage(src){
  const image=new Image();image.src=src;return image.decode().then(()=>image);
}

export function createSpeechJoin(width,height,{composited=false}={}){
  const canvas=document.createElement('canvas');
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:false});
  renderer.setSize(width,height,false);renderer.setClearColor(0,0);
  const textures=[];
  const texture=image=>{
    const t=image instanceof HTMLCanvasElement?new THREE.CanvasTexture(image):new THREE.Texture(image);
    t.colorSpace=THREE.NoColorSpace;t.minFilter=t.magFilter=THREE.LinearFilter;t.generateMipmaps=false;t.needsUpdate=true;textures.push(t);return t;
  };
  const geometry=new THREE.PlaneGeometry(2,2),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,2);camera.position.z=1;
  const vertexShader='varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
  const target=new THREE.WebGLRenderTarget(width,height,{depthBuffer:false,stencilBuffer:false});
  const morph=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,blending:THREE.NoBlending,
    uniforms:{a:{value:null},b:{value:null},flow:{value:null},size:{value:new THREE.Vector2(width,height)},progress:{value:0},composited:{value:composited?1:0}},vertexShader,
    fragmentShader:`varying vec2 v;uniform sampler2D a,b,flow;uniform vec2 size;uniform float progress,composited;
      vec2 movement(vec2 uv,float backward){
        vec2 f=(texture2D(flow,vec2(uv.x,uv.y*.5+(1.0-backward)*.5)).rg*255.0-128.0)*.5;
        return f/vec2(size.x,-size.y);
      }
      vec2 inverseWarp(vec2 uv,float amount,float backward){
        vec2 q=uv-amount*movement(uv,backward);
        for(int i=0;i<2;i++)q=uv-amount*movement(q,backward);
        return q;
      }
      vec4 packedAt(sampler2D image,vec2 uv){
        if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0))))return vec4(0.0);
        if(composited>0.5){vec4 c=texture2D(image,uv);return vec4(c.rgb*c.a,c.a);}
        float alpha=texture2D(image,vec2(uv.x,uv.y*.5)).r;
        return vec4(texture2D(image,vec2(uv.x,uv.y*.5+.5)).rgb*alpha,alpha);
      }
      void main(){
        vec4 c=mix(packedAt(a,inverseWarp(v,progress,0.0)),packedAt(b,inverseWarp(v,1.0-progress,1.0)),progress);
        gl_FragColor=vec4(c.rgb/max(c.a,.00001),c.a);
      }`});
  const morphScene=new THREE.Scene();morphScene.add(new THREE.Mesh(geometry,morph));
  const finish=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,
    uniforms:{actor:{value:target.texture},actorPixel:{value:new THREE.Vector2(1/width,1/height)},composited:{value:composited?1:0},...edgeUniforms()},vertexShader,
    fragmentShader:`varying vec2 v;uniform sampler2D actor;uniform float composited;
      float actorAt(vec2 uv){return texture2D(actor,uv).a;}
      vec3 rgbAt(vec2 uv){return texture2D(actor,uv).rgb;}
      ${actorEdgeGLSL}
      ${edgeBlendGLSL}
      void main(){gl_FragColor=composited>0.5?texture2D(actor,v):blendEdge(v,cleanActor(v));}`});
  const scene=new THREE.Scene();scene.add(new THREE.Mesh(geometry,finish));
  const sampler=createSceneSampler();
  let cancel=null;
  const paint=t=>{
    morph.uniforms.progress.value=t;
    renderer.setRenderTarget(target);renderer.render(morphScene,camera);renderer.setRenderTarget(null);
    sampler.update(finish.uniforms,canvas);renderer.render(scene,camera);
  };
  return {canvas,
    async play(from,to,map,{durationMs=220,signal,onFrame=()=>{}}={}){
      signal?.throwIfAborted();
      for(const t of textures.splice(0))t.dispose();
      morph.uniforms.a.value=texture(from);morph.uniforms.b.value=texture(to);morph.uniforms.flow.value=texture(map);
      return new Promise(resolve=>{
        let request,start;
        const stop=()=>{cancelAnimationFrame(request);signal?.removeEventListener('abort',stop);cancel=null;resolve();};
        cancel=stop;signal?.addEventListener('abort',stop,{once:true});
        const step=now=>{
          if(signal?.aborted)return stop();
          start??=now;const t=Math.min(1,(now-start)/durationMs),eased=t*t*(3-2*t);
          paint(eased);onFrame(eased);
          if(t===1)stop();else request=requestAnimationFrame(step);
        };
        paint(0);request=requestAnimationFrame(step);
      });
    },
    dispose(){cancel?.();for(const t of textures)t.dispose();sampler.dispose();geometry.dispose();morph.dispose();finish.dispose();target.dispose();renderer.dispose();renderer.forceContextLoss();},
  };
}
