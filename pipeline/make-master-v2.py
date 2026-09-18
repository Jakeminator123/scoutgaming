#!/usr/bin/env python3
"""Master v2: keep the Tripo-generated Astrid (the one with a real face and hair)
and drop the MakeHuman head swap from v1. The table scene already carries the
Tripo character, so this only fixes the file to open ready to look at:
material shading, camera view, seat-3 deal loaded on both rig and card.
Lip-sync shape keys live on the anatomical head and are deliberately not used here.
"""
import bpy, sys
out = sys.argv[sys.argv.index('--') + 1]
arm = bpy.data.objects['Armature']
arm.animation_data_create()
arm.animation_data.action = bpy.data.actions['Deal_Seat_03_Contact_Study']
card = bpy.data.objects.get('Card_Template')
if card:
    card.animation_data_create()
    card.animation_data.action = bpy.data.actions.get('Deal_Seat_03_Contact_Study_Card')
bpy.context.scene.frame_set(1)
bpy.context.scene.camera = bpy.data.objects.get('Player seated lens') or bpy.context.scene.camera
# Open looking at the render, not at grey solid shading.
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type != 'VIEW_3D':
            continue
        for space in area.spaces:
            if space.type != 'VIEW_3D':
                continue
            space.shading.type = 'MATERIAL'
            space.overlay.show_overlays = False
            if space.region_3d:
                space.region_3d.view_perspective = 'CAMERA'
body = bpy.data.objects.get('char1')
print('MASTER2-OK char1_verts=%s mats=%s camera=%s' % (
    len(body.data.vertices) if body else None,
    [m.name for m in body.data.materials if m] if body else None,
    bpy.context.scene.camera.name))
bpy.ops.wm.save_as_mainfile(filepath=out)
