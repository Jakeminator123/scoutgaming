"""Apply reviewed, versioned geometry corrections while preserving editable actions."""
import bpy,sys,json,hashlib
from pathlib import Path
from dealer_oral_fit import apply_oral_fit
from dealer_posterior_neck_fit import apply_posterior_neck_fit
from dealer_glb_materials import set_material_factor

source=Path(sys.argv[1]).resolve();output=Path(sys.argv[2]).resolve()
bpy.ops.wm.open_mainfile(filepath=str(source))
bpy.context.preferences.filepaths.save_version=0
def signature():
 return {'actions':sorted(a.name for a in bpy.data.actions),'meshes':{o.name:{'vertices':len(o.data.vertices),'polygons':len(o.data.polygons),'weights':hashlib.sha256(repr([(v.index,[(g.group,g.weight) for g in v.groups]) for v in o.data.vertices]).encode()).hexdigest()} for o in bpy.context.scene.objects if o.type=='MESH'}}
before=signature();oral=apply_oral_fit();neck=apply_posterior_neck_fit()
assert signature()==before,'Topology, weights or actions changed'
assert apply_oral_fit()['alreadyApplied'] and apply_posterior_neck_fit()['alreadyApplied']
output.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(output))
if len(sys.argv)>3:
 glb=Path(sys.argv[3]).resolve();bpy.ops.object.select_all(action='DESELECT')
 for obj in bpy.context.scene.objects:
  if obj.type in {'MESH','ARMATURE'}:obj.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_animations=False,export_morph=True,export_morph_normal=True,export_skins=True,export_materials='EXPORT')
 set_material_factor(glb,'Eyes_Blue',[1,1,1,1])
output.with_suffix('.fit-verification.json').write_text(json.dumps({'source':str(source),'output':str(output),'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'oral':oral,'posteriorNeck':neck,'topologyWeightsActionsPreserved':True,'idempotent':True,'signature':before},indent=2))
