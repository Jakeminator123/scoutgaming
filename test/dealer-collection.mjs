import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../web/public/vendor/three/three.module.js';
import {planCollection} from '../web/public/dealer-collection.mjs';
import {riggedCardPose} from '../web/public/rigged-card-layout.mjs';
import {loadRigGeometry} from '../pipeline/load-dealer-rig.mjs';
import {poseCardAction} from '../web/public/dealer-rig.mjs';
const profile=JSON.parse(fs.readFileSync(new URL('../assets/blackjack-3d/profile.json',import.meta.url)));
const folder=new URL('../web/public/dealers/astrid/rig/',import.meta.url);
const {rig,root}=loadRigGeometry(new URL('astrid-rigged.glb',folder),JSON.parse(fs.readFileSync(new URL('profile.json',folder))));
function cardsFor(seats=[0,1,2,3,4,5,6],hands=1){
 const cards=[];for(const seat of seats)for(let handIndex=0;handIndex<hands;handIndex++)for(let cardIndex=0;cardIndex<2;cardIndex++){
  const pose=riggedCardPose({profile,seat,handCount:hands,handIndex,cardIndex,cardCount:2});cards.push({id:cards.length,group:`${seat}:${handIndex}`,...pose});
 }
 for(let cardIndex=0;cardIndex<2;cardIndex++)cards.push({id:cards.length,group:'dealer',...riggedCardPose({profile,cardIndex,cardCount:2})});return cards;
}
test('sweep keeps original cards still until contact and deposits exactly one coherent packet',()=>{
 const cards=cardsFor(),landing=[-.91,.94,.25],plan=planCollection(cards,{landing});let previous,count=0;
 for(let frame=0;frame<=Math.ceil(plan.duration*60);frame++){
  const sample=plan.sample(frame/60);assert.ok(sample.count>=count);count=sample.count;
  for(const pose of sample.transforms){const original=cards.find(c=>c.id===pose.id);if(!pose.picked)assert.deepEqual(pose.position,original.position);
   assert.ok(pose.position[1]>=.9105,'Card may not pass through felt');
   if(previous){const last=previous.transforms.find(c=>c.id===pose.id);assert.ok(Math.hypot(...pose.position.map((v,i)=>v-last.position[i]))<.065,'Card teleported between frames');}
  }
  previous=sample;
 }
 const final=plan.sample(plan.duration);assert.equal(final.count,cards.length);assert.ok(final.released);
 assert.equal(new Set(final.transforms.map(c=>c.id)).size,cards.length);
 final.transforms.forEach((c,i)=>{assert.ok(Math.abs(c.position[0]-landing[0])<1e-9);assert.ok(Math.abs(c.position[2]-landing[2])<1e-9);assert.ok(Math.abs(c.position[1]-landing[1]-(cards.length-1-i)*.00045)<1e-9);});
});
test('sweep reaches the actual stack with skin above the felt for seven seats and outer split hands',()=>{
 const vertices=[];root.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const ids=mesh.geometry.attributes.skinIndex,w=mesh.geometry.attributes.skinWeight;for(let index=0;index<ids.count;index++){let weight=0;for(let j=0;j<4;j++)if(/^(Left|Right)(Hand|Thumb\d|Index\d|Middle\d|Ring\d|Pinky\d)$/.test(mesh.skeleton.bones[ids.getComponent(index,j)].name))weight+=w.getComponent(index,j);if(weight>.5)vertices.push({mesh,index});}});
 for(const cards of [cardsFor(),cardsFor([0,6],4),cardsFor([3])]){
  const plan=planCollection(cards,{landing:[-.91,1.06,.25]});let previous;
  for(let frame=0;frame<=Math.ceil(plan.duration*30);frame++){
   const sample=plan.sample(frame/30),result=poseCardAction(rig,sample.progress,{kind:'collect-sweep',sample});
   assert.ok(result.errors[sample.active]<.001,`Unreachable active hand ${frame}: ${result.errors[sample.active]}`);
   for(const {mesh,index} of vertices){const p=new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,index);mesh.applyBoneTransform(index,p);mesh.localToWorld(p);assert.ok(p.y>=.9098,`Skin below felt at ${frame}: ${p.y}`);}
   const wrists=['left','right'].map(side=>rig.handPosition(side));if(previous)wrists.forEach((p,i)=>assert.ok(p.distanceTo(previous[i])<.08,`Wrist jump at ${frame}, side ${i}, cards ${cards.length}, phase ${sample.phase}: ${p.distanceTo(previous[i])}, handoff ${sample.handoff}`));previous=wrists;
  }
 }
});
