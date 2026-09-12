import * as T from 'three';
import {GLTFLoader} from './vendor/GLTFLoader.js';
const stage=document.querySelector('#stage'),canvas=document.querySelector('#model'),status=document.querySelector('#status');
const renderer=new T.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.AgXToneMapping;renderer.toneMappingExposure=1;
const scene=new T.Scene();scene.background=new T.Color('#303133');const camera=new T.OrthographicCamera();let centre,height,front,yaw=0,turn=false,drag=false,last=0;
const hemi=new T.HemisphereLight(0xffffff,0x7f7872,.65);scene.add(hemi);scene.add(new T.AmbientLight(0xfff8f1,.45));
function light(color,intensity,pos){const l=new T.DirectionalLight(color,intensity);l.position.set(...pos);scene.add(l);return l;}
light(0xfff4e8,2,[2,1,.6]);light(0xe5ecff,1.2,[2,.5,-1.3]);light(0xffffff,.6,[-2,3,-1]);
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);if(!height)return;const span=height*1.12,aspect=w/h;camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;if(aspect<.88){camera.left=-height*.51;camera.right=height*.51;camera.top=height*.51/aspect;camera.bottom=-camera.top;}camera.near=.001;camera.far=100;camera.updateProjectionMatrix();}
function position(){if(!centre)return;const direction=front.clone().applyAxisAngle(new T.Vector3(0,1,0),yaw);camera.position.copy(centre).addScaledVector(direction,height*3);camera.lookAt(centre);}
let model, repaired=false, loading=false;
async function loadModel(repair){
if(loading)return;loading=true;status.hidden=false;status.textContent='Loading model…';
try{
const file=repair?'repaired.glb':'model.glb';
const expected=repair?'09fd91c9f95f528583bd28bba0ace0b2f31e77ff202680440bcaac40fa4b9b7c':'1757bd0469cc338cfa7f6c4e3897d64d72eeed79393c9dd63591a94d61184ba1';
const response=await fetch('./'+file);if(!response.ok)throw Error('Model download failed');const bytes=await response.arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');if(hash!==expected)throw Error('Unexpected model revision');
const gltf=await new GLTFLoader().parseAsync(bytes,location.href);gltf.scene.updateMatrixWorld(true);
let mesh;gltf.scene.traverse(o=>{if(o.isMesh&&!mesh)mesh=o;});
if(!model){const box=new T.Box3().setFromObject(gltf.scene);centre=box.getCenter(new T.Vector3());height=box.max.y-box.min.y;front=new T.Vector3(1,0,0).transformDirection(mesh.matrixWorld);front.y=0;front.normalize();resize();position();}
if(model){scene.remove(model);model.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const value of Object.values(m))if(value?.isTexture)value.dispose();m.dispose();}}});}
model=gltf.scene;scene.add(model);repaired=repair;
document.querySelector('#repair').setAttribute('aria-pressed',String(repair));
document.querySelector('#revision').textContent=repair?'Cheek surface repaired · original materials':'New Higgsfield source · original materials';
document.querySelector('#blend-download').href=repair?'repaired.blend':'original.blend';document.querySelector('#glb-download').href=file;
canvas.dataset.sourceSha256=hash;canvas.dataset.meshVertices=String(mesh.geometry.attributes.position.count);canvas.dataset.revision=repair?'cheek-repair':'original';status.hidden=true;
}catch(error){status.textContent=error.message;console.error(error);}finally{loading=false;}
}
document.querySelector('#repair').onclick=()=>loadModel(!repaired);
await loadModel(false);
document.querySelector('#front').onclick=()=>{yaw=0;turn=false;document.querySelector('#turn').setAttribute('aria-pressed','false');position();};document.querySelector('#turn').onclick=e=>{turn=!turn;e.currentTarget.setAttribute('aria-pressed',String(turn));};canvas.onpointerdown=e=>{drag=true;last=e.clientX;canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(drag){yaw+=(e.clientX-last)*.008;last=e.clientX;position();}};canvas.onpointerup=()=>drag=false;new ResizeObserver(resize).observe(stage);let previous=0;renderer.setAnimationLoop(t=>{if(turn&&!drag){yaw+=(t-previous)*.0002;position();}previous=t;renderer.render(scene,camera);});
