import fs from 'node:fs';
import * as T from '../../../../web/public/vendor/three/three.module.js';
import {loadRigGeometry} from '../../../../pipeline/load-dealer-rig.mjs';
import {controlDealer,poseDealer} from './dealer-rig-upright.mjs';
import {seatTarget} from '../../../../web/public/dealer-motion.mjs';
const source=new URL('../../2026-09-11/astrid-replacement/hand-study/finger-candidate-v1/',import.meta.url);
const profile=JSON.parse(fs.readFileSync(new URL('profile.json',source)));
const {root}=loadRigGeometry(new URL('astrid-rigged.glb',source),profile),rig=controlDealer(root,profile);
const vertices=[];root.traverse(m=>{if(!m.isSkinnedMesh)return;const ids=m.geometry.attributes.skinIndex,w=m.geometry.attributes.skinWeight;for(let i=0;i<ids.count;i++){let sum=0;for(let k=0;k<4;k++)if(/^(Left|Right)(Hand|Thumb\d|Index\d|Middle\d|Ring\d|Pinky\d)$/.test(m.skeleton.bones[ids.getComponent(i,k)].name))sum+=w.getComponent(i,k);if(sum>.5)vertices.push([m,i]);}});
function floor(){let min=Infinity;for(const [m,i] of vertices){const v=new T.Vector3().fromBufferAttribute(m.geometry.attributes.position,i);m.applyBoneTransform(i,v);m.localToWorld(v);min=Math.min(min,v.y);}return min;}
const results=[],failures=[];let maxJump=0,maxContact=0,maxReach=0,minFloor=Infinity,maxReturn=0;const poses={rest:{bones:Object.fromEntries([...rig.bones].map(([n,b])=>[n,{world:b.matrixWorld.toArray()}]))}};
for(let seat=0;seat<7;seat++){
 let previous,initial;
 for(let frame=0;frame<=100;frame++){
  const t=frame/100,result=poseDealer(rig,t,seatTarget(seat),[.56,.935,.11]);
  const points=['left','right'].map(s=>rig.handPosition(s).clone());
  if(previous)maxJump=Math.max(maxJump,...points.map((v,i)=>v.distanceTo(previous[i])));previous=points;
  if(frame===0)initial=[...rig.bones].map(([n,b])=>[n,b.getWorldPosition(new T.Vector3())]);
  if(frame===100)maxReturn=Math.max(maxReturn,...initial.map(([n,p])=>rig.bones.get(n).getWorldPosition(new T.Vector3()).distanceTo(p)));
  const contact=Math.max(...['left','right'].map(s=>rig.contactPoint(s).distanceTo(new T.Vector3(...result.sample.contacts[s]))));
  const reach=Math.max(...Object.values(result.errors));maxReach=Math.max(maxReach,reach);maxContact=Math.max(maxContact,contact);
  const f=floor();minFloor=Math.min(minFloor,f);
  if(reach>.001||contact>.002||f<.9098)failures.push({seat:seat+1,t,reach,contact,floor:f});
  if([0,20,39,69,75,100].includes(frame))results.push({seat:seat+1,t,reach,contact,floor:f});
  if(seat===3&&[0,69,100].includes(frame))poses[t]={rootPosition:root.position.toArray(),bones:Object.fromEntries([...rig.bones].map(([n,b])=>[n,{position:b.position.toArray(),quaternion:b.quaternion.toArray(),world:b.matrixWorld.toArray()}]))};
 }
}
const report={source:String(source),scope:'Rejected V1 diagnostic, independent Three skin contact; no appearance approval',samples:707,maxJump,maxReach,maxContact,minFloor,maxReturn,skinMathError:rig.verifySkinMath(),failures,results};
fs.writeFileSync(new URL('checks.json',import.meta.url),JSON.stringify(report,null,2));fs.writeFileSync(new URL('poses.json',import.meta.url),JSON.stringify(poses));console.log(JSON.stringify({...report,results:undefined,failures:failures.slice(0,10)}));
if(failures.length||maxJump>.05||maxReturn>.001)process.exitCode=1;
