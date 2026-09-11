"""Transfer verified body weights to the intact original Tripo mesh and PBR."""
import bpy, math, json, hashlib, sys, os
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.kdtree import KDTree

root=Path(__file__).resolve().parent
out=root/'rig-corrected-transfer'
out.mkdir(exist_ok=True)
target=out/'original-pbr-body-rig.blend'
if target.exists():raise FileExistsError(target)
bpy.ops.wm.open_mainfile(filepath=str(root/'rig-corrected-review/candidate-packed.blend'))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
provider=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o.vertex_groups)
arm.animation_data_clear()
for bone in arm.pose.bones:bone.matrix_basis.identity()
for action in list(bpy.data.actions):bpy.data.actions.remove(action)
bpy.context.view_layer.update()
provider_points=[provider.matrix_world@v.co for v in provider.data.vertices]
with bpy.data.libraries.load(str(root/'canonical-review/candidate-packed.blend'),link=False) as (data,loaded):
 loaded.objects=data.objects
source=next(o for o in loaded.objects if o.type=='MESH')
bpy.context.scene.collection.objects.link(source)
bpy.context.view_layer.update()
source_points=[source.matrix_world@v.co for v in source.data.vertices]
def bounds(points):
 return Vector([min(p[i] for p in points) for i in range(3)]),Vector([max(p[i] for p in points) for i in range(3)])
sl,sh=bounds(source_points);pl,ph=bounds(provider_points)
scale=(ph.z-pl.z)/(sh.z-sl.z)
translation=(pl+ph)/2-(sl+sh)/2*scale
transform=Matrix.Translation(translation)@Matrix.Scale(scale,4)
used_provider={i for poly in provider.data.polygons for i in poly.vertices}
tree=KDTree(len(used_provider))
for i in used_provider:tree.insert(provider_points[i],i)
tree.balance()
# Fit one uniform similarity transform, rather than trusting remeshed extrema.
sample=np.array([list(p) for p in source_points[::4]],dtype=float)
for _ in range(10):
 destinations=np.array([list(tree.find(transform@Vector(p))[0]) for p in sample])
 a=sample-sample.mean(axis=0);b=destinations-destinations.mean(axis=0)
 u,s,vt=np.linalg.svd(a.T@b)
 correction=np.eye(3);correction[2,2]=np.linalg.det(vt.T@u.T)
 rotation=vt.T@correction@u.T
 scale=float(np.sum(s*np.diag(correction))/np.sum(a*a))
 offset=destinations.mean(axis=0)-scale*rotation@sample.mean(axis=0)
 transform=Matrix.Identity(4)
 for i in range(3):
  for j in range(3):transform[i][j]=scale*rotation[i,j]
  transform[i][3]=offset[i]
translation=Vector(offset)
mapped=[];distances=[];ambiguous=0
def weights(index):return {g.group:g.weight for g in provider.data.vertices[index].groups}
for point in source_points:
 aligned=transform@point
 _,index,distance=tree.find(aligned)
 mapped.append(index);distances.append(distance)
 chosen=weights(index)
 for _,other,_ in tree.find_range(aligned,max(distance+1e-7,1e-6)):
  alternatives=weights(other)
  if max([abs(chosen.get(k,0)-alternatives.get(k,0)) for k in set(chosen)|set(alternatives)]+[0])>1e-4:
   ambiguous+=1;break
diagnostics={'referencedProviderVertices':len(used_provider),'totalProviderVertices':len(provider_points),
 'maxMm':max(distances)*1000,'percentilesMm':np.percentile(distances,[50,95,99,99.9]).tolist(),
 'transform':[list(row) for row in transform],
 'worst':[{'sourceIndex':int(i),'point':list(source_points[i]),'distanceMm':distances[i]*1000,
           'weights':{provider.vertex_groups[k].name:v for k,v in weights(mapped[i]).items()}}
          for i in np.argsort(distances)[-12:]],'ambiguous':ambiguous}
