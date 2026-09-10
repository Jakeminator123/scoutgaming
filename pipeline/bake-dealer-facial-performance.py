"""Save a source-clock facial performance in an editable, packed Blender project.
Body studies remain available, while this timeline plays only the measured face.
"""
import bpy,json,sys,hashlib
from pathlib import Path
folder=Path(sys.argv[1]).resolve();data=json.loads((folder/'facial-keyframes.json').read_text());root=Path(__file__).resolve().parents[1]
if hashlib.sha256((root/data['source']).read_bytes()).hexdigest()!=data['sourceHash']:raise ValueError('Facial performance no longer matches source video')
bpy.ops.wm.open_mainfile(filepath=str(folder/'astrid-animated.blend'));scene=bpy.context.scene
arm=next(o for o in scene.objects if o.type=='ARMATURE');scene.frame_set(1);arm.animation_data.action=None
for track in list(arm.animation_data.nla_tracks):arm.animation_data.nla_tracks.remove(track)
actions=[]
for obj in scene.objects:
 if obj.type!='MESH' or not obj.data.shape_keys:continue
 keys=obj.data.shape_keys;keys.animation_data_create();action=bpy.data.actions.new('Speech_Goodluck_'+obj.name);action.use_fake_user=True;keys.animation_data.action=action
 for frame in data['frames']:
  for name,value in frame['weights'].items():
   block=keys.key_blocks.get(name)
   if block:block.value=value;block.keyframe_insert('value',frame=frame['frame'],group=name)
 for name in data['frames'][0]['weights']:
  block=keys.key_blocks.get(name)
  if block:block.value=0;block.keyframe_insert('value',frame=1+data['duration']*data['fps'],group=name)
 for layer in action.layers:
  for strip in layer.strips:
   for bag in strip.channelbags:
    for curve in bag.fcurves:
     for key in curve.keyframe_points:key.interpolation='LINEAR'
 track=keys.animation_data.nla_tracks.new();track.name='Speech_Goodluck';track.strips.new(action.name,1,action);keys.animation_data.action=None;actions.append(action.name)
scene.render.fps=round(data['fps']);scene.render.fps_base=scene.render.fps/data['fps'];scene.frame_start=1;scene.frame_end=1+round(data['duration']*data['fps']);scene.frame_set(1)
editor=scene.sequence_editor_create();strip=editor.sequences.new_sound('Original Goodluck Audio',str(folder/'goodluck.wav'),1,1);strip.sound.pack()
scene['facial_performance']='Bets are closed. Good luck at my table. Measured from the original source video. Source-clock motion; visual phoneme acceptance remains open.'
scene['facial_source_sha256']=data['sourceHash'];scene['animation_status']='This timeline is the measured Goodluck facial performance. Twelve body actions remain separately editable.'
bpy.ops.wm.save_as_mainfile(filepath=str(folder/'astrid-goodluck.blend'))
bpy.ops.export_scene.gltf(filepath=str(folder/'astrid-goodluck.glb'),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_morph=True,export_morph_normal=True,export_skins=True,export_materials='EXPORT',export_extras=True,export_cameras=False,export_lights=False)
(folder/'facial-native-verification.json').write_text(json.dumps({'sourceHash':data['sourceHash'],'sourceFrames':len(data['frames']),'fps':data['fps'],'duration':data['duration'],'actions':actions,'audioPacked':bool(strip.sound.packed_file),'status':'baked; rendered speech review still required'},indent=2))
