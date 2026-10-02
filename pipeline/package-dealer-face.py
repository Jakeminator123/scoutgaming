"""Pack and reopen the anatomical dealer's editable source deliverables."""
import bpy, json, hashlib, shutil, struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'media/dealers/astrid/staging/2026-09-10/astrid-head-v2'
DEST = ROOT / 'media/dealers/astrid/source/3d/anatomical'
DEST.mkdir(parents=True, exist_ok=True)
projects = {
    'astrid-face-source.blend': SOURCE / 'astrid-face-groomed.blend',
    'astrid-rigged.blend': SOURCE / 'combined/astrid-rigged.blend',
    'astrid-animated.blend': SOURCE / 'combined/astrid-animated.blend',
    'astrid-goodluck.blend': SOURCE / 'combined/astrid-goodluck.blend',
}
report = {'status': 'editable technical delivery; visual acceptance remains open', 'blender': bpy.app.version_string, 'projects': {}}
for name, source in projects.items():
    bpy.ops.wm.open_mainfile(filepath=str(source))
    if name == 'astrid-animated.blend':
        legacy = bpy.data.actions.get('Armature|clip0|baselayer')
        if legacy:
            for obj in bpy.context.scene.objects:
                if not obj.animation_data: continue
                for track in list(obj.animation_data.nla_tracks):
                    if any(strip.action == legacy for strip in track.strips): obj.animation_data.nla_tracks.remove(track)
            bpy.data.actions.remove(legacy)
    bpy.ops.file.pack_all()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(DEST / name), compress=True)
    bpy.ops.wm.open_mainfile(filepath=str(DEST / name))
    images = [im for im in bpy.data.images if im.source == 'FILE' and im.users]
    if any(not im.packed_file for im in images):
        raise ValueError(f'{name}: unpacked material image')
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    report['projects'][name] = {
        'sha256': hashlib.sha256((DEST / name).read_bytes()).hexdigest(),
        'bytes': (DEST / name).stat().st_size,
        'meshes': len(meshes), 'packedImages': len(images),
        'shapeKeys': {o.name: len(o.data.shape_keys.key_blocks)-1 for o in meshes if o.data.shape_keys},
        'actions': [a.name for a in bpy.data.actions],
        'controls': [o.name for o in bpy.context.scene.objects if o.name.startswith('CTRL_')],
    }
for name in ['astrid-animated.glb', 'astrid-goodluck.glb', 'attachment-verification.json', 'native-verification.json', 'control-verification.json', 'export-verification.json', 'facial-native-verification.json', 'neck-verification.json', 'motion-samples.json', 'motion-metrics.json', 'profile.json']:
    shutil.copyfile(SOURCE / 'combined' / name, DEST / name)
# Omit only the generated source's unrequested baseline clip, preserving all
# authored animation buffers, mesh data and embedded material images exactly.
path = DEST / 'astrid-animated.glb'
raw = path.read_bytes(); chunks = []; offset = 12
while offset < len(raw):
    size, kind = struct.unpack_from('<II', raw, offset)
    chunks.append((kind, raw[offset+8:offset+8+size])); offset += 8+size
document = json.loads(chunks[0][1])
document['animations'] = [a for a in document['animations'] if a['name'] != 'Armature|clip0|baselayer']
if len(document['animations']) != 12: raise ValueError('Expected twelve authored body actions')
encoded = json.dumps(document, separators=(',', ':')).encode(); encoded += b' '*((-len(encoded))%4)
chunks[0] = (chunks[0][0], encoded)
payload = b''.join(struct.pack('<II',len(data),kind)+data for kind,data in chunks)
path.write_bytes(struct.pack('<III',0x46546c67,2,12+len(payload))+payload)
shutil.copyfile(SOURCE / 'vendor/makehuman/LICENSE.ASSETS.md', DEST / 'LICENSE-MAKEHUMAN-ASSETS.md')
receipt = json.loads((SOURCE / 'texture-job.json').read_text())
(DEST / 'reference-job.json').write_text(json.dumps({key: receipt[key] for key in ['id', 'created_at', 'display_name', 'job_type', 'status']}, indent=2))
(DEST / 'delivery-verification.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
