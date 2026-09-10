import fs from 'node:fs';
import assert from 'node:assert/strict';
import {prepareFacialPerformance} from '../web/public/dealer-face.mjs';
const [model,capture]=process.argv.slice(2);
if(!model||!capture)throw new Error('Pass facial GLB and measured source JSON');
const bytes=fs.readFileSync(model),length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length)),bin=bytes.subarray(28+length);
const data=JSON.parse(fs.readFileSync(capture)),performance=prepareFacialPerformance(data);
assert.equal(json.animations.length,1,'speech export must contain one take');
const animation=json.animations[0];
function values(id){const a=json.accessors[id],view=json.bufferViews[a.bufferView];assert.equal(a.componentType,5126);const n={SCALAR:1,VEC4:4}[a.type],stride=view.byteStride??n*4,offset=(view.byteOffset??0)+(a.byteOffset??0);return Array.from({length:a.count},(_,i)=>Array.from({length:n},(_,j)=>bin.readFloatLE(offset+i*stride+j*4)));}
let maxError=0,tracks=0,start=Infinity,end=-Infinity;
for(const channel of animation.channels){
 const sampler=animation.samplers[channel.sampler],times=values(sampler.input).map(v=>v[0]);start=Math.min(start,times[0]);end=Math.max(end,times.at(-1));
 if(channel.target.path!=='weights')continue;
 const node=json.nodes[channel.target.node],mesh=json.meshes[node.mesh],names=mesh.extras.targetNames,weights=values(sampler.output).map(v=>v[0]);
 assert.equal(weights.length,times.length*names.length);tracks++;
 for(const time of [...data.frames.map(f=>f.time),data.duration]){
  let hi=times.findIndex(t=>t>=time);if(hi<0)hi=times.length-1;const lo=Math.max(0,hi-1),alpha=hi===lo?0:Math.max(0,Math.min(1,(time-times[lo])/(times[hi]-times[lo]))),expected=performance.sample(time);
  names.forEach((name,index)=>{const a=weights[lo*names.length+index],b=weights[hi*names.length+index];maxError=Math.max(maxError,Math.abs(a+(b-a)*alpha-(expected[name]??0)));});
 }
}
assert.equal(tracks,5,'all five facial meshes must carry the same source-clock take');
assert.ok(Math.abs(start)<1e-6,`speech begins at ${start}s instead of zero`);
assert.ok(Math.abs(end-data.duration)<1e-5,`speech ends at ${end}s instead of ${data.duration}s`);
assert.ok(maxError<.002,`exported speech differs from source-clock weights by ${maxError}`);
console.log(JSON.stringify({tracks,start,end,maxMorphWeightError:maxError,status:'source-clock weights verified; rendered lip review remains separate'},null,2));
