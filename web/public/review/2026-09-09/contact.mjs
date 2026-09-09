import * as T from '../../vendor/three/three.module.js';
import {makeShoe} from '../../shoe-model.mjs';
const video=document.querySelector('#take'),canvas=document.querySelector('#card'),scrub=document.querySelector('#scrub'),status=document.querySelector('#time');
const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);
const scene=new T.Scene(),camera=new T.OrthographicCamera(-.5,.5,.5,-.5,.01,10);camera.position.z=2;
scene.add(new T.HemisphereLight(0xffffff,0x5b5144,2));const light=new T.DirectionalLight(0xffffff,3);light.position.set(-1,2,3);scene.add(light);
const art=document.createElement('canvas');art.width=280;art.height=392;const ctx=art.getContext('2d');ctx.fillStyle='#faf6e9';ctx.fillRect(0,0,280,392);ctx.fillStyle='#a22121';ctx.font='bold 46px Georgia';ctx.fillText('A',18,53);ctx.font='40px Georgia';ctx.fillText('♦',18,99);ctx.font='110px Georgia';ctx.fillText('♦',100,240);const face=new T.CanvasTexture(art);face.colorSpace=T.SRGBColorSpace;
const back=new T.TextureLoader().load('/assets/cardback.png',()=>paint(video.currentTime));back.colorSpace=T.SRGBColorSpace;
const edge=new T.MeshStandardMaterial({color:0xe6dfce,roughness:.85});
const card=new T.Mesh(new T.BoxGeometry(.068,.093,.0012),[edge,edge,edge,edge,new T.MeshStandardMaterial({map:face,roughness:.7}),new T.MeshStandardMaterial({map:back,roughness:.7})]);scene.add(card);
const shoe=makeShoe(270,{remaining:415,total:416,dealt:1,cutAfter:312},()=>paint(video.currentTime),'/');shoe.root.scale.setScalar(.001);shoe.root.rotation.x=1.04;scene.add(shoe.root);shoe.root.updateMatrixWorld(true);
const outlet=shoe.outlet.getWorldPosition(new T.Vector3());shoe.root.position.set(.389-outlet.x,-.408-outlet.y,-.05-outlet.z);
// Index/thumb midpoint measurements from Vision, with rejected detections omitted.
const points=[[2.5,.889,.908],[2.75,.898,.878],[3,.904,.847],[3.5,.821,.720],[3.75,.699,.731],[4,.591,.809],[4.25,.533,.901],[4.5,.523,.944],[4.75,.521,.958]];
function position(t){if(t<=2.5)return points[0].slice(1);if(t>=4.75)return points.at(-1).slice(1);const i=points.findIndex(p=>p[0]>=t),a=points[i-1],b=points[i],f=(t-a[0])/(b[0]-a[0]);return [a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f];}
let last=null,audio,muted=false;
function sound(kind){if(muted||document.hidden||!audio||audio.state!=='running')return;const duration=kind==='pickup'?.09:.07,buffer=audio.createBuffer(1,audio.sampleRate*duration,audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2);const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();filter.type='lowpass';filter.frequency.value=kind==='pickup'?1700:650;gain.gain.value=.11;source.buffer=buffer;source.connect(filter).connect(gain).connect(audio.destination);source.start();}
function paint(t){let [x,y]=position(t),phase=t<2.5?'Reach':t<4.75?'Card follows fingertips':t<5.1?'Release':'Landed';if(t<1.2)phase='Rest';const release=Math.max(0,Math.min(1,(t-4.75)/.35));x+=(.49-x)*release;y+=(.96-y)*release;
// Grip is on the right edge; keep most of the card clear of the hand.
card.position.set(x-.5-.03,.5-y+.018,.07);card.rotation.set(.25,Math.PI*(1-Math.max(0,Math.min(1,(t-3.5)/.9))),-.2*(1-release));card.visible=t>=2.5;
renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);renderer.render(scene,camera);scrub.value=t;status.textContent=`${t.toFixed(2)} s · ${phase}`;
if(last!==null&&!video.paused&&!video.seeking&&t-last<.2&&t>=last){for(const [at,kind] of [[2.5,'pickup'],[5.1,'land']])if(last<at&&t>=at)sound(kind);}last=t;
}
function frame(_,metadata){paint(metadata.mediaTime);video.requestVideoFrameCallback(frame);}video.requestVideoFrameCallback(frame);
video.addEventListener('loadeddata',()=>paint(video.currentTime));video.addEventListener('seeked',()=>{last=null;paint(video.currentTime)});video.addEventListener('ended',()=>document.querySelector('#play').textContent='Replay dealing movement');
document.querySelector('#play').onclick=async()=>{if(!video.paused){video.pause();document.querySelector('#play').textContent='Resume';return;}audio??=new AudioContext();await audio.resume();if(video.ended)video.currentTime=0;await video.play();document.querySelector('#play').textContent='Pause';};
document.querySelector('#sound').onclick=e=>{muted=!muted;e.target.textContent=muted?'Sound off':'Sound on'};
scrub.oninput=()=>{video.pause();last=null;video.currentTime=+scrub.value;document.querySelector('#play').textContent='Resume';};
document.addEventListener('visibilitychange',()=>{if(document.hidden){video.pause();last=null;document.querySelector('#play').textContent='Resume';}});new ResizeObserver(()=>paint(video.currentTime)).observe(canvas);
