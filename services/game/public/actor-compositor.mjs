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
