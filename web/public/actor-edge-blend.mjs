import * as THREE from './vendor/three/three.module.js';

// Edge blend for the keyed actor (green takes and the waiting idle), on the
// GPU only: the matte is eroded and feathered, and the outer band of the
// actor's colour is wrapped a little toward the scene colour behind her. The
// RGB itself is never blurred, so hair and finger detail survive. Tunable
// through ?edge=erode,feather,wrap (pixels, pixels, fraction) and, when
// ?edgeHud=1, three live sliders.
export const EDGE_DEFAULTS={erode:1,feather:2,wrap:.15};
export const EDGE_LIMITS={erode:[0,4],feather:[0,6],wrap:[0,.6]};

export function parseEdgeParams(search='',defaults=EDGE_DEFAULTS){
  const raw=new URLSearchParams(search).get('edge');
  const out={...defaults};
  if(raw==null)return out;
  const parts=raw.split(',').map(s=>s.trim());
  const keys=['erode','feather','wrap'];
  keys.forEach((key,i)=>{
    if(parts[i]===undefined||parts[i]==='')return;
    const value=Number(parts[i]);
    if(!Number.isFinite(value))return;
    const [lo,hi]=EDGE_LIMITS[key];out[key]=Math.min(hi,Math.max(lo,value));
  });
  return out;
}

// Shared live parameters: every compositor reads them each paint.
export const edgeParams=typeof location==='undefined'?{...EDGE_DEFAULTS}:parseEdgeParams(location.search);
export function setEdgeParams(next){
  for(const key of Object.keys(EDGE_LIMITS)){
    if(next?.[key]===undefined)continue;
    const [lo,hi]=EDGE_LIMITS[key];const value=Number(next[key]);
    if(Number.isFinite(value))edgeParams[key]=Math.min(hi,Math.max(lo,value));
  }
  return {...edgeParams};
}

// Requires actorAt(uv), rgbAt(uv) and actorPixel from the host shader.
export const edgeBlendGLSL=`
  uniform float edgeErode,edgeFeather,edgeWrap,sceneReady;
  uniform sampler2D sceneTex; uniform vec4 sceneRect; uniform vec3 wrapColour,feltColour; uniform float feltFromV;
  float erodedAt(vec2 uv){
    float a=actorAt(uv);
    if(edgeErode<=0.0)return a;
    for(int i=0;i<8;i++){
      float ang=float(i)*0.7853982;
      a=min(a,actorAt(uv+vec2(cos(ang),sin(ang))*actorPixel*edgeErode));
    }
    return a;
  }
  vec4 blendEdge(vec2 uv,vec4 actor){
    float centre=erodedAt(uv),soft=centre;
    if(edgeFeather>0.0){
      // Small gaussian on the (eroded) alpha only: centre plus an 8-tap ring.
      float sum=centre*0.25;
      for(int i=0;i<8;i++){
        float ang=float(i)*0.7853982;
        sum+=erodedAt(uv+vec2(cos(ang),sin(ang))*actorPixel*edgeFeather)*0.09375;
      }
      soft=sum;
    }
    // The cleaned matte stays the ceiling: feathering softens inward, never
    // grows the silhouette back over removed spill.
    float alpha=min(actor.a,soft);
    vec3 rgb=actor.rgb;
    if(edgeWrap>0.0&&alpha>0.001){
      vec2 sceneUv=vec2(sceneRect.x+uv.x*sceneRect.z,1.0-(sceneRect.y+(1.0-uv.y)*sceneRect.w));
      vec4 scene=texture2D(sceneTex,sceneUv);
      // The room plate is CSS and the table canvas keeps no drawing buffer, so
      // the captured texture is usually empty: fall back to the wall tone above
      // the rear rail and the felt tone below it.
      vec3 fallback=mix(wrapColour,feltColour,step(uv.y,feltFromV));
      vec3 behind=mix(fallback,scene.rgb,sceneReady*scene.a);
      // Light wrap: 0 in the interior, up to edgeWrap at the outermost pixels.
      rgb=mix(rgb,behind,edgeWrap*(1.0-soft));
    }
    return vec4(rgb,alpha);
  }`;

