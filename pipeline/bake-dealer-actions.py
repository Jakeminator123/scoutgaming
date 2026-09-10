"""Bake inspected Three.js bone poses into the same editable Blender armature.

Rest-axis corrections are measured per bone; no guessed coordinate conversions.
"""
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Matrix,Vector

folder=Path(sys.argv[1]).resolve()
bpy.ops.wm.open_mainfile(filepath=str(folder/'astrid-rigged.blend'))
data=json.loads((folder/'motion-samples.json').read_text())
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
arm.animation_data_create()
conversion=Matrix.Rotation(math.pi/2,4,'X')
def matrix(values):return Matrix([values[i:i+4] for i in range(0,16,4)]).transposed()
bind={b.name:b.matrix_local.copy() for b in arm.data.bones}
correction={name:(conversion@matrix(m)).inverted()@(arm.matrix_world@bind[name]) for name,m in data['rest'].items()}
inv_arm=arm.matrix_world.inverted()
actions=[]
for seat, specification in enumerate(data['actions']):
    action=bpy.data.actions.new(specification['name'])
    action.use_fake_user=True
    arm.animation_data.action=action
    for sample in (s for s in data['samples'] if s['seat']==seat):
        frame=sample['frame']
        poses={n:inv_arm@conversion@matrix(m)@correction[n] for n,m in sample['bones'].items()}
        for b in arm.pose.bones:
            desired=poses[b.name]
            if b.parent:
                basis=bind[b.name].inverted()@bind[b.parent.name]@poses[b.parent.name].inverted()@desired
            else:basis=bind[b.name].inverted()@desired
            b.rotation_mode='QUATERNION';b.matrix_basis=basis
            for key in ['location','rotation_quaternion','scale']:
                b.keyframe_insert(key,frame=frame,group=b.name)
    actions.append(action)
arm.animation_data.action=actions[3]
scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=max(s['frame'] for s in data['samples']);scene.render.fps=30;scene.frame_set(1)
scene['animation_status']='Twelve dealing, reveal, collection and greeting studies. Numeric reach verified, visual skin/contact not approved. No facial/lip sync animation.'
# A delivery camera and lighting make the editable project immediately inspectable.
camera=bpy.data.objects.new('Dealer_Review_Camera',bpy.data.cameras.new('Dealer_Review_Camera'))
scene.collection.objects.link(camera);camera.location=(0,-3.0,1.65);camera.rotation_euler=(Vector((0,0,1.0))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=45;scene.camera=camera
for name,location,power in [('Key',(-2,-3,4),450),('Fill',(2,-2,2.5),180),('Rim',(0,2,3),300)]:
    light=bpy.data.objects.new(name,bpy.data.lights.new(name,'AREA'));scene.collection.objects.link(light);light.location=location;light.data.energy=power;light.data.shape='DISK';light.data.size=3;light.rotation_euler=(Vector((0,0,1))-light.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='BLENDER_EEVEE_NEXT';scene.render.resolution_x=960;scene.render.resolution_y=720;scene.render.resolution_percentage=100
bpy.ops.wm.save_as_mainfile(filepath=str(folder/'astrid-animated.blend'))
bpy.ops.export_scene.gltf(filepath=str(folder/'astrid-animated.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_extras=True,export_cameras=False,export_lights=False)
print(json.dumps({'actions':[a.name for a in actions],'frames':scene.frame_end,'fps':30,'blend':str(folder/'astrid-animated.blend'),'glb':str(folder/'astrid-animated.glb')}))
