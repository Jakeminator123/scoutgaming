import {stageGeometry,backgroundRect,tableRect} from './geometry.js';
/* One WebGL compositor, one decoded dealer frame, multiple complementary passes.
 * No AI segmentation; split mask is an explicit authoring aid. */
export class Compositor {
  constructor(canvas, onError = console.error) {
    this.canvas = canvas; this.onError = onError; this.images = new Map(); this.textures = new Map();
    this.cardCanvas = document.createElement('canvas'); this.cardCanvas.width=1080; this.cardCanvas.height=1920;
    this.cardRevision=0; this.lastCards=''; this.ready=true;
    this.gl=canvas.getContext('webgl',{alpha:false, antialias:false, premultipliedAlpha:true});
    if (!this.gl) { this.cpu=new CanvasFallback(canvas,this.cardCanvas); this.onError('WebGL är avstängt här. Reservvisning med CPU används – lägre förhandsupplösning, oförändrade exportfiler.'); return; }
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.ready=false;this.onError('Grafikkontexten tappades. Väntar på återställning.');});
    canvas.addEventListener('webglcontextrestored',()=>{this.textures.clear();this.init();this.ready=true;this.onError('Grafiken har återställts.');});
    this.init();
  }
  init(){
    const gl=this.gl;
    const vertex=`attribute vec2 a; uniform vec4 rect; uniform vec2 res; varying vec2 uv;
      void main(){uv=a;vec2 p=(rect.xy+a*rect.zw)/res;gl_Position=vec4(p.x*2.-1.,1.-p.y*2.,0.,1.);}`;
    const fragment=`precision mediump float;varying vec2 uv;uniform sampler2D image;uniform sampler2D mask;uniform sampler2D hand;
      uniform float keyOn,threshold,softness,despill,debugMode,pass,splitY,hasHand,hasMask,opacity;
      void main(){vec4 c=texture2D(image,uv);float alpha=c.a;
        if(keyOn>.5){float dominance=(c.g-max(c.r,c.b))/max(c.g,.001);
          float green=smoothstep(threshold,threshold+softness,dominance)*smoothstep(.012,.065,c.g);
          alpha*=1.-green;c.g=mix(c.g,min(c.g,max(c.r,c.b)),despill*green);}
        if(hasMask>.5) alpha*=texture2D(mask,uv).r;
        float hands=hasHand>.5?texture2D(hand,uv).r:smoothstep(splitY-.002,splitY+.002,uv.y);
        if(pass>.5&&pass<1.5)alpha*=1.-hands;
        if(pass>1.5)alpha*=hands;
        if(debugMode>1.5){c.rgb=vec3(alpha);alpha=1.;}
        alpha*=opacity;gl_FragColor=vec4(c.rgb*alpha,alpha);
      }`;
    const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
    const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment),p=gl.createProgram();
    gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));this.program=p;gl.useProgram(p);
    this.u={};for(const n of ['rect','res','image','mask','hand','keyOn','threshold','softness','despill','debugMode','pass','splitY','hasHand','hasMask','opacity'])this.u[n]=gl.getUniformLocation(p,n);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]),gl.STATIC_DRAW);
    const attr=gl.getAttribLocation(p,'a');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
    gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    this.white=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.white);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  }
  texture(source,unit=0){
    const gl=this.gl;gl.activeTexture(gl.TEXTURE0+unit);
    if(!source){gl.bindTexture(gl.TEXTURE_2D,this.white);return;}
    let record=this.textures.get(source);
    if(!record){record={tex:gl.createTexture(),version:null};this.textures.set(source,record);gl.bindTexture(gl.TEXTURE_2D,record.tex);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);}
    gl.bindTexture(gl.TEXTURE_2D,record.tex);
    const version=source instanceof HTMLVideoElement?source.currentSrc+'@'+source.currentTime:source===this.cardCanvas?this.cardRevision:source.src||'static';
    if(record.version!==version){
      if(source instanceof HTMLVideoElement && source.readyState<2)return;
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);record.version=version;
    }
  }
  draw(source,rect,{key=null,pass=0,mask=null,hand=null,splitY=.4,opacity=1,debug=0}={}){
    if(!source)return;const gl=this.gl,u=this.u;gl.useProgram(this.program);
    this.texture(source,0);this.texture(mask,1);this.texture(hand,2);
    gl.uniform1i(u.image,0);gl.uniform1i(u.mask,1);gl.uniform1i(u.hand,2);
    gl.uniform4f(u.rect,...rect);gl.uniform2f(u.res,...this.logical);
    gl.uniform1f(u.keyOn,key?.enabled?1:0);gl.uniform1f(u.threshold,key?.threshold??.23);gl.uniform1f(u.softness,key?.softness??.15);
    gl.uniform1f(u.despill,key?.despill??0);gl.uniform1f(u.debugMode,debug);gl.uniform1f(u.pass,pass);gl.uniform1f(u.splitY,splitY);
    gl.uniform1f(u.hasMask,mask?1:0);gl.uniform1f(u.hasHand,hand?1:0);gl.uniform1f(u.opacity,opacity);gl.drawArrays(gl.TRIANGLES,0,6);
  }
  geometry(scene){return stageGeometry(scene);}
  paintCards(cards,metadata,anchors){
    const signature=JSON.stringify([cards,metadata?.positioner,anchors]);if(signature===this.lastCards)return;
    this.lastCards=signature;this.cardRevision++;const ctx=this.cardCanvas.getContext('2d');ctx.clearRect(0,0,1080,1920);
    const positions=metadata?.positioner||{};const w=metadata?.kort_bredd||79,h=metadata?.kort_hojd||106;
    for(const target of [...Object.keys(positions)]){
      const point=positions[target];const group=cards.filter(c=>(c.target==='hole'?'dealer':c.target)===target);
      group.forEach((card,i)=>{const x=point.cx-w/2-(group.length-1-i)*w*.26,y=point.cy-h/2;
        ctx.save();ctx.shadowColor='#0009';ctx.shadowBlur=8;ctx.fillStyle=card.faceDown?'#1c2b46':'#fffaf0';ctx.strokeStyle='#d8c8a1';ctx.lineWidth=2;
        ctx.beginPath();ctx.roundRect(x,y,w,h,5);ctx.fill();ctx.shadowBlur=0;ctx.stroke();
        if(card.faceDown){ctx.strokeStyle='#b8a170';for(let k=10;k<w;k+=10){ctx.beginPath();ctx.moveTo(x+k,y+7);ctx.lineTo(x+k,y+h-7);ctx.stroke();}}
        else {const red=['H','D','♥','♦','hearts','diamonds'].includes(card.s);const suit={S:'♠',H:'♥',D:'♦',C:'♣',spades:'♠',hearts:'♥',diamonds:'♦',clubs:'♣'}[card.s]||card.s||'♠';
          ctx.fillStyle=red?'#b52237':'#182332';ctx.font='bold 25px Arial';ctx.textAlign='left';ctx.fillText(String(card.r||'?'),x+7,y+27);ctx.font='30px Arial';ctx.textAlign='center';ctx.fillText(suit,x+w/2,y+72);}
        ctx.restore();});
      if(anchors){ctx.strokeStyle='#62d7ed';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.strokeRect(point.cx-w/2,point.cy-h/2,w,h);ctx.setLineDash([]);
        ctx.fillStyle='#62d7ed';ctx.font='bold 20px Arial';ctx.textAlign='center';ctx.fillText(target==='dealer'?'DEALER':'P'+target,point.cx,point.cy+h/2+27);}
    }
  }
  render(scene,actor,assets,cards,metadata){
    if(!this.ready)return; if(this.cpu){this.paintCards(cards,metadata,scene.anchors);this.cpu.render(scene,actor,assets,this.cardCanvas);return;} const gl=this.gl,{dims,s,x,y}=this.geometry(scene);this.logical=dims;
    const previewScale=Math.min(1,1280/Math.max(...dims));const width=Math.round(dims[0]*previewScale),height=Math.round(dims[1]*previewScale);
    if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
    gl.viewport(0,0,width,height);gl.clearColor(.018,.025,.04,1);gl.clear(gl.COLOR_BUFFER_BIT);
    const rect=[x,y,1080*s,1920*s],get=role=>assets.get(scene[role]);
    const sceneRect=(a,t)=>[x+t.x*1080*s,y+t.y*1920*s,t.width*1080*s,t.width*1080*s*(a.height/a.width)];
    const background=get('background');if(scene.show.background&&background?.el)this.draw(background.el,backgroundRect(scene,background,dims));
    const mask=get('matte')?.el,hand=get('handmatte')?.el;
    if(scene.key.mode!=='composite'){
      this.draw(actor,rect,{key:{...scene.key,enabled:scene.key.enabled&&scene.key.mode==='alpha'},mask:scene.key.mode==='alpha'?mask:null,debug:scene.key.mode==='alpha'?2:0});return;
    }
    const actorPass=p=>{if(scene.show.dealer)this.draw(actor,rect,{key:scene.key,mask,hand,pass:p,splitY:scene.splitY});};
    if(scene.tableFront===true)actorPass(0);
    else if(scene.layerMode==='split')actorPass(1);
    const table=get('table');if(scene.show.table&&table?.el)this.draw(table.el,tableRect(scene,table,{dims,s,x,y}));
    this.paintCards(cards,metadata,scene.anchors);if(scene.show.cards)this.draw(this.cardCanvas,rect);
    if(scene.tableFront!==true)actorPass(scene.layerMode==='split'?2:0);
    for(const [role,transform] of [['foreground','foregroundTransform'],['overlay','overlayTransform']]){
      const a=get(role);if(scene.show[role]&&a?.el)this.draw(a.el,sceneRect(a,scene[transform]));}
  }
  release(source){const r=this.textures.get(source);if(r&&this.gl)this.gl.deleteTexture(r.tex);this.textures.delete(source);}
  dispose(){if(!this.gl)return;for(const r of this.textures.values())this.gl.deleteTexture(r.tex);this.textures.clear();this.gl.deleteProgram(this.program);}
}


