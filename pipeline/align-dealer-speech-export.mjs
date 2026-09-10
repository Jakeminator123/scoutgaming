// Repair the positive frame-1 offset in an existing Blender speech GLB.
// New exports use export_anim_slide_to_zero; geometry and materials stay byte-identical.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const filename=process.argv[2];if(!filename)throw new Error('Pass speech GLB');
const raw=fs.readFileSync(filename);assert.equal(raw.readUInt32LE(0),0x46546c67);assert.equal(raw.readUInt32LE(8),raw.length);
const chunks=[];for(let offset=12;offset<raw.length;){const length=raw.readUInt32LE(offset),kind=raw.readUInt32LE(offset+4);chunks.push({kind,data:Buffer.from(raw.subarray(offset+8,offset+8+length))});offset+=8+length;}
const json=JSON.parse(chunks[0].data),bin=chunks.find(c=>c.kind===0x004e4942).data;
assert.equal(json.animations.length,1,'only a single source-clock speech take may be aligned');
const animation=json.animations[0],inputs=[...new Set(animation.channels.map(ch=>animation.samplers[ch.sampler].input))];
const offsets=new Map(),streams=[];
for(const id of inputs){const a=json.accessors[id],view=json.bufferViews[a.bufferView];assert.equal(a.componentType,5126);assert.equal(a.type,'SCALAR');assert.equal(a.sparse,undefined);const start=(view.byteOffset??0)+(a.byteOffset??0),stride=view.byteStride??4,positions=Array.from({length:a.count},(_,i)=>start+i*stride);for(const position of positions)offsets.set(position,bin.readFloatLE(position));streams.push({a,positions});}
const start=Math.min(...streams.map(s=>offsets.get(s.positions[0])));
assert.ok(start>=0&&start<.1,'unexpected speech start offset');
assert.ok(streams.every(s=>Math.abs(offsets.get(s.positions[0])-start)<1e-6),'speech tracks do not share a start time');
for(const [position,value] of offsets)bin.writeFloatLE(value-start,position);
for(const {a,positions} of streams){a.min=[Math.min(...positions.map(p=>bin.readFloatLE(p)))];a.max=[Math.max(...positions.map(p=>bin.readFloatLE(p)))];}
let encoded=Buffer.from(JSON.stringify(json));encoded=Buffer.concat([encoded,Buffer.alloc((4-encoded.length%4)%4,32)]);chunks[0].data=encoded;
const payload=Buffer.concat(chunks.map(({kind,data})=>{const header=Buffer.alloc(8);header.writeUInt32LE(data.length);header.writeUInt32LE(kind,4);return Buffer.concat([header,data]);})),header=Buffer.alloc(12);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(12+payload.length,8);fs.writeFileSync(filename,Buffer.concat([header,payload]));
console.log(JSON.stringify({file:filename,offsetRemovedSeconds:start,timingStreams:inputs.length}));
