"""Transfer a reviewed groom into an editable rig without changing its actions."""
import bpy, sys, json, hashlib
from pathlib import Path
source, study, output = map(lambda p: Path(p).resolve(), sys.argv[1:4])
bpy.ops.wm.open_mainfile(filepath=str(source))
bpy.context.preferences.filepaths.save_version = 0
protected = ['char1', 'Astrid_Face', 'Astrid_Eyes', 'Astrid_Teeth', 'Astrid_Tongue', 'Astrid_Eyelashes']
def mesh_signature(obj):
    values = [tuple(v.co) for v in obj.data.vertices]
    keys = [(k.name, [tuple(v.co) for v in k.data]) for k in obj.data.shape_keys.key_blocks] if obj.data.shape_keys else []
    weights = [[(g.group, g.weight) for g in v.groups] for v in obj.data.vertices]
    return hashlib.sha256(repr((values, keys, [tuple(p.vertices) for p in obj.data.polygons], weights)).encode()).hexdigest()
def action_signature(action):
    curves = [c for layer in action.layers for strip in layer.strips for bag in strip.channelbags for c in bag.fcurves]
    return hashlib.sha256(repr([(c.data_path,c.array_index,[(tuple(k.co),tuple(k.handle_left),tuple(k.handle_right),k.interpolation) for k in c.keyframe_points]) for c in curves]).encode()).hexdigest()
before = {name: mesh_signature(bpy.data.objects[name]) for name in protected}
actions = [(a, action_signature(a)) for a in bpy.data.actions]
original_objects = set(bpy.data.objects)
arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
old_cap = bpy.data.objects['Astrid_Hair']; world = old_cap.matrix_world.copy()
names = ['Astrid_Hair', 'Astrid_Hair_Fibers', 'Astrid_Hair_Bun_Core', 'SOURCE_Continuous_Swept_Groom', 'Astrid_Face']
with bpy.data.libraries.load(str(study), link=False) as (available, loaded):
    assert all(name in available.objects for name in names)
    loaded.objects = list(names)
incoming = dict(zip(names, loaded.objects))
face = bpy.data.objects['Astrid_Face']; study_face = incoming.pop('Astrid_Face')
assert mesh_signature(face) == mesh_signature(study_face), 'Study face differs geometrically'
face.material_slots[0].link = 'DATA'; face.data.materials[0] = study_face.material_slots[0].material
mask_name = 'PosteriorAtlasCorrection'
if mask_name in face.data.color_attributes:
    face.data.color_attributes.remove(face.data.color_attributes[mask_name])
mask = face.data.color_attributes.new(name=mask_name, type='FLOAT_COLOR', domain='POINT')
for a, b in zip(mask.data, study_face.data.color_attributes[mask_name].data):
    a.color = b.color
for name, obj in incoming.items():
    old = bpy.data.objects.get(name)
    if old is not None and old != obj:
        bpy.data.objects.remove(old, do_unlink=True)
    obj.name = name; bpy.context.scene.collection.objects.link(obj)
    obj.parent = arm
    if obj.type == 'CURVE':
        obj.parent_type = 'BONE'; obj.parent_bone = 'Head'; obj.hide_render = True; obj.hide_set(True)
    else:
        obj.parent_type = 'OBJECT'
        for modifier in obj.modifiers:
            if modifier.type == 'ARMATURE': modifier.object = arm
    bpy.context.view_layer.update(); obj.matrix_world = world.copy()
keep = set(incoming.values())
for obj in list(bpy.data.objects):
    if obj not in original_objects and obj not in keep:
        bpy.data.objects.remove(obj, do_unlink=True)
assert before == {name: mesh_signature(bpy.data.objects[name]) for name in protected}
assert all(action_signature(action) == digest for action, digest in actions), 'Existing animation changed'
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.file.pack_all(); bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
report = {'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(), 'studySha256':hashlib.sha256(study.read_bytes()).hexdigest(), 'outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(), 'protectedMeshes':before, 'preservedActions':{a.name:digest for a,digest in actions}, 'status':'isolated native transfer; attachment and visual verification required'}
output.with_suffix('.hair-verification.json').write_text(json.dumps(report, indent=2))
print(json.dumps({'output':str(output),'actions':list(report['preservedActions'])}))
