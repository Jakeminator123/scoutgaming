"""Render a controlled, neutral head comparison from an editable dealer project."""
import bpy,sys,math
from pathlib import Path
from mathutils import Vector
source=Path(sys.argv[1]).resolve();output=Path(sys.argv[2]).resolve();output.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
scene=bpy.context.scene
for o in list(scene.objects):
 if o.type in ['LIGHT','CAMERA']:bpy.data.objects.remove(o,do_unlink=True)
arm=next(o for o in scene.objects if o.type=='ARMATURE')
if arm.animation_data:
 arm.animation_data.action=None
 for tr in arm.animation_data.nla_tracks:tr.mute=True
for b in arm.pose.bones:b.matrix_basis.identity()
bpy.context.view_layer.update()
world=bpy.data.worlds.new('Portrait_Studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.10,.12,.14,1);world.node_tree.nodes['Background'].inputs[1].default_value=.35;scene.world=world
for name,loc,power,size in [('Portrait_Key',(-.6,-.9,2.0),35,.7),('Portrait_Fill',(.7,-.4,1.6),13,.8),('Portrait_Rim',(.3,.5,1.9),35,.6)]:
 light=bpy.data.objects.new(name,bpy.data.lights.new(name,'AREA'));scene.collection.objects.link(light);light.location=loc;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(Vector((0,0,1.60))-light.location).to_track_quat('-Z','Y').to_euler()
camera=bpy.data.objects.new('Portrait_Camera',bpy.data.cameras.new('Portrait_Camera'));scene.collection.objects.link(camera);angle=math.radians(float(sys.argv[3]) if len(sys.argv)>3 else 0);camera.location=(math.sin(angle),-math.cos(angle),1.60);camera.rotation_euler=(Vector((0,0,1.60))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=85;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=6
scene.render.resolution_x=900;scene.render.resolution_y=1100;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=str(output)
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=-1
bpy.ops.render.render(write_still=True)
