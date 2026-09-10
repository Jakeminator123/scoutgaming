"""Remove imported hard-normal seams without changing the source texture or rig."""
from pathlib import Path
import bpy,bmesh,sys,json
source=Path(sys.argv[1]).resolve();dest=Path(sys.argv[2]).resolve();dest.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source));obj=next(o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers));mesh=obj.data
before=len(mesh.vertices)
def signature(v):return tuple(sorted((g.group,round(g.weight,6)) for g in v.groups))
original={}
for v in mesh.vertices:original.setdefault(tuple(round(c,6) for c in v.co),set()).add(signature(v))
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
if mesh.has_custom_normals:bpy.ops.mesh.customdata_custom_splitnormals_clear()
bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bm.to_mesh(mesh);bm.free()
for e in mesh.edges:e.use_edge_sharp=False
for p in mesh.polygons:p.use_smooth=True
mesh.update();mismatch=sum(signature(v) not in original.get(tuple(round(c,6) for c in v.co),set()) for v in mesh.vertices)
if mismatch:raise RuntimeError(f'{mismatch} vertices changed position or skin binding')
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(dest))
report={'source':str(source),'verticesBefore':before,'verticesAfter':len(mesh.vertices),'positionOrWeightMismatches':mismatch,'materials':'unchanged','status':'surface shading cleanup; not a photoreal likeness approval'}
dest.with_suffix('.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
