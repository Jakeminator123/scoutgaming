import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const faceFolder=process.env.ASTRID_FACE_FIXTURE_ROOT?pathToFileURL(path.resolve(process.env.ASTRID_FACE_FIXTURE_ROOT)+path.sep):new URL('../web/public/dealers/astrid/rig/face-study/',import.meta.url);
import * as T from '../web/public/vendor/three/three.module.js';
import {loadRigGeometry} from '../pipeline/load-dealer-rig.mjs';
import {poseDealer} from '../web/public/dealer-rig.mjs';
import {seatTarget} from '../web/public/dealer-motion.mjs';
test('head turns keep lower-face skin within the 2 mm regression tolerance',()=>{
 const folder=faceFolder;
 const {rig,root}=loadRigGeometry(new URL('astrid-rigged.glb',folder),JSON.parse(fs.readFileSync(new URL('profile.json',folder))));
 const mesh=root.getObjectByName('Astrid_Face').children.find(o=>o.isSkinnedMesh),head=rig.bones.get('Head');
 const headRestInverse=head.matrixWorld.clone().invert(),selected=[];
 function point(i){const p=new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i);mesh.applyBoneTransform(i,p);return mesh.localToWorld(p);}
 for(let i=0;i<mesh.geometry.attributes.position.count;i++){const p=point(i);if(p.y>1.505&&p.y<1.59&&p.z>.09)selected.push({i,p});}
 assert.ok(selected.length>30,'actual lower-face geometry must be checked');
 for(const seat of [0,6])for(const progress of [.39,.68,.82]){
  poseDealer(rig,progress,seatTarget(seat),[.56,.935,.11]);
  const transform=head.matrixWorld.clone().multiply(headRestInverse);
  // The sample includes soft tissue under the chin. Permit slight neck blending,
  // while rejecting the centimetres of stretching in the failed source binding.
  for(const {i,p} of selected)assert.ok(point(i).distanceTo(p.clone().applyMatrix4(transform))<.002,`lower face stretches at seat${seat+1}, t=${progress}, vertex${i}`);
 }
});
