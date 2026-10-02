import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../web/public/vendor/three/three.module.js';
import {loadRigGeometry} from '../pipeline/load-dealer-rig.mjs';
import {poseDealer,poseCardAction} from '../web/public/dealer-rig.mjs';
import {riggedCardPose} from '../web/public/rigged-card-layout.mjs';
const folder=new URL('../media/dealers/astrid/runtime/indexed/rig/',import.meta.url);
const {rig,root}=loadRigGeometry(new URL('astrid-rigged.glb',folder),JSON.parse(fs.readFileSync(new URL('profile.json',folder))));
const profile=JSON.parse(fs.readFileSync(new URL('../media/game/source/3d/profile.json',import.meta.url)));
const vertices=[];
root.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const ids=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
  for(let index=0;index<ids.count;index++){
    let handWeight=0;
    for(let j=0;j<4;j++)if(/^(Left|Right)(Hand|Thumb\d|Index\d|Middle\d|Ring\d|Pinky\d)$/.test(mesh.skeleton.bones[ids.getComponent(index,j)].name))handWeight+=weights.getComponent(index,j);
    if(handWeight>.5)vertices.push({mesh,index});
  }
});
test('collection reaches the growing discard stack without pulling hand skin through felt',()=>{
 for(let seat=0;seat<7;seat++)for(const count of [1,100,312,415])for(const progress of [.2,.39,.69,.8]){
  const {position}=riggedCardPose({profile,seat});
  const result=poseCardAction(rig,progress,{kind:'collect',source:position,target:[-.91,.920+count*.00045,.25]});
  assert.ok(result.errors[result.sample.active]<.001,`Discard unreachable: ${seat}/${count}/${progress}`);
  for(const {mesh,index} of vertices){
   const p=new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,index);mesh.applyBoneTransform(index,p);mesh.localToWorld(p);
   assert.ok(p.y>=.9098,`Collection skin clips felt: ${seat}/${count}/${progress}`);
  }
 }
});
test('extreme split destinations remain reachable with real hand skin above the felt',()=>{
  for(let seat=0;seat<7;seat++)for(let handIndex=0;handIndex<4;handIndex++)for(const cardIndex of [0,20]){
    const {position}=riggedCardPose({profile,seat,handCount:4,handIndex,cardCount:21,cardIndex});
    for(const progress of [.2,.39,.69]){
      const result=poseDealer(rig,progress,position,[.56,.935,.11]);
      assert.ok(result.errors[result.sample.active]<.001,`Unreachable split target: ${seat}/${handIndex}/${cardIndex}`);
      let lowest=Infinity;
      for(const {mesh,index} of vertices){
        const p=new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,index);
        mesh.applyBoneTransform(index,p);mesh.localToWorld(p);lowest=Math.min(lowest,p.y);
      }
      assert.ok(lowest>=.9098,`Split hand skin clips felt: ${seat}/${handIndex}/${cardIndex} at ${progress}: ${lowest}`);
    }
  }
});
