// Export source-clock morph tracks without resampling the native body rig.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {prepareFacialPerformance} from '../web/public/dealer-face.mjs';
const [model,capture,output]=process.argv.slice(2),raw=fs.readFileSync(model),modelSha256=crypto.createHash('sha256').update(raw).digest('hex'),data=JSON.parse(fs.readFileSync(capture)),performance=prepareFacialPerformance(data,{modelSha256});
assert.equal(performance.rigModelHash,modelSha256,'Explicit rig calibration required');
const size=raw.readUInt32LE(12),j=JSON.parse(raw.subarray(20,20+size)),parts=[raw.subarray(28+size,28+size+j.buffers[0].byteLength)];let offset=parts[0].length;
function append(values){const padding=(4-offset%4)%4;parts.push(Buffer.alloc(padding));offset+=padding;const bytes=Buffer.alloc(values.length*4);values.forEach((v,i)=>bytes.writeFloatLE(v,i*4));const view=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length});parts.push(bytes);offset+=bytes.length;const id=j.accessors.length;j.accessors.push({bufferView:view,componentType:5126,count:values.length,type:'SCALAR',min:[Math.min(...values)],max:[Math.max(...values)]});return id;}
const times=[...new Set([0,...data.frames.map(f=>f.time),data.duration])].sort((a,b)=>a-b),input=append(times),animation={name:'Speech_Goodluck',samplers:[],channels:[]};
for(let node=0;node<j.nodes.length;node++){
 const mesh=j.meshes[j.nodes[node].mesh],names=mesh?.extras?.targetNames;if(!names?.length)continue;
 const weights=times.flatMap(t=>{const w=performance.sample(t);return names.map(n=>w[n]??0);});const sampler=animation.samplers.length;animation.samplers.push({input,output:append(weights),interpolation:'LINEAR'});animation.channels.push({sampler,target:{node,path:'weights'}});
}
assert.equal(animation.channels.length,5);j.animations=[animation];j.buffers[0].byteLength=offset;j.asset.extras={...j.asset.extras,facialSourceSha256:data.sha256,facialRigModelSha256:modelSha256};
function chunk(bytes,type,fill=0){const p=Buffer.concat([bytes,Buffer.alloc((4-bytes.length%4)%4,fill)]),h=Buffer.alloc(8);h.writeUInt32LE(p.length);h.writeUInt32LE(type,4);return Buffer.concat([h,p]);}
const payload=Buffer.concat([chunk(Buffer.from(JSON.stringify(j)),0x4e4f534a,32),chunk(Buffer.concat(parts),0x004e4942)]),header=Buffer.alloc(12);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(payload.length+12,8);fs.writeFileSync(output,Buffer.concat([header,payload]));
const result=fs.readFileSync(output),n=result.readUInt32LE(12),doc=JSON.parse(result.subarray(20,20+n)),bin=result.subarray(28+n);let error=0;
for(const channel of doc.animations[0].channels){const s=doc.animations[0].samplers[channel.sampler],a=doc.accessors[s.output],v=doc.bufferViews[a.bufferView],names=doc.meshes[doc.nodes[channel.target.node].mesh].extras.targetNames;times.forEach((t,i)=>names.forEach((name,k)=>{error=Math.max(error,Math.abs(bin.readFloatLE(v.byteOffset+(i*names.length+k)*4)-(performance.sample(t)[name]??0)));}));}
assert.ok(error<1e-6);assert.ok(bin.subarray(0,parts[0].length).equals(parts[0]));console.log(JSON.stringify({modelSha256,sourceSha256:data.sha256,channels:animation.channels.length,samples:times.length,start:times[0],end:times.at(-1),maximumWeightError:error,geometryMaterialsAndSkinUnchanged:true}));
