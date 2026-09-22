import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../web/public/vendor/three/three.module.js';
import {expandCameraToCanvas,fitTableCamera,pointOnSurface} from '../web/public/blender-table-scene.mjs';
import {uniformRegistration} from '../web/public/performance-contact.mjs';

test('full-canvas rendering reveals the base without moving registered source pixels',()=>{
  for(const viewport of [{width:1117,height:837},{width:1280,height:720},{width:706,height:837}]){
    const frame=uniformRegistration({width:1920,height:1080,framingScale:.85},viewport);
    const camera=new THREE.PerspectiveCamera(50,1920/1080,.01,100);
    const projection=camera.projectionMatrix.clone();
    const points=[[-.65,.4],[.33,-.24],[0,-1.16]].map(([x,y])=>new THREE.Vector3(x,y,0).unproject(camera));
    const before=points.map(p=>p.clone().project(camera));
    expandCameraToCanvas(camera,projection,frame,viewport);
    points.forEach((point,i)=>{
      const after=point.clone().project(camera);
      assert.ok(Math.abs((after.x+1)*viewport.width/2-(frame.x+(before[i].x+1)*frame.width/2))<1e-8);
      assert.ok(Math.abs((1-after.y)*viewport.height/2-(frame.y+(1-before[i].y)*frame.height/2))<1e-8);
      assert.ok(after.clone().unproject(camera).distanceTo(point)<1e-8,'raycast inverse must track the expanded projection');
    });
    assert.ok(before[2].y < -1,'base began outside the video frustum');
    assert.ok(points[2].clone().project(camera).y > -1,'base is visible in the full canvas');
    const once=camera.projectionMatrix.clone();
    expandCameraToCanvas(camera,projection,frame,viewport);
    assert.deepEqual(camera.projectionMatrix.elements,once.elements,'resize must not compound the frame transform');
  }
});

test('lower table camera preserves actor rear-edge registration and filmed shoe contact',()=>{
  const camera=new THREE.PerspectiveCamera(47.35,1920/1080,.01,100);
  camera.position.set(-.00146069,1.87376392,.88749713);
  camera.quaternion.set(-.396248847,0,0,.918143272).normalize();
  camera.updateMatrixWorld(true);
  const rear=new THREE.Vector3(0,.76,-.12563765);
  const outlet=new THREE.Vector3(.34312752,.7672,.04108719);
  const sourceRear=rear.clone().project(camera),sourceOutlet=outlet.clone().project(camera);
  const sourceWidth=new THREE.Vector3(.5,.76,rear.z).project(camera).x-sourceRear.x;
  const baseTop=new THREE.Vector3(0,.687,.385),baseBottom=new THREE.Vector3(0,0,.385);
  const oldHeight=baseTop.clone().project(camera).y-baseBottom.clone().project(camera).y;
  fitTableCamera(camera,rear);
  assert.ok(rear.clone().project(camera).distanceTo(new THREE.Vector3(sourceRear.x,sourceRear.y,rear.clone().project(camera).z))<1e-8);
  const width=new THREE.Vector3(.5,.76,rear.z).project(camera).x-rear.clone().project(camera).x;
  assert.ok(Math.abs(width-sourceWidth)<1e-8,'actor shoulder and rear rail scale must not change');
  const elevation=Math.atan2(camera.position.y-rear.y,camera.position.z-rear.z)*180/Math.PI;
  assert.ok(Math.abs(elevation-34)<1e-8);
  const aligned=pointOnSurface(camera,sourceOutlet,outlet.y);
  assert.ok(Math.abs(aligned.y-outlet.y)<1e-8,'shoe must remain on the physical tabletop');
  const projection=aligned.project(camera);
  assert.ok(Math.abs(projection.x-sourceOutlet.x)<1e-8&&Math.abs(projection.y-sourceOutlet.y)<1e-8,'shoe extraction remains at the filmed hand');
  const newHeight=baseTop.clone().project(camera).y-baseBottom.clone().project(camera).y;
  assert.ok(newHeight>oldHeight*1.5,'pedestal should no longer be foreshortened by the close camera');
});
