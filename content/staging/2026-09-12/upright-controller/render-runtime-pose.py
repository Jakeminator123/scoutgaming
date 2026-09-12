"""Render actual private controller bone matrices against unchanged rejected V1 source."""
import bpy,json,math,os
from pathlib import Path
from mathutils import Matrix,Vector
out=Path(__file__).resolve().parent;repo=out.parents[3]
src=repo/'content/staging/2026-09-11/astrid-replacement/hand-study/finger-candidate-v1/astrid-rigged.blend'
poses=json.loads((out/'poses.json').read_text());bpy.ops.wm.open_mainfile(filepath=str(src));a=next(o for o in bpy.data.objects if o.type=='ARMATURE');native={b.name:(a.matrix_world@b.matrix).copy() for b in a.pose.bones};C=Matrix.Rotation(math.pi/2,4,'X')
def fromthree(v):return Matrix([v[i:i+4] for i in range(0,16,4)]).transposed()
scene=bpy.context.scene
world=bpy.data.worlds.new('Pose review world');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.15,.15,.15,1);world.node_tree.nodes['Background'].inputs[1].default_value=.3;scene.world=world
focus=Vector((0,-.05,1.21))
def aim(o):o.rotation_euler=(focus-o.location).to_track_quat('-Z','Y').to_euler()
for name,loc,power in [('Key',(-.8,-1,2),45),('Fill',(.8,-.6,1.8),22),('Rim',(.3,.6,2),30)]:
 l=bpy.data.objects.new(name,bpy.data.lights.new(name,'AREA'));scene.collection.objects.link(l);l.location=loc;l.data.energy=power;l.data.shape='DISK';l.data.size=1;aim(l)
cam=bpy.data.objects.new('Eye level camera',bpy.data.cameras.new('Eye level camera'));scene.collection.objects.link(cam);cam.location=(0,-2.25,1.48);aim(cam);cam.data.lens=58;scene.camera=cam
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,-.36,.89055));table=bpy.context.object;table.name='Diagnostic felt plane, not game table';table.dimensions=(2.2,1.08,.04);mat=bpy.data.materials.new('Diagnostic felt');mat.diffuse_color=(.012,.045,.035,1);table.data.materials.append(mat)
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=6;scene.render.resolution_x=1000;scene.render.resolution_y=850;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.render.image_settings.file_format='PNG'
checks={}
for key,name in [('0','upright-idle'),('0.69','centre-release')]:
 for pb in a.pose.bones:
  rest=fromthree(poses['rest']['bones'][pb.name]['world']);new=fromthree(poses[key]['bones'][pb.name]['world']);pb.matrix=a.matrix_world.inverted()@C@new@rest.inverted()@C.inverted()@native[pb.name];bpy.context.view_layer.update()
 residual=max(((a.matrix_world@pb.head)-(C@fromthree(poses[key]['bones'][pb.name]['world'])).translation).length for pb in a.pose.bones)
 assert residual<.0001,residual
 checks[name]={'nativeVsRuntimeBoneHeadMaxMm':residual*1000}
 bpy.ops.wm.save_as_mainfile(filepath=str(out/(name+'.blend')));scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
(out/'native-render-checks.json').write_text(json.dumps(checks,indent=2));print(json.dumps(checks),flush=True);os._exit(0)
