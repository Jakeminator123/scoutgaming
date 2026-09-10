import * as T from './vendor/three/three.module.js';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';
import {controlDealer,poseDealer,poseCardAction} from './dealer-rig.mjs';
import {DEAL_SECONDS,CARD_ACTION_SECONDS} from './dealer-motion.mjs';
import {bindBlackjackAssets} from './blackjack-asset-state.mjs';
import {cardFaceArt} from './card-art.mjs';

// Opt-in contact review inside the real game. This renderer consumes the card
// DOM built from server snapshots; it has no shuffle, wallet or command API.
export async function createRiggedTableScene(canvas) {
  const renderer=new T.WebGLRenderer({canvas,alpha:false,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene();scene.background=new T.Color('#090e0b');
  const camera=new T.PerspectiveCamera(38,innerWidth/innerHeight,.03,30);
  scene.add(new T.HemisphereLight(0xf7ecdf,0x586858,.9));
  const key=new T.DirectionalLight(0xffefdb,2.1);key.position.set(-2,4,3);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);key.shadow.normalBias=.002;
  Object.assign(key.shadow.camera,{left:-2,right:2,top:3,bottom:-2,near:.1,far:12});scene.add(key);
  const fill=new T.DirectionalLight(0xc8d9ed,.6);fill.position.set(3,2,2);scene.add(fill);
  const rim=new T.DirectionalLight(0xffe0a4,.9);rim.position.set(.3,3,-2);scene.add(rim);
  const loader=new GLTFLoader();
  const [table,room,dealer,profile,tableProfile]=await Promise.all([
    loader.loadAsync('assets/blackjack-3d/blackjack-table.glb'),loader.loadAsync('assets/blackjack-3d/blackjack-room.glb'),
    loader.loadAsync('dealers/astrid/rig/astrid-rigged.glb'),
    fetch('dealers/astrid/rig/profile.json').then(r=>{if(!r.ok)throw new Error('Dealer rig unavailable');return r.json();}),
    fetch('assets/blackjack-3d/profile.json').then(r=>{if(!r.ok)throw new Error('Table calibration unavailable');return r.json();}),
  ]);
  for(const asset of [table.scene,room.scene,dealer.scene]){scene.add(asset);asset.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});}
  // Acrylic cannot cast an opaque black shadow across the shoe opening.
  table.scene.traverse(o=>{
    if(o.isMesh&&o.material?.transmission>0)o.castShadow=false;
    if(o.name.startsWith('Betting_ink'))o.visible=false; // Live hit targets supply the same seven rings.
  });
  const assets=bindBlackjackAssets(table.scene),rig=controlDealer(dealer.scene,profile);
  scene.updateMatrixWorld(true);
  // Source chips remain independent in Blender/GLB. Batch equal tray bodies
  // for rendering while retaining a separate editable transform per instance.
  const trayGroups=new Map();
  table.scene.traverse(o=>{
    if(o.isMesh&&/^Tray_Chip_\d+_\d+$/.test(o.name)){
      const group=trayGroups.get(o.material)??[];group.push(o);trayGroups.set(o.material,group);
    }
  });
  for(const [material,meshes] of trayGroups){
    const geometry=meshes[0].geometry;
    const batch=new T.InstancedMesh(geometry,material,meshes.length);
    batch.name='Tray_Instances_'+material.name;batch.castShadow=true;batch.receiveShadow=true;
    batch.userData.sourceNames=meshes.map(o=>o.name);
    meshes.forEach((mesh,i)=>{batch.setMatrixAt(i,mesh.matrixWorld);mesh.visible=false;});
    batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere();scene.add(batch);
  }
  const outlet=assets.nodes.Shoe_Outlet.getWorldPosition(new T.Vector3()).toArray();
  const records=new Map();let active=null,last=performance.now(),visibleSeats=[0,1,2,3,4,5,6],disposed=false;
  const backTexture=await new T.TextureLoader().loadAsync('assets/cardback.png');backTexture.colorSpace=T.SRGBColorSpace;
  function screen(point){const p=new T.Vector3(...point).project(camera);return{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};}
  function targetFor(el){
    const box=el.closest('.seat')?.dataset.box,sub=el.closest('.subhand'),ci=Number(el.style.getPropertyValue('--ci'))||0;
    let pos=box===undefined?[...tableProfile.dealerCards]:[...tableProfile.seatCards[6-Number(box)]];
    if(sub){const siblings=sub.parentElement.querySelectorAll(':scope > .subhand').length;pos[0]+=(Number(sub.dataset.h)-(siblings-1)/2)*.105;}
    pos[0]+=(ci-.5)*.023;pos[2]-=ci*.008;pos[1]=tableProfile.feltHeight+.00055+ci*.00045;
    return pos;
  }
  function createCard(el){
    const faceDown=el.classList.contains('back');
    const art=faceDown?null:cardFaceArt({r:el.dataset.rank,s:el.dataset.suit});
    const tex=faceDown?backTexture:new T.TextureLoader().load(art.url);tex.colorSpace=T.SRGBColorSpace;
    const edge=new T.MeshStandardMaterial({color:'#ebe5d9',roughness:.85});
    const front=new T.MeshStandardMaterial({map:tex,roughness:.78});
    const back=new T.MeshStandardMaterial({map:backTexture,roughness:.78});
    const mesh=new T.Mesh(new T.BoxGeometry(.063,.0004,.088),[edge,edge,front,back,edge,edge]);
    mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
    const item={el,mesh,tex,faceDown};records.set(el,item);return item;
  }
  function remove(item){scene.remove(item.mesh);item.mesh.geometry.dispose();new Set(item.mesh.material).forEach(m=>m.dispose());if(item.tex!==backTexture)item.tex.dispose();records.delete(item.el);}
  function syncCards(){
    const els=new Set(document.querySelectorAll('.cards .card'));
    for(const [el,item] of records)if(!els.has(el))remove(item);
    for(const el of els){
      if(!el.classList.contains('back')&&(!el.dataset.rank||!el.dataset.suit))continue;
      const item=records.get(el)??createCard(el);
      if(active?.item===item||item.collected)continue;
      const target=targetFor(el);item.mesh.position.set(...target);
      item.mesh.rotation.y=Math.atan2(target[0]*.72,Math.max(.25,target[2]));item.mesh.visible=true;
    }
  }
  const observer=new MutationObserver(syncCards);
  observer.observe(document.querySelector('#table2d'),{childList:true,subtree:true});
  function resize(){
    renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;
    const portrait=innerWidth<861&&innerHeight>innerWidth;
    const focus=portrait?visibleSeats.reduce((sum,i)=>sum+tableProfile.seatCards[6-i][0],0)/visibleSeats.length:0;
    camera.position.set(focus,portrait?1.73:1.60,portrait?2.37:2.45);camera.lookAt(focus,portrait?1.12:1.10,.20);camera.updateProjectionMatrix();
    const pos=screen(tableProfile.dealerCards),root=document.documentElement.style;
    root.setProperty('--rig-dealer-x',`${pos.x}px`);root.setProperty('--rig-dealer-y',`${pos.y}px`);
  }
  function status(text,error=0){const node=document.querySelector('#rig-review-status');if(node){node.textContent=text;node.dataset.contactError=String(error);}}
  function render(now=performance.now()){
    if(disposed)return;requestAnimationFrame(render);const dt=Math.min((now-last)/1000,.050);last=now;
    if(document.hidden)return;
    if(active){
      active.time+=dt;const progress=Math.min(1,active.time/active.seconds);
      const pose=active.kind==='deal'?poseDealer(rig,progress,active.target,outlet):poseCardAction(rig,progress,{kind:active.kind,source:active.source,target:active.target,initialYaw:active.initialYaw});
      const sample=pose.sample;
      active.item.mesh.position.set(...sample.card);active.item.mesh.visible=sample.visible??sample.picked;
      active.item.mesh.rotation.y=sample.cardYaw??0;
      active.item.mesh.rotation.x=sample.cardPitch??0;
      if(sample.picked&&!active.picked){active.picked=true;active.onCue?.('pickup');}
      if(sample.released&&!active.released){active.released=true;active.onCue?.('land');}
      const error=Number(pose.fingerError)||0;
      status(`${sample.phase} · motion review · face animation unfinished`,error);
      const audit=document.querySelector('#rig-review-status');
      if(audit){audit.dataset.action=active.kind;audit.dataset.progress=progress.toFixed(4);audit.dataset.target=JSON.stringify(active.target);audit.dataset.cardPosition=JSON.stringify(sample.card);audit.dataset.cardYaw=String(sample.cardYaw??0);audit.dataset.cardPitch=String(sample.cardPitch??0);}
      if(progress===1){const done=active;active=null;done.item.mesh.position.set(...done.target);done.item.mesh.visible=true;if(done.kind==='collect')done.item.collected=true;done.resolve();}
    }else poseDealer(rig,0,tableProfile.seatCards[3],outlet);
    renderer.render(scene,camera);
  }
  resize();syncCards();requestAnimationFrame(render);
  canvas.addEventListener('webglcontextlost',event=>{
    event.preventDefault();status('3D context lost. Card state is saved on the server.');
    if(active){const done=active;active=null;done.resolve();}
    document.documentElement.classList.remove('rigged-review');
  });
  return {rigged:true,resize,render:()=>{},
    project(x,z){return screen([x*1.1,.911,z*1.15-.10]);},
    seatScreen(index,boxes){visibleSeats=boxes;resize();const p=[...tableProfile.seatCards[6-index]];p[2]+=.145;return screen(p);},
    shoeOutlet(){return screen(outlet);},setShoe(state){assets.updateShoe(state);},
    dealCard({element,onCue}){
      if(active)throw new Error('Dealer already presenting a card');
      const item=records.get(element)??createCard(element);item.mesh.visible=false;
      return new Promise(resolve=>{active={kind:'deal',seconds:DEAL_SECONDS,item,target:targetFor(element),time:0,onCue,resolve,picked:false,released:false};console.info('[rigged-review] deal',element.closest('.seat')?.dataset.box??'dealer',element.dataset.rank??'hidden',element.dataset.suit??'',JSON.stringify(active.target));});
    },
    revealCard({element,card,onCue}){
      if(active)throw new Error('Dealer already presenting a card');
      const item=records.get(element)??createCard(element),pos=targetFor(element);
      const tex=new T.TextureLoader().load(cardFaceArt(card).url);tex.colorSpace=T.SRGBColorSpace;
      item.mesh.material[2].dispose();item.mesh.material[2]=new T.MeshStandardMaterial({map:tex,roughness:.78});
      if(item.tex!==backTexture)item.tex.dispose();item.tex=tex;item.mesh.rotation.x=Math.PI;
      return new Promise(resolve=>{active={kind:'reveal',seconds:CARD_ACTION_SECONDS.reveal,item,source:pos,target:pos,initialYaw:item.mesh.rotation.y,time:0,onCue,resolve,picked:false,released:false};});
    },
    async collectCards({onCue}={}){
      const target=assets.nodes.Discard_Landing.getWorldPosition(new T.Vector3());let count=0;
      for(const item of [...records.values()]){
        if(!item.el.isConnected)continue;
        if(active)throw new Error('Dealer already presenting a card');
        const source=item.mesh.position.toArray(),to=target.clone();to.y+=count++*.00045;
        await new Promise(resolve=>{active={kind:'collect',seconds:CARD_ACTION_SECONDS.collect,item,source,target:to.toArray(),initialYaw:item.mesh.rotation.y,time:0,onCue,resolve,picked:false,released:false};});
      }
    },
    registration(){return{version:1,type:'rigged-review',units:'metres',shoe:{outlet},camera:{projection:camera.projectionMatrix.toArray(),world:camera.matrixWorld.toArray()},limitations:profile.limitations};},
    dispose(){disposed=true;observer.disconnect();for(const item of records.values())remove(item);backTexture.dispose();renderer.dispose();},
  };
}
