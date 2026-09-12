"""Bounded source-relative cheek relief study; preserve original and all UV/image data."""
import bpy,json,os,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
b=Path(__file__).resolve().parent;src=b.parent/'provider-original.glb';sha=hashlib.sha256(src.read_bytes()).hexdigest();regions=json.loads((b/'cheek-regions.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(src));m=next(o for o in bpy.data.objects if o.type=='MESH');d=m.data;p=[m.matrix_world@v.co for v in d.vertices];f=Vector(regions['front']);r=Vector(regions['right']);weights={}
for i,v in enumerate(p):
 if v.dot(f)<.18:continue
 distance=min(((v.dot(r)-s['lateral'])**2+(v.z-s['z'])**2)**.5 for s in regions['samples'])
 if distance<.028:weights[i]=(1-(distance/.028)**2)**2
adj={i:set() for i in weights}
for e in d.edges:
 a,c=e.vertices
 if a in adj:adj[a].add(c)
 if c in adj:adj[c].add(a)
# Same-position seam copies share neighbours and displacement.
kd=KDTree(len(p))
for i,v in enumerate(p):kd.insert(v,i)
kd.balance();same={}
for i in weights:
 same[i]=[j for _,j,_ in kd.find_range(p[i],.000003)]
 combined=set()
 for j in same[i]:combined.update(adj.get(j,set()))
 adj[i]=combined
values=[v.dot(f) for v in p];original=values[:]
for step in range(18):
 new=values[:]
 for i,w in weights.items():
  if adj[i]:new[i]=values[i]+.55*w*(sum(values[j] for j in adj[i])/len(adj[i])-values[i])
 values=new
inverse=m.matrix_world.inverted();changes=[]
for i,w in weights.items():
 delta=max(-.003,min(.003,sum(values[j]-original[j] for j in same[i])/len(same[i])))
 d.vertices[i].co=inverse@(p[i]+f*delta);changes.append(abs(delta))
d.update();bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(b/'cheek-cleanup.blend'))
assert hashlib.sha256(src.read_bytes()).hexdigest()==sha
(b/'cleanup.json').write_text(json.dumps({'sourceSha256':sha,'affectedVertices':len(weights),'maxSourceUnitDisplacement':max(changes),'medianSourceUnitDisplacement':sorted(changes)[len(changes)//2],'scope':'Only bounded forward-axis cheek smoothing; no eye/lip/hair edits, no rig or likeness approval'},indent=2));print(len(weights),max(changes),flush=True);os._exit(0)
