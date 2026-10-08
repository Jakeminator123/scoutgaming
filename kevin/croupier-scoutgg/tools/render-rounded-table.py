# Render the approved Variant B scene without baked UI or actor. Source blend is read-only.
import bpy, sys
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:]
scene=bpy.context.scene
for obj in bpy.data.objects:
    if obj.name.startswith(('Box_', 'Rule ', 'Rules Arc', 'ShoePart_')) or 'Astrid reference' in obj.name:
        obj.hide_render=True
scene.render.resolution_x=780
scene.render.resolution_y=1688
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.filepath=args[0]
if hasattr(scene,'cycles'):
    scene.cycles.samples=32
    scene.cycles.use_denoising=True
bpy.ops.render.render(write_still=True)
