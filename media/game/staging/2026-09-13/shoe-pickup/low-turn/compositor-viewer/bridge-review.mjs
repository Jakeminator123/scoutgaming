import {packedGPU} from '/packed-gpu.mjs';
const [registration,join,table]=await Promise.all(['/speech-registration.json','/camera-return-join.json','/camera-table.json'].map(async u=>{const r=await fetch(u);if(!r.ok)throw Error(u);return r.json();}));
const videos=Object.fromEntries(['return','bridge','idle'].map(k=>[k,document.querySelector(`#${k}-video`)])),status=document.querySelector('#status');
if(new URLSearchParams(location.search).get('edge')==='1'){videos.bridge.src='/speech-bridge-edge.mp4';videos.bridge.load();}
if(new URLSearchParams(location.search).get('edge')==='2'){videos.bridge.src='/speech-bridge-residual.mp4';videos.bridge.load();}
const gpu=packedGPU(document.querySelector('#scene'),videos.bridge,{outputWidth:1280});
function compose(a,b){return [[a[0][0]*b[0][0]+a[0][1]*b[1][0],a[0][0]*b[0][1]+a[0][1]*b[1][1],a[0][0]*b[0][2]+a[0][1]*b[1][2]+a[0][2]],[a[1][0]*b[0][0]+a[1][1]*b[1][0],a[1][0]*b[0][1]+a[1][1]*b[1][1],a[1][0]*b[0][2]+a[1][1]*b[1][2]+a[1][2]]];}
function parameters(m){return {scale:Math.hypot(m[0][0],m[1][0]),rotation:Math.atan2(m[1][0],m[0][0]),translation:[m[0][2],m[1][2]]};}
const returnMatrix=join['source109-return0'].returnToReferenceSimilarity,start=parameters(compose(returnMatrix,registration.endpointFits[0].similarity)),end=parameters(registration.endpointFits[1].similarity);
function transform(n){const u=Math.max(0,Math.min(1,n/96)),t=u*u*(3-2*u);return {scale:start.scale+(end.scale-start.scale)*t,rotation:start.rotation+(end.rotation-start.rotation)*t,translation:start.translation.map((v,i)=>v+(end.translation[i]-v)*t)};}
const art=[{r:'A',s:'♠'},{r:'7',s:'♥'},{r:'Q',s:'♣'},{r:'4',s:'♦'}],cards=table.cards.map((c,i)=>({id:c.cardId,quad:c.authoredFlatQuad,face:'front',card:art[i]}));
let generation=0,request=null;
function stop(){generation++;for(const v of Object.values(videos))v.pause();if(request!==null)videos[request.take].cancelVideoFrameCallback(request.id);request=null;for(const v of Object.values(videos))v.onended=null;}
async function seek(v,n){if(v.readyState<2)await new Promise((resolve,reject)=>{v.addEventListener('loadeddata',resolve,{once:true});v.addEventListener('error',()=>reject(Error('Media unavailable')),{once:true});});if(Math.abs(v.currentTime-n/24)>.0001)await new Promise(resolve=>{v.addEventListener('seeked',resolve,{once:true});v.currentTime=n/24;});}
function paint(take,n){gpu.paint(null,{video:videos[take],cards,handMaskEnabled:false,transform:take==='bridge'?transform(n):take==='return'?parameters(returnMatrix):undefined});status.value=`${take} native ${n} · 24 fps · seam draft`;}
async function show(take,n){stop();const token=generation;await seek(videos[take],n);if(token===generation)paint(take,n);}
document.querySelector('#return').onclick=()=>show('return',30);document.querySelector('#first').onclick=()=>show('bridge',0);document.querySelector('#last').onclick=()=>show('bridge',96);document.querySelector('#idle').onclick=()=>show('idle',0);
document.querySelector('#play').onclick=async()=>{stop();const token=generation;await seek(videos.bridge,0);if(token!==generation)return;paint('bridge',0);const frames=[0];let finished=false;async function finish(recovered){if(finished||token!==generation)return;finished=true;videos.bridge.pause();if(recovered){await seek(videos.bridge,96);if(token!==generation)return;paint('bridge',96);}status.dataset.frames=JSON.stringify([...new Set(frames)]);status.dataset.recoveredFinal=String(recovered);status.value+=' · ended';}videos.bridge.onended=()=>finish(true);function next(_,m){if(token!==generation||finished)return;const n=Math.min(96,Math.round(m.mediaTime*24));paint('bridge',n);frames.push(n);if(n===96){finish(false);return;}request={take:"bridge",id:videos.bridge.requestVideoFrameCallback(next)};}request={take:"bridge",id:videos.bridge.requestVideoFrameCallback(next)};await videos.bridge.play();};
await Promise.all([seek(videos.return,30),seek(videos.bridge,0),seek(videos.idle,0)]);paint('idle',0);paint('return',30);

// Decode all three actual segments; retain original idle motion and indexed alpha.
document.querySelector('#sequence').onclick=async()=>{
 stop();const token=generation,receipt=[];delete status.dataset.sequence;
 async function segment(take,last){
  const v=videos[take];await seek(v,0);if(token!==generation)return false;paint(take,0);const paintedStartMs=performance.now();
  return new Promise(async(resolve,reject)=>{
   const frames=[0],timings=[];let done=false;
   async function finish(recovered){if(done)return;done=true;v.pause();v.onended=null;
    if(token!==generation){resolve(false);return;}
    if(recovered){await seek(v,last);if(token!==generation){resolve(false);return;}paint(take,last);}
    receipt.push({take,observed:[...new Set(frames)],recoveredFinal:recovered,paintedStartMs,paintedEndMs:performance.now(),timings});resolve(true);
   }
   function next(_,m){if(token!==generation){resolve(false);return;}const n=Math.min(last,Math.round(m.mediaTime*24));paint(take,n);frames.push(n);timings.push({native:n,wallMs:performance.now(),mediaTime:m.mediaTime});if(n===last){finish(false);return;}request={take,id:v.requestVideoFrameCallback(next)};}
   v.onended=()=>finish(true);request={take,id:v.requestVideoFrameCallback(next)};try{await v.play();}catch(e){reject(e);}
  });
 }
 if(!await segment('return',30)||!await segment('bridge',96)||!await segment('idle',144))return;
 if(token!==generation)return;paint('idle',144);
 status.dataset.sequence=JSON.stringify(receipt);status.value+=' · sequence ended after original moving idle';
};
