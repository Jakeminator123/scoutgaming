import * as THREE from './vendor/three/three.module.js';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';
import {uniformRegistration} from './performance-contact.mjs';
import {createDealingCard} from './dealing-card.mjs';
import {createFeltBranding,createBlenderCardStack,createFeltBettingBoxes,BET_BOX_SIZE} from './blender-table-details.mjs';
import {layoutFeltCards} from './blender-card-layout.mjs';
import {cardFaceArt} from './card-art.mjs';

// Keep the native actor unwarped. The table camera is fitted at the rear edge,
// and the shoe outlet is registered to the filmed pickup after that camera fit.
export async function createBlenderTableScene(canvas,{frame,dealer='astrid'}={}){
  const [asset,registration,cardBack]=await Promise.all([
    new GLTFLoader().loadAsync('review/astrid-table-v2/table.glb'),
    fetch('review/astrid-table-v2/registration.json').then(r=>{if(!r.ok)throw new Error('Table registration unavailable');return r.json();}),
    new THREE.TextureLoader().loadAsync('assets/cardback.png'),
  ]);
  const camera=asset.cameras.find(c=>c.name==='PlateCam');
  if(!camera?.isPerspectiveCamera)throw new Error('Blender PlateCam is missing');
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
  renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.add(asset.scene);
  // Restore each dealer's original felt palette. The Blender diffuse map is
  // baked green; keep its wool normal map and roughness without that tint.
  const feltColors={astrid:'#263336',amira:'#665139'};
  const felt=asset.scene.getObjectByName('HERO_TableFelt');
  if(felt&&feltColors[dealer]){
    felt.material=felt.material.clone();felt.material.map=null;
    felt.material.color.set(feltColors[dealer]);
  }
  canvas.dataset.tableDealer=dealer;
  canvas.dataset.feltColor=feltColors[dealer]??'source';
  scene.add(new THREE.HemisphereLight(0xfff3df,0x282c30,2.2));
  const key=new THREE.DirectionalLight(0xffedda,3);key.position.set(-2,4,2);scene.add(key);
  key.castShadow=true;key.shadow.mapSize.set(2048,2048);
  Object.assign(key.shadow.camera,{left:-2,right:2,top:2,bottom:-2,near:.1,far:10});
  key.shadow.bias=-.0001;key.shadow.normalBias=.002;
  key.shadow.camera.updateProjectionMatrix();
  const fill=new THREE.DirectionalLight(0xc7deed,1);fill.position.set(2,2,-1);scene.add(fill);
  const source={width:1920,height:1080,framingScale:frame?.framingScale??1};
  // Preserve PlateCam's horizontal field of view; the 2048x1158 reference
  // differs slightly from the native 1920x1080 video, so crop only vertically.
  const hFov=2*Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)*camera.aspect);
  camera.aspect=source.width/source.height;
  camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(hFov/2)/camera.aspect));
  camera.updateProjectionMatrix();scene.updateMatrixWorld(true);
  const bounds=registration.anchors.feltBoundsBlender;
  const surfaceHeight=bounds[2][1],radius=(bounds[0][1]-bounds[0][0])/2;
  const rear=-bounds[1][1],depth=bounds[1][1]-bounds[1][0];
  const outlet=new THREE.Vector3(...registration.anchors.outlet.worldGLTF);
  cardBack.colorSpace=THREE.SRGBColorSpace;cardBack.anisotropy=8;
  const [shoeMin,shoeMax]=registration.anchors.shoeLocalBounds;
  const cardStack=createBlenderCardStack({width:shoeMax[0]-shoeMin[0],length:shoeMax[1]-shoeMin[1],height:shoeMax[2]-shoeMin[2]},cardBack);
  const shoe=asset.scene.getObjectByName('PRP_Shoe');
  shoe.add(cardStack.root);
  // Transparent acrylic must not hide its contents or cast an opaque box shadow.
  shoe.material.depthWrite=false;
  scene.add(createFeltBranding({radius,depth,rear,surfaceHeight}));
  const bettingBoxes=createFeltBettingBoxes({radius,depth,rear,surfaceHeight});scene.add(bettingBoxes.group);
  const filmedOutlet=outlet.clone().project(camera);
  fitTableCamera(camera,new THREE.Vector3(0,surfaceHeight,rear));
  const sourceProjection=camera.projectionMatrix.clone();
  const alignedOutlet=pointOnSurface(camera,filmedOutlet,outlet.y);
  const shoeOffset=alignedOutlet.clone().sub(outlet);
  for(const name of ['PRP_Shoe','PRP_ShoeStripe'])asset.scene.getObjectByName(name)?.position.add(shoeOffset);
  outlet.copy(alignedOutlet);
  asset.scene.traverse(o=>{if(o.isMesh){o.castShadow=!o.material.transparent;o.receiveShadow=true;}});
  const base=asset.scene.getObjectByName('PRP_WalnutBase');
  const floorY=new THREE.Box3().setFromObject(base).min.y;
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.ShadowMaterial({opacity:.38}));
  floor.name='TableFloorShadow';floor.rotation.x=-Math.PI/2;floor.position.y=floorY-.001;
  floor.receiveShadow=true;scene.add(floor);
  scene.updateMatrixWorld(true);
  let fit;
  function projectPoint(point){
    const p=point.clone().project(camera);
    return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};
  }
  function render(){renderer.render(scene,camera);}
  function resize(){
    fit=uniformRegistration(source,{width:innerWidth,height:innerHeight});
    renderer.setSize(innerWidth,innerHeight,false);
    // Render below the film frame too, so the complete pedestal and its foot
    // remain visible. Actor registration still uses the native source frame.
    expandCameraToCanvas(camera,sourceProjection,fit,{width:innerWidth,height:innerHeight});
    renderer.setViewport(0,0,innerWidth,innerHeight);
    const edge=projectPoint(new THREE.Vector3(0,surfaceHeight,rear));
    const style=document.documentElement.style;
    style.setProperty('--performance-rear',`${edge.y}px`);
    style.setProperty('--performance-table-height',`${fit.y+fit.height-edge.y}px`);
    style.setProperty('--blender-seat-scale',`${Math.min(1,fit.width/1400)}`);
    document.documentElement.dataset.performanceStaged='true';
    document.documentElement.dataset.blenderTable='true';
    canvas.dataset.tableSource='table-v2.blend';canvas.dataset.camera='PlateCam-lower-review';
    canvas.dataset.sourceHash=registration.sourceSha256;
    render();
  }
  resize();
  const deal=createDealingCard({scene,camera,renderer,viewport:()=>({x:0,y:0,width:innerWidth,height:innerHeight}),surfaceHeight,unitScale:.001,cardBackTexture:cardBack,faceArt:card=>cardFaceArt(card,{jumbo:dealer==='amira'})});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();document.documentElement.classList.remove('table-3d');});
  canvas.addEventListener('webglcontextrestored',()=>{resize();document.documentElement.classList.add('table-3d');});
  return {resize,render,
    layoutCards(){layoutFeltCards((id,quad,index,hands)=>{
      const m=bettingBoxes.meshes[id];if(!m?.visible)return null;
      return quad.map(([x,y])=>{
        const point=m.localToWorld(new THREE.Vector3(x,y,.0003*(index+1)));
        // Keep outer fans in front of their own boxes, clear of the shoe.
        // Rotating the whole offset towards centre put box 6 below the shoe.
        point.x-=m.matrixWorld.elements[4]*.126;
        if(hands>1&&Math.abs(m.position.x)>radius*.6)point.x+=Math.sign(m.position.x)*.045;
        return projectPoint(point);
      });
    });},
    setBettingBoxes(boxes){bettingBoxes.update(boxes);render();},
    bettingBoxQuad(id){const m=bettingBoxes.meshes[id],w=BET_BOX_SIZE.width/2,h=BET_BOX_SIZE.height/2;
      if(!m?.visible)return null;
      return [[-w,h],[w,h],[w,-h],[-w,-h]].map(([x,y])=>projectPoint(m.localToWorld(new THREE.Vector3(x,y,0))));
    },
    project(x,z){return projectPoint(new THREE.Vector3(x*radius,surfaceHeight,rear+z*depth));},
    dealerCardQuad(index=0,count=2){
      const w=.063,h=.088,step=Math.min(.026,.13/Math.max(1,count-1));
      // Place the dealer fan ahead of Amira's resting hands, leaving its total
      // visible beside the fan rather than underneath the keyed fingers.
      const x=-.018+index*step,z=rear+.19+index*.003;
      return [[x-w/2,z-h/2],[x+w/2,z-h/2],[x+w/2,z+h/2],[x-w/2,z+h/2]].map(([x,z])=>projectPoint(new THREE.Vector3(x,surfaceHeight+.001,z)));
    },
    shoeOutlet(){return projectPoint(outlet);},
    dealCard(options){
      const quad=options.element?.dataset.feltCorners;
      const worldCorners=quad?JSON.parse(quad).map(([x,y])=>pointOnSurface(camera,new THREE.Vector2(x/innerWidth*2-1,1-y/innerHeight*2),surfaceHeight+.001)):null;
      return deal({...options,origin:outlet,worldCorners});
    },
    setShoe(state){cardStack.update(state);canvas.dataset.shoeRemaining=cardStack.root.userData.remaining??'';render();},
    registration(){return {version:1,source:registration.sourceSha256,camera:{type:'perspective',projection:camera.projectionMatrix.toArray(),world:camera.matrixWorld.toArray()},viewport:{x:0,y:0,width:innerWidth,height:innerHeight},sourceFrame:fit,shoe:{outlet:outlet.toArray(),screen:projectPoint(outlet)}};},
  };
}

