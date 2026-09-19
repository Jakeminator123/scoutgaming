import * as THREE from './vendor/three/three.module.js';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';
import {uniformRegistration} from './performance-contact.mjs';
import {createDealingCard} from './dealing-card.mjs';

// The saved Blender perspective camera and the native actor use one frame.
// No independent table/actor zoom or shoe repositioning is applied here.
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
  const scene=new THREE.Scene();scene.add(asset.scene);
  scene.add(new THREE.HemisphereLight(0xfff3df,0x282c30,2.2));
  const key=new THREE.DirectionalLight(0xffedda,3);key.position.set(-2,4,2);scene.add(key);
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
  let fit;
  function projectPoint(point){
    const p=point.clone().project(camera);
    return {x:fit.x+(p.x+1)*fit.width/2,y:fit.y+(1-p.y)*fit.height/2};
  }
  function render(){renderer.render(scene,camera);}
  function resize(){
    fit=uniformRegistration(source,{width:innerWidth,height:innerHeight});
    renderer.setSize(innerWidth,innerHeight,false);
    renderer.setViewport(fit.x,innerHeight-fit.y-fit.height,fit.width,fit.height);
    const edge=projectPoint(new THREE.Vector3(0,surfaceHeight,rear));
    const style=document.documentElement.style;
    style.setProperty('--performance-rear',`${edge.y}px`);
    style.setProperty('--performance-table-height',`${fit.y+fit.height-edge.y}px`);
    document.documentElement.dataset.performanceStaged='true';
    canvas.dataset.tableSource='table-v2.blend';canvas.dataset.camera='PlateCam';
    canvas.dataset.sourceHash=registration.sourceSha256;
    render();
  }
  resize();
  const deal=createDealingCard({scene,camera,renderer,viewport:()=>fit,surfaceHeight,unitScale:.001});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();document.documentElement.classList.remove('table-3d');});
  canvas.addEventListener('webglcontextrestored',()=>{resize();document.documentElement.classList.add('table-3d');});
  return {resize,render,
    project(x,z){return projectPoint(new THREE.Vector3(x*radius,surfaceHeight,rear+z*depth));},
    shoeOutlet(){return projectPoint(outlet);},
    dealCard(options){return deal({...options,origin:outlet});},
    // Authoritative remaining-card status stays in the existing HUD. The
    // supplied hollow shoe has no animated stack, so never invent its count.
    setShoe(){render();},
    registration(){return {version:1,source:registration.sourceSha256,camera:{type:'perspective',projection:camera.projectionMatrix.toArray(),world:camera.matrixWorld.toArray()},viewport:fit,shoe:{outlet:outlet.toArray(),screen:projectPoint(outlet)}};},
  };
}
