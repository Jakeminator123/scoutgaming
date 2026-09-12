import bpy,json,os,math
from pathlib import Path
from mathutils import Vector
b=Path(__file__).resolve().parent;bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(b.parent/'provider-original.glb'))
m=next(o for o in bpy.data.objects if o.type=='MESH');p=[m.matrix_world@v.co for v in m.data.vertices];lo=Vector([min(v[k] for v in p) for k in range(3)]);hi=Vector([max(v[k] for v in p) for k in range(3)]);c=(lo+hi)/2;f=(m.matrix_world.to_3x3()@Vector((1,0,0))).normalized();r=Vector((-f.y,f.x,0));h=hi.z-lo.z
samples=[]
for px,py in [(447,399),(580,399)]:
 u=(px/1000-.5)*h*1.1+c.dot(r);z=(.5-py/1000)*h*1.1+c.z
 ids=[i for i,v in enumerate(p) if ((v.dot(r)-u)**2+(v.z-z)**2)**.5<.028]
 depths=sorted(p[i].dot(f) for i in ids)
 samples.append({'pixel':[px,py],'lateral':u,'z':z,'count':len(ids),'depthRange':[depths[0],depths[-1]],'depthQuartiles':[depths[int((len(depths)-1)*q)] for q in [.25,.5,.75]]})
(b/'cheek-regions.json').write_text(json.dumps({'front':list(f),'right':list(r),'centre':list(c),'samples':samples},indent=2));print(json.dumps(samples),flush=True);os._exit(0)
