// Presentation only: never changes the shared table, bets, shoe or video sources.
import {dealer} from './dealers.js';
export const TABLE_STYLES={prive:{name:'Privé',color:null,accent:'#dbc18a'},emerald:{name:'Emerald Club',color:'#125c43',accent:'#b7dec6'},midnight:{name:'Midnight',color:'#213e70',accent:'#b9cceb'},burgundy:{name:'Burgundy',color:'#70253c',accent:'#ecc5b2'}};
const stage=document.querySelector('#stage');
const button=document.createElement('button');button.type='button';button.className='table-style-open';button.textContent='Table & felt';button.setAttribute('aria-haspopup','dialog');document.querySelector('.settings-popover').append(button);
const dialog=document.createElement('dialog');dialog.className='table-style-dialog';dialog.setAttribute('aria-labelledby','table-style-title');
dialog.innerHTML='<header><div><small>ASTRID · YOUR TABLE</small><h2 id="table-style-title">Table & felt</h2></div><button type="button" class="style-close" aria-label="Close">×</button></header><div class="table-shape-options" role="group" aria-label="Table shape"><button type="button" data-shape="original">Original</button><button type="button" data-shape="rounded">Rounded</button><button type="button" data-shape="extended">Extended · no edges</button></div><div class="table-style-options"></div><label class="custom-felt">Custom felt<input type="color" aria-label="Custom felt" value="#125c43"></label><p class="style-status" role="status"></p><p class="style-note">Same game and hand. These appearance choices affect your screen only.</p>';
document.body.append(dialog);
const canvas=document.createElement('canvas');canvas.className='table-style-layer';canvas.setAttribute('aria-hidden','true');stage.insertBefore(canvas,document.querySelector('#tableBoxes'));
const gl=canvas.getContext('webgl',{alpha:true,antialias:false,depth:false,premultipliedAlpha:false,powerPreference:'low-power'});
// A Table Studio table (?table=<slug>) starts on the operator's felt; a player's own pick there is kept per table.
const tableSlug=/^[a-z0-9_-]{1,40}$/.test(new URLSearchParams(location.search).get('table')??'')?new URLSearchParams(location.search).get('table'):null;
const STORE=tableSlug?'astrid-table-style:'+tableSlug:'astrid-table-style';
let selected={preset:'prive',color:null,shape:'original'},roundedImagePromise,shapeRequest=0,roundedReady=false,program,texture,frame=0,lastSource,lastTime=-1,failed=false,frameVideo=null;
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
try{if(!gl)throw Error('WebGL unavailable');program=gl.createProgram();
 gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 p; varying vec2 uv; void main(){uv=vec2((p.x+1.)*.5,(1.-p.y)*.5);gl_Position=vec4(p,0.,1.);}'));
 gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`precision mediump float;
 varying vec2 uv;uniform sampler2D source;uniform sampler2D roundedPlate;uniform float rounded;uniform float extended;uniform float coloured;uniform float still;uniform vec3 tint;
 void main(){vec4 c=texture2D(source,uv);float y=uv.y*1920.;float x=uv.x*1080.;
 // Follow the inner rail. Nothing above the table is recoloured.
 float edge=1694.-mix(420.,250.,rounded)*pow(abs((x-540.)/540.),2.25);
 float mask=smoothstep(733.,744.,y)*(1.-smoothstep(edge-7.,edge,y));
 // Select the dark, warm felt; reject skin, white cards, acrylic and black clothing.
 float hi=max(c.r,max(c.g,c.b));float lo=min(c.r,min(c.g,c.b));
 float sat=hi-lo;float warm=c.r-c.g;
 float key=smoothstep(.095,.14,hi)*(1.-smoothstep(.25,.34,hi));
 key*=1.-smoothstep(.042,.09,sat);key*=smoothstep(-.008,.012,warm);
 float a=mask*key;
 // A keyed dealer's own plate draws the shoe above this room still (Emil's composite does the same), so here the
 // still's shoe becomes plain felt: through the plate's keyed acrylic only felt shows. Masking the acrylic by colour
 // left a jagged, stepped outline on light felts (Kevin). Felt grain is kept where the still is felt; elsewhere in the
 // shoe a flat felt shade, blended over a 5x5 neighbourhood so no edge is hard.
 float shoe=still*smoothstep(632.,648.,x)*smoothstep(682.,698.,y)*(1.-smoothstep(900.,916.,y));
 float near=0.;
 for(int i=-2;i<=2;i++)for(int j=-2;j<=2;j++){vec3 n=texture2D(source,uv+vec2(float(i)*4./1080.,float(j)*4./1920.)).rgb;
   float nh=max(n.r,max(n.g,n.b)),ns=nh-min(n.r,min(n.g,n.b));
   near+=smoothstep(.095,.14,nh)*(1.-smoothstep(.25,.34,nh))*(1.-smoothstep(.042,.09,ns))*smoothstep(-.008,.012,n.r-n.g);}
 near/=25.;
 // The shoe's own cards (white) and red line stay from the still; only its grey acrylic and dark rim go.
 float keep=max(smoothstep(.30,.46,hi),smoothstep(.16,.26,sat));
 a=max(a,mask*shoe*(1.-keep));
 float fhi=mix(hi,mix(.12,hi,near),shoe*(1.-keep));
 vec3 shaded=tint*(.54+fhi*2.3);
 if(rounded>.5){
   // Extended mode samples only the clean centre felt of the same plate.
   // Its rail stays outside the frame without zooming the dealer or game UI.
   vec2 plateUv=mix(uv,vec2(.35+uv.x*.30,.48+clamp((uv.y-.39)/.61,0.,1.)*.20),extended);
   vec3 plate=texture2D(roundedPlate,plateUv).rgb;
   mask=mix(mask,smoothstep(.379,.395,uv.y),extended);
   float plateHi=max(plate.r,max(plate.g,plate.b));
   float plateKey=smoothstep(.08,.13,plateHi)*(1.-smoothstep(.30,.40,plateHi));
   plateKey*=1.-smoothstep(.07,.14,plateHi-min(plate.r,min(plate.g,plate.b)));
   plate=mix(plate,tint*(.54+plateHi*2.3),mask*plateKey*coloured);
   // Keep original filmed foreground above the rail: hands, sleeves, shoe and lettering.
   float foreground=(1.-key)*(1.-smoothstep(.60,.66,uv.y));
   float cover=smoothstep(.379,.395,uv.y)*(1.-foreground);
   gl_FragColor=vec4(plate,cover);
 }else{
   // A light felt: the printed lettering would stay the film's cream, and its half-keyed edges turned into dark,
   // broken outlines. Reprint it in dark ink, blending felt -> ink by brightness so the edges stay smooth.
   // Filmed white cards (near 1.0) and skin (saturated) are left alone; dark felts keep the filmed lettering.
   float light=step(.5,dot(tint,vec3(.2126,.7152,.0722)));
   float ink=light*mask*(1.-shoe)*smoothstep(.24,.48,hi)*(1.-smoothstep(.10,.22,sat))*(1.-smoothstep(.9,.97,hi));
   // The table's own lettering (same place on every plate and on Astrid's film: x 150-930, y 843-1000) is too soft to
   // reprint cleanly at this size: there the film's cream is wiped to plain felt and index.html draws it as vector
   // text (#feltPrint). Anything else cream on a light felt keeps the dark reprint.
   // Inside it every felt or cream pixel is covered (skin, cards and dark sleeves stay), with the felt's own grain
   // but its brightness capped, so the soft letter edges leave no outline under the vector text.
   float print=light*mask*step(150.,x)*step(x,930.)*step(843.,y)*step(y,1000.);
   float wipe=print*smoothstep(.06,.095,hi)*(1.-smoothstep(.10,.22,sat))*(1.-smoothstep(.9,.97,hi));
   float w=clamp(max(a+ink*(1.-print),wipe),0.,1.);
   vec3 felt=tint*(.54+min(hi,.19)*2.3);
   gl_FragColor=vec4(print>.5?felt:mix(shaded,tint*.28,ink/max(a+ink,.0001)),w*coloured);
 }
 }`));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Shader link failed');
 gl.useProgram(program);const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const p=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
 texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
}catch{failed=true;}
async function loadRounded(){
 if(roundedReady)return true;
 if(!roundedImagePromise)roundedImagePromise=new Promise(resolve=>{
  const image=new Image();image.onload=()=>{try{
   gl.activeTexture(gl.TEXTURE1);const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);gl.uniform1i(gl.getUniformLocation(program,'roundedPlate'),1);
   roundedReady=true;resolve(true);
  }catch{resolve(false);}finally{gl.activeTexture(gl.TEXTURE0);}};
  image.onerror=()=>{roundedImagePromise=null;resolve(false);};image.src='/media/table-styles/variant-b.png';
 });return roundedImagePromise;
}
function stop(){if(frameVideo){frameVideo.cancelVideoFrameCallback(frame);frameVideo=null;}else cancelAnimationFrame(frame);}
function paint(){
 if((!selected.color&&selected.shape==='original')||document.hidden||failed)return;
 // A keyed dealer's clips are green screen; his table is the room still behind him.
 const video=dealer.keyed?null:stage.querySelector('video.v.on');const source=video&&video.readyState>=2?video:stage.querySelector('.still');
 const time=source instanceof HTMLVideoElement?source.currentTime:0;
 gl.useProgram(program);gl.uniform1f(gl.getUniformLocation(program,'still'),source instanceof HTMLVideoElement?0:1);
 if(source!==lastSource||time!==lastTime){
  try{gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);gl.drawArrays(gl.TRIANGLES,0,6);lastSource=source;lastTime=time;}
  catch{canvas.hidden=true;failed=true;dialog.querySelector('.style-status').textContent='Table theme unavailable. Showing the original table.';return;}
 }
 if(video&&!video.paused&&video.requestVideoFrameCallback){frameVideo=video;frame=video.requestVideoFrameCallback(()=>{frameVideo=null;paint();});}
 else if(video&&!video.paused)frame=requestAnimationFrame(paint);
}
function resize(){const r=stage.getBoundingClientRect();canvas.width=Math.round(Math.min(r.width,720));canvas.height=Math.round(canvas.width*1920/1080);canvas.style.height=`${r.width*1920/1080}px`;if(gl)gl.viewport(0,0,canvas.width,canvas.height);lastSource=null;}
function apply(preset,color,save=true){
 if(!TABLE_STYLES[preset]||color!==null&&!/^#[0-9a-f]{6}$/i.test(color))return;
 if((color||selected.shape!=='original')&&failed){dialog.querySelector('.style-status').textContent='Felt colours are unavailable in this browser.';return;}
 selected={...selected,preset,color};stop();canvas.hidden=!color&&selected.shape==='original';
 if(gl){gl.useProgram(program);gl.uniform1f(gl.getUniformLocation(program,'rounded'),selected.shape!=='original'?1:0);gl.uniform1f(gl.getUniformLocation(program,'extended'),selected.shape==='extended'?1:0);gl.uniform1f(gl.getUniformLocation(program,'coloured'),color?1:0);}
 dialog.querySelectorAll('[data-shape]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.shape===selected.shape)));
 stage.dataset.tableShape=selected.shape;stage.dataset.tableStyle=preset;
 // Printed brand ink (felt-logo.js): dark on a light felt, cream otherwise.
 {const rgb=color?color.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16)/255):null;stage.dataset.feltTone=rgb&&(.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2])>.5?'light':'dark';}document.documentElement.style.setProperty('--gold',TABLE_STYLES[preset].accent);
 dialog.querySelectorAll('[data-style]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.style===preset&&color===TABLE_STYLES[preset].color)));
 if(color){const rgb=color.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16)/255);gl.useProgram(program);gl.uniform3fv(gl.getUniformLocation(program,'tint'),rgb);dialog.querySelector('input').value=color;lastSource=null;paint();}
 if(selected.shape!=='original'&&!color){lastSource=null;paint();}
 if(save){try{localStorage.setItem(STORE,JSON.stringify(selected));}catch{}}
 dialog.querySelector('.style-status').textContent=color===TABLE_STYLES[preset].color?TABLE_STYLES[preset].name:'Custom felt';
}
for(const [id,preset] of Object.entries(TABLE_STYLES)){const b=document.createElement('button');b.type='button';b.dataset.style=id;b.innerHTML='<i aria-hidden="true"></i><span></span>';b.querySelector('i').style.background=preset.color||'#302929';b.querySelector('span').textContent=preset.name;b.onclick=()=>apply(id,preset.color);dialog.querySelector('.table-style-options').append(b);}
for(const b of dialog.querySelectorAll('[data-shape]'))b.onclick=async()=>{
 const request=++shapeRequest;
 if(failed){dialog.querySelector('.style-status').textContent='Table shapes are unavailable in this browser.';return;}
 if(b.dataset.shape!=='original'){
  dialog.querySelector('.style-status').textContent='Loading table…';
  if(!await loadRounded()){dialog.querySelector('.style-status').textContent='Table failed to load. Please retry.';return;}
 }
 if(request!==shapeRequest)return;
 selected.shape=b.dataset.shape;apply(selected.preset,selected.color);
};
button.onclick=()=>dialog.showModal();dialog.querySelector('.style-close').onclick=()=>dialog.close();dialog.querySelector('input').oninput=e=>apply(selected.preset,e.target.value);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();stop();canvas.hidden=true;failed=true;});
new ResizeObserver(()=>{resize();stop();paint();}).observe(stage);resize();
const videoChanges=new MutationObserver(()=>{stop();lastSource=null;paint();});
for(const video of stage.querySelectorAll('video.v'))videoChanges.observe(video,{attributes:true,attributeFilter:['class']});
for(const video of stage.querySelectorAll('video.v'))for(const event of ['playing','seeked','loadeddata'])video.addEventListener(event,()=>{stop();lastSource=null;paint();});
stage.querySelector('.still').addEventListener('load',()=>{stop();paint();});
document.addEventListener('visibilitychange',()=>{stop();if(!document.hidden){lastSource=null;paint();}});
let stored;try{stored=JSON.parse(localStorage.getItem(STORE));}catch{}
if(!stored&&tableSlug){try{const r=await fetch('/api/studio/table?slug='+encodeURIComponent(tableSlug));if(r.ok){const t=await r.json();
  // re-read: a pick made while this loaded wins over the operator's default
  try{stored=JSON.parse(localStorage.getItem(STORE));}catch{}
  stored??={preset:TABLE_STYLES[t.felt]?t.felt:'prive',color:t.felt==='custom'?t.custom:TABLE_STYLES[t.felt]?.color??null,shape:'original'};}}catch{}}
if(['rounded','extended'].includes(stored?.shape)&&!failed&&await loadRounded())selected.shape=stored.shape;
if(stored&&TABLE_STYLES[stored.preset]&&(stored.color===null||/^#[0-9a-f]{6}$/i.test(stored.color)))apply(stored.preset,stored.color,false);else apply('prive',null,false);
