import bpy, json, os
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

out = Path(__file__).parent
scene = bpy.context.scene
camera = scene.camera
objects = []
for obj in scene.objects:
    record = {'name':obj.name, 'type':obj.type, 'hidden_render':obj.hide_render,
              'location':list(obj.location), 'rotation':list(obj.rotation_euler),
              'scale':list(obj.scale), 'matrix_world':[list(row) for row in obj.matrix_world],
              'dimensions':list(obj.dimensions), 'materials':[m.name if m else None for m in getattr(obj.data,'materials',[])]}
    if obj.type == 'MESH':
        points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
        record['vertices'] = len(obj.data.vertices)
        record['bounds_world'] = [list(point) for point in points]
        if camera:
            record['bounds_camera'] = [list(world_to_camera_view(scene,camera,point)) for point in points]
    if obj.type == 'CAMERA':
        record['camera'] = {key:getattr(obj.data,key) for key in ['type','lens','sensor_width','sensor_height','sensor_fit','shift_x','shift_y','ortho_scale','clip_start','clip_end']}
    objects.append(record)
report = {'file':bpy.data.filepath, 'scene':scene.name, 'camera':camera.name if camera else None,
          'render':{key:getattr(scene.render,key) for key in ['resolution_x','resolution_y','resolution_percentage','pixel_aspect_x','pixel_aspect_y','film_transparent','engine']},
          'view':{'transform':scene.view_settings.view_transform,'look':scene.view_settings.look,'exposure':scene.view_settings.exposure},
          'objects':objects,
          'images':[{'name':im.name,'path':im.filepath,'absolute':bpy.path.abspath(im.filepath),'packed':bool(im.packed_file),'size':list(im.size),'exists':os.path.isfile(bpy.path.abspath(im.filepath))} for im in bpy.data.images],
          'materials':[{'name':m.name,'diffuse':list(m.diffuse_color),'nodes':[{'name':n.name,'type':n.type,'image':n.image.name if getattr(n,'image',None) else None} for n in m.node_tree.nodes] if m.node_tree else []} for m in bpy.data.materials]}
(out/'inspection.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'scene':report['scene'],'camera':report['camera'],'render':report['render'],'objects':[(o['name'],o['type']) for o in objects],'images':report['images']}))
