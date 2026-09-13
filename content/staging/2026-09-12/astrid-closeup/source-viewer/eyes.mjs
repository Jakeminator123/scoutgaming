import * as T from 'three';
import {GLTFLoader} from './vendor/GLTFLoader.js';
const canvas=document.querySelector('#model'),stage=document.querySelector('#stage'),status=document.querySelector('#status');
const controls=Object.fromEntries(['blink','yaw','pitch'].map(name=>[name,document.getElementById(name)]));
const renderer=new T.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.AgXToneMapping;
const scene=new T.Scene();scene.background=new T.Color('#303133');const camera=new T.OrthographicCamera();
scene.add(new T.HemisphereLight(0xffffff,0x7f7872,.65),new T.AmbientLight(0xfff8f1,.45));
for(const [color,strength,position] of [[0xfff4e8,2,[2,1,.6]],[0xe5ecff,1.2,[2,.5,-1.3]],[0xffffff,.6,[-2,3,-1]]]){const light=new T.DirectionalLight(color,strength);light.position.set(...position);scene.add(light);}
let centre,height,front,orbit=0,playing=false,start=0,drag=false,lastX=0;const pivots=[],lids=[];
function resize(){const width=stage.clientWidth,h=stage.clientHeight;renderer.setSize(width,h,false);if(!height)return;const aspect=width/h,span=height*1.12;camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;if(aspect<.88){camera.left=-height*.51;camera.right=height*.51;camera.top=height*.51/aspect;camera.bottom=-camera.top;}camera.near=.001;camera.far=100;camera.updateProjectionMatrix();}
function position(){if(centre){camera.position.copy(centre).addScaledVector(front.clone().applyAxisAngle(new T.Vector3(0,1,0),orbit),height*3);camera.lookAt(centre);}}
function pose(blink,yaw,pitch){for(const lid of lids)lid.morphTargetInfluences[lid.morphTargetDictionary.Blink]=blink;for(const {object,rest} of pivots)object.quaternion.copy(rest).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,-1),T.MathUtils.degToRad(yaw))).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),T.MathUtils.degToRad(pitch)));canvas.dataset.blink=blink.toFixed(3);canvas.dataset.gazeYaw=yaw.toFixed(2);canvas.dataset.gazePitch=pitch.toFixed(2);}
function manual(){playing=false;document.querySelector('#play').setAttribute('aria-pressed','false');pose(+controls.blink.value,+controls.yaw.value,+controls.pitch.value);}
for(const control of Object.values(controls))control.addEventListener('input',manual);
document.querySelector('#front').onclick=()=>{orbit=0;for(const control of Object.values(controls))control.value=0;manual();position();};
document.querySelector('#play').onclick=e=>{playing=!playing;start=performance.now();e.currentTarget.setAttribute('aria-pressed',String(playing));if(!playing)manual();};
canvas.onpointerdown=e=>{drag=true;lastX=e.clientX;canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(drag){orbit+=(e.clientX-lastX)*.008;lastX=e.clientX;position();}};canvas.onpointerup=canvas.onpointercancel=()=>drag=false;
try{const config=await(await fetch('./eye-config.json')).json();const response=await fetch('./eye-rig.glb');if(!response.ok)throw Error('Model download failed');const bytes=await response.arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');if(hash!==config.sha256)throw Error('Unexpected eye model revision');
const gltf=await new GLTFLoader().parseAsync(bytes,location.href);scene.add(gltf.scene);gltf.scene.updateMatrixWorld(true);const face=gltf.scene.getObjectByName('Astrid_Face');if(!face)throw Error('Face mesh missing');const bounds=new T.Box3().setFromObject(gltf.scene);centre=bounds.getCenter(new T.Vector3());height=bounds.max.y-bounds.min.y;front=new T.Vector3(1,0,0).transformDirection(face.matrixWorld);front.y=0;front.normalize();
gltf.scene.traverse(object=>{if(object.name.startsWith('EyePivot'))pivots.push({object,rest:object.quaternion.clone()});if(object.isMesh&&object.morphTargetDictionary?.Blink!==undefined)lids.push(object);});if(pivots.length!==2||lids.length!==4)throw Error('Incomplete eye controls');resize();position();pose(0,0,0);canvas.dataset.sourceSha256=hash;canvas.dataset.eyePivots=String(pivots.length);canvas.dataset.blinkMeshes=String(lids.length);status.hidden=true;
}catch(error){status.textContent=error.message;console.error(error);}
new ResizeObserver(resize).observe(stage);
function ease(t){t=T.MathUtils.clamp(t,0,1);return t*t*(3-2*t);}
renderer.setAnimationLoop(time=>{if(playing){const t=((time-start)/1000)%6;let blink=0;if(t>=1.45&&t<1.54)blink=ease((t-1.45)/.09);else if(t>=1.54&&t<1.58)blink=1;else if(t>=1.58&&t<1.75)blink=1-ease((t-1.58)/.17);const yaw=t<1?0:t<1.09?-7*ease((t-1)/.09):t<3?-7:t<3.1?-7+14*ease((t-3)/.1):t<4.8?7:t<4.9?7*(1-ease((t-4.8)/.1)):0;pose(blink,yaw,0);}renderer.render(scene,camera);});
