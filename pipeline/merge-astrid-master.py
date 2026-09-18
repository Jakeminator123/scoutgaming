#!/usr/bin/env python3
"""Merge the anatomical Astrid (face, hair, eyes, lipsync shape keys) into the
blackjack table scene (table, shoe, cards, chips, room, camera, deal actions).

Both files share one rig lineage: identical bone names and world placement
(Head and RightHand land on the same world coordinates), the anatomical rig
just adds EyeLeft/EyeRight. So the anatomical character can replace the table
scene's placeholder body without moving any prop.

Run: blender -b <table.blend> -P merge-astrid-master.py -- <anatomical.blend> <out.blend>
"""
import bpy, sys, os

src, out = sys.argv[sys.argv.index('--') + 1:][:2]
CHAR = ['Armature', 'char1', 'Astrid_Face', 'Astrid_Eyes', 'Astrid_Teeth', 'Astrid_Tongue',
        'Astrid_Eyelashes', 'Astrid_Hair', 'Astrid_Hair_Fibers']

# 1. Remember the placeholder character, then rename it out of the way so the
#    appended objects keep their original names instead of getting .001 suffixes.
old = {n: bpy.data.objects.get(n) for n in ('Armature', 'char1')}
actions = {a.name: a for a in bpy.data.actions}
for n, o in old.items():
    if o: o.name = 'OLD_' + n
for a in bpy.data.actions: a.use_fake_user = True   # keep deal/card actions alive

# 2. Append the anatomical character.
appended = []
for name in CHAR:
    before = set(bpy.data.objects)
    try:
        bpy.ops.wm.append(filepath=os.path.join(src, 'Object', name),
                          directory=os.path.join(src, 'Object'), filename=name)
    except RuntimeError as e:
        print('SKIP', name, e); continue
    appended += [o for o in bpy.data.objects if o not in before]
arm = bpy.data.objects.get('Armature')
if arm is None or arm.type != 'ARMATURE':
    raise SystemExit('MERGE-FAIL: anatomical Armature did not append')

# 3. Point every appended mesh at the appended armature (parent + modifier),
#    so nothing still references the placeholder rig.
for o in appended:
    if o.type != 'MESH': continue
    if o.parent is not None and o.parent.type == 'ARMATURE': o.parent = arm
    for m in o.modifiers:
        if m.type == 'ARMATURE': m.object = arm

# 4. Drop the placeholder body and rig.
for o in (old.get('Armature'), old.get('char1')):
    if o: bpy.data.objects.remove(o, do_unlink=True)

# 5. Re-attach the table scene's dealing actions to the merged rig; the bone
#    names are a subset of the anatomical rig, so they play unchanged.
arm.animation_data_create()
arm.animation_data.action = actions.get('Deal_Seat_03_Contact_Study') or arm.animation_data.action
card = bpy.data.objects.get('Card_Template')
if card:
    card.animation_data_create()
    card.animation_data.action = actions.get('Deal_Seat_03_Contact_Study_Card')

props = [o.name for o in bpy.data.objects if o.name.startswith(('Shoe_', 'Table', 'Card_', 'Chip_'))]
print('MERGE-OK objects=%d actions=%d props=%d meshes=%s' % (
    len(bpy.data.objects), len(bpy.data.actions), len(props),
    [o.name for o in appended if o.type == 'MESH']))
bpy.ops.wm.save_as_mainfile(filepath=out)
