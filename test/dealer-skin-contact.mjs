import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../web/public/vendor/three/three.module.js';
import {loadRigGeometry} from '../pipeline/load-dealer-rig.mjs';
import {poseDealer,poseCardAction} from '../web/public/dealer-rig.mjs';
import {seatTarget} from '../web/public/dealer-motion.mjs';
const folder=new URL('../media/dealers/astrid/runtime/indexed/rig/',import.meta.url);
const profile=JSON.parse(fs.readFileSync(new URL('profile.json',folder)));
const {rig,root}=loadRigGeometry(new URL('astrid-rigged.glb',folder),profile);
const handVertices=[];
root.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const ids=mesh.geometry.attributes.skinIndex,w=mesh.geometry.attributes.skinWeight;for(let index=0;index<ids.count;index++){let weight=0;for(let j=0;j<4;j++){const name=mesh.skeleton.bones[ids.getComponent(index,j)].name;if(/^(Left|Right)(Hand|Thumb\d|Index\d|Middle\d|Ring\d|Pinky\d)$/.test(name))weight+=w.getComponent(index,j);}if(weight>.5)handVertices.push({mesh,index});}});
function independentlyMeasuredFloor(){let lowest=Infinity;for(const {mesh,index} of handVertices){const p=new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,index);mesh.applyBoneTransform(index,p);mesh.localToWorld(p);lowest=Math.min(lowest,p.y);}return lowest;}
test('actual deformed hand skin clears felt at pickup, transfer and release for every seat',()=>{
 assert.ok(handVertices.length>100);
 for(let seat=0;seat<7;seat++)for(const progress of [0,.2,.39,.69,.75,1]){
  poseDealer(rig,progress,seatTarget(seat),[.56,.935,.11]);
  assert.ok(independentlyMeasuredFloor()>=.9098,`skin penetrates at seat ${seat+1}, t=${progress}`);
  assert.ok(rig.verifySkinMath()<1e-6,'CPU contact must match Three.js skinning');
 }
});
test('reveal and collection skin clear the table instead of only passing a bone-distance check',()=>{
 for(const kind of ['reveal','collect'])for(let seat=0;seat<7;seat++)for(const progress of [.2,.39,.5,.69,.75]){
  const result=poseCardAction(rig,progress,{kind,source:kind==='reveal'?[0,.91055,.23]:seatTarget(seat),target:[-.91,.920,.25]});
  assert.ok(independentlyMeasuredFloor()>=.9098,`${kind} skin penetrates at ${seat}, t=${progress}`);
  assert.ok(result.errors[result.sample.active]<.001);
 }
});
test('skin-based target selection cannot make the wrist teleport between adjacent motion samples',()=>{
 for(let seat=0;seat<7;seat++){
  let previous;
  for(let frame=0;frame<=100;frame++){
   poseDealer(rig,frame/100,seatTarget(seat),[.56,.935,.11]);
   const points=['left','right'].map(side=>rig.handPosition(side));
   if(previous)for(let i=0;i<2;i++)assert.ok(points[i].distanceTo(previous[i])<.05,`wrist jump at ${seat}:${frame}`);
   previous=points;
  }
 }
});