/* Deliberately slower compatibility path. A preview, not a performance benchmark.
 * In particular: the distributed source/export resolutions are NOT reduced. */
class CanvasFallback {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.cacheKey=null;this.maskCache=new WeakMap();
    this.raw=document.createElement('canvas');this.raw.width=360;this.raw.height=640;this.rawctx=this.raw.getContext('2d',{willReadFrequently:true});
    this.full=document.createElement('canvas');this.full.width=360;this.full.height=640;
    this.body=document.createElement('canvas');this.body.width=360;this.body.height=640;
    this.hands=document.createElement('canvas');this.hands.width=360;this.hands.height=640;
    this.alpha=document.createElement('canvas');this.alpha.width=360;this.alpha.height=640;
  }
  mask(el){if(!el)return null;let data=this.maskCache.get(el);if(data)return data;
    const c=document.createElement('canvas');c.width=360;c.height=640;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(el,0,0,360,640);data=ctx.getImageData(0,0,360,640).data;this.maskCache.set(el,data);return data;}
  prepare(actor,scene,assets){if(!actor)return false;if(actor instanceof HTMLVideoElement&&actor.readyState<2)return false;
    const key=(actor.currentSrc||actor.src||'')+'@'+(actor.currentTime||0)+'/'+JSON.stringify([scene.key,scene.matte,scene.handmatte,scene.splitY,scene.layerMode]);
    if(this.cacheKey===key)return true;this.cacheKey=key;
    this.rawctx.clearRect(0,0,360,640);this.rawctx.drawImage(actor,0,0,360,640);const raw=this.rawctx.getImageData(0,0,360,640),src=raw.data;
    const full=new ImageData(new Uint8ClampedArray(src),360,640),body=new ImageData(new Uint8ClampedArray(src),360,640),hands=new ImageData(new Uint8ClampedArray(src),360,640),alpha=new ImageData(360,640);
    const mask=this.mask(assets.get(scene.matte)?.el),hand=this.mask(assets.get(scene.handmatte)?.el),smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
    for(let i=0;i<src.length;i+=4){const r=src[i]/255,g=src[i+1]/255,b=src[i+2]/255;let a=src[i+3]/255,green=0;
      if(scene.key.enabled){green=smooth(scene.key.threshold,scene.key.threshold+scene.key.softness,(g-Math.max(r,b))/Math.max(g,.001))*smooth(.012,.065,g);a*=1-green;}
      if(mask)a*=mask[i]/255;
      const y=Math.floor(i/4/360)/640,h=hand?hand[i]/255:smooth(scene.splitY-.002,scene.splitY+.002,y);
      const despilled=255*(g+(Math.min(g,Math.max(r,b))-g)*scene.key.despill*green);
      full.data[i+1]=body.data[i+1]=hands.data[i+1]=despilled;
      full.data[i+3]=a*255;body.data[i+3]=a*(1-h)*255;hands.data[i+3]=a*h*255;
      alpha.data[i]=alpha.data[i+1]=alpha.data[i+2]=a*255;alpha.data[i+3]=255;
    }
    this.full.getContext('2d').putImageData(full,0,0);this.body.getContext('2d').putImageData(body,0,0);this.hands.getContext('2d').putImageData(hands,0,0);this.alpha.getContext('2d').putImageData(alpha,0,0);return true;
  }
  render(scene,actor,assets,cards){const {dims,s,x,y}=stageGeometry(scene),width=dims[0]/3,height=dims[1]/3;
    if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
    const ctx=this.ctx;ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#05070b';ctx.fillRect(0,0,width,height);ctx.scale(1/3,1/3);
    const get=role=>assets.get(scene[role]),rect=(a,trans)=>[x+trans.x*1080*s,y+trans.y*1920*s,trans.width*1080*s,trans.width*1080*s*a.height/a.width];
    const draw=(el,r)=>{if(el&&(!(el instanceof HTMLVideoElement)||el.readyState>=2))ctx.drawImage(el,...r);};
    const bg=get('background');if(scene.show.background&&bg?.el)draw(bg.el,backgroundRect(scene,bg,dims));
    const ready=this.prepare(actor,scene,assets),actorRect=[x,y,1080*s,1920*s];
    if(scene.key.mode!=='composite'){if(ready)draw(scene.key.mode==='alpha'?this.alpha:actor,actorRect);return;}
    if(ready&&scene.show.dealer&&scene.tableFront===true)draw(this.full,actorRect);
    else if(ready&&scene.show.dealer&&scene.layerMode==='split')draw(this.body,actorRect);
    const table=get('table');if(scene.show.table&&table?.el)draw(table.el,tableRect(scene,table,{dims,s,x,y}));
    if(scene.show.cards)draw(cards,actorRect);
    if(ready&&scene.show.dealer&&scene.tableFront!==true)draw(scene.layerMode==='split'?this.hands:this.full,actorRect);
    for(const role of ['foreground','overlay']){const a=get(role);if(a?.el&&scene.show[role])draw(a.el,rect(a,scene[role+'Transform']));}
  }
}
