"""Add reusable IK controls to a separate native source, preserving rest skin."""
import bpy,sys,json,os,runpy
from pathlib import Path
from mathutils import Vector
source=Path(sys.argv[1]).resolve();output=Path(sys.argv[2]).resolve()
assert not output.exists()
bpy.ops.wm.open_mainfile(filepath=str(source))
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
assert not any(o.name.startswith('CTRL_') for o in bpy.data.objects)
# Provider imported bone tails are 100x longer than their anatomical segments.
# Set length only; preserve rest orientation/head and therefore skin rest matrices.
rest={b.name:b.matrix_local.copy() for b in arm.data.bones}
mesh=max((o for o in bpy.data.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices))
def skin():
 bpy.context.view_layer.update();e=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());data=e.to_mesh();points=[e.matrix_world@v.co for v in data.vertices];e.to_mesh_clear();return points
original_skin=skin()
bpy.context.view_layer.objects.active=arm;arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for side in ['Left','Right']:
 for first,second in [('Arm','ForeArm'),('ForeArm','Hand'),('UpLeg','Leg'),('Leg','Foot')]:
  bone=arm.data.edit_bones[side+first];end=arm.data.edit_bones[side+second].head
  bone.length=(end-bone.head).length
bpy.ops.object.mode_set(mode='OBJECT')
matrix_residual=max(abs(b.matrix_local[r][c]-rest[b.name][r][c]) for b in arm.data.bones for r in range(4) for c in range(4))
print('Native rest matrix residual',matrix_residual,flush=True)
skin_residual=max((a-b).length for a,b in zip(original_skin,skin()))
print('World skin residual mm',skin_residual*1000,flush=True)
assert skin_residual<.00001
collection=bpy.data.collections.new('DEALER_CONTROLS');bpy.context.scene.collection.children.link(collection)
def control(name,matrix,size=.075):
 o=bpy.data.objects.new(name,None);collection.objects.link(o);o.matrix_world=matrix;o.empty_display_type='CIRCLE';o.empty_display_size=size;o.show_in_front=True;o.rotation_mode='QUATERNION';return o
body=control('CTRL_BODY',arm.matrix_world,.2);body['purpose']='Move and rotate the whole dealer'
world=arm.matrix_world.copy();arm.parent=body;arm.matrix_world=world
for side in ['Left','Right']:
 for kind,upper,lower,end in [('WRIST','Arm','ForeArm','Hand'),('FOOT','UpLeg','Leg','Foot')]:
  target=control('CTRL_'+side.upper()+'_'+kind,arm.matrix_world@arm.pose.bones[side+end].matrix)
  target['IK']=0.0;target.id_properties_ui('IK').update(min=0,max=1)
  target['purpose']='Match current FK pose using Dealer panel, then move/rotate and key this target'
  pole=control('CTRL_'+side.upper()+('_ELBOW' if kind=='WRIST' else '_KNEE'),arm.matrix_world@arm.pose.bones[side+lower].matrix,.04)
  pole.location+=Vector((0,-.25,0))
  for o in [target,pole]:
   w=o.matrix_world.copy();o.parent=body;o.matrix_world=w
  ik=arm.pose.bones[side+lower].constraints.new('IK');ik.name='Dealer manual '+kind;ik.target=target;ik.pole_target=pole;ik.chain_count=2;ik.use_stretch=False
  rotation=arm.pose.bones[side+end].constraints.new('COPY_ROTATION');rotation.name='Dealer target orientation';rotation.target=target;rotation.target_space='WORLD';rotation.owner_space='WORLD'
  for c in [ik,rotation]:
   driver=c.driver_add('influence').driver;driver.type='SCRIPTED';driver.expression='blend'
   v=driver.variables.new();v.name='blend';v.type='SINGLE_PROP';v.targets[0].id=target;v.targets[0].data_path='["IK"]'
bpy.context.view_layer.update()
repo=Path(__file__).resolve().parents[5]
panel=repo/'pipeline/dealer-ik-panel.py'
assert panel.exists(),str(panel)
text=bpy.data.texts.new('Dealer movement controls.py');text.write(panel.read_text())
api=runpy.run_path(str(panel));report=[]
for side in ['Left','Right']:
 for kind in ['WRIST','FOOT']:
  baseline={b.name:(arm.matrix_world@b.head).copy() for b in arm.pose.bones}
  residual=api['snap_ik'](arm,side,kind)
  change=max((arm.matrix_world@b.head-baseline[b.name]).length for b in arm.pose.bones)
  assert change<.001,(side,kind,change)
  report.append({'side':side,'kind':kind,'snapResidualMm':residual*1000,'maxAllBoneChangeMm':change*1000})
  bpy.data.objects['CTRL_'+side.upper()+'_'+kind]['IK']=0.;api['refresh'](bpy.data.objects['CTRL_'+side.upper()+'_'+kind])
output.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(output))
output.with_suffix('.json').write_text(json.dumps({'source':str(source),'checks':report,'restSkinResidualMm':skin_residual*1000,'nativeMatrixResidual':matrix_residual,'scope':'Rest pose IK matching only; no full motion or visual acceptance'},indent=2))
print(json.dumps(report),flush=True);os._exit(0)
