import * as THREE from './vendor/three/three.module.js';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';
import {uniformRegistration} from './performance-contact.mjs';
import {createDealingCard} from './dealing-card.mjs';

// Keep the native actor unwarped. The table camera is fitted at the rear edge,
// and the shoe outlet is registered to the filmed pickup after that camera fit.
export async function createBlenderTableScene(canvas,{frame}={}){
  const [asset,registration]=await Promise.all([
    new GLTFLoader().loadAsync('review/astrid-table-v2/table.glb'),
    fetch('review/astrid-table-v2/registration.json').then(r=>{if(!r.ok)throw new Error('Table registration unavailable');return r.json();}),
  ]);
  const camera=asset.cameras.find(c=>c.name==='PlateCam');
  if(!camera?.isPerspectiveCamera)throw new Error('Blender PlateCam is missing');
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
  renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.add(asset.scene);
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
  const filmedOutlet=outlet.clone().project(camera);
  fitTableCamera(camera,new THREE.Vector3(0,surfaceHeight,rear));
  const sourceProjection=camera.projectionMatrix.clone();
  const alignedOutlet=pointOnSurface(camera,filmedOutlet,outlet.y);
  const shoeOffset=alignedOutlet.clone().sub(outlet);
  for(const name of ['PRP_Shoe','PRP_ShoeStripe'])asset.scene.getObjectByName(name)?.position.add(shoeOffset);
  outlet.copy(alignedOutlet);
  asset.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
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
  const deal=createDealingCard({scene,camera,renderer,viewport:()=>({x:0,y:0,width:innerWidth,height:innerHeight}),surfaceHeight,unitScale:.001});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();document.documentElement.classList.remove('table-3d');});
  canvas.addEventListener('webglcontextrestored',()=>{resize();document.documentElement.classList.add('table-3d');});
  return {resize,render,
    project(x,z){return projectPoint(new THREE.Vector3(x*radius,surfaceHeight,rear+z*depth));},
    shoeOutlet(){return projectPoint(outlet);},
    dealCard(options){return deal({...options,origin:outlet});},
    // Authoritative remaining-card status stays in the existing HUD. The
    // supplied hollow shoe has no animated stack, so never invent its count.
    setShoe(){render();},
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
