"""Add opt-in IK controls while retaining the verified FK animation actions."""
import json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector,Matrix
folder=Path(sys.argv[1]).resolve()
bpy.ops.wm.open_mainfile(filepath=str(folder/'astrid-animated.blend'))
scene=bpy.context.scene;scene.frame_end=max(s['frame'] for s in json.loads((folder/'motion-samples.json').read_text())['samples']);scene.frame_set(1)
arm=next(o for o in scene.objects if o.type=='ARMATURE')
collection=bpy.data.collections['DEALER_CONTROLS']
def obj(name,location):
    o=bpy.data.objects.get(name)
    if o is None:o=bpy.data.objects.new(name,None);collection.objects.link(o)
    o.location=location;o.empty_display_type='CIRCLE';o.empty_display_size=.075;o.show_in_front=True
    return o
def world_head(name):return arm.matrix_world@arm.pose.bones[name].head
def drive(c,control):
    control['IK']=0.0;control.id_properties_ui('IK').update(min=0,max=1,description='0 plays baked FK actions; 1 enables this editable IK control')
    f=c.driver_add('influence');v=f.driver.variables.new();v.name='ik';v.targets[0].id=control;v.targets[0].data_path='["IK"]';f.driver.expression='ik'
results=[]
for side in ['Left','Right']:
    for kind,upper,lower,end in [('WRIST',side+'Arm',side+'ForeArm',side+'Hand'),('FOOT',side+'UpLeg',side+'Leg',side+'Foot')]:
        target=obj('CTRL_'+side.upper()+'_'+kind,world_head(end));target.rotation_mode='QUATERNION';target.rotation_quaternion=(arm.matrix_world@arm.pose.bones[end].matrix).to_quaternion()
        a,b,c=world_head(upper),world_head(lower),world_head(end);direction=(c-a).normalized();bend=(b-a)-direction*(b-a).dot(direction)
        if bend.length<1e-5:bend=Vector((0,-1,0))
        pole=obj('CTRL_'+side.upper()+('_ELBOW' if kind=='WRIST' else '_KNEE'),b+bend.normalized()*.25)
        constraints=arm.pose.bones[lower].constraints
        for old in list(constraints):
            if old.type=='IK':constraints.remove(old)
        ik=constraints.new('IK');ik.name='Dealer '+kind+' IK';ik.target=target;ik.pole_target=pole;ik.chain_count=2;ik.use_stretch=False
        # Solve pole roll against the current authored elbow/knee, then preserve FK.
        best=(float('inf'),0)
        for n in range(72):
            angle=-math.pi+n*math.tau/72;ik.pole_angle=angle;bpy.context.view_layer.update()
            error=(world_head(lower)-b).length
            if error<best[0]:best=(error,angle)
        ik.pole_angle=best[1]
        bpy.context.view_layer.update()
        baseline=(world_head(end)-target.location).length
        target.location+=Vector((0,-.005,.005));bpy.context.view_layer.update();moved=(world_head(end)-target.location).length
        target.location-=Vector((0,-.005,.005));drive(ik,target)
        rotation=arm.pose.bones[end].constraints.new('COPY_ROTATION');rotation.name='Dealer '+kind+' orientation';rotation.target=target;rotation.target_space='WORLD';rotation.owner_space='WORLD';drive(rotation,target)
        results.append({'control':target.name,'restTargetErrorMm':baseline*1000,'movedTargetErrorMm':moved*1000,'default':'FK; set IK to1 to move this target'})
        bpy.context.view_layer.update()
world=arm.matrix_world.copy()
body=bpy.data.objects['CTRL_BODY'];body.location=(0,0,0);body.empty_display_size=.22
bpy.context.view_layer.update()
arm.parent=body;arm.matrix_parent_inverse=Matrix.Identity(4);arm.matrix_world=world
bpy.context.view_layer.update()
body['purpose']='Global body/root transform. Foot and wrist controls remain world-space when IK is enabled.'
head=obj('CTRL_HEAD_ROTATION',world_head('Head'));head.rotation_mode='QUATERNION';head.rotation_quaternion=(arm.matrix_world@arm.pose.bones['Head'].matrix).to_quaternion()
rotation=arm.pose.bones['Head'].constraints.new('COPY_ROTATION');rotation.name='Editable head orientation';rotation.target=head;rotation.target_space='WORLD';rotation.owner_space='WORLD';drive(rotation,head)
look=bpy.data.objects.get('CTRL_LOOK')
if look:bpy.data.objects.remove(look,do_unlink=True)
scene['control_help']='CTRL_BODY moves root. CTRL_LEFT/RIGHT_WRIST and FOOT have IK blend0..1;0 retains baked actions. Elbow/knee poles control bend. CTRL_HEAD_ROTATION IK1 enables head rotation. Finger FK bones named Left/Right Thumb/Index/Middle/Ring/Pinky1..3. No eye or facial deformation rig.'
# Validate the final native project, after parenting/constraints, against authored world positions.
samples=json.loads((folder/'motion-samples.json').read_text());native=[];selected=arm.animation_data.action
for specification in samples['actions']:
    action=bpy.data.actions[specification['name']];arm.animation_data.action=action
    if action.slots:arm.animation_data.action_slot=action.slots[0]
    frames=[s for s in samples['samples'] if s['action']==action.name];worst=0
    for fraction in [0,.38,.66,1]:
        sample=frames[round(fraction*(len(frames)-1))];scene.frame_set(sample['frame']);bpy.context.view_layer.update()
        for name,values in sample['bones'].items():
            wanted=Vector((values[12],-values[14],values[13]));actual=world_head(name);worst=max(worst,(actual-wanted).length)
    native.append({'action':action.name,'maxNativeJointPositionErrorMm':worst*1000})
if max(r['maxNativeJointPositionErrorMm'] for r in native)>1:raise RuntimeError(f'Native world position verification failed: {native}')
arm.animation_data.action=selected
if selected.slots:arm.animation_data.action_slot=selected.slots[0]
scene.frame_set(1);bpy.context.view_layer.update()
(folder/'native-verification.json').write_text(json.dumps(native,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(folder/'astrid-animated.blend'))
(folder/'control-verification.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results,indent=2))
