"""Bake the original Tripo into metres/front +Z without re-encoding PBR maps."""
import json,struct,hashlib
from pathlib import Path
import numpy as np

root=Path(__file__).resolve().parent
source=root/'triangle-source/provider-original.glb'
output=root/'canonical-source';output.mkdir(exist_ok=True)
target=output/'original-canonical.glb'
if target.exists():raise FileExistsError(target)
raw=source.read_bytes();length,kind=struct.unpack_from('<II',raw,12)
assert kind==0x4e4f534a
doc=json.loads(raw[20:20+length]);start=20+length
size,kind=struct.unpack_from('<II',raw,start);assert kind==0x004e4942
binary=bytearray(raw[start+8:start+8+size]);original_binary=bytes(binary)
assert len(doc['nodes'])==1 and len(doc['meshes'])==1 and not doc.get('skins')
node=doc['nodes'][0];assert node['mesh']==0
assert len(doc['meshes'][0]['primitives'])==1
attributes=doc['meshes'][0]['primitives'][0]['attributes']
matrix=np.array(node['matrix']).reshape((4,4),order='F')
def read_accessor(index,width):
 a=doc['accessors'][index];assert a['componentType']==5126 and 'sparse' not in a
 view=doc['bufferViews'][a['bufferView']];assert view.get('buffer',0)==0
 offset=view.get('byteOffset',0)+a.get('byteOffset',0);stride=view.get('byteStride',width*4)
 return a,offset,stride,np.array([struct.unpack_from('<'+'f'*width,binary,offset+i*stride) for i in range(a['count'])])
a,offset,stride,positions=read_accessor(attributes['POSITION'],3)
world=np.c_[positions,np.ones(len(positions))]@matrix.T
lo=world[:,:3].min(axis=0);hi=world[:,:3].max(axis=0)
centre=(lo+hi)/2;scale=1.73/(hi[1]-lo[1])
rotation=np.array([[0,0,-1],[0,1,0],[1,0,0]],dtype=float)
translation=np.array([-centre[0],-lo[1],-centre[2]])
canonical=(world[:,:3]+translation)*scale@rotation.T
for i,p in enumerate(canonical):struct.pack_into('<fff',binary,offset+i*stride,*p)
a['min']=canonical.min(axis=0).tolist();a['max']=canonical.max(axis=0).tolist()
na,no,ns,normals=read_accessor(attributes['NORMAL'],3)
normals=normals@np.linalg.inv(matrix[:3,:3])@rotation.T
normals/=np.linalg.norm(normals,axis=1)[:,None]
for i,n in enumerate(normals):struct.pack_into('<fff',binary,no+i*ns,*n)
if 'min' in na:na['min']=normals.min(axis=0).tolist()
if 'max' in na:na['max']=normals.max(axis=0).tolist()
node['matrix']=np.eye(4).flatten(order='F').tolist()
images=[]
for image in doc['images']:
 v=doc['bufferViews'][image['bufferView']];o=v.get('byteOffset',0);n=v['byteLength']
 assert binary[o:o+n]==original_binary[o:o+n]
 images.append(hashlib.sha256(binary[o:o+n]).hexdigest())
ua,uo,us,uv=read_accessor(attributes['TEXCOORD_0'],2)
assert all(binary[uo+i*us:uo+i*us+8]==original_binary[uo+i*us:uo+i*us+8] for i in range(ua['count']))
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
result=struct.pack('<III',0x46546c67,2,12+8+len(encoded)+8+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary
target.write_bytes(result)
# Original Blender world -> canonical Blender world, for measured finger landmarks.
blender=np.array([[0,scale,0,scale*centre[2]],[-scale,0,0,scale*centre[0]],[0,0,scale,-scale*lo[1]],[0,0,0,1]])
report={'sourceSha256':hashlib.sha256(raw).hexdigest(),'canonicalSha256':hashlib.sha256(result).hexdigest(),
 'uniformScale':scale,'originalGltfWorldMin':lo.tolist(),'originalGltfWorldMax':hi.tolist(),
 'originalBlenderWorldToCanonicalBlenderWorld':blender.tolist(),'canonicalGltfMin':a['min'],'canonicalGltfMax':a['max'],
 'vertices':len(positions),'originalPbrImageHashesPreserved':images,'uvBytesPreserved':True,
 'topologyAndMaterialDefinitionsPreserved':True,'front':'glTF +Z / Blender -Y','rigged':False}
(output/'normalization.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
