// Fixed source-family grading. No per-frame colour fit or camera manipulation.
export function compositeProfileErrors(p){
  const errors=[];
  if(p?.version!==1||p?.dealer!=='amira')errors.push('unsupported profile');
  if(JSON.stringify(p?.curveInput)!=='[0,0.25,0.5,0.75,1]')errors.push('curve input positions must be quarter points');
  for(const kind of ['speech','waiting']){
    const v=p?.[kind],c=v?.curve;
    if(!Array.isArray(c)||c.length!==5||!c.every((x,i)=>Number.isFinite(x)&&x>=0&&x<=1&&(!i||x>=c[i-1])))errors.push(`${kind}: non-monotonic curve`);
    if(!(v?.saturation>=0&&v.saturation<=2))errors.push(`${kind}: saturation`);
    if(!Array.isArray(v?.temperatureRGB)||v.temperatureRGB.length!==3||!v.temperatureRGB.every(x=>Number.isFinite(x)&&x>=.5&&x<=1.5))errors.push(`${kind}: temperature`);
  }
  if(!p?.edge||!p?.shadows?.contact||!p?.shadows?.cast||!p?.finish)errors.push('incomplete composite');
  return errors;
}
export function applyGrade(rgb,g){
  const lum=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
  const pos=Math.min(3.99999,Math.max(0,lum*4)),i=Math.floor(pos);
  const target=g.curve[i]+(g.curve[i+1]-g.curve[i])*(pos-i);
  let out=rgb.map(x=>x*target/Math.max(lum,1e-5));
  const l=(Math.max(...out)+Math.min(...out))/2;
  return out.map((x,c)=>Math.min(1,Math.max(0,(l+(x-l)*g.saturation)*g.temperatureRGB[c])));
}
export function trackedContacts(track,frame,sha){
  if(!track||track.sha256!==sha||track.points?.length!==track.frames)return null;
  const t=Math.max(0,Math.min(track.frames-1,frame)),lo=Math.floor(t),hi=Math.min(track.frames-1,lo+1);
  return track.points[lo].map((p,i)=>p.map((x,k)=>x+(track.points[hi][i][k]-x)*(t-lo)));
}
export const actorGradeGLSL=`
  uniform float gradeEnabled,gradeSaturation,gradeHigh,shapeDodge,shapeBurn,lowerSpill,gradeWrapWidth;
  uniform vec4 gradeCurve; uniform vec3 gradeGain;
  uniform vec2 contactPoints[4];
  float curveAt(float l){
    float x=clamp(l,0.0,1.0)*4.0;
    if(x<1.0)return mix(gradeCurve.x,gradeCurve.y,x);
    if(x<2.0)return mix(gradeCurve.y,gradeCurve.z,x-1.0);
    if(x<3.0)return mix(gradeCurve.z,gradeCurve.w,x-2.0);
    return mix(gradeCurve.w,gradeHigh,x-3.0);
  }
  vec4 gradeActor(vec2 uv,vec4 actor){
    if(gradeEnabled<0.5)return actor;
    vec3 rgb=actor.rgb;
    float lum=dot(rgb,vec3(.2126,.7152,.0722));
    rgb*=curveAt(lum)/max(lum,0.00001);
    float lightness=(max(max(rgb.r,rgb.g),rgb.b)+min(min(rgb.r,rgb.g),rgb.b))*.5;
    rgb=mix(vec3(lightness),rgb,gradeSaturation)*gradeGain;
    // Small shape accents, confined to measured forearm undersides/collar.
    vec2 pixel=vec2(uv.x,1.0-uv.y)/actorPixel;
    float underside=0.0;
    for(int i=2;i<4;i++){
      vec2 d=(pixel-contactPoints[i])/vec2(40.0,12.0);
      underside=max(underside,exp(-dot(d,d)*.5)*smoothstep(-2.0,10.0,pixel.y-contactPoints[i].y));
    }
    float collar=exp(-dot((uv-vec2(.50,.51))/vec2(.07,.10),(uv-vec2(.50,.51))/vec2(.07,.10)));
    rgb*=1.0-shapeBurn*(underside*.7+collar*.25);
    rgb+=shapeDodge*.12*rgb*(1.0-rgb);
    float rim=min(min(actorAt(uv+vec2(actorPixel.x*gradeWrapWidth,0.0)),actorAt(uv-vec2(actorPixel.x*gradeWrapWidth,0.0))),min(actorAt(uv+vec2(0.0,actorPixel.y*gradeWrapWidth)),actorAt(uv-vec2(0.0,actorPixel.y*gradeWrapWidth))));
    rgb=mix(rgb,feltColour,lowerSpill*(1.0-rim)*step(uv.y,feltFromV+.04));
    return vec4(clamp(rgb,0.0,1.0),actor.a);
  }`;
