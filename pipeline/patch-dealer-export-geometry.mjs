// Replace corrected primitives while keeping every existing animation byte intact.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const [oldPath,newPath,outPath]=process.argv.slice(2);
function read(p){const raw=fs.readFileSync(p),n=raw.readUInt32LE(12),j=JSON.parse(raw.subarray(20,20+n));return {j,bin:raw.subarray(28+n,28+n+j.buffers[0].byteLength)};}
const old=read(oldPath),fresh=read(newPath),j=old.j,n=fresh.j,pad=Buffer.alloc((4-old.bin.length%4)%4),base=old.bin.length+pad.length;
const viewOffset=j.bufferViews.length,accessorOffset=j.accessors.length;
for(const view of n.bufferViews){assert.equal(view.buffer,0);j.bufferViews.push({...view,byteOffset:base+(view.byteOffset??0)});}
for(const source of n.accessors){const a=structuredClone(source);if(a.bufferView!==undefined)a.bufferView+=viewOffset;if(a.sparse){a.sparse.indices.bufferView+=viewOffset;a.sparse.values.bufferView+=viewOffset;}j.accessors.push(a);}
for(const name of ['char1','Astrid_Teeth','Astrid_Tongue']){
 const a=j.nodes.find(x=>x.name===name),b=n.nodes.find(x=>x.name===name);assert.ok(a&&b,name);
 assert.deepEqual(j.skins[a.skin].joints.map(i=>j.nodes[i].name),n.skins[b.skin].joints.map(i=>n.nodes[i].name),'Skin ordering changed');
 const previous=j.meshes[a.mesh],replacement=structuredClone(n.meshes[b.mesh]);
 assert.deepEqual(previous.extras?.targetNames,replacement.extras?.targetNames,'Morph order changed');
 for(const p of replacement.primitives){
  for(const key of Object.keys(p.attributes))p.attributes[key]+=accessorOffset;
  if(p.indices!==undefined)p.indices+=accessorOffset;
  for(const target of p.targets??[])for(const key of Object.keys(target))target[key]+=accessorOffset;
  if(p.material!==undefined){const material=n.materials[p.material].name;p.material=j.materials.findIndex(m=>m.name===material);assert.ok(p.material>=0,material);}
 }
 j.meshes[a.mesh]=replacement;
}
const binary=Buffer.concat([old.bin,pad,fresh.bin]);j.buffers[0].byteLength=binary.length;
function chunk(bytes,type,fill=0){const padded=Buffer.concat([bytes,Buffer.alloc((4-bytes.length%4)%4,fill)]),h=Buffer.alloc(8);h.writeUInt32LE(padded.length);h.writeUInt32LE(type,4);return Buffer.concat([h,padded]);}
const payload=Buffer.concat([chunk(Buffer.from(JSON.stringify(j)),0x4e4f534a,32),chunk(binary,0x004e4942)]),header=Buffer.alloc(12);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(payload.length+12,8);
fs.writeFileSync(outPath,Buffer.concat([header,payload]));
const result=read(outPath);assert.ok(result.bin.subarray(0,old.bin.length).equals(old.bin));assert.deepEqual(result.j.animations,old.j.animations);
console.log(JSON.stringify({output:outPath,animations:j.animations?.map(a=>a.name),originalAnimationBytesPreserved:true,replacedMeshes:['char1','Astrid_Teeth','Astrid_Tongue']}));