export function edgeUniforms(){
  return {edgeErode:{value:edgeParams.erode},edgeFeather:{value:edgeParams.feather},edgeWrap:{value:edgeParams.wrap},
    sceneReady:{value:0},sceneTex:{value:null},sceneRect:{value:new THREE.Vector4(0,0,1,1)},wrapColour:{value:new THREE.Vector3(.13,.11,.08)},feltColour:{value:new THREE.Vector3(.12,.40,.33)},feltFromV:{value:0}};
}

// A 96x54 copy of the Blender table canvas behind the actor (the room plate
// is CSS and cannot be sampled), refreshed at most four times a second, so the wrap can borrow the
// real scene colour per pixel. Falls back to a felt tone when nothing draws.
export function createSceneSampler({interval=250}={}){
  const small=document.createElement('canvas');small.width=96;small.height=54;
  const ctx=small.getContext('2d',{willReadFrequently:true});
  const texture=new THREE.CanvasTexture(small);texture.colorSpace=THREE.NoColorSpace;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;
  let last=-Infinity,ready=false;
  return {texture,
    update(uniforms,element){
      const r=element.getBoundingClientRect();
      uniforms.sceneRect.value.set(r.x/innerWidth,r.y/innerHeight,r.width/innerWidth,r.height/innerHeight);
      uniforms.edgeErode.value=edgeParams.erode;uniforms.edgeFeather.value=edgeParams.feather;uniforms.edgeWrap.value=edgeParams.wrap;
      const rear=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--performance-rear'));
      uniforms.feltFromV.value=Number.isFinite(rear)&&r.height>0?1-(rear-r.y)/r.height:0;
      const now=performance.now();
      if(now-last>=interval){
        last=now;ctx.clearRect(0,0,96,54);
        try{
          for(const id of ['#table-canvas']){
            const el=document.querySelector(id);
            if(el&&(el instanceof HTMLImageElement||el instanceof HTMLCanvasElement||el instanceof HTMLVideoElement)){
              const b=el.getBoundingClientRect();
              ctx.drawImage(el,b.x/innerWidth*96,b.y/innerHeight*54,b.width/innerWidth*96,b.height/innerHeight*54);
            }
          }
          ready=ctx.getImageData(48,27,1,1).data[3]>0;texture.needsUpdate=true;
        }catch{ready=false;}
      }
      uniforms.sceneTex.value=texture;uniforms.sceneReady.value=ready?1:0;
    },
    dispose(){texture.dispose();}};
}

// Cheap live tuning: window.astridEdge.set({erode,feather,wrap}) always; three
// sliders when the page is opened with ?edgeHud=1.
export function installEdgeHud(host){
  if(typeof window==='undefined')return null;
  window.astridEdge={get:()=>({...edgeParams}),set:setEdgeParams,defaults:EDGE_DEFAULTS};
  if(new URLSearchParams(location.search).get('edgeHud')!=='1')return null;
  const panel=document.createElement('div');panel.id='edge-hud';
  Object.assign(panel.style,{position:'absolute',left:'16px',top:'72px',zIndex:70,padding:'8px 10px',border:'1px solid #d6ff3a',borderRadius:'12px',background:'#111c',color:'#d6ff3a',font:'12px Arial',display:'grid',gap:'4px'});
  for(const key of ['erode','feather','wrap']){
    const [lo,hi]=EDGE_LIMITS[key];const row=document.createElement('label');
    const input=document.createElement('input');input.type='range';input.min=lo;input.max=hi;input.step=key==='wrap'?.01:.1;input.value=edgeParams[key];
    const out=document.createElement('span');out.textContent=` ${key} ${edgeParams[key]}`;
    input.oninput=()=>{setEdgeParams({[key]:input.value});out.textContent=` ${key} ${edgeParams[key]}`;};
    row.append(input,out);panel.append(row);
  }
  host.append(panel);return panel;
}
