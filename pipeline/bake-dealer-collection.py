"""Append the inspected collection sweep and independent neutral card helpers.

The twelve existing body actions remain editable. The separate GLB carries one
synchronized sweep clip; card helpers contain no game-generated card faces.
"""
import bpy,json,math,sys,hashlib,subprocess
from pathlib import Path
from mathutils import Matrix,Vector
root=Path(__file__).resolve().parents[1];folder=Path(sys.argv[1]).resolve()
data=json.loads((folder/'motion-samples.json').read_text())
model=root/'web/public/dealers/astrid/rig/face-study/astrid-rigged.glb'
if hashlib.sha256(model.read_bytes()).hexdigest()!=data['modelSha256']:raise ValueError('Collection was measured on another model')
bpy.ops.wm.open_mainfile(filepath=str(root/'assets/astrid-3d/anatomical/astrid-animated.blend'))
scene=bpy.context.scene;arm=next(o for o in scene.objects if o.type=='ARMATURE');original={a.name for a in bpy.data.actions}
assert len(original)==12,original
arm.animation_data_create();arm.animation_data.action=None
for track in list(arm.animation_data.nla_tracks):arm.animation_data.nla_tracks.remove(track)
conversion=Matrix.Rotation(math.pi/2,4,'X')
def matrix(values):return Matrix([values[i:i+4] for i in range(0,16,4)]).transposed()
bind={b.name:b.matrix_local.copy() for b in arm.data.bones};inv_arm=arm.matrix_world.inverted()
correction={n:(conversion@matrix(m)).inverted()@(arm.matrix_world@bind[n]) for n,m in data['rest'].items()}
name=data['actions'][0]['name'];action=bpy.data.actions.new(name);action.use_fake_user=True;arm.animation_data.action=action
for sample in data['samples']:
 poses={n:inv_arm@conversion@matrix(m)@correction[n] for n,m in sample['bones'].items()}
 for b in arm.pose.bones:
  if b.name not in poses:continue
  desired=poses[b.name]
  basis=bind[b.name].inverted()@bind[b.parent.name]@poses[b.parent.name].inverted()@desired if b.parent else bind[b.name].inverted()@desired
  b.rotation_mode='QUATERNION';b.matrix_basis=basis
  for key in ['location','rotation_quaternion','scale']:b.keyframe_insert(key,frame=sample['frame'],group=b.name)
def linear(action):
 for layer in action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for curve in bag.fcurves:
     for point in curve.keyframe_points:point.interpolation='LINEAR'
def track(obj,action):
 linear(action);tr=obj.animation_data.nla_tracks.new();tr.name=name;tr.strips.new(action.name,1,action);obj.animation_data.action=None
track(arm,action)
collection=bpy.data.collections.new('COLLECTION_CARD_HELPERS');scene.collection.children.link(collection)
material=bpy.data.materials.new('Neutral collection study card');material.diffuse_color=(.78,.76,.69,1);material.use_nodes=True;material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.78,.76,.69,1);material.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.75
cards={}
for spec in data['cards']:
 bpy.ops.mesh.primitive_cube_add(size=1);obj=bpy.context.object;obj.name=f'Collection_Card_{spec["id"]:02d}';obj.dimensions=(.063,.088,.0007);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 for old in list(obj.users_collection):old.objects.unlink(obj)
 collection.objects.link(obj);obj.data.materials.append(material);obj['study_card_id']=spec['id'];obj['purpose']='Independent neutral collection helper; no game card face or value'
 obj.animation_data_create();a=bpy.data.actions.new(f'Sweep_Card_{spec["id"]:02d}');a.use_fake_user=True;obj.animation_data.action=a
 for sample in data['samples']:
  state=next(c for c in sample['cards'] if c['id']==spec['id']);obj.location=conversion.to_3x3()@Vector(state['position']);obj.rotation_euler=(0,0,state['yaw']);obj.keyframe_insert('location',frame=sample['frame']);obj.keyframe_insert('rotation_euler',frame=sample['frame'])
 track(obj,a);cards[spec['id']]=obj
scene.render.fps=data['fps'];scene.frame_start=1;scene.frame_end=max(s['frame'] for s in data['samples'])
max_bone=max_card=0
for sample in data['samples']:
 scene.frame_set(sample['frame']);bpy.context.view_layer.update()
 for n,m in sample['bones'].items():
  actual=arm.matrix_world@arm.pose.bones[n].matrix;expected=conversion@matrix(m)@correction[n];max_bone=max(max_bone,(actual.translation-expected.translation).length)
 for c in sample['cards']:max_card=max(max_card,(cards[c['id']].matrix_world.translation-conversion.to_3x3()@Vector(c['position'])).length)
assert max_bone<.00002,max_bone
assert max_card<.000002,max_card
assert original.issubset({a.name for a in bpy.data.actions})
scene['animation_status']='Thirteen editable body studies. Active timeline collects sixteen independent neutral cards into one stack. Runtime visual review remains separate.'
scene['collection_source_model_sha256']=data['modelSha256'];scene.frame_set(1)
bpy.context.preferences.filepaths.save_version=0;bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(folder/'astrid-collection-sweep.blend'),compress=True)
(folder/'native-verification.json').write_text(json.dumps({'originalBodyActions':sorted(original),'newBodyAction':name,'cardHelpers':len(cards),'frames':len(data['samples']),'fps':data['fps'],'maxBonePositionErrorM':max_bone,'maxCardPositionErrorM':max_card,'sourceModelSha256':data['modelSha256'],'status':'native frame correspondence verified; GLB and visible collection review separate'},indent=2))
# The public glTF rest matrices exactly match the measured source. Attach the
# verified transforms directly, preserving its geometry, skin and materials,
# rather than reevaluating every mesh for each independent card NLA track.
subprocess.run(['node',str(root/'pipeline/export-dealer-collection.mjs'),str(folder)],check=True)
print('Saved collection project and GLB',max_bone,max_card,flush=True)