// A longer lens and a lower viewing angle expose the supplied full-height
// pedestal. Preserve the rear-edge position/scale where the filmed actor sits.
export function fitTableCamera(camera,anchor,{elevation=34,distance=2.6}={}){
  const target=anchor.clone().project(camera);
  const cameraDepth=-anchor.clone().applyMatrix4(camera.matrixWorldInverse).z;
  const focal=camera.projectionMatrix.elements[5]*distance/cameraDepth;
  const angle=THREE.MathUtils.degToRad(elevation);
  camera.position.copy(anchor).add(new THREE.Vector3(0,Math.sin(angle)*distance,Math.cos(angle)*distance));
  camera.lookAt(anchor);camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(1/focal));
  camera.updateMatrixWorld(true);camera.updateProjectionMatrix();
  const shift=new THREE.Matrix4().makeTranslation(target.x,target.y,0);
  camera.projectionMatrix.premultiply(shift);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}

export function pointOnSurface(camera,ndc,height){
  const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(ndc.x,ndc.y),camera);
  return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-height),new THREE.Vector3());
}

export function expandCameraToCanvas(camera,sourceProjection,frame,viewport){
  const sx=frame.width/viewport.width,sy=frame.height/viewport.height;
  const tx=(2*frame.x+frame.width)/viewport.width-1;
  const ty=1-(2*frame.y+frame.height)/viewport.height;
  const frameToCanvas=new THREE.Matrix4().set(sx,0,0,tx,0,sy,0,ty,0,0,1,0,0,0,0,1);
  camera.projectionMatrix.copy(sourceProjection).premultiply(frameToCanvas);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}
