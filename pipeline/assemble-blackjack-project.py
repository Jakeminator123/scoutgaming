"""Combine the editable table and actual rig; preserve source files separately."""
import bpy,json,math,shutil
from pathlib import Path
from mathutils import Vector
REPO=Path(__file__).resolve().parents[1]
OUT=REPO/'assets/blackjack-3d';DELIVERY=OUT/'editable-project';DELIVERY.mkdir(exist_ok=True)
def p(v):return(v[0],-v[2],v[1])
dealer=REPO/'assets/astrid-3d/astrid-animated.blend'
assert dealer.exists(),'Wait for the verified dealer bake before assembly'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'blackjack-table-optimized.blend'))
scene=bpy.context.scene
existing=set(bpy.data.objects)
with bpy.data.libraries.load(str(dealer),link=False) as (source,dest):
    dest.objects=source.objects;dest.actions=source.actions
added=[]
for obj in dest.objects:
    if obj is None or obj in existing:continue
    if obj.type in {'CAMERA','LIGHT'}:continue
    if obj.name not in scene.objects:scene.collection.objects.link(obj)
    added.append(obj)
templates=bpy.data.objects.get('Prop_Templates')
if templates:
    for obj in (templates,*templates.children_recursive):obj.hide_render=True
motion=json.loads((REPO/'assets/astrid-3d/motion-samples.json').read_text())
arm=next(o for o in added if o.type=='ARMATURE')
arm.animation_data_create();arm.animation_data.action=None;arm.animation_data.use_nla=True
for track in list(arm.animation_data.nla_tracks):arm.animation_data.nla_tracks.remove(track)
track=arm.animation_data.nla_tracks.new();track.name='Review all twelve studies'
template=bpy.data.objects['Card_Template']
bpy.ops.object.select_all(action='DESELECT');parts=[]
for original in template.children:
    part=original.copy();part.data=original.data.copy();part.parent=None
    part.matrix_world=original.matrix_local.copy();part.hide_render=False
    scene.collection.objects.link(part);part.select_set(True);parts.append(part)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
card=bpy.context.object;card.name='Review_Card_Contact_Helper';card.animation_data_clear()
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
card['purpose']='Editable contact-study helper. Actual game cards are issued by the server.'
card.animation_data_create();card_track=card.animation_data.nla_tracks.new();card_track.name='Matched card transforms'
timeline=[];start=1
for info in motion['actions']:
    action=bpy.data.actions.get(info['name'])
    assert action,f"Missing baked action {info['name']}"
    samples=[s for s in motion['samples'] if s['action']==info['name']]
    end=max(s['frame'] for s in samples)
    strip=track.strips.new(info['name'],start,action);strip.extrapolation='NOTHING'
    strip.influence=1;strip.use_animated_influence=False;strip.blend_in=strip.blend_out=0
    strip.action_frame_start=1;strip.action_frame_end=end
    card.animation_data.action=bpy.data.actions.new(info['name']+'_Card')
    for sample in samples:
        frame=sample['frame'];card.location=p(sample.get('card') or (0,.911,.23))
        card.rotation_euler=(sample.get('cardPitch',0),0,sample.get('cardYaw',0))
        card.hide_render=card.hide_viewport=info['kind'] not in ('deal','reveal','collect') or (info['kind']=='deal' and sample['phase']=='pickup')
        for prop in ('location','rotation_euler','hide_render','hide_viewport'):card.keyframe_insert(data_path=prop,frame=frame)
    card_action=card.animation_data.action;card_action.use_fake_user=True;card.animation_data.action=None
    card_strip=card_track.strips.new(card_action.name,start,card_action);card_strip.extrapolation='NOTHING'
    card_strip.action_frame_start=1;card_strip.action_frame_end=end
    scene.timeline_markers.new(info['name'],frame=start)
    timeline.append({'action':info['name'],'start':start,'end':start+end-1})
    start+=end
scene.frame_start=1;scene.frame_end=start-1;scene.render.fps=motion['fps']
scene['acceptance']='CONTACT REVIEW CANDIDATE. Facial animation and remaining gameplay gestures incomplete.'
scene['source_files']='Detailed table and original generated dealer retained separately.'
scene['workflow']='Play the marked review timeline for all twelve studies and matched card transforms. Mute the review NLA track to edit an individual named Action. Optional target IK sliders default off to preserve the baked studies.'
scene['gameplay']='Existing Croupier backend owns cards, shoe, balances and settlement. This project contains presentation assets only.'
scene.render.resolution_x=1280;scene.render.resolution_y=900
scene.render.resolution_percentage=100;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.camera.location=p((0,1.85,2.65));scene.camera.rotation_euler=(Vector(p((0,1.02,.18)))-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.lens=36
preview_errors=[]
for entry in timeline:
    samples=[s for s in motion['samples'] if s['action']==entry['action']]
    for sample in (samples[0],samples[len(samples)//2],samples[-1]):
        scene.frame_set(entry['start']+sample['frame']-1);bpy.context.view_layer.update()
        head=arm.matrix_world@arm.pose.bones['Head'].head
        head_error=math.dist((head.x,head.z,-head.y),sample['bones']['Head'][12:15])
        card_error=math.dist(card.location,p(sample['card'])) if sample.get('card') else 0
        preview_errors.append({'action':entry['action'],'frame':scene.frame_current,'headMm':head_error*1000,'cardMm':card_error*1000})
        assert head_error<.001 and card_error<.001,f'Preview timeline calibration failed: {preview_errors[-1]}'
scene.frame_set(0);scene.frame_set(1);bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(DELIVERY/'astrid-blackjack-editable.blend'))
scene.render.filepath=str(DELIVERY/'scene-contact-review.png');bpy.ops.render.render(write_still=True)
result={'file':'astrid-blackjack-editable.blend','units':'metres','fps':30,'dealerObjects':[o.name for o in added],
 'actions':[a.name for a in bpy.data.actions], 'timeline':timeline,'previewRegistrationChecks':preview_errors,
 'armatures':[{ 'name':o.name,'bones':len(o.data.bones),'constraints':sum(len(b.constraints) for b in o.pose.bones)} for o in added if o.type=='ARMATURE'],
 'meshes':sum(o.type=='MESH' for o in scene.objects),
 'limitations':['Facial blendshapes and phoneme/lip synchronization are absent.','Only the named exported actions listed here are delivered; no implied gesture support.','Contact study requires final rendered mesh collision and full-round QA; numerical joint checks alone do not approve it.']}
(DELIVERY/'project-inspection.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result))
