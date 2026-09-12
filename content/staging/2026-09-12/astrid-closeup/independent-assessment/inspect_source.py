import bpy,json,math,os,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
out=Path(__file__).resolve().parent;source=out.parent/'provider-original.glb';original=hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(source))
mesh=next(o for o in bpy.data.objects if o.type=='MESH');points=[mesh.matrix_world@v.co for v in mesh.data.vertices];lo=Vector(tuple(min(p[k] for p in points) for k in range(3)));hi=Vector(tuple(max(p[k] for p in points) for k in range(3)));height=hi.z-lo.z;centre=(lo+hi)/2
n=len(points);parent=list(range(n))
def root(i):
 while i!=parent[i]:parent[i]=parent[parent[i]];i=parent[i]
 return i
def union(a,b):
 a,b=root(a),root(b)
 if a!=b:parent[max(a,b)]=min(a,b)
for e in mesh.data.edges:union(*e.vertices)
raw={}
for i in range(n):raw[root(i)]=raw.get(root(i),0)+1
kd=KDTree(n)
for i,p in enumerate(points):kd.insert(p,i)
kd.balance()
for i,p in enumerate(points):
 for _,j,d in kd.find_range(p,height*3e-6):union(i,j)
components={}
for i in range(n):components.setdefault(root(i),[]).append(i)
report={'sourceSha256':original,'vertices':n,'polygons':len(mesh.data.polygons),'polygonSizes':sorted(set(len(p.vertices) for p in mesh.data.polygons)),'rawComponents':sorted(raw.values(),reverse=True),'weldedComponents':[{'count':len(ids),'min':[min(points[i][k] for i in ids) for k in range(3)],'max':[max(points[i][k] for i in ids) for k in range(3)]} for ids in sorted(components.values(),key=len,reverse=True)],'bounds':[list(lo),list(hi)],'morphs':list(mesh.data.shape_keys.key_blocks.keys()) if mesh.data.shape_keys else [],'armatures':sum(o.type=='ARMATURE' for o in bpy.data.objects),'images':[{'name':i.name,'size':list(i.size)} for i in bpy.data.images]}
(out/'geometry.json').write_text(json.dumps(report,indent=2))
scene=bpy.context.scene;w=bpy.data.worlds.new('Independent neutral studio');w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.16,.16,.16,1);w.node_tree.nodes['Background'].inputs[1].default_value=.4;scene.world=w
focus=centre
for name,offset,power in [('Key',(.8,-.55,.8),35),('Fill',(.6,.6,.45),17),('Rim',(-.5,.3,.75),25)]:
 l=bpy.data.objects.new(name,bpy.data.lights.new(name,'AREA'));scene.collection.objects.link(l);l.location=centre+Vector(offset)*height;l.data.energy=power*(height/1.73)**2;l.data.shape='DISK';l.data.size=height*.7;l.rotation_euler=(focus-l.location).to_track_quat('-Z','Y').to_euler()
cam=bpy.data.objects.new('Independent camera',bpy.data.cameras.new('Independent camera'));scene.collection.objects.link(cam);cam.data.type='ORTHO';cam.data.ortho_scale=height*1.10;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=6;scene.render.resolution_x=scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.render.image_settings.file_format='PNG'
forward=mesh.matrix_world.to_3x3()@Vector((1,0,0));aligned=math.degrees(math.atan2(forward.x,-forward.y))
report['alignedCameraAngleDegrees']=aligned
clay=bpy.data.materials.new('Diagnostic clay override');clay.use_nodes=True;clay.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.45,.45,.45,1);clay.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.8
for name,angle in [('front',90),('three-quarter',135),('aligned-front',aligned),('clay-front',aligned)]:
 scene.view_layers[0].material_override=clay if name=='clay-front' else None
 theta=math.radians(angle);cam.location=focus+Vector((math.sin(theta),-math.cos(theta),0))*height*2;cam.rotation_euler=(focus-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
(out/'geometry.json').write_text(json.dumps(report,indent=2))
assert hashlib.sha256(source.read_bytes()).hexdigest()==original
print(json.dumps({k:v for k,v in report.items() if k!='rawComponents'}),flush=True);os._exit(0)
