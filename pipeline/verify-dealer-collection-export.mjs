import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as T from '../web/public/vendor/three/three.module.js';
const folder=process.argv[2],bytes=fs.readFileSync(path.join(folder,process.argv[3]??'astrid-collection-sweep.glb'));
const length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length)),bin=bytes.subarray(28+length);
const data=JSON.parse(fs.readFileSync(path.join(folder,'motion-samples.json')));
const sourceBytes=fs.readFileSync(process.argv[4]??new URL('../media/dealers/astrid/runtime/indexed/rig/face-study/astrid-rigged.glb',import.meta.url)),sourceSize=sourceBytes.readUInt32LE(12),source=JSON.parse(sourceBytes.subarray(20,20+sourceSize));
assert.equal(crypto.createHash('sha256').update(sourceBytes).digest('hex'),data.modelSha256);
assert.ok(bin.subarray(0,source.buffers[0].byteLength).equals(sourceBytes.subarray(28+sourceSize,28+sourceSize+source.buffers[0].byteLength)),'Original geometry and texture bytes changed');
for(const key of ['accessors','bufferViews','materials','meshes'])assert.deepEqual(json[key].slice(0,source[key].length),source[key],`${key} changed`);
for(const key of ['skins','images','textures','samplers'])assert.deepEqual(json[key],source[key],`${key} changed`);
const animation=json.animations.find(a=>a.name===data.actions[0].name);assert.ok(animation,'Sweep clip missing');
function values(id){const a=json.accessors[id],v=json.bufferViews[a.bufferView],n={SCALAR:1,VEC3:3,VEC4:4}[a.type];assert.equal(a.componentType,5126);const stride=v.byteStride??n*4,start=(v.byteOffset??0)+(a.byteOffset??0);return Array.from({length:a.count},(_,i)=>Array.from({length:n},(_,j)=>bin.readFloatLE(start+i*stride+j*4)));}
const nodes=json.nodes.map(n=>{const o=new T.Group();o.name=n.name;if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);return o;});
json.nodes.forEach((n,i)=>n.children?.forEach(j=>nodes[i].add(nodes[j])));const root=new T.Group();for(const i of json.scenes[json.scene??0].nodes)root.add(nodes[i]);
const channels=animation.channels.filter(c=>c.target.path!=='weights').map(c=>{const s=animation.samplers[c.sampler];assert.equal(s.interpolation??'LINEAR','LINEAR');return {...c,times:values(s.input).map(v=>v[0]),values:values(s.output)};});
let maxJoint=0,maxCard=0,maxCardAngle=0;
for(const sample of data.samples){
 const time=sample.frame/data.fps;
 for(const c of channels){let hi=c.times.findIndex(t=>t>=time-1e-6);if(hi<0)hi=c.times.length-1;const lo=Math.max(0,hi-1),alpha=lo===hi?0:Math.max(0,Math.min(1,(time-c.times[lo])/(c.times[hi]-c.times[lo]))),o=nodes[c.target.node];
  if(c.target.path==='rotation')o.quaternion.fromArray(c.values[lo]).slerp(new T.Quaternion(...c.values[hi]),alpha);
  else (c.target.path==='translation'?o.position:o.scale).fromArray(c.values[lo]).lerp(new T.Vector3(...c.values[hi]),alpha);
 }
 root.updateMatrixWorld(true);
 for(const [name,m] of Object.entries(sample.bones)){const o=root.getObjectByName(name);assert.ok(o,name);maxJoint=Math.max(maxJoint,o.getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3().setFromMatrixPosition(new T.Matrix4().fromArray(m))));}
 for(const c of sample.cards){const o=root.getObjectByName(`Collection_Card_${String(c.id).padStart(2,'0')}`);assert.ok(o,`Card ${c.id}`);maxCard=Math.max(maxCard,o.getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3(...c.position)));const actual=new T.Vector3(1,0,0).applyQuaternion(o.getWorldQuaternion(new T.Quaternion())),expected=new T.Vector3(Math.cos(c.yaw),0,-Math.sin(c.yaw));maxCardAngle=Math.max(maxCardAngle,actual.angleTo(expected));}
}
assert.ok(maxJoint<.001,`Joint export error ${maxJoint}m`);assert.ok(maxCard<.00001,`Card export error ${maxCard}m`);assert.ok(maxCardAngle<.001,`Card yaw error ${maxCardAngle}rad`);
const result={frames:data.samples.length,cardHelpers:data.cards.length,animations:json.animations.map(a=>a.name),originalGeometryMaterialsAndSkinPreserved:true,maxJointPositionErrorMm:maxJoint*1000,maxCardPositionErrorMm:maxCard*1000,maxCardYawErrorDegrees:maxCardAngle*180/Math.PI,status:'GLB frame correspondence verified; visual motion acceptance separate'};
fs.writeFileSync(path.join(folder,'collection-export-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