diagnostics['percentilesMm']=[x*1000 for x in diagnostics['percentilesMm']]
(out/'alignment-diagnostics.json').write_text(json.dumps(diagnostics,indent=2))
# The provider shifts a small subset of source surface vertices by up to 1 mm.
# This is approximate weight sampling, not an assertion of identical vertices.
# The canonical geometry stays fixed and distant-region deformation is checked.
if max(distances)>.00101:raise ValueError(f'Alignment exceeds 1.01mm; see diagnostics: {max(distances)*1000}')
if ambiguous:raise ValueError(f'{ambiguous} ambiguous spatial weight matches')
mesh=source.data
original_counts=(len(mesh.vertices),len(mesh.polygons),len(mesh.loops))
original_uv=[[tuple(loop.uv) for loop in layer.data] for layer in mesh.uv_layers]
original_images={i.name:hashlib.sha256(i.packed_file.data).hexdigest() for i in bpy.data.images if i.packed_file and i.name.startswith(('Color_','ORM_','NormalGL_'))}
mesh.transform(source.matrix_world)
source.matrix_world=Matrix.Identity(4)
source.name='Astrid_Original_Tripo'
groups={g.index:source.vertex_groups.new(name=g.name) for g in provider.vertex_groups}
for vi,pi in enumerate(mapped):
 for group,weight in weights(pi).items():groups[group].add([vi],weight,'REPLACE')
modifier=source.modifiers.new('Transferred original body rig','ARMATURE');modifier.object=arm
bpy.data.objects.remove(provider,do_unlink=True)
# Keep the canonical source geometry fixed; align the provider's skeleton to it.
source.matrix_world=Matrix.Identity(4)
arm.matrix_world=transform.inverted()@arm.matrix_world
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get();evaluated=source.evaluated_get(deps);em=evaluated.to_mesh()
expected=source_points
rest_error=max((evaluated.matrix_world@v.co-expected[i]).length for i,v in enumerate(em.vertices))
evaluated.to_mesh_clear()
if rest_error>.00005:raise ValueError(f'Rest deformation exceeds 0.05mm: {rest_error*1000}')
assert original_counts==(len(mesh.vertices),len(mesh.polygons),len(mesh.loops))
assert original_uv==[[tuple(loop.uv) for loop in layer.data] for layer in mesh.uv_layers]
assert original_images=={i.name:hashlib.sha256(i.packed_file.data).hexdigest() for i in bpy.data.images if i.packed_file and i.name.startswith(('Color_','ORM_','NormalGL_'))}
for obj in bpy.context.scene.objects:obj.select_set(False)
source.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1
bpy.context.scene['candidate_scope']=f'Original Tripo mesh and PBR with spatial {len(arm.data.bones)}-bone body weights. No fingers, eyes, jaw or facial controls yet.'
bpy.ops.wm.save_as_mainfile(filepath=str(target))
bpy.ops.export_scene.gltf(filepath=str(out/'original-pbr-body-rig.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True)
report={'sourceGeometryCounts':original_counts,'providerAlignmentScale':scale,'providerAlignmentTranslation':list(translation),'sourceGeometryTransform':'identity in canonical Blender world',
 'canonicalSourceToProviderWorld':[list(row) for row in transform],
 'mappedVertices':len(mapped),'maxMappingErrorMm':max(distances)*1000,'meanMappingErrorMm':sum(distances)/len(distances)*1000,'mappingToleranceMm':1.01,
 'ambiguousMappings':ambiguous,'maxRestSkinErrorMm':rest_error*1000,'originalUvPreserved':True,'originalPackedImages':original_images,
 'boneCount':len(arm.data.bones),'actions':len(bpy.data.actions),'jointProfile':{b.name:list(arm.matrix_world@b.head_local) for b in arm.data.bones},
 'limitations':['No finger or face controls.','No blackjack contact or broad deformation approval.','Provider armature aligned to unchanged canonical source; original source files unchanged.']}
(out/'transfer-verification.json').write_text(json.dumps(report,indent=2))
# One reproducible elbow bend for visual inspection; source rig file stays at rest.
arm.pose.bones['LeftForeArm'].rotation_mode='XYZ'
arm.pose.bones['LeftForeArm'].rotation_euler.z=math.radians(55)
bpy.context.view_layer.update()
evaluated=source.evaluated_get(bpy.context.evaluated_depsgraph_get());em=evaluated.to_mesh()
moved=[evaluated.matrix_world@v.co for v in em.vertices]
evaluated.to_mesh_clear()
far=[i for i,p in enumerate(source_points) if p.x<-.04 or p.z<.70 or p.z>1.52]
far_error=max((moved[i]-source_points[i]).length for i in far)
report['elbowBendTest']={'bone':'LeftForeArm','localAxis':'Z','degrees':55,'farRegionVertices':len(far),'maxFarRegionMovementMm':far_error*1000}
(out/'transfer-verification.json').write_text(json.dumps(report,indent=2))
if far_error>.002:raise ValueError(f'Unrelated body regions move during elbow bend: {far_error*1000}mm')
bpy.ops.wm.save_as_mainfile(filepath=str(out/'arm-bend-study.blend'))
print(json.dumps({k:v for k,v in report.items() if k not in ['jointProfile','originalPackedImages']}))
sys.stdout.flush();os._exit(0)
