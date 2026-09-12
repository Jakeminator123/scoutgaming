import bpy, math, os
from pathlib import Path
from mathutils import Vector
out=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(out/'astrid-surface-repair.blend'))
mesh=next(o for o in bpy.data.objects if o.type=='MESH')
points=[mesh.matrix_world@v.co for v in mesh.data.vertices]
lo=Vector([min(p[k] for p in points) for k in range(3)])
hi=Vector([max(p[k] for p in points) for k in range(3)])
height=hi.z-lo.z;centre=(lo+hi)/2
scene=bpy.context.scene
world=bpy.data.worlds.new('Neutral review');world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.16,.16,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.4;scene.world=world
for name,offset,power in [('Key',(.8,-.55,.8),35),('Fill',(.6,.6,.45),17),('Rim',(-.5,.3,.75),25)]:
    light=bpy.data.objects.new(name,bpy.data.lights.new(name,'AREA'));scene.collection.objects.link(light)
    light.location=centre+Vector(offset)*height;light.data.energy=power*(height/1.73)**2
    light.data.shape='DISK';light.data.size=height*.7
    light.rotation_euler=(centre-light.location).to_track_quat('-Z','Y').to_euler()
camera=bpy.data.objects.new('Review',bpy.data.cameras.new('Review'));scene.collection.objects.link(camera)
camera.data.type='ORTHO';camera.data.ortho_scale=height*1.10
forward=mesh.matrix_world.to_3x3()@Vector((1,0,0));forward.z=0;forward.normalize()
camera.location=centre+forward*height*2
camera.rotation_euler=(centre-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=6
scene.render.resolution_x=scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(out/'front.png')
bpy.ops.render.render(write_still=True)
print('Rendered',flush=True);os._exit(0)
