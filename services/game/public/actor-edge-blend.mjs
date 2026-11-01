import * as THREE from './vendor/three/three.module.js';

// Edge blend for the keyed actor (green takes and the waiting idle), on the
// GPU only: the matte is eroded and feathered, and the outer band of the
// actor's colour is wrapped a little toward the scene colour behind her. The
// RGB itself is never blurred, so hair and finger detail survive. Tunable
// through ?edge=erode,feather,wrap (pixels, pixels, fraction).
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

// Requires actorAt(uv), rgbAt(uv) and actorPixel from the host shader.
export const edgeBlendGLSL=`
  uniform float edgeErode,edgeFeather,edgeWrap;
  uniform float hairFeather,hairAmount,hairWrap;uniform vec4 hairRegion;
  uniform vec3 wrapColour,feltColour; uniform float feltFromV;
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
    // Amira-only optional hair matte treatment. No RGB blur: skin and the
    // opaque face interior retain their original pixels and alpha.
    vec2 p=vec2(uv.x,1.0-uv.y);
    float hair=hairAmount*smoothstep(hairRegion.x,hairRegion.x+.035,p.x)*(1.0-smoothstep(hairRegion.y-.035,hairRegion.y,p.x))
      *(1.0-smoothstep(hairRegion.w-.045,hairRegion.w,p.y))
      *(1.0-smoothstep(.16,.32,dot(rgbAt(uv),vec3(.2126,.7152,.0722))));
    float feather=mix(edgeFeather,max(edgeFeather,hairFeather),hair);
    if(feather>0.0){
      // Small gaussian on the (eroded) alpha only: centre plus an 8-tap ring.
      float sum=centre*0.25;
      for(int i=0;i<8;i++){
        float ang=float(i)*0.7853982;
        sum+=erodedAt(uv+vec2(cos(ang),sin(ang))*actorPixel*feather)*0.09375;
      }
      soft=sum;
    }
    // The cleaned matte stays the ceiling: feathering softens inward, never
    // grows the silhouette back over removed spill.
    float alpha=min(actor.a,soft);
    vec3 rgb=actor.rgb;
    if(edgeWrap>0.0&&alpha>0.001){
      // Stable wall tone above the rear rail and felt tone below it.
      vec3 behind=mix(wrapColour,feltColour,step(uv.y,feltFromV));
      // Light wrap: 0 in the interior, up to edgeWrap at the outermost pixels.
      rgb=mix(rgb,behind,mix(edgeWrap,hairWrap,hair)*(1.0-soft));
    }
    return vec4(rgb,alpha);
  }`;

export function edgeUniforms(){
  return {edgeErode:{value:edgeParams.erode},edgeFeather:{value:edgeParams.feather},edgeWrap:{value:edgeParams.wrap},
    hairFeather:{value:0},hairAmount:{value:0},hairWrap:{value:0},hairRegion:{value:new THREE.Vector4(.28,.70,0,.5)},
    wrapColour:{value:new THREE.Vector3(.13,.11,.08)},feltColour:{value:new THREE.Vector3(.12,.40,.33)},feltFromV:{value:0}};
}

// Keep the wall/felt boundary aligned with the actor as the viewport changes.
export function updateEdgeUniforms(uniforms,element){
  const r=element.getBoundingClientRect();
  uniforms.edgeErode.value=edgeParams.erode;uniforms.edgeFeather.value=edgeParams.feather;uniforms.edgeWrap.value=edgeParams.wrap;
  const rear=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--performance-rear'));
  uniforms.feltFromV.value=Number.isFinite(rear)&&r.height>0?1-(rear-r.y)/r.height:0;
}
