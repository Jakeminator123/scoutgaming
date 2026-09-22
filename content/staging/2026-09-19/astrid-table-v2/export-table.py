import bpy, json, hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

out=Path(__file__).parent
public=out.parents[3]/'web/public/review/astrid-table-v2'
public.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene
camera=scene.camera
assert camera and camera.name=='PlateCam'

def point_record(world):
    p=world_to_camera_view(scene,camera,world)
    return {'worldBlender':list(world),'worldGLTF':[world.x,world.z,-world.y],
            'uv':[p.x,1-p.y]}

shoe=bpy.data.objects['PRP_Shoe']
vs=[v.co for v in shoe.data.vertices]
mins=[min(v[i] for v in vs) for i in range(3)]
maxs=[max(v[i] for v in vs) for i in range(3)]
# Local Y is the shoe's length. The front opening is at its minimum Y.
outletLocal=Vector(((mins[0]+maxs[0])/2,mins[1],mins[2]+.007))
outlet=point_record(shoe.matrix_world@outletLocal)
felt=bpy.data.objects['HERO_TableFelt']
bounds=[felt.matrix_world@Vector(corner) for corner in felt.bound_box]
feltBounds=[[min(p[i] for p in bounds),max(p[i] for p in bounds)] for i in range(3)]
card=bpy.data.objects['PRP_Card']
anchors={'outlet':outlet,'dealerCard':point_record(card.matrix_world@Vector((0,0,0))),
         'feltBoundsBlender':feltBounds,'shoeLocalBounds':[mins,maxs],
         'shoeOutletLocal':list(outletLocal)}

# Export a derivative; never save over the user's .blend. The prop card is a
# camera reference only. The game alone supplies authoritative card identities.
bpy.ops.object.select_all(action='DESELECT')
for obj in scene.objects:
    obj.select_set(obj.name!='PRP_Card')
bpy.ops.export_scene.gltf(filepath=str(public/'table.glb'),export_format='GLB',
    use_selection=True,export_cameras=True,export_lights=False,export_animations=False,
    export_apply=True,export_yup=True)
receipt={'source':bpy.data.filepath,'sourceSha256':hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),
         'reference':'assets/astrid-3d/greenscreen/blackjack-camera-reference.jpg',
         'sourceResolution':[scene.render.resolution_x,scene.render.resolution_y],
         'camera':'PlateCam','excluded':['PRP_Card'],'anchors':anchors,
         'tableSha256':hashlib.sha256((public/'table.glb').read_bytes()).hexdigest()}
(out/'export-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
(public/'registration.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt))
