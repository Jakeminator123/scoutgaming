"""Rebuild two damaged cheek patches from surrounding curvature, preserving source."""
import bpy, numpy as np, json, hashlib, os
from pathlib import Path
from mathutils import Vector

out=Path(__file__).resolve().parent
src=out.parent/'provider-original.glb'
source_hash=hashlib.sha256(src.read_bytes()).hexdigest()
regions=json.loads((out.parent/'face-cleanup/cheek-regions.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(src))
obj=next(o for o in bpy.data.objects if o.type=='MESH')
mesh=obj.data
points=np.array([obj.matrix_world@v.co for v in mesh.vertices],dtype=float)
forward=np.array(regions['front']);right=np.array(regions['right'])
lateral=points@right; depth=points@forward; z=points[:,2]
delta=np.zeros(len(points)); blend=np.zeros(len(points))
reports=[]
for patch in regions['samples']:
    u=(lateral-patch['lateral'])/.04; v=(z-patch['z'])/.04
    radius=np.sqrt(u*u+v*v)
    basis=np.column_stack([np.ones(len(u)),u,v,u*u,u*v,v*v])
    ring=(radius>.66)&(radius<1.25)&(depth>.18)
    a=basis[ring]; b=depth[ring]; weights=np.ones(len(b))
    for _ in range(5):
        fit=np.linalg.lstsq(a*weights[:,None],b*weights,rcond=None)[0]
        residual=b-a@fit
        sigma=max(.0002,1.4826*np.median(abs(residual-np.median(residual))))
        weights=np.minimum(1,1.5*sigma/np.maximum(abs(residual),1e-9))
    weight=np.clip((1.10-radius)/.55,0,1)
    weight=weight*weight*(3-2*weight)
    weight[depth<=.18]=0
    change=np.clip(basis@fit-depth,-.006,.006)*weight
    delta+=change; blend=np.maximum(blend,weight)
    reports.append({'centre':patch,'fitSamples':int(ring.sum()),'maxDisplacement':float(abs(change).max())})
original_normals=np.array([n.vector[:] for n in mesh.corner_normals])
inverse=obj.matrix_world.inverted()
for i in np.where(blend>0)[0]:
    mesh.vertices[int(i)].co=inverse@Vector(points[i]+forward*delta[i])
mesh.update()
# Recalculate normals only around the repaired surface; keep imported normals elsewhere.
coordinates=np.array([v.co[:] for v in mesh.vertices])
triangles=np.array([p.vertices[:] for p in mesh.polygons])
face_normals=np.cross(coordinates[triangles[:,1]]-coordinates[triangles[:,0]],coordinates[triangles[:,2]]-coordinates[triangles[:,0]])
normal_sum=np.zeros_like(coordinates)
for k in range(3):np.add.at(normal_sum,triangles[:,k],face_normals)
# UV seam duplicates receive the same normal without changing topology or UVs.
_,groups=np.unique(np.round(coordinates/3e-6).astype(np.int64),axis=0,return_inverse=True)
group_sum=np.zeros((int(groups.max())+1,3));np.add.at(group_sum,groups,normal_sum)
normal_sum=group_sum[groups]
normal_sum/=np.maximum(np.linalg.norm(normal_sum,axis=1)[:,None],1e-10)
loop_ids=np.array([l.vertex_index for l in mesh.loops])
w=blend[loop_ids,None]
normals=original_normals*(1-w)+normal_sum[loop_ids]*w
normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-10)
mesh.normals_split_custom_set(normals.tolist())
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(out/'astrid-surface-repair.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'astrid-surface-repair.glb'),export_format='GLB',export_image_format='AUTO')
assert hashlib.sha256(src.read_bytes()).hexdigest()==source_hash
(out/'repair.json').write_text(json.dumps({'sourceSha256':source_hash,'vertices':len(points),'changedVertices':int((abs(delta)>1e-10).sum()),'maxSourceUnitDisplacement':float(abs(delta).max()),'patches':reports,'status':'Awaiting visual review; no rig or likeness acceptance'},indent=2))
print('Saved cheek reconstruction candidate',flush=True)
os._exit(0)
