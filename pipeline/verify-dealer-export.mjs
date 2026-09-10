import fs from 'node:fs';
import path from 'node:path';
import * as T from '../web/public/vendor/three/three.module.js';
const dir=process.argv[2],b=fs.readFileSync(path.join(dir,'astrid-animated.glb'));
const size=b.readUInt32LE(12),json=JSON.parse(b.subarray(20,20+size)),bin=b.subarray(28+size);
function values(id){const a=json.accessors[id],v=json.bufferViews[a.bufferView],n={SCALAR:1,VEC3:3,VEC4:4}[a.type];if(a.componentType!==5126)throw new Error('Unexpected nonfloat animation');const start=(v.byteOffset??0)+(a.byteOffset??0);return Array.from({length:a.count},(_,i)=>Array.from({length:n},(_,j)=>bin.readFloatLE(start+(i*n+j)*4)));}
const expected=JSON.parse(fs.readFileSync(path.join(dir,'motion-samples.json')));
const results=[];
const names=expected.actions.map(a=>a.name);const actions=json.animations.filter(a=>names.includes(a.name));
if(actions.length!==expected.actions.length)throw new Error(`Expected all dealer actions, received ${actions.length}`);
for(const animation of actions){
 const seat=names.indexOf(animation.name);
 const frames=expected.samples.filter(s=>s.action===animation.name);
 const nodes=json.nodes.map(n=>{const o=new T.Group();o.name=n.name;if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);return o;});
 json.nodes.forEach((n,i)=>n.children?.forEach(j=>nodes[i].add(nodes[j])));const root=new T.Group();for(const i of json.scenes[json.scene??0].nodes)root.add(nodes[i]);
 let worstPosition=0,worstRotation=0;
 for(const index of [0,Math.round((frames.length-1)*.38),Math.round((frames.length-1)*.66),frames.length-1]){
  const sample=frames[index];
  for(const ch of animation.channels){
   const sampler=animation.samplers[ch.sampler],times=values(sampler.input),v=values(sampler.output),time=sample.frame/30;
   let hi=times.findIndex(t=>t[0]>=time-1e-6);if(hi<0)hi=times.length-1;
   const lo=Math.max(0,hi-1),alpha=hi===lo?0:Math.max(0,Math.min(1,(time-times[lo][0])/(times[hi][0]-times[lo][0])));
   const o=nodes[ch.target.node];
   if(ch.target.path==='rotation')o.quaternion.fromArray(v[lo]).slerp(new T.Quaternion(...v[hi]),alpha);
   else{const prop=ch.target.path==='translation'?o.position:o.scale;prop.fromArray(v[lo]).lerp(new T.Vector3(...v[hi]),alpha);}
  }
  root.updateMatrixWorld(true);
  for(const [name,m] of Object.entries(sample.bones)){
   const o=root.getObjectByName(name);if(!o)throw new Error(`Missing exported bone ${name}`);
   const target=new T.Matrix4().fromArray(m),p=new T.Vector3(),q=new T.Quaternion(),scale=new T.Vector3();target.decompose(p,q,scale);
   worstPosition=Math.max(worstPosition,p.distanceTo(o.getWorldPosition(new T.Vector3())));
   worstRotation=Math.max(worstRotation,q.angleTo(o.getWorldQuaternion(new T.Quaternion())));
  }
 }
 results.push({action:animation.name,maxJointPositionErrorMm:worstPosition*1000,maxJointRotationErrorDegrees:worstRotation*180/Math.PI});
}
fs.writeFileSync(path.join(dir,'export-verification.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
if(results.some(r=>r.maxJointPositionErrorMm>1))process.exitCode=1;
