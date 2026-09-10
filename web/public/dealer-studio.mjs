import * as T from './vendor/three/three.module.js';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';
import {controlDealer,poseDealer,poseCardAction,poseDealerGesture} from './dealer-rig.mjs';
import {seatTarget,DEAL_SECONDS,CARD_ACTION_SECONDS} from './dealer-motion.mjs';
import {controlDealerFace,prepareFacialPerformance,sampleDealerIdle} from './dealer-face.mjs';
import {bindBlackjackAssets} from './blackjack-asset-state.mjs';
const faceStudy=new URLSearchParams(location.search).get('face')==='anatomical';
const rigFolder=faceStudy?'dealers/astrid/rig/face-study/':'dealers/astrid/rig/';
let faceController=null,facePerformance=null,faceFromMedia=false,faceIdle=false,idleStart=0;const manualFace={};
const $=s=>document.querySelector(s),scene=new T.Scene();scene.background=new T.Color('#161e19');
const renderer=new T.WebGLRenderer({canvas:$('#stage'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.80;
const camera=new T.PerspectiveCamera(40,1,.03,30);scene.add(new T.HemisphereLight(0xf7ecdf,0x778074,.8));
const key=new T.DirectionalLight(0xffedda,2);key.position.set(-2,4,3);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.normalBias=.004;Object.assign(key.shadow.camera,{left:-2,right:2,top:3,bottom:-2,near:.1,far:12});scene.add(key);
const fill=new T.DirectionalLight(0xc8d9ed,.5);fill.position.set(3,2,2);scene.add(fill);
const rim=new T.DirectionalLight(0xffe0a4,.8);rim.position.set(.3,3,-2);scene.add(rim);
if(faceStudy){const portraitFill=new T.DirectionalLight(0xfff6ed,1.1);portraitFill.layers.set(1);portraitFill.position.set(.1,1.7,3);portraitFill.target.position.set(0,1.6,0);scene.add(portraitFill,portraitFill.target);camera.layers.enable(1);}
const mat=(color,roughness=.6,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
function mesh(g,m,p=[0,0,0]){const o=new T.Mesh(g,m);o.position.set(...p);o.castShadow=true;o.receiveShadow=true;scene.add(o);return o;}
let outlet=[.43,.935,.11],tableAssets;
const cards=[];let moving=null,rig=null,profile=null,skeleton=null,currentSeat=3,progress=0,playing=false,queue=[],last=performance.now(),view='player',action='deal',lastPoseKey='';
const targets=[];
for(let i=0;i<7;i++){
 const b=document.createElement('button');b.textContent=`Plats ${i+1}`;b.disabled=true;b.onclick=()=>start([i]);$('.seats').append(b);
}
function card(){
 const c=document.createElement('canvas');c.width=252;c.height=352;const x=c.getContext('2d');x.fillStyle='#faf7ed';x.fillRect(0,0,c.width,c.height);x.fillStyle='#992e30';x.font='bold 46px Georgia';x.fillText('A',13,48);x.font='42px Georgia';x.fillText('♥',12,90);x.font='106px Georgia';x.textAlign='center';x.fillText('♥',126,217);
 const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const paper=mat('#ece7d9',.8),front=new T.MeshStandardMaterial({map:tex,roughness:.8}),back=mat('#21362c',.65);
 const o=mesh(new T.BoxGeometry(.063,.0007,.088),[paper,paper,front,back,paper,paper],outlet);o.userData.texture=tex;return o;
}
function clearCards(){for(const c of cards){scene.remove(c);c.geometry.dispose();for(const m of c.material)m.dispose();c.userData.texture.dispose();}cards.length=0;moving=null;}
function begin(seat){currentSeat=seat;progress=0;moving=card();cards.push(moving);for(const [i,b] of [...$('.seats').children].entries())b.setAttribute('aria-pressed',String(i===seat));}
function start(seats){action='deal';clearCards();queue=[...seats];begin(queue.shift());playing=true;$('#pause').textContent='Pausa';}
for(const b of document.querySelectorAll('[data-action]'))b.onclick=()=>{clearCards();queue=[];begin(currentSeat);action=b.dataset.action;playing=true;};
$('#play').onclick=()=>start([0,1,2,3,4,5,6]);$('#pause').onclick=()=>{if(!playing&&(!moving||progress>=1)){clearCards();queue=[];begin(currentSeat);}playing=!playing;$('#pause').textContent=playing?'Pausa':'Fortsätt';};
$('#reset').onclick=()=>{playing=false;queue=[];clearCards();progress=0;lastPoseKey='';$('#pause').textContent='Fortsätt';$('#timeline').value=0;$('#frame').textContent='0%';rig?.reset();};
$('#timeline').oninput=()=>{playing=false;if(!moving)begin(currentSeat);progress=Number($('#timeline').value);$('#pause').textContent='Fortsätt';};
$('#timeline').onchange=$('#timeline').oninput;
$('#bones').onclick=()=>{if(skeleton){skeleton.visible=!skeleton.visible;$('#bones').setAttribute('aria-pressed',String(skeleton.visible));}};
$('#clean').onclick=()=>{const clean=document.body.classList.toggle('clean');$('#clean').setAttribute('aria-pressed',String(clean));$('#clean').textContent=clean?'Visa panel':'Ren vy';};
let needsRender=true;
const invalidate=()=>{needsRender=true;};
for(const event of ['input','change','click','play','pause','seeked','ended','visibilitychange','webglcontextrestored'])document.addEventListener(event,invalidate,true);
let yaw=0,pitch=0,drag=null;
$('#stage').onpointerdown=e=>{$('#stage').setPointerCapture(e.pointerId);drag=[e.clientX,e.clientY];};$('#stage').onpointermove=e=>{if(!drag)return;needsRender=true;yaw+=(e.clientX-drag[0])*.006;pitch=T.MathUtils.clamp(pitch+(e.clientY-drag[1])*.004,-.3,.6);drag=[e.clientX,e.clientY];};$('#stage').onpointerup=$('#stage').onpointercancel=()=>drag=null;
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{view=b.dataset.view;document.body.classList.toggle('face-view',view==='face');yaw=pitch=0;for(const c of document.querySelectorAll('[data-view]'))c.setAttribute('aria-pressed',String(c===b));};
function setCamera(){if(view==='face'&&rig){const head=rig.bone('head').getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.065,.02));const distance=innerWidth<900?.95:.75;camera.position.set(head.x+Math.sin(yaw)*distance,head.y+.025+pitch,head.z+Math.cos(yaw)*distance);camera.lookAt(head);return;}const narrow=innerWidth<900;const cfg=view==='body'?{look:[0,.95,0],d:narrow?4.8:3.8,y:1.55}:view==='hands'?{look:[moving?.visible?moving.position.x:0,1.0,moving?.visible?moving.position.z:.2],d:1.1,y:1.45}:{look:[0,1.02,.15],d:narrow?3.8:2.65,y:1.65};camera.position.set((view==='hands'?cfg.look[0]:0)+Math.sin(yaw)*cfg.d,cfg.y+pitch,Math.cos(yaw)*cfg.d);camera.lookAt(...cfg.look);}
try{
 const loader=new GLTFLoader();
 const [table,room]=await Promise.all([loader.loadAsync('assets/blackjack-3d/blackjack-table.glb'),loader.loadAsync('assets/blackjack-3d/blackjack-room.glb')]);
 for(const asset of [table.scene,room.scene]){scene.add(asset);asset.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});}
 tableAssets=bindBlackjackAssets(table.scene);scene.updateMatrixWorld(true);outlet=tableAssets.nodes.Shoe_Outlet.getWorldPosition(new T.Vector3()).toArray();
 profile=await fetch(rigFolder+'profile.json').then(r=>{if(!r.ok)throw new Error('Modellbearbetning pågår. Ladda om när exporten är klar.');return r.json();});
 const gltf=await new GLTFLoader().loadAsync(rigFolder+'astrid-rigged.glb');scene.add(gltf.scene);rig=controlDealer(gltf.scene,profile);skeleton=new T.SkeletonHelper(gltf.scene);skeleton.visible=false;scene.add(skeleton);
 if(faceStudy){
  gltf.scene.traverse(o=>o.layers.enable(1));
  faceController=controlDealerFace(gltf.scene);facePerformance=prepareFacialPerformance(await fetch(rigFolder+'goodluck-face.json').then(r=>r.json()));document.body.classList.add('face-study');$('#face-view').hidden=$('#face-controls').hidden=false;
  const stopIdle=()=>{faceIdle=false;$('#face-idle').setAttribute('aria-pressed','false');$('#face-idle').textContent='Starta viloblick';};
  const clearManual=()=>{for(const key of Object.keys(manualFace))manualFace[key]=0;for(const id of ['face-jaw','face-close','face-blink','face-smile'])$('#'+id).value=0;};
  for(const id of ['face-yaw','face-pitch'])$('#'+id).oninput=$('#'+id).onchange=stopIdle;
  for(const [id,names] of [['face-jaw',['jawOpen']],['face-close',['mouthClose']],['face-blink',['eyeBlinkLeft','eyeBlinkRight']],['face-smile',['mouthSmile']]])$('#'+id).oninput=()=>{stopIdle();faceFromMedia=false;$('#face-source').pause();for(const name of names)manualFace[name]=Number($('#'+id).value);};
  for(const id of ['face-jaw','face-close','face-blink','face-smile'])$('#'+id).onchange=$('#'+id).oninput;
  $('#face-idle').onclick=()=>{faceIdle=!faceIdle;idleStart=performance.now();faceFromMedia=false;$('#face-source').pause();$('#face-idle').setAttribute('aria-pressed',String(faceIdle));$('#face-idle').textContent=faceIdle?'Pausa viloblick':'Starta viloblick';};
  $('#face-source').onplay=()=>{clearManual();faceFromMedia=true;};$('#face-source').onseeked=()=>{faceFromMedia=true;};$('#face-source').onended=()=>{faceFromMedia=false;clearManual();faceController.reset();};
  $('#face-reset').onclick=()=>{faceFromMedia=false;faceIdle=false;$('#face-idle').setAttribute('aria-pressed','false');$('#face-idle').textContent='Starta viloblick';$('#face-source').pause();for(const key of Object.keys(manualFace))manualFace[key]=0;for(const id of ['face-jaw','face-close','face-blink','face-smile','face-yaw','face-pitch'])$('#'+id).value=0;faceController.reset();};
 }
 $('#loading').textContent='Modellen är laddad';$('#asset-info').textContent=`${profile.vertices.toLocaleString('sv-SE')} vertexpunkter · ${rig.bones.size} leder · material och texturer inbäddade.`;
 $('#play').disabled=$('#pause').disabled=false;for(const b of $('.seats').children)b.disabled=false;
 window.dealerStudio={rig,profile,scene,camera,get progress(){return progress;},get seat(){return currentSeat;}};
}catch(e){$('#loading').textContent=e.message;console.error(e);}
function pose(){
 if(!rig)return;
 const poseKey=`${action}:${currentSeat}:${progress}:${moving?.uuid??''}`;if(poseKey===lastPoseKey)return;lastPoseKey=poseKey;
 const target=action==='own'?[0,.91055,.23]:seatTarget(currentSeat);
 const result=['reveal','collect'].includes(action)?poseCardAction(rig,progress,{kind:action,source:action==='reveal'?[0,.91055,.23]:target,target:[-.91,.920,.25]}):['greeting','accept-bets'].includes(action)?poseDealerGesture(rig,progress,{kind:action}):poseDealer(rig,progress,target,outlet);
 const {sample:s,errors,fingerError}=result,err=errors[s.active];
 if(moving){if(s.card){moving.position.set(...s.card);moving.rotation.set(s.cardPitch??0,s.cardYaw??0,0);moving.visible=s.visible??s.picked;}else moving.visible=false;}
 const phases={pickup:'HÄMTA KORT',handoff:'LÄMNA ÖVER KORT',carry:'FÖR KORTET',release:'SLÄPP',return:'TOM HAND TILLBAKA'};
 $('#phase').textContent=`PLATS ${currentSeat+1} · ${phases[s.phase]??s.phase}`;$('#contact').textContent=err<.005?`Riggens kontaktpunkt: ${Math.round(fingerError*1000)} mm`:`Räckvidd behöver justeras: ${Math.round(err*1000)} mm`;
 $('#contact').dataset.error=String(err);$('#timeline').value=progress;$('#frame').textContent=`${Math.round(progress*100)}%`;
}
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;if(!playing&&!faceIdle&&!(faceFromMedia&&!$('#face-source').paused)&&!needsRender)return;needsRender=false;if(playing&&rig){progress=Math.min(1,progress+dt/(CARD_ACTION_SECONDS[action]??DEAL_SECONDS)*Number($('#speed').value));if(progress>=1){pose();if(queue.length)begin(queue.shift());else{playing=false;$('#pause').textContent='Spela igen';}}}pose();if(faceController){if(faceFromMedia)faceController.sample(facePerformance,$('#face-source').currentTime);else if(faceIdle){const idle=sampleDealerIdle((now-idleStart)/1000);faceController.apply({...manualFace,...idle.weights});}else faceController.apply(manualFace);const idle=faceIdle&&!faceFromMedia?sampleDealerIdle((now-idleStart)/1000):{yaw:0,pitch:0};faceController.gaze(Number($('#face-yaw').value)+idle.yaw,Number($('#face-pitch').value)+idle.pitch);}setCamera();renderer.render(scene,camera);}
function resize(){needsRender=true;renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();requestAnimationFrame(frame);
