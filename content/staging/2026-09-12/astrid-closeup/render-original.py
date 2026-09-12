"""Render the untouched imported source from four angles; never deform the mesh."""
from pathlib import Path
import bpy, math, json, os, sys
from mathutils import Vector

root=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(root/'native-source/candidate-packed.blend'))
scene=bpy.context.scene
pts=[o.matrix_world@v.co for o in scene.objects if o.type=='MESH' for v in o.data.vertices]
lo=Vector([min(p[i] for p in pts) for i in range(3)])
hi=Vector([max(p[i] for p in pts) for i in range(3)])
center=(lo+hi)/2; height=hi.z-lo.z
world=bpy.data.worlds.new('Neutral studio'); world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.24,.24,.24,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.3; scene.world=world
def aim(obj,p): obj.rotation_euler=(p-obj.location).to_track_quat('-Z','Y').to_euler()
lights=[]
for name,offset,energy,size in [('Key',(-.65,-1,1.0),15,1.25),('Fill',(.8,-.7,.4),7,1.5),('Rim',(.4,.7,1),10,1.0)]:
    data=bpy.data.lights.new(name,'AREA'); data.energy=energy*height**2; data.shape='DISK'; data.size=size*height
    obj=bpy.data.objects.new(name,data); scene.collection.objects.link(obj); lights.append((obj,Vector(offset)*height))
cam=bpy.data.objects.new('Inspection camera',bpy.data.cameras.new('Inspection camera'));scene.collection.objects.link(cam);scene.camera=cam
cam.data.type='ORTHO';cam.data.ortho_scale=height*1.1;cam.data.clip_start=.001;cam.data.clip_end=20
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=6
scene.render.resolution_x=800;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
out=root/'original-renders-neutral';out.mkdir(exist_ok=True)
for angle in [0,60,90]:
    a=math.radians(angle);front=Vector((math.sin(a),-math.cos(a),0));right=Vector((math.cos(a),math.sin(a),0))
    cam.location=center+front*height*3;aim(cam,center)
    for lamp,offset in lights:
        lamp.location=center+right*offset.x-front*offset.y+Vector((0,0,offset.z));aim(lamp,center)
    scene.render.filepath=str(out/f'angle-{angle}.png');bpy.ops.render.render(write_still=True)
    print('rendered',angle,flush=True)
(out/'scene.json').write_text(json.dumps({'source':'../provider-original.glb','native':'../native-source/candidate-packed.blend','bounds':[list(lo),list(hi)],'projection':'orthographic','samples':24,'angles':[0,60,90],'keyPowerPerSquareMetre':15,'worldStrength':.3,'meshEdits':False,'materialsEdited':False,'note':'Earlier original-renders studio was overexposed; retain those frames for diagnosis, use these exposure-corrected frames for assessment.'},indent=2))
sys.stdout.flush();os._exit(0)
