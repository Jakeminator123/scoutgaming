import fs from 'node:fs';
import * as T from '../web/public/vendor/three/three.module.js';
import {controlDealer} from '../web/public/dealer-rig.mjs';

// Geometry-only glTF loading for independent CPU skin checks; no browser/image mocks.
export function loadRigGeometry(file,profile){
const bytes=fs.readFileSync(file);
const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
const joints=new Set(json.skins.flatMap(s=>s.joints)),nodes=json.nodes.map((n,i)=>{const o=joints.has(i)?new T.Bone():new T.Group();o.name=n.name??`node${i}`;if(n.matrix){o.matrix.fromArray(n.matrix);o.matrix.decompose(o.position,o.quaternion,o.scale);}else{if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);}return o;});
json.nodes.forEach((n,i)=>n.children?.forEach(c=>nodes[i].add(nodes[c])));const root=new T.Group();for(const i of json.scenes[json.scene??0].nodes)root.add(nodes[i]);root.updateMatrixWorld(true);
// Load actual skin geometry as well as joints so contact follows deformed vertices.
const bin=bytes.subarray(28+bytes.readUInt32LE(12));
function accessor(index){const a=json.accessors[index],view=json.bufferViews[a.bufferView],size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],component={5126:4,5123:2,5121:1}[a.componentType],read={5126:'readFloatLE',5123:'readUInt16LE',5121:'readUInt8'}[a.componentType],offset=(view.byteOffset??0)+(a.byteOffset??0),stride=view.byteStride??size*component;const values=new Float32Array(a.count*size);for(let i=0;i<a.count;i++)for(let j=0;j<size;j++)values[i*size+j]=bin[read](offset+i*stride+j*component)/(a.normalized?(a.componentType===5123?65535:255):1);return{values,size};}
for(const [index,node] of json.nodes.entries())if(node.mesh!==undefined&&node.skin!==undefined){
 const skin=json.skins[node.skin],inverse=accessor(skin.inverseBindMatrices).values,skeleton=new T.Skeleton(skin.joints.map(i=>nodes[i]),skin.joints.map((_,i)=>new T.Matrix4().fromArray(inverse,i*16)));
 for(const primitive of json.meshes[node.mesh].primitives){const geometry=new T.BufferGeometry();for(const [name,key] of [['position','POSITION'],['skinIndex','JOINTS_0'],['skinWeight','WEIGHTS_0']]){const a=accessor(primitive.attributes[key]);geometry.setAttribute(name,new T.BufferAttribute(a.values,a.size));}const mesh=new T.SkinnedMesh(geometry,new T.MeshBasicMaterial());nodes[index].add(mesh);mesh.bind(skeleton,new T.Matrix4());}
}
root.updateMatrixWorld(true);
const rig=controlDealer(root,profile);
return{rig,root,json};
}
