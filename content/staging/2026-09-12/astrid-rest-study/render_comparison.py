"""Isolate actual runtime torso constants; arms remain source rest (not full game pose)."""
import bpy,math,json,os,hashlib
from pathlib import Path
from mathutils import Matrix,Vector
out=Path(__file__).resolve().parent
repo=out.parents[3]
src=repo/'content/staging/2026-09-11/astrid-replacement/inspection/rig-corrected-transfer/original-pbr-body-rig.blend'
source_sha=hashlib.sha256(src.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(src))
a=next(o for o in bpy.data.objects if o.type=='ARMATURE')
scene=bpy.context.scene
world=bpy.data.worlds.new('Diagnostic world');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.15,.15,.15,1);world.node_tree.nodes['Background'].inputs[1].default_value=.4;scene.world=world
focus=Vector((0,0,1.36))
def aim(o,target):o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
for name,pos,power,size in [('Key',(-.8,-1,2.1),65,1.1),('Fill',(.8,-.6,1.8),35,1.1),('Rim',(.3,.6,2.0),50,.9)]:
 light=bpy.data.objects.new(name,bpy.data.lights.new(name,'AREA'));scene.collection.objects.link(light);light.location=pos;light.data.energy=power;light.data.shape='DISK';light.data.size=size;aim(light,focus)
cam=bpy.data.objects.new('Fixed eye level camera',bpy.data.cameras.new('Fixed eye level camera'));scene.collection.objects.link(cam);cam.location=(0,-2.6,1.56);aim(cam,focus);cam.data.lens=65;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=6
scene.render.resolution_x=800;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
def rotate_world(name,angle):
 pb=a.pose.bones[name];world=a.matrix_world@pb.matrix
 q=Matrix.Rotation(angle,4,'X');rotated=q@world;rotated.translation=world.translation
 pb.matrix=a.matrix_world.inverted()@rotated;bpy.context.view_layer.update()
report={'source':str(src),'sourceSha256':source_sha,'scope':'Torso/head constants isolated; original rest arms, not full game idle or seating/contact acceptance','cases':{}}
for name,lean,gaze in [('runtime-torso',.4,.05),('upright-torso',.05,.05)]:
 for pb in a.pose.bones:pb.matrix_basis=Matrix.Identity(4)
 bpy.context.view_layer.update();rotate_world('Spine02',lean);rotate_world('Head',-gaze)
 points={n:list(a.matrix_world@a.pose.bones[n].head) for n in ['Hips','Spine02','Spine','Head','LeftArm','RightArm']}
 report['cases'][name]={'leanRadians':lean,'headCounterRotationRadians':gaze,'worldHeads':points}
 bpy.ops.wm.save_as_mainfile(filepath=str(out/(name+'.blend')))
 scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
assert hashlib.sha256(src.read_bytes()).hexdigest()==source_sha
(out/'comparison.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True);os._exit(0)
