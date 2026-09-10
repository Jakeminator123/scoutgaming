import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const faceFolder=process.env.ASTRID_FACE_FIXTURE_ROOT?pathToFileURL(path.resolve(process.env.ASTRID_FACE_FIXTURE_ROOT)+path.sep):new URL('../web/public/dealers/astrid/rig/face-study/',import.meta.url);
import {prepareFacialPerformance,controlDealerFace,mapFacialWeights,verifyFacialSource} from '../web/public/dealer-face.mjs';
const data={schemaVersion:1,duration:1,frames:[{time:0,weights:{jawOpen:0}},{time:.1,weights:{jawOpen:1}},{time:.2,weights:{jawOpen:0}}]};
test('source-clock sampling supports seek, reverse scrub and playback-rate changes without state drift',()=>{
 const p=prepareFacialPerformance(data);assert.equal(p.sample(.05).jawOpen,.5);assert.equal(p.sample(.15).jawOpen,.5000000000000001);assert.equal(p.sample(.05).jawOpen,.5);assert.equal(p.sample(1).jawOpen,0);assert.equal(p.sample(-1).jawOpen,0);
});
test('missing source intervals are not presented as measured facial performance',()=>{
 const p=prepareFacialPerformance({...data,frames:[data.frames[0],{time:.5,weights:{jawOpen:1}}]});assert.equal(p.sample(.25).jawOpen,0);assert.equal(p.sample(.5).jawOpen,1);assert.equal(p.sample(.8).jawOpen,0);assert.throws(()=>prepareFacialPerformance({...data,frames:[data.frames[1],data.frames[0]]}));
});
test('reset clears the face after interrupted speech and clamps invalid controls',()=>{
 const face={morphTargetDictionary:{jawOpen:0,eyeBlinkLeft:1},morphTargetInfluences:[.9,1]};const controller=controlDealerFace({traverse:f=>f(face)});controller.apply({jawOpen:5,eyeBlinkLeft:NaN});assert.deepEqual(face.morphTargetInfluences,[1,0]);controller.reset();assert.deepEqual(face.morphTargetInfluences,[0,0]);assert.equal(mapFacialWeights({mouthSmileLeft:.2,mouthSmileRight:.6}).mouthSmile,.4);
});
test('measured performance is rejected when the source video bytes change',async()=>{
 const source=JSON.parse(fs.readFileSync(new URL('../web/public/dealers/astrid/rig/face-study/goodluck-face.json',import.meta.url)));
 const bytes=fs.readFileSync(new URL('../web/public/dealers/astrid/speech/goodluck.mp4',import.meta.url));
 assert.equal(await verifyFacialSource(source,bytes),source.sha256);
 await assert.rejects(verifyFacialSource(source,Buffer.concat([bytes,Buffer.from([0])])),/does not match/);
});
test('exported face contains real deformation targets and separately weighted gaze bones',()=>{
 const bytes=fs.readFileSync(new URL('astrid-rigged.glb',faceFolder));
 const jsonLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonLength)),bin=bytes.subarray(28+jsonLength);
 const node=json.nodes.find(n=>n.name==='Astrid_Face'),mesh=json.meshes[node.mesh],names=mesh.extras.targetNames;
 for(const name of ['jawOpen','mouthPucker','eyeBlinkLeft','eyeBlinkRight']){
  const target=mesh.primitives[0].targets[names.indexOf(name)];assert.ok(target,`${name} missing`);
  const accessor=json.accessors[target.POSITION];assert.equal(accessor.componentType,5126);let largest=0;
  const ranges=[];
  if(accessor.bufferView!==undefined)ranges.push({view:accessor.bufferView,offset:accessor.byteOffset??0,count:accessor.count});
  if(accessor.sparse)ranges.push({view:accessor.sparse.values.bufferView,offset:accessor.sparse.values.byteOffset??0,count:accessor.sparse.count});
  for(const range of ranges){const view=json.bufferViews[range.view],offset=(view.byteOffset??0)+range.offset;
   for(let i=0;i<range.count*3;i++){const n=bin.readFloatLE(offset+i*4);assert.ok(Number.isFinite(n));largest=Math.max(largest,Math.abs(n));}
  }
  assert.ok(largest>.001,`${name} has no meaningful mesh movement`);
 }
 const eyes=json.nodes.find(n=>n.name==='Astrid_Eyes'),skin=json.skins[eyes.skin],primitive=json.meshes[eyes.mesh].primitives[0];
 const accessor=json.accessors[primitive.attributes.JOINTS_0],view=json.bufferViews[accessor.bufferView],offset=(view.byteOffset??0)+(accessor.byteOffset??0),size=accessor.componentType===5121?1:2;
 const weighted=new Set();const w=json.accessors[primitive.attributes.WEIGHTS_0],wv=json.bufferViews[w.bufferView],wo=(wv.byteOffset??0)+(w.byteOffset??0);
 for(let i=0;i<accessor.count*4;i++)if(bin.readFloatLE(wo+i*4)>.001){const joint=size===1?bin.readUInt8(offset+i):bin.readUInt16LE(offset+i*2);weighted.add(json.nodes[skin.joints[joint]].name);}
 assert.deepEqual([...weighted].sort(),['EyeLeft','EyeRight']);
});
