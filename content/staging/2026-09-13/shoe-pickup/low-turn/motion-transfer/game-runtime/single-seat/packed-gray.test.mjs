import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('terminal GPU cleanup owns each unique resource once and late loader/paint cannot revive it',async()=>{
 const resources=[],loads=[];let renders=0,loss=0;
 class R{constructor(){this.count=0;resources.push(this);}dispose(){this.count++;}clone(){return new this.constructor();}}
 class Geometry extends R{constructor(){super();this.attributes={position:{setXYZ(){}}};}setAttribute(){}setIndex(){}}
 class Material extends R{constructor(o={}){super();Object.assign(this,o);this.color={setRGB(){}};}}
 const vector=()=>({set(){}});
 const THREE={WebGLRenderer:class extends R{setSize(){}setClearColor(){}render(){renders++;}forceContextLoss(){loss++;}},Scene:class{add(){}clear(){}},OrthographicCamera:class{position={}},VideoTexture:class extends R{},CanvasTexture:class extends R{},TextureLoader:class{load(url,cb){loads.push(cb);return new R();}},ShaderMaterial:Material,MeshBasicMaterial:Material,PlaneGeometry:Geometry,BufferGeometry:Geometry,Float32BufferAttribute:class{},Mesh:class{constructor(g,m){this.geometry=g;this.material=m;this.position=vector();this.scale=vector();this.rotation={};this.userData={};}}};
 const text=fs.readFileSync(new URL('./harness/packed-gray.mjs',import.meta.url),'utf8').replace("import * as THREE from '/vendor/three/three.module.js';",'').replace("import {cardFaceArt} from '/card-art.mjs';",'').replace('export function packedGPU','function packedGPU');
 const packedGPU=new Function('THREE','cardFaceArt',text+';return packedGPU;')(THREE,()=>({canvas:{}}));
 const gpu=packedGPU({}, {},{shoeMaskURL:'/mask'}),q=[[0,0],[1,0],[1,1],[0,1]];
 gpu.paint(null,{cards:[{quad:q,card:{r:'A',s:'♠'}},{quad:q,face:'back'}]});gpu.paint(null,{video:{},cards:[]});
 const before=renders;const receipt=gpu.dispose();assert.equal(gpu.dispose(),receipt);assert.deepEqual(receipt,{disposed:true,resourcesDisposed:resources.length-1,contextReleased:true});for(const cb of loads)cb();assert.equal(gpu.paint(null),false);
 assert.equal(renders,before);assert.equal(loss,1);assert.ok(resources.length>10);for(const r of resources)assert.equal(r.count,1,'each unique owned resource disposed exactly once');
});
