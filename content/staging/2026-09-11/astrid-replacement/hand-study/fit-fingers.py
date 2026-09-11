"""Fit finger controls to THIS source mesh's reviewed hand landmarks.
Original geometry/maps and non-hand weights remain untouched. Isolated candidate.
"""
import argparse, json, math
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('output');a=p.parse_args()
out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=False)
land=json.loads((Path(__file__).parent/'landmarks.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
if a.source.endswith('.blend'):bpy.ops.wm.open_mainfile(filepath=str(Path(a.source).resolve()))
else:bpy.ops.import_scene.gltf(filepath=str(Path(a.source).resolve()))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.vertex_groups]
assert len(meshes)==1,'Inspect multi-mesh inputs explicitly';mesh=meshes[0]
arm.animation_data_clear();arm.data.pose_position='REST'
points=np.array([mesh.matrix_world@v.co for v in mesh.data.vertices]);inverse=arm.matrix_world.inverted()
old_vertices=points.copy();mapping={};report={'fittingVersion':2,'membership':'Complete digit projection; no radial surface cutoff','landmarkSourceSha256':land['sourceSha256'],'hands':{},'limitations':['Measured geometric finger rig candidate; no facial or final grip approval.']}
bpy.context.view_layer.objects.active=arm;arm.select_set(True)
for side in ['right','left']:
 prefix=side.title(); hand=prefix+'Hand'; assert arm.data.bones.get(hand)
 chains={};fitted=[]
 for digit,xzs in land[side+'XZ'].items():
  xyz=[]
  for x,z in xzs:
   ds=np.linalg.norm(points[:,[0,2]]-np.array([x,z]),axis=1)
   ids=np.flatnonzero(ds<.006)
   assert len(ids)>5,f'Landmark outside actual {side} {digit} geometry'
   ys=points[ids,1];y=float((np.quantile(ys,.15)+np.quantile(ys,.85))/2)
   xyz.append(Vector((x,y,z)))
  chains[digit]=xyz;fitted.append({'digit':digit,'points':[list(v) for v in xyz]})
 bpy.ops.object.mode_set(mode='EDIT')
 names=[]
 for digit,xyz in chains.items():
  parent=arm.data.edit_bones[hand]
  for j in range(3):
   name=f'{prefix}{digit}{j+1}';b=arm.data.edit_bones.new(name)
   b.head=inverse@xyz[j];b.tail=inverse@xyz[j+1];b.parent=parent;b.use_connect=j>0
   # Palm-facing local Z: positive local X flexes into the actual palm.
   b.align_roll(inverse.to_3x3()@Vector((0,-1,0)));parent=b;names.append(name)
 bpy.ops.object.mode_set(mode='OBJECT')
 groups={n:mesh.vertex_groups.new(name=n) for n in names};hgroup=mesh.vertex_groups.get(hand);assert hgroup
 handids=[v.index for v in mesh.data.vertices if any(g.group==hgroup.index and g.weight>.1 for g in v.groups)]
 assigned=0
 for i in handids:
  v=Vector(points[i]);options=[]
  for digit,xyz in chains.items():
   lengths=[(xyz[k+1]-xyz[k]).length for k in range(3)]; cum=[0,lengths[0],lengths[0]+lengths[1]]
   for j in range(3):
    d=xyz[j+1]-xyz[j];u=((v.x-xyz[j].x)*d.x+(v.z-xyz[j].z)*d.z)/(d.x*d.x+d.z*d.z)
    closest=xyz[j]+d*min(1,max(0,u));distance=math.hypot(v.x-closest.x,v.z-closest.z)
    options.append((distance,digit,j,u,cum[j]+min(1,max(0,u))*lengths[j],lengths))
  distance,digit,j,u,s,lengths=min(options,key=lambda x:x[0])
  if j==0 and u<-.2:continue
  # A 12 mm root blend preserves webbing; adjacent joints share bend rings.
  rootBlend=min(1,max(0,(s+.001)/.012));rootBlend=rootBlend*rootBlend*(3-2*rootBlend)
  amount=rootBlend # Complete distal surface membership; never strand outer skin on Hand.
  if amount<.001:continue
  old=next(g.weight for g in mesh.data.vertices[i].groups if g.group==hgroup.index)
  hgroup.add([i],old*(1-amount),'REPLACE')
  # Linear transition around the joint, rather than hard segment ownership.
  weights={j:1.0}; jointBand=.005
  if j>0 and s-sum(lengths[:j])<jointBand:
   t=(s-sum(lengths[:j]))/jointBand;weights={j-1:(1-t)*.5,j:(1+t)*.5}
  elif j<2 and sum(lengths[:j+1])-s<jointBand:
   t=(sum(lengths[:j+1])-s)/jointBand;weights={j:(1+t)*.5,j+1:(1-t)*.5}
  for k,w in weights.items():groups[f'{prefix}{digit}{k+1}'].add([i],old*amount*w,'REPLACE')
  assigned+=1
 mapping[side]=names;report['hands'][side]={'landmarks':fitted,'affectedVertices':assigned}
arm.data.pose_position='POSE'
for pb in arm.pose.bones:pb.rotation_mode='QUATERNION';pb.rotation_quaternion=(1,0,0,0);pb.location=(0,0,0);pb.scale=(1,1,1)
assert np.max(np.abs(old_vertices-np.array([mesh.matrix_world@v.co for v in mesh.data.vertices])))==0
profile={'version':1,'status':'unreviewed new-source hand candidate','bones':{'hips':'Hips','head':'Head','leftUpperArm':'LeftArm','leftForeArm':'LeftForeArm','leftHand':'LeftHand','rightUpperArm':'RightArm','rightForeArm':'RightForeArm','rightHand':'RightHand','fingers':mapping},'limitations':report['limitations']}
# Store explicit manual controls on the actual pose bones, no baked stock action.
for side,names in mapping.items():
 for name in names:arm.pose.bones[name]['purpose']='Measured Astrid digit; local X flexion, local Z splay. Review skin before action acceptance.'
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(out/'astrid-rigged.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'astrid-rigged.glb'),export_format='GLB',export_animations=False,export_extras=True)
(out/'profile.json').write_text(json.dumps(profile,indent=2));(out/'fitting.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
