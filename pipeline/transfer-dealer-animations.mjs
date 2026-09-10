// Copy animation data into a fresh rig export without duplicating old geometry.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const [sourcePath,modelPath,outputPath]=process.argv.slice(2);
function read(path){const raw=fs.readFileSync(path),size=raw.readUInt32LE(12),json=JSON.parse(raw.subarray(20,20+size));return{raw,json,bin:raw.subarray(28+size,28+size+json.buffers[0].byteLength)};}
const source=read(sourcePath),model=read(modelPath),j=model.json;
assert.ok(source.json.animations?.length,'Source has no animations');
assert.ok(!j.animations?.length,'Destination must be a rest model');
const nodeMap=new Map(),viewMap=new Map(),accessorMap=new Map(),chunks=[model.bin];let length=model.bin.length;
const parent=(doc,index)=>doc.nodes.findIndex(node=>node.children?.includes(index));
function mapNode(index){
 if(nodeMap.has(index))return nodeMap.get(index);
 const a=source.json.nodes[index],matches=j.nodes.map((n,i)=>[n,i]).filter(([n])=>n.name===a.name);assert.equal(matches.length,1,`Ambiguous or absent node ${a.name}`);const [b,destination]=matches[0];
 for(const [key,defaults] of [['translation',[0,0,0]],['rotation',[0,0,0,1]],['scale',[1,1,1]],['matrix',[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]]]){
  const av=a[key]??defaults,bv=b[key]??defaults;assert.equal(av.length,bv.length);assert.ok(av.every((v,i)=>Math.abs(v-bv[i])<1e-6),`Rest transform changed: ${a.name}.${key}`);
 }
 const ap=parent(source.json,index),bp=parent(j,destination);assert.equal(ap<0?null:source.json.nodes[ap].name,bp<0?null:j.nodes[bp].name,`Parent changed: ${a.name}`);
 nodeMap.set(index,destination);if(ap>=0)mapNode(ap);return destination;
}
function mapView(index){
 if(viewMap.has(index))return viewMap.get(index);const original=source.json.bufferViews[index];assert.equal(original.buffer,0);const bytes=source.bin.subarray(original.byteOffset??0,(original.byteOffset??0)+original.byteLength);assert.equal(bytes.length,original.byteLength);
 const pad=Buffer.alloc((4-length%4)%4);chunks.push(pad,bytes);length+=pad.length;const id=j.bufferViews.length;j.bufferViews.push({...original,byteOffset:length});length+=bytes.length;viewMap.set(index,id);return id;
}
function mapAccessor(index){
 if(accessorMap.has(index))return accessorMap.get(index);const a=structuredClone(source.json.accessors[index]);if(a.bufferView!==undefined)a.bufferView=mapView(a.bufferView);if(a.sparse){a.sparse.indices.bufferView=mapView(a.sparse.indices.bufferView);a.sparse.values.bufferView=mapView(a.sparse.values.bufferView);}const id=j.accessors.length;j.accessors.push(a);accessorMap.set(index,id);return id;
}
j.animations=source.json.animations.map(original=>{const a=structuredClone(original);for(const sampler of a.samplers){sampler.input=mapAccessor(sampler.input);sampler.output=mapAccessor(sampler.output);}for(const channel of a.channels){assert.ok(['translation','rotation','scale','weights'].includes(channel.target.path));const oldIndex=channel.target.node;channel.target.node=mapNode(oldIndex);if(channel.target.path==='weights'){const oldMesh=source.json.meshes[source.json.nodes[oldIndex].mesh],newMesh=j.meshes[j.nodes[channel.target.node].mesh];assert.deepEqual(oldMesh.extras?.targetNames,newMesh.extras?.targetNames,'Morph order changed');}}return a;});
const bin=Buffer.concat(chunks);j.buffers[0].byteLength=bin.length;
function chunk(bytes,type,fill=0){const padded=Buffer.concat([bytes,Buffer.alloc((4-bytes.length%4)%4,fill)]),header=Buffer.alloc(8);header.writeUInt32LE(padded.length);header.writeUInt32LE(type,4);return Buffer.concat([header,padded]);}
const payload=Buffer.concat([chunk(Buffer.from(JSON.stringify(j)),0x4e4f534a,32),chunk(bin,0x004e4942)]),header=Buffer.alloc(12);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(payload.length+12,8);fs.writeFileSync(outputPath,Buffer.concat([header,payload]));
const result=read(outputPath);assert.ok(result.bin.subarray(0,model.bin.length).equals(model.bin),'Model bytes changed');
for(const [oldId,newId] of viewMap){const a=source.json.bufferViews[oldId],b=result.json.bufferViews[newId];assert.ok(source.bin.subarray(a.byteOffset??0,(a.byteOffset??0)+a.byteLength).equals(result.bin.subarray(b.byteOffset,b.byteOffset+b.byteLength)),'Animation bytes changed');}
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');const report={sourceSha256:sha(source.raw),modelSha256:sha(model.raw),outputSha256:sha(result.raw),animations:j.animations.map(a=>({name:a.name,channels:a.channels.length})),mappedNodes:nodeMap.size,copiedViews:viewMap.size,addedBytes:bin.length-model.bin.length,modelBinaryUnchanged:true,animationBinaryUnchanged:true,status:'Rest transforms, hierarchy and animation bytes verified; visual playback verification required'};fs.writeFileSync(outputPath+'.verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
